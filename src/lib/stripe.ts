import Stripe from 'stripe'

// Only initialize Stripe server-side
let stripe: Stripe | null = null
if (typeof window === 'undefined') {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-05-28.basil',
    typescript: true,
  })
}
export { stripe }

// For client-side usage
export const getStripe = () => {
  if (typeof window === 'undefined') return null

  return import('@stripe/stripe-js').then(({ loadStripe }) =>
    loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)
  )
}