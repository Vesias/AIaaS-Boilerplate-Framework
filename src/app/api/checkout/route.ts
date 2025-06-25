import { stripe } from '@/lib/stripe'
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { items, priceId, mode = 'payment' } = await req.json()

    if (!stripe) {
      return NextResponse.json(
        { error: 'Stripe not configured' },
        { status: 500 }
      )
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: priceId 
        ? [{ price: priceId, quantity: 1 }]
        : items.map((item: any) => ({
            price_data: {
              currency: 'eur',
              product_data: {
                name: item.name,
                description: item.description,
              },
              unit_amount: item.price * 100, // Stripe expects cents
            },
            quantity: item.quantity,
          })),
      mode: mode, // 'payment' for one-time, 'subscription' for recurring
      customer_email: userId, // You might want to get actual email from Clerk
      metadata: {
        userId: userId,
      },
      success_url: `${req.headers.get('origin')}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get('origin')}/cancel`,
    })

    return NextResponse.json({ sessionId: session.id })
  } catch (error: any) {
    console.error('Error creating checkout session:', error)
    return NextResponse.json(
      { error: 'Error creating checkout session', details: error.message },
      { status: 500 }
    )
  }
}