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
        
      case 'invoice.sent':
        await handleInvoiceSent(event.data.object as Stripe.Invoice, db)
        break
        
      case 'invoice.updated':
        await handleInvoiceUpdated(event.data.object as Stripe.Invoice, db)
        break
        
      case 'invoice.finalized':
        await handleInvoiceFinalized(event.data.object as Stripe.Invoice, db)
        break
        
      case 'invoice.voided':
        await handleInvoiceVoided(event.data.object as Stripe.Invoice, db)
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
    // Determine if this is a European transaction for VAT compliance
    const customer = await stripe.customers.retrieve(customerId)
    const customerCountry = customer.address?.country || 'US'
    const isEUCustomer = ['AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK'].includes(customerCountry)
    
    await db.createInvoice({
      user_id: profile.id,
      stripe_invoice_id: invoice.id,
      invoice_number: invoice.number || generateInvoiceNumber(),
      amount_paid: invoice.amount_paid || 0,
      amount_due: invoice.amount_due || 0,
      currency: invoice.currency || 'eur',
      status: invoice.status as any,
      hosted_invoice_url: invoice.hosted_invoice_url || undefined,
      invoice_pdf: invoice.invoice_pdf || undefined,
      line_items: invoice.lines?.data || [],
      metadata: {
        ...invoice.metadata,
        customer_country: customerCountry,
        is_eu_transaction: isEUCustomer,
        tax_compliance_checked: true
      }
    })

    // Send invoice email if configured
    if (invoice.status === 'open') {
      await sendInvoiceCreatedNotification(invoice, profile)
    }

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
      amount_paid: invoice.amount_paid || 0,
      paid_at: new Date().toISOString()
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

    // Send payment confirmation email
    await sendPaymentSuccessNotification(invoice, profile)
    
    // Generate and store receipt
    await generatePaymentReceipt(invoice, profile)
    
    // Update customer payment history for credit scoring
    await updateCustomerPaymentHistory(customerId, 'success')

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
    // Get current payment attempt count
    const currentInvoice = await db.getInvoiceByStripeId(invoice.id)
    const attemptCount = (currentInvoice?.payment_attempts || 0) + 1
    
    // Update invoice status based on attempts
    const newStatus = attemptCount >= 3 ? 'uncollectible' : 'past_due'
    
    await db.updateInvoice(invoice.id, {
      status: newStatus as any,
      payment_attempts: attemptCount,
      last_payment_error: invoice.last_finalization_error?.message || 'Payment failed'
    })

    // If this is a subscription invoice, update subscription status
    if (invoice.subscription) {
      const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string)
      
      // Pause subscription after multiple failures
      if (attemptCount >= 2) {
        await stripe.subscriptions.update(subscription.id, {
          pause_collection: {
            behavior: 'void'
          }
        })
      }
      
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

    // Send payment failure notification with escalation level
    await sendPaymentFailureNotification(invoice, profile, attemptCount)
    
    // Schedule automated payment retry if not max attempts
    if (attemptCount < 3) {
      await schedulePaymentRetry(invoice.id, attemptCount)
    }
    
    // Update customer payment history
    await updateCustomerPaymentHistory(customerId, 'failed')
    
    console.log(`Invoice payment failed (attempt ${attemptCount}):`, invoice.id)
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

// Generate unique invoice number
function generateInvoiceNumber(): string {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const timestamp = Date.now().toString().slice(-6)
  return `INV-${year}${month}-${timestamp}`
}

// Send invoice created notification
async function sendInvoiceCreatedNotification(invoice: Stripe.Invoice, profile: any) {
  try {
    // TODO: Implement email service integration
    console.log('Would send invoice created email to:', profile.email)
    
    // This would integrate with your email service (SendGrid, SES, etc.)
    // await emailService.sendInvoiceEmail({
    //   to: profile.email,
    //   invoice: invoice,
    //   template: 'invoice-created'
    // })
  } catch (error) {
    console.error('Error sending invoice notification:', error)
  }
}

// Send payment success notification
async function sendPaymentSuccessNotification(invoice: Stripe.Invoice, profile: any) {
  try {
    console.log('Would send payment success email to:', profile.email)
    
    // TODO: Implement payment confirmation email
    // await emailService.sendPaymentConfirmation({
    //   to: profile.email,
    //   invoice: invoice,
    //   amount: invoice.amount_paid,
    //   template: 'payment-received'
    // })
  } catch (error) {
    console.error('Error sending payment success notification:', error)
  }
}

// Send payment failure notification with escalation
async function sendPaymentFailureNotification(invoice: Stripe.Invoice, profile: any, attemptCount: number) {
  try {
    const escalationLevel = attemptCount >= 3 ? 3 : attemptCount >= 2 ? 2 : 1
    
    console.log(`Would send payment failure email (level ${escalationLevel}) to:`, profile.email)
    
    // TODO: Implement escalating payment reminder emails
    // await emailService.sendPaymentReminder({
    //   to: profile.email,
    //   invoice: invoice,
    //   escalationLevel: escalationLevel,
    //   template: 'payment-reminder'
    // })
  } catch (error) {
    console.error('Error sending payment failure notification:', error)
  }
}

// Generate and store payment receipt
async function generatePaymentReceipt(invoice: Stripe.Invoice, profile: any) {
  try {
    console.log('Would generate payment receipt for invoice:', invoice.id)
    
    // TODO: Generate PDF receipt and store in file system or cloud storage
    // const receiptPDF = await generateReceiptPDF(invoice, profile)
    // const receiptUrl = await uploadToStorage(receiptPDF, `receipts/receipt-${invoice.id}.pdf`)
    // 
    // // Update invoice record with receipt URL
    // await db.updateInvoice(invoice.id, {
    //   receipt_url: receiptUrl
    // })
  } catch (error) {
    console.error('Error generating payment receipt:', error)
  }
}

// Update customer payment history for analytics
async function updateCustomerPaymentHistory(customerId: string, status: 'success' | 'failed') {
  try {
    console.log(`Updating payment history for customer ${customerId}: ${status}`)
    
    // TODO: Implement customer analytics tracking
    // await analytics.track({
    //   event: 'payment_attempt',
    //   customerId: customerId,
    //   status: status,
    //   timestamp: new Date().toISOString()
    // })
  } catch (error) {
    console.error('Error updating customer payment history:', error)
  }
}

// Schedule automated payment retry
async function schedulePaymentRetry(invoiceId: string, attemptCount: number) {
  try {
    // Calculate retry delay: 24h, 72h, 168h (1 week)
    const retryDelays = [24, 72, 168]
    const delayHours = retryDelays[attemptCount - 1] || 168
    
    const retryDate = new Date()
    retryDate.setHours(retryDate.getHours() + delayHours)
    
    console.log(`Would schedule payment retry for invoice ${invoiceId} at:`, retryDate)
    
    // TODO: Implement job queue for automated retries
    // await jobQueue.schedule('retry_payment', {
    //   invoiceId: invoiceId,
    //   attemptCount: attemptCount
    // }, retryDate)
  } catch (error) {
    console.error('Error scheduling payment retry:', error)
  }
}

// Handle invoice sent event
async function handleInvoiceSent(invoice: Stripe.Invoice, db: any) {
  try {
    await db.updateInvoice(invoice.id, {
      status: 'sent' as any,
      sent_at: new Date().toISOString()
    })
    
    console.log('Invoice sent successfully:', invoice.id)
  } catch (error) {
    console.error('Error handling invoice sent:', error)
    throw error
  }
}

// Handle invoice updated event
async function handleInvoiceUpdated(invoice: Stripe.Invoice, db: any) {
  try {
    await db.updateInvoice(invoice.id, {
      status: invoice.status as any,
      amount_paid: invoice.amount_paid || 0,
      amount_due: invoice.amount_due || 0,
      hosted_invoice_url: invoice.hosted_invoice_url || undefined,
      invoice_pdf: invoice.invoice_pdf || undefined,
      updated_at: new Date().toISOString()
    })
    
    console.log('Invoice updated successfully:', invoice.id)
  } catch (error) {
    console.error('Error handling invoice updated:', error)
    throw error
  }
}

// Handle invoice finalized event
async function handleInvoiceFinalized(invoice: Stripe.Invoice, db: any) {
  try {
    await db.updateInvoice(invoice.id, {
      status: 'open' as any,
      finalized_at: new Date().toISOString(),
      invoice_pdf: invoice.invoice_pdf || undefined
    })
    
    // Auto-send invoice if configured
    if (invoice.auto_advance) {
      await stripe.invoices.sendInvoice(invoice.id)
    }
    
    console.log('Invoice finalized successfully:', invoice.id)
  } catch (error) {
    console.error('Error handling invoice finalized:', error)
    throw error
  }
}

// Handle invoice voided event
async function handleInvoiceVoided(invoice: Stripe.Invoice, db: any) {
  try {
    await db.updateInvoice(invoice.id, {
      status: 'void' as any,
      voided_at: new Date().toISOString()
    })
    
    // Send void notification if needed
    const customerId = invoice.customer as string
    const profile = await db.getProfileByStripeCustomerId(customerId)
    if (profile) {
      await sendInvoiceVoidedNotification(invoice, profile)
    }
    
    console.log('Invoice voided successfully:', invoice.id)
  } catch (error) {
    console.error('Error handling invoice voided:', error)
    throw error
  }
}

// Send invoice voided notification
async function sendInvoiceVoidedNotification(invoice: Stripe.Invoice, profile: any) {
  try {
    console.log('Would send invoice voided email to:', profile.email)
    
    // TODO: Implement invoice void notification
    // await emailService.sendInvoiceVoidNotification({
    //   to: profile.email,
    //   invoice: invoice,
    //   template: 'invoice-voided'
    // })
  } catch (error) {
    console.error('Error sending invoice void notification:', error)
  }
}

