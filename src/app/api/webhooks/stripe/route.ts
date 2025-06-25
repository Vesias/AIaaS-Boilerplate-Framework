import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { createDatabaseService } from '@/lib/database'

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(req: Request) {
  const body = await req.text()
  const signature = headers().get('stripe-signature')!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, endpointSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 })
  }

  console.log('Received Stripe webhook:', event.type)

  try {
    const db = await createDatabaseService()

    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session, db)
        break

      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription, db)
        break

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription, db)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription, db)
        break

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice, db)
        break

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice, db)
        break

      case 'invoice.created':
        await handleInvoiceCreated(event.data.object as Stripe.Invoice, db)
        break

      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent, db)
        break

      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent, db)
        break

      case 'customer.created':
        await handleCustomerCreated(event.data.object as Stripe.Customer, db)
        break

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Error processing webhook:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session, db: any) {
  const customerId = session.customer as string
  const userId = session.metadata?.userId

  if (!userId) {
    console.error('No userId found in checkout session metadata')
    return
  }

  try {
    // Update user profile with Stripe customer ID
    await db.updateProfile(userId, {
      stripe_customer_id: customerId
    })

    // If this is a subscription, it will be handled by the subscription.created event
    // If this is a one-time payment, handle it here
    if (session.mode === 'payment') {
      console.log('One-time payment completed for user:', userId)
      // Add any one-time payment logic here
    }

    console.log('Checkout session completed successfully for user:', userId)
  } catch (error) {
    console.error('Error handling checkout session completed:', error)
    throw error
  }
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription, db: any) {
  const customerId = subscription.customer as string
  const userId = subscription.metadata?.userId

  if (!userId) {
    // Try to find user by stripe_customer_id
    const profile = await db.getProfileByStripeCustomerId(customerId)
    if (!profile) {
      console.error('No user found for customer:', customerId)
      return
    }
  }

  const finalUserId = userId || customerId

  try {
    await db.createSubscription({
      user_id: finalUserId,
      stripe_subscription_id: subscription.id,
      stripe_price_id: subscription.items.data[0].price.id,
      status: subscription.status as any,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
      trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : undefined
    })

    // Update Clerk user metadata
    await updateClerkUserMetadata(finalUserId, {
      subscription: {
        status: subscription.status,
        priceId: subscription.items.data[0].price.id,
        currentPeriodEnd: subscription.current_period_end
      }
    })

    console.log('Subscription created successfully for user:', finalUserId)
  } catch (error) {
    console.error('Error handling subscription created:', error)
    throw error
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription, db: any) {
  try {
    await db.updateSubscription(subscription.id, {
      status: subscription.status as any,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
      trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : undefined
    })

    // Get user ID from subscription
    const subscriptionRecord = await db.getActiveSubscription(subscription.metadata?.userId || '')
    if (subscriptionRecord) {
      // Update Clerk user metadata
      await updateClerkUserMetadata(subscriptionRecord.user_id, {
        subscription: {
          status: subscription.status,
          priceId: subscription.items.data[0].price.id,
          currentPeriodEnd: subscription.current_period_end
        }
      })
    }

    console.log('Subscription updated successfully:', subscription.id)
  } catch (error) {
    console.error('Error handling subscription updated:', error)
    throw error
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription, db: any) {
  try {
    await db.updateSubscription(subscription.id, {
      status: 'canceled' as any,
      cancel_at_period_end: true
    })

    // Get user ID from subscription
    const subscriptionRecord = await db.getActiveSubscription(subscription.metadata?.userId || '')
    if (subscriptionRecord) {
      // Update Clerk user metadata
      await updateClerkUserMetadata(subscriptionRecord.user_id, {
        subscription: {
          status: 'canceled',
          priceId: null,
          currentPeriodEnd: subscription.current_period_end
        }
      })
    }

    console.log('Subscription deleted successfully:', subscription.id)
  } catch (error) {
    console.error('Error handling subscription deleted:', error)
    throw error
  }
}

async function handleInvoiceCreated(invoice: Stripe.Invoice, db: any) {
  const customerId = invoice.customer as string
  
  // Find user by customer ID
  const profile = await db.getProfileByStripeCustomerId(customerId)
  if (!profile) {
    console.error('No user found for customer:', customerId)
    return
  }

  try {
    await db.createInvoice({
      user_id: profile.id,
      stripe_invoice_id: invoice.id,
      invoice_number: invoice.number || `INV-${Date.now()}`,
      amount_paid: invoice.amount_paid || 0,
      amount_due: invoice.amount_due || 0,
      currency: invoice.currency || 'eur',
      status: invoice.status as any,
      hosted_invoice_url: invoice.hosted_invoice_url || undefined,
      invoice_pdf: invoice.invoice_pdf || undefined,
      line_items: invoice.lines?.data || []
    })

    console.log('Invoice created successfully:', invoice.id)
  } catch (error) {
    console.error('Error handling invoice created:', error)
    throw error
  }
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice, db: any) {
  const customerId = invoice.customer as string
  
  // Find user by customer ID
  const profile = await db.getProfileByStripeCustomerId(customerId)
  if (!profile) {
    console.error('No user found for customer:', customerId)
    return
  }

  try {
    // Update invoice status
    await db.updateInvoice(invoice.id, {
      status: 'paid' as any,
      amount_paid: invoice.amount_paid || 0
    })

    // If this is a subscription invoice, activate the subscription
    if (invoice.subscription) {
      const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string)
      await db.updateSubscription(subscription.id, {
        status: 'active' as any
      })

      // Update Clerk user metadata
      await updateClerkUserMetadata(profile.id, {
        subscription: {
          status: 'active',
          priceId: subscription.items.data[0].price.id,
          currentPeriodEnd: subscription.current_period_end
        }
      })
    }

    console.log('Invoice payment succeeded:', invoice.id)
  } catch (error) {
    console.error('Error handling invoice payment succeeded:', error)
    throw error
  }
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice, db: any) {
  const customerId = invoice.customer as string
  
  // Find user by customer ID
  const profile = await db.getProfileByStripeCustomerId(customerId)
  if (!profile) {
    console.error('No user found for customer:', customerId)
    return
  }

  try {
    // Update invoice status
    await db.updateInvoice(invoice.id, {
      status: 'uncollectible' as any
    })

    // If this is a subscription invoice, update subscription status
    if (invoice.subscription) {
      const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string)
      await db.updateSubscription(subscription.id, {
        status: 'past_due' as any
      })

      // Update Clerk user metadata
      await updateClerkUserMetadata(profile.id, {
        subscription: {
          status: 'past_due',
          priceId: subscription.items.data[0].price.id,
          currentPeriodEnd: subscription.current_period_end
        }
      })
    }

    // TODO: Send notification to user about failed payment
    // TODO: Implement dunning management
    
    console.log('Invoice payment failed:', invoice.id)
  } catch (error) {
    console.error('Error handling invoice payment failed:', error)
    throw error
  }
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent, db: any) {
  const customerId = paymentIntent.customer as string
  const userId = paymentIntent.metadata?.userId

  if (!userId && !customerId) {
    console.error('No user identifier found in payment intent')
    return
  }

  try {
    console.log('Payment intent succeeded:', paymentIntent.id)
    // Handle one-time payment success
    // This can be used for credits, upgrades, or other one-time purchases
  } catch (error) {
    console.error('Error handling payment intent succeeded:', error)
    throw error
  }
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent, db: any) {
  const customerId = paymentIntent.customer as string
  const userId = paymentIntent.metadata?.userId

  if (!userId && !customerId) {
    console.error('No user identifier found in payment intent')
    return
  }

  try {
    console.log('Payment intent failed:', paymentIntent.id)
    // TODO: Handle payment failure
    // TODO: Send notification to user
    // TODO: Implement retry logic
  } catch (error) {
    console.error('Error handling payment intent failed:', error)
    throw error
  }
}

async function handleCustomerCreated(customer: Stripe.Customer, db: any) {
  try {
    console.log('Customer created:', customer.id)
    // The customer will be linked to a user when they complete checkout
    // or when we create the customer programmatically
  } catch (error) {
    console.error('Error handling customer created:', error)
    throw error
  }
}

// Helper function to update Clerk user metadata
async function updateClerkUserMetadata(userId: string, metadata: any) {
  try {
    // This would require the Clerk Backend API
    // For now, we'll just log it
    console.log('Would update Clerk metadata for user:', userId, metadata)
    
    // TODO: Implement actual Clerk metadata update
    // const clerkClient = require('@clerk/clerk-sdk-node')
    // await clerkClient.users.updateUserMetadata(userId, { publicMetadata: metadata })
  } catch (error) {
    console.error('Error updating Clerk metadata:', error)
  }
}

