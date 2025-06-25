import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createDatabaseService } from '@/lib/database'

// GET - Get current subscription
export async function GET() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = await createDatabaseService()
    const subscription = await db.getActiveSubscription(userId)

    if (!subscription) {
      return NextResponse.json({ subscription: null })
    }

    // Get additional details from Stripe
    const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id, {
      expand: ['default_payment_method', 'items.data.price.product']
    })

    return NextResponse.json({
      subscription: {
        ...subscription,
        stripeData: stripeSubscription
      }
    })
  } catch (error) {
    console.error('Error fetching subscription:', error)
    return NextResponse.json(
      { error: 'Failed to fetch subscription' },
      { status: 500 }
    )
  }
}

// PATCH - Update subscription (upgrade/downgrade)
export async function PATCH(req: Request) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { priceId, prorationBehavior = 'create_prorations' } = await req.json()

    if (!priceId) {
      return NextResponse.json({ error: 'Price ID is required' }, { status: 400 })
    }

    const db = await createDatabaseService()
    const subscription = await db.getActiveSubscription(userId)

    if (!subscription) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 400 }
      )
    }

    // Update subscription in Stripe
    const updatedSubscription = await stripe.subscriptions.update(
      subscription.stripe_subscription_id,
      {
        items: [
          {
            id: subscription.stripe_subscription_id,
            price: priceId,
          },
        ],
        proration_behavior: prorationBehavior,
      }
    )

    // Update will be handled by webhook
    return NextResponse.json({ subscription: updatedSubscription })
  } catch (error) {
    console.error('Error updating subscription:', error)
    return NextResponse.json(
      { error: 'Failed to update subscription' },
      { status: 500 }
    )
  }
}

// DELETE - Cancel subscription
export async function DELETE(req: Request) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { cancelAtPeriodEnd = true } = await req.json()

    const db = await createDatabaseService()
    const subscription = await db.getActiveSubscription(userId)

    if (!subscription) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 400 }
      )
    }

    let canceledSubscription

    if (cancelAtPeriodEnd) {
      // Cancel at period end
      canceledSubscription = await stripe.subscriptions.update(
        subscription.stripe_subscription_id,
        {
          cancel_at_period_end: true,
        }
      )
    } else {
      // Cancel immediately
      canceledSubscription = await stripe.subscriptions.cancel(
        subscription.stripe_subscription_id
      )
    }

    // Update will be handled by webhook
    return NextResponse.json({ subscription: canceledSubscription })
  } catch (error) {
    console.error('Error canceling subscription:', error)
    return NextResponse.json(
      { error: 'Failed to cancel subscription' },
      { status: 500 }
    )
  }
}