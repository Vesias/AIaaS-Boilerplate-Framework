'use client'

import { getStripe } from '@/lib/stripe'
import { useUser } from '@clerk/nextjs'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface CheckoutItem {
  name: string
  description: string
  price: number // in euros
  quantity: number
}

interface CheckoutButtonProps {
  items?: CheckoutItem[]
  priceId?: string // For predefined Stripe prices
  mode?: 'payment' | 'subscription'
  children?: React.ReactNode
  className?: string
}

export default function CheckoutButton({ 
  items, 
  priceId, 
  mode = 'payment',
  children = 'Checkout',
  className 
}: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false)
  const { isSignedIn, user } = useUser()

  const handleCheckout = async () => {
    if (!isSignedIn) {
      alert('Please sign in to continue with checkout')
      return
    }

    setLoading(true)

    try {
      const stripe = await getStripe()
      if (!stripe) throw new Error('Stripe failed to initialize')

      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          items: items || [],
          priceId,
          mode 
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Checkout failed')
      }

      const { sessionId } = await response.json()

      const { error } = await stripe.redirectToCheckout({
        sessionId,
      })

      if (error) {
        console.error('Stripe checkout error:', error)
        alert('Checkout error: ' + error.message)
      }
    } catch (error: any) {
      console.error('Error:', error)
      alert('Error: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      onClick={handleCheckout}
      disabled={loading || !isSignedIn}
      className={className}
    >
      {loading ? 'Processing...' : children}
    </Button>
  )
}