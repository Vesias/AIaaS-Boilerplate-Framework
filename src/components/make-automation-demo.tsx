'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Loader2, Send, CheckCircle, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { 
  processFormSubmission, 
  triggerEmailCampaign, 
  requestDataExport, 
  createSupportTicket,
  updateInventory,
  triggerCustomScenario 
} from '@/app/actions/make-automation'

export default function MakeAutomationDemo() {
  const [isLoading, setIsLoading] = useState(false)
  const [lastExecution, setLastExecution] = useState<string | null>(null)

  // Form submission demo
  const handleFormSubmission = async (formData: FormData) => {
    setIsLoading(true)
    try {
      const result = await processFormSubmission(formData)
      
      if (result.success) {
        toast.success('Form submitted successfully!')
        setLastExecution(result.executionId || 'unknown')
      } else {
        toast.error(result.error || 'Failed to submit form')
      }
    } catch (error) {
      toast.error('An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  // Email campaign demo
  const handleEmailCampaign = async () => {
    setIsLoading(true)
    try {
      const result = await triggerEmailCampaign(
        'newsletter', 
        ['user@example.com'], 
        {
          subject: 'Welcome to our platform!',
          template: 'welcome_email',
          variables: { userName: 'Demo User' }
        }
      )
      
      if (result.success) {
        toast.success('Email campaign triggered!')
        setLastExecution(result.executionId || 'unknown')
      } else {
        toast.error(result.error || 'Failed to trigger email campaign')
      }
    } catch (error) {
      toast.error('An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  // Data export demo
  const handleDataExport = async () => {
    setIsLoading(true)
    try {
      const result = await requestDataExport('users', { 
        dateRange: 'last_30_days',
        format: 'csv' 
      })
      
      if (result.success) {
        toast.success('Data export requested!')
        setLastExecution(result.executionId || 'unknown')
      } else {
        toast.error(result.error || 'Failed to request data export')
      }
    } catch (error) {
      toast.error('An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  // Support ticket demo
  const handleSupportTicket = async () => {
    setIsLoading(true)
    try {
      const result = await createSupportTicket({
        subject: 'Demo Support Request',
        description: 'This is a demo support ticket created via Make.com integration',
        priority: 'normal',
        category: 'technical'
      })
      
      if (result.success) {
        toast.success('Support ticket created!')
        setLastExecution(result.executionId || 'unknown')
      } else {
        toast.error(result.error || 'Failed to create support ticket')
      }
    } catch (error) {
      toast.error('An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  // Inventory update demo
  const handleInventoryUpdate = async () => {
    setIsLoading(true)
    try {
      const result = await updateInventory('prod_demo_123', 10, 'increase')
      
      if (result.success) {
        toast.success('Inventory updated!')
        setLastExecution(result.executionId || 'unknown')
      } else {
        toast.error(result.error || 'Failed to update inventory')
      }
    } catch (error) {
      toast.error('An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  // Custom scenario demo
  const handleCustomScenario = async () => {
    setIsLoading(true)
    try {
      const result = await triggerCustomScenario('demo.test', {
        message: 'This is a custom demo scenario',
        timestamp: new Date().toISOString(),
        data: { key: 'value', number: 42 }
      })
      
      if (result.success) {
        toast.success('Custom scenario triggered!')
        setLastExecution(result.executionId || 'unknown')
      } else {
        toast.error(result.error || 'Failed to trigger custom scenario')
      }
    } catch (error) {
      toast.error('An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Make.com Integration Demo</h1>
        <p className="text-muted-foreground">
          Test various Make.com automation scenarios from your Next.js application
        </p>
        {lastExecution && (
          <Badge variant="outline" className="mt-2">
            Last Execution: {lastExecution}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Form Submission Demo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Form Submission
            </CardTitle>
            <CardDescription>
              Submit a contact form and trigger Make.com workflow
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={handleFormSubmission} className="space-y-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" placeholder="John Doe" required />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  name="email" 
                  type="email" 
                  placeholder="john@example.com" 
                  required 
                />
              </div>
              <div>
                <Label htmlFor="message">Message</Label>
                <Textarea 
                  id="message" 
                  name="message" 
                  placeholder="Your message here..." 
                  rows={3}
                />
              </div>
              <input type="hidden" name="formType" value="contact" />
              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit Form'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Email Campaign Demo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Email Campaign
            </CardTitle>
            <CardDescription>
              Trigger an email campaign via Make.com
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              This will trigger a welcome email campaign to demo recipients.
            </p>
          </CardContent>
          <CardFooter>
            <Button 
              onClick={handleEmailCampaign} 
              disabled={isLoading} 
              className="w-full"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send Campaign'}
            </Button>
          </CardFooter>
        </Card>

        {/* Data Export Demo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Data Export
            </CardTitle>
            <CardDescription>
              Request data export through Make.com
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Export user data from the last 30 days in CSV format.
            </p>
          </CardContent>
          <CardFooter>
            <Button 
              onClick={handleDataExport} 
              disabled={isLoading} 
              className="w-full"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Export Data'}
            </Button>
          </CardFooter>
        </Card>

        {/* Support Ticket Demo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Support Ticket
            </CardTitle>
            <CardDescription>
              Create a support ticket via Make.com
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Create a demo support ticket and trigger notification workflows.
            </p>
          </CardContent>
          <CardFooter>
            <Button 
              onClick={handleSupportTicket} 
              disabled={isLoading} 
              className="w-full"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Ticket'}
            </Button>
          </CardFooter>
        </Card>

        {/* Inventory Update Demo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Inventory Update
            </CardTitle>
            <CardDescription>
              Update product inventory via Make.com
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Increase inventory for demo product by 10 units.
            </p>
          </CardContent>
          <CardFooter>
            <Button 
              onClick={handleInventoryUpdate} 
              disabled={isLoading} 
              className="w-full"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update Inventory'}
            </Button>
          </CardFooter>
        </Card>

        {/* Custom Scenario Demo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Custom Scenario
            </CardTitle>
            <CardDescription>
              Trigger a custom Make.com scenario
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Send custom data to a Make.com scenario for processing.
            </p>
          </CardContent>
          <CardFooter>
            <Button 
              onClick={handleCustomScenario} 
              disabled={isLoading} 
              className="w-full"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Trigger Custom'}
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Integration Status */}
      <Card>
        <CardHeader>
          <CardTitle>Integration Status</CardTitle>
          <CardDescription>
            Current Make.com integration configuration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Webhook URL</Label>
              <p className="text-sm text-muted-foreground">
                {process.env.NEXT_PUBLIC_APP_URL ? 
                  `${process.env.NEXT_PUBLIC_APP_URL}/api/make/webhook` : 
                  'Not configured'
                }
              </p>
            </div>
            <div>
              <Label>Data API URL</Label>
              <p className="text-sm text-muted-foreground">
                {process.env.NEXT_PUBLIC_APP_URL ? 
                  `${process.env.NEXT_PUBLIC_APP_URL}/api/make/data` : 
                  'Not configured'
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}