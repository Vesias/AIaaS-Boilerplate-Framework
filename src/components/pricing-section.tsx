'use client'

import { useState } from 'react'
import CheckoutButton from './checkout-button'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Check } from 'lucide-react'

interface PricingPlan {
  id: string
  name: string
  description: string
  price: number
  currency: string
  interval: 'month' | 'year'
  stripePriceId: string
  features: string[]
  popular?: boolean
  buttonText?: string
}

const defaultPlans: PricingPlan[] = [
  {
    id: 'basic',
    name: 'Basic',
    description: 'Perfect for getting started',
    price: 9.99,
    currency: 'EUR',
    interval: 'month',
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_BASIC || 'price_basic',
    features: [
      'Up to 10 workflows',
      'Basic AI integration',
      'Email support',
      'Dashboard access',
      'Basic analytics'
    ],
    buttonText: 'Start Basic Plan'
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'Best for growing businesses',
    price: 29.99,
    currency: 'EUR',
    interval: 'month',
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PRO || 'price_pro',
    features: [
      'Unlimited workflows',
      'Advanced AI integration',
      'Priority support',
      'Advanced analytics',
      'Custom integrations',
      'API access',
      'Team collaboration'
    ],
    popular: true,
    buttonText: 'Start Pro Plan'
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For large scale operations',
    price: 99.99,
    currency: 'EUR',
    interval: 'month',
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_ENTERPRISE || 'price_enterprise',
    features: [
      'Everything in Pro',
      'White-label solution',
      'Dedicated support',
      'Custom development',
      'SLA guarantee',
      'On-premise deployment',
      'Advanced security'
    ],
    buttonText: 'Contact Sales'
  }
]

interface PricingSectionProps {
  plans?: PricingPlan[]
  title?: string
  subtitle?: string
  yearly?: boolean
}

export function PricingSection({ 
  plans = defaultPlans, 
  title = "Choose Your Plan",
  subtitle = "Start your journey with the perfect plan for your needs",
  yearly = false 
}: PricingSectionProps) {
  const [isYearly, setIsYearly] = useState(yearly)

  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(price)
  }

  const getAdjustedPrice = (plan: PricingPlan) => {
    if (isYearly && plan.interval === 'month') {
      // Apply 20% discount for yearly billing
      return plan.price * 12 * 0.8
    }
    return isYearly ? plan.price * 12 : plan.price
  }

  const getPriceDisplay = (plan: PricingPlan) => {
    const adjustedPrice = getAdjustedPrice(plan)
    const interval = isYearly ? 'year' : plan.interval
    return `${formatPrice(adjustedPrice, plan.currency)}/${interval}`
  }

  return (
    <section className="py-20 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            {title}
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
            {subtitle}
          </p>
          
          {/* Billing Toggle */}
          <div className="flex items-center justify-center space-x-4 mb-8">
            <span className={`text-sm font-medium ${!isYearly ? 'text-gray-900 dark:text-white' : 'text-gray-500'}`}>
              Monthly
            </span>
            <button
              onClick={() => setIsYearly(!isYearly)}
              className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-gray-700"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isYearly ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className={`text-sm font-medium ${isYearly ? 'text-gray-900 dark:text-white' : 'text-gray-500'}`}>
              Yearly
            </span>
            {isYearly && (
              <Badge variant="secondary" className="ml-2">
                Save 20%
              </Badge>
            )}
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan) => (
            <Card 
              key={plan.id} 
              className={`relative ${plan.popular ? 'border-blue-500 shadow-lg scale-105' : 'border-gray-200 dark:border-gray-700'}`}
            >
              {plan.popular && (
                <Badge 
                  className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white"
                >
                  Most Popular
                </Badge>
              )}
              
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-2xl font-bold">{plan.name}</CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-300">
                  {plan.description}
                </CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-gray-900 dark:text-white">
                    {getPriceDisplay(plan)}
                  </span>
                  {isYearly && (
                    <div className="text-sm text-gray-500 mt-1">
                      {formatPrice(plan.price, plan.currency)}/month billed annually
                    </div>
                  )}
                </div>
              </CardHeader>

              <CardContent>
                <ul className="space-y-3">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center">
                      <Check className="h-5 w-5 text-green-500 mr-3 flex-shrink-0" />
                      <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter>
                {plan.id === 'enterprise' ? (
                  <Button 
                    className="w-full" 
                    variant={plan.popular ? 'default' : 'outline'}
                    asChild
                  >
                    <a href="mailto:sales@yourcompany.com">
                      {plan.buttonText}
                    </a>
                  </Button>
                ) : (
                  <CheckoutButton
                    priceId={plan.stripePriceId}
                    mode="subscription"
                    className="w-full"
                  >
                    {plan.buttonText}
                  </CheckoutButton>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>

        {/* Bottom Section */}
        <div className="text-center mt-12">
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            All plans include 14-day free trial. No credit card required.
          </p>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-500">
            <span className="flex items-center">
              <Check className="h-4 w-4 text-green-500 mr-2" />
              Cancel anytime
            </span>
            <span className="flex items-center">
              <Check className="h-4 w-4 text-green-500 mr-2" />
              24/7 Support
            </span>
            <span className="flex items-center">
              <Check className="h-4 w-4 text-green-500 mr-2" />
              EU VAT included
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}