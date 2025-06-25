'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Plus, Play, Pause, Settings, Trash2, Copy, ExternalLink, Activity, Clock, CheckCircle } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

interface Workflow {
  id: string
  name: string
  description?: string
  active: boolean
  trigger: string
  provider: 'n8n' | 'make'
  executions: number
  successRate: number
  lastRun?: string
  createdAt: string
}

export default function WorkflowsPage() {
  const { userId } = useAuth()
  const { toast } = useToast()
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [showWorkflowForm, setShowWorkflowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null)

  // Mock data for demonstration
  useEffect(() => {
    const mockWorkflows: Workflow[] = [
      {
        id: '1',
        name: 'User Onboarding',
        description: 'Automated email sequence for new users',
        active: true,
        trigger: 'webhook',
        provider: 'n8n',
        executions: 156,
        successRate: 98.5,
        lastRun: '2024-01-14T10:30:00Z',
        createdAt: '2024-01-01'
      },
      {
        id: '2',
        name: 'Payment Processing',
        description: 'Handle Stripe webhook events and update user status',
        active: true,
        trigger: 'webhook',
        provider: 'make',
        executions: 89,
        successRate: 100,
        lastRun: '2024-01-14T09:15:00Z',
        createdAt: '2024-01-05'
      },
      {
        id: '3',
        name: 'Weekly Reports',
        description: 'Generate and send weekly analytics reports',
        active: false,
        trigger: 'schedule',
        provider: 'n8n',
        executions: 12,
        successRate: 91.7,
        lastRun: '2024-01-07T00:00:00Z',
        createdAt: '2024-01-03'
      }
    ]
    setWorkflows(mockWorkflows)
    setLoading(false)
  }, [])

  const activeWorkflows = workflows.filter(w => w.active)
  const totalExecutions = workflows.reduce((sum, w) => sum + w.executions, 0)
  const avgSuccessRate = workflows.length > 0 
    ? workflows.reduce((sum, w) => sum + w.successRate, 0) / workflows.length 
    : 0

  const handleCreateWorkflow = async (formData: FormData) => {
    const newWorkflow: Workflow = {
      id: Date.now().toString(),
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      active: false,
      trigger: formData.get('trigger') as string,
      provider: (formData.get('provider') as 'n8n' | 'make') || 'n8n',
      executions: 0,
      successRate: 0,
      createdAt: new Date().toISOString()
    }

    setWorkflows(prev => [newWorkflow, ...prev])
    setShowWorkflowForm(false)
    toast({
      title: "Workflow created",
      description: "Your workflow has been created successfully."
    })
  }

  const toggleWorkflow = async (id: string) => {
    setWorkflows(prev => prev.map(workflow => 
      workflow.id === id ? { ...workflow, active: !workflow.active } : workflow
    ))
    
    const workflow = workflows.find(w => w.id === id)
    toast({
      title: workflow?.active ? "Workflow deactivated" : "Workflow activated",
      description: `${workflow?.name} is now ${workflow?.active ? 'inactive' : 'active'}.`
    })
  }

  const executeWorkflow = async (id: string) => {
    const workflow = workflows.find(w => w.id === id)
    toast({
      title: "Workflow executed",
      description: `${workflow?.name} is now running.`
    })
  }

  const deleteWorkflow = (id: string) => {
    setWorkflows(prev => prev.filter(workflow => workflow.id !== id))
    toast({
      title: "Workflow deleted",
      description: "The workflow has been removed."
    })
  }

  const duplicateWorkflow = (id: string) => {
    const original = workflows.find(w => w.id === id)
    if (original) {
      const duplicate: Workflow = {
        ...original,
        id: Date.now().toString(),
        name: `${original.name} (Copy)`,
        active: false,
        executions: 0,
        successRate: 0,
        createdAt: new Date().toISOString()
      }
      setWorkflows(prev => [duplicate, ...prev])
      toast({
        title: "Workflow duplicated",
        description: "A copy of the workflow has been created."
      })
    }
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Workflows</h2>
          <p className="text-muted-foreground">
            Automate your business processes with n8n and Make.com
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <a href="http://localhost:5678" target="_blank" rel="noopener">
              <ExternalLink className="mr-2 h-4 w-4" />
              Open n8n
            </a>
          </Button>
          <Button onClick={() => setShowWorkflowForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Workflow
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Workflows</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{workflows.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <Badge variant="default">Running</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeWorkflows.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Executions</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalExecutions}</div>
            <p className="text-xs text-muted-foreground">
              All time
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgSuccessRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              Average across all workflows
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Workflows List */}
      <Card>
        <CardHeader>
          <CardTitle>Your Workflows</CardTitle>
          <CardDescription>
            Manage and monitor your automation workflows
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading workflows...</div>
          ) : workflows.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No workflows found. Create your first workflow to get started!
            </div>
          ) : (
            <div className="space-y-4">
              {workflows.map((workflow) => (
                <div
                  key={workflow.id}
                  className="flex items-center gap-4 p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={workflow.active}
                      onCheckedChange={() => toggleWorkflow(workflow.id)}
                    />
                    <Badge 
                      variant={workflow.provider === 'n8n' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {workflow.provider}
                    </Badge>
                  </div>
                  
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{workflow.name}</h3>
                      <Badge variant="outline" className="text-xs">
                        {workflow.trigger}
                      </Badge>
                      {workflow.active && (
                        <Badge variant="default" className="text-xs bg-green-500">
                          Active
                        </Badge>
                      )}
                    </div>
                    {workflow.description && (
                      <p className="text-sm text-muted-foreground">
                        {workflow.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{workflow.executions} executions</span>
                      <span>{workflow.successRate}% success rate</span>
                      {workflow.lastRun && (
                        <span>Last run: {new Date(workflow.lastRun).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => executeWorkflow(workflow.id)}
                      disabled={!workflow.active}
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => duplicateWorkflow(workflow.id)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedWorkflow(workflow)}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteWorkflow(workflow.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Workflow Dialog */}
      <Dialog open={showWorkflowForm} onOpenChange={setShowWorkflowForm}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Create New Workflow</DialogTitle>
          </DialogHeader>
          <form action={handleCreateWorkflow} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Workflow Name</Label>
              <Input
                id="name"
                name="name"
                placeholder="Enter workflow name"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Describe what this workflow does"
                rows={3}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="provider">Provider</Label>
                <Select name="provider" defaultValue="n8n">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="n8n">n8n</SelectItem>
                    <SelectItem value="make">Make.com</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="trigger">Trigger Type</Label>
                <Select name="trigger" defaultValue="webhook">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="webhook">Webhook</SelectItem>
                    <SelectItem value="schedule">Schedule</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowWorkflowForm(false)}>
                Cancel
              </Button>
              <Button type="submit">
                Create Workflow
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Workflow Dialog */}
      {selectedWorkflow && (
        <Dialog open={!!selectedWorkflow} onOpenChange={() => setSelectedWorkflow(null)}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Edit Workflow: {selectedWorkflow.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Status</Label>
                  <p className={`text-sm ${selectedWorkflow.active ? 'text-green-600' : 'text-gray-600'}`}>
                    {selectedWorkflow.active ? 'Active' : 'Inactive'}
                  </p>
                </div>
                <div>
                  <Label>Provider</Label>
                  <p className="text-sm">{selectedWorkflow.provider}</p>
                </div>
              </div>
              
              <div>
                <Label>Description</Label>
                <p className="text-sm text-muted-foreground">
                  {selectedWorkflow.description || 'No description provided'}
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Executions</Label>
                  <p className="text-sm">{selectedWorkflow.executions}</p>
                </div>
                <div>
                  <Label>Success Rate</Label>
                  <p className="text-sm">{selectedWorkflow.successRate}%</p>
                </div>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSelectedWorkflow(null)}>
                  Close
                </Button>
                <Button variant="outline" asChild>
                  <a 
                    href={selectedWorkflow.provider === 'n8n' ? 'http://localhost:5678' : '#'} 
                    target="_blank" 
                    rel="noopener"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Edit in {selectedWorkflow.provider}
                  </a>
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}