'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Label } from './ui/label'
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

// Validation schema
const waitlistSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  company: z.string().optional(),
  message: z.string().max(500, 'Message must be less than 500 characters').optional(),
  useCase: z.string().optional()
})

type WaitlistFormData = z.infer<typeof waitlistSchema>

interface WaitlistFormProps {
  className?: string
}

export function WaitlistForm({ className }: WaitlistFormProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string>('')

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset
  } = useForm<WaitlistFormData>({
    resolver: zodResolver(waitlistSchema)
  })

  const onSubmit = async (data: WaitlistFormData) => {
    setStatus('loading')
    setErrorMessage('')

    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (response.ok) {
        setStatus('success')
        reset()
      } else {
        setStatus('error')
        setErrorMessage(result.error || 'Something went wrong. Please try again.')
      }
    } catch (error) {
      setStatus('error')
      setErrorMessage('Network error. Please check your connection and try again.')
    }
  }

  if (status === 'success') {
    return (
      <Card className={cn('w-full max-w-md mx-auto', className)}>
        <CardContent className="pt-6">
          <div className="text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              You're on the list!
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Thanks for joining our waitlist. We'll notify you as soon as your access is ready.
            </p>
            <Button 
              onClick={() => setStatus('idle')}
              variant="outline"
              className="w-full"
            >
              Join Another Person
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn('w-full max-w-md mx-auto', className)}>
      <CardHeader>
        <CardTitle>Join the Waitlist</CardTitle>
        <CardDescription>
          Get early access to our automation platform and exclusive benefits.
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">Email Address *</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              {...register('email')}
              className={errors.email ? 'border-red-500' : ''}
            />
            {errors.email && (
              <p className="text-sm text-red-500">{errors.email.message}</p>
            )}
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Full Name *</Label>
            <Input
              id="name"
              type="text"
              placeholder="John Doe"
              {...register('name')}
              className={errors.name ? 'border-red-500' : ''}
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>

          {/* Company */}
          <div className="space-y-2">
            <Label htmlFor="company">Company (Optional)</Label>
            <Input
              id="company"
              type="text"
              placeholder="Your Company"
              {...register('company')}
            />
          </div>

          {/* Use Case */}
          <div className="space-y-2">
            <Label htmlFor="useCase">Primary Use Case (Optional)</Label>
            <select
              id="useCase"
              {...register('useCase')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a use case</option>
              <option value="workflow-automation">Workflow Automation</option>
              <option value="data-integration">Data Integration</option>
              <option value="ai-assistance">AI Assistance</option>
              <option value="customer-support">Customer Support</option>
              <option value="marketing-automation">Marketing Automation</option>
              <option value="business-process">Business Process Optimization</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="message">Tell us about your needs (Optional)</Label>
            <Textarea
              id="message"
              placeholder="What would you like to automate? What features are most important to you?"
              {...register('message')}
              className={cn(
                'min-h-[80px] resize-none',
                errors.message ? 'border-red-500' : ''
              )}
            />
            {errors.message && (
              <p className="text-sm text-red-500">{errors.message.message}</p>
            )}
          </div>

          {/* Error Message */}
          {status === 'error' && (
            <div className="flex items-start space-x-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600 dark:text-red-400">
                {errorMessage}
              </p>
            </div>
          )}

          {/* Submit Button */}
          <Button 
            type="submit" 
            className="w-full"
            disabled={status === 'loading'}
          >
            {status === 'loading' ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Joining Waitlist...
              </>
            ) : (
              'Join Waitlist'
            )}
          </Button>

          {/* Terms */}
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            By joining, you agree to receive product updates and early access notifications. 
            You can unsubscribe at any time.
          </p>
        </form>
      </CardContent>
    </Card>
  )
}

// Minimal inline form for other pages
export function WaitlistFormInline({ className }: { className?: string }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return

    setStatus('loading')

    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, name: 'Inline Signup' }),
      })

      if (response.ok) {
        setStatus('success')
        setEmail('')
      } else {
        setStatus('error')
      }
    } catch (error) {
      setStatus('error')
    }

    // Reset status after 3 seconds
    setTimeout(() => setStatus('idle'), 3000)
  }

  if (status === 'success') {
    return (
      <div className={cn('flex items-center space-x-2 text-green-600', className)}>
        <CheckCircle className="w-5 h-5" />
        <span className="text-sm">Thanks! You're on the waitlist.</span>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className={cn('flex space-x-2', className)}>
      <Input
        type="email"
        placeholder="Enter your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className="flex-1"
      />
      <Button type="submit" disabled={status === 'loading'}>
        {status === 'loading' ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          'Join'
        )}
      </Button>
    </form>
  )
}