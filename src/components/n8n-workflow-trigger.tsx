'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useUser } from '@clerk/nextjs'
import { 
  triggerUserActivityWorkflow, 
  sendNotificationWorkflow, 
  triggerCustomWorkflow 
} from '@/app/actions/n8n-workflows'

export function N8nWorkflowTrigger() {
  const { user } = useUser()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [workflowType, setWorkflowType] = useState<string>('')

  // Form states for different workflow types
  const [activityAction, setActivityAction] = useState('')
  const [notificationMessage, setNotificationMessage] = useState('')
  const [notificationChannels, setNotificationChannels] = useState<string[]>(['email'])
  const [customPayload, setCustomPayload] = useState('')

  const handleTriggerWorkflow = async () => {
    if (!user) {
      setResult({ success: false, error: 'Please sign in first' })
      return
    }

    setLoading(true)
    setResult(null)

    try {
      let response

      switch (workflowType) {
        case 'user-activity':
          response = await triggerUserActivityWorkflow(activityAction, {
            page: window.location.pathname,
            userAgent: navigator.userAgent
          })
          break

        case 'notification':
          response = await sendNotificationWorkflow(
            'manual',
            notificationMessage,
            notificationChannels
          )
          break

        case 'custom':
          const payload = customPayload ? JSON.parse(customPayload) : {}
          response = await triggerCustomWorkflow(payload)
          break

        default:
          response = { success: false, error: 'Please select a workflow type' }
      }

      setResult(response)
    } catch (error: any) {
      setResult({ 
        success: false, 
        error: error.message || 'Failed to trigger workflow' 
      })
    } finally {
      setLoading(false)
    }
  }

  const toggleChannel = (channel: string) => {
    setNotificationChannels(prev => 
      prev.includes(channel) 
        ? prev.filter(c => c !== channel)
        : [...prev, channel]
    )
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>n8n Workflow Trigger</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Workflow Type Selection */}
        <div className="space-y-2">
          <Label htmlFor="workflow-type">Workflow Type</Label>
          <Select value={workflowType} onValueChange={setWorkflowType}>
            <SelectTrigger>
              <SelectValue placeholder="Select a workflow type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="user-activity">User Activity</SelectItem>
              <SelectItem value="notification">Send Notification</SelectItem>
              <SelectItem value="custom">Custom Workflow</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* User Activity Form */}
        {workflowType === 'user-activity' && (
          <div className="space-y-2">
            <Label htmlFor="activity-action">Action</Label>
            <Input
              id="activity-action"
              value={activityAction}
              onChange={(e) => setActivityAction(e.target.value)}
              placeholder="e.g., viewed_dashboard, clicked_button, downloaded_file"
            />
          </div>
        )}

        {/* Notification Form */}
        {workflowType === 'notification' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="notification-message">Message</Label>
              <Textarea
                id="notification-message"
                value={notificationMessage}
                onChange={(e) => setNotificationMessage(e.target.value)}
                placeholder="Enter your notification message..."
                rows={3}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Channels</Label>
              <div className="flex flex-wrap gap-2">
                {['email', 'sms', 'push', 'slack', 'discord'].map(channel => (
                  <Badge
                    key={channel}
                    variant={notificationChannels.includes(channel) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => toggleChannel(channel)}
                  >
                    {channel}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Custom Workflow Form */}
        {workflowType === 'custom' && (
          <div className="space-y-2">
            <Label htmlFor="custom-payload">Custom Payload (JSON)</Label>
            <Textarea
              id="custom-payload"
              value={customPayload}
              onChange={(e) => setCustomPayload(e.target.value)}
              placeholder='{"event": "custom.action", "data": {"key": "value"}}'
              rows={5}
              className="font-mono text-sm"
            />
          </div>
        )}

        {/* Trigger Button */}
        <Button 
          onClick={handleTriggerWorkflow}
          disabled={loading || !workflowType || !user}
          className="w-full"
        >
          {loading ? 'Triggering Workflow...' : 'Trigger n8n Workflow'}
        </Button>

        {/* Result Display */}
        {result && (
          <div className={`p-4 rounded-lg ${
            result.success 
              ? 'bg-green-50 border border-green-200' 
              : 'bg-red-50 border border-red-200'
          }`}>
            <div className="font-medium mb-2">
              {result.success ? '✅ Success' : '❌ Error'}
            </div>
            <div className="text-sm">
              {result.message || result.error}
            </div>
            {result.data && (
              <details className="mt-2">
                <summary className="text-sm font-medium cursor-pointer">
                  Response Data
                </summary>
                <pre className="mt-1 text-xs bg-gray-100 p-2 rounded overflow-auto">
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              </details>
            )}
          </div>
        )}

        {/* User Info */}
        <div className="text-sm text-gray-500 border-t pt-4">
          {user ? (
            <div>
              <strong>User:</strong> {user.primaryEmailAddress?.emailAddress} ({user.id})
            </div>
          ) : (
            <div>Please sign in to trigger workflows</div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}