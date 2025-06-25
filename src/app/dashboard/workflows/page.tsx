'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Plus, Play, Pause, Settings, Trash2, Copy, ExternalLink, Activity, Clock, CheckCircle, Eye, BarChart3, Zap, Calendar, TrendingUp, AlertCircle, Monitor } from 'lucide-react'
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
  avgExecutionTime?: number
  errorCount: number
  webhookUrl?: string
  nextRun?: string
  tags: string[]
}

interface WorkflowExecution {
  id: string
  workflowId: string
  status: 'success' | 'error' | 'running'
  startTime: string
  endTime?: string
  duration?: number
  errorMessage?: string
  triggeredBy: string
}

interface WorkflowTemplate {
  id: string
  name: string
  description: string
  provider: 'n8n' | 'make'
  category: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  estimatedSetupTime: number
  tags: string[]
  preview: string
}

export default function WorkflowsPage() {
  const { userId } = useAuth()
  const { toast } = useToast()
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [showWorkflowForm, setShowWorkflowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null)
  const [executions, setExecutions] = useState<WorkflowExecution[]>([])
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([])
  const [showTemplates, setShowTemplates] = useState(false)
  const [showExecutions, setShowExecutions] = useState(false)
  const [activeTab, setActiveTab] = useState<'workflows' | 'executions' | 'templates' | 'analytics'>('workflows')

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
        createdAt: '2024-01-01',
        avgExecutionTime: 2.5,
        errorCount: 2,
        webhookUrl: 'https://api.roomicor.com/webhooks/user-onboarding',
        nextRun: '2024-01-15T10:30:00Z',
        tags: ['email', 'onboarding', 'users']
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
        createdAt: '2024-01-05',
        avgExecutionTime: 1.2,
        errorCount: 0,
        webhookUrl: 'https://api.roomicor.com/webhooks/payments',
        tags: ['payments', 'stripe', 'billing']
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
        createdAt: '2024-01-03',
        avgExecutionTime: 15.3,
        errorCount: 1,
        nextRun: '2024-01-21T00:00:00Z',
        tags: ['analytics', 'reports', 'weekly']
      },
      {
        id: '4',
        name: 'Task Automation',
        description: 'Create tasks from external triggers and AI suggestions',
        active: true,
        trigger: 'api',
        provider: 'n8n',
        executions: 45,
        successRate: 95.6,
        lastRun: '2024-01-14T14:20:00Z',
        createdAt: '2024-01-10',
        avgExecutionTime: 0.8,
        errorCount: 2,
        tags: ['tasks', 'ai', 'automation']
      }
    ]

    const mockExecutions: WorkflowExecution[] = [
      {
        id: 'exec-1',
        workflowId: '1',
        status: 'success',
        startTime: '2024-01-14T10:30:00Z',
        endTime: '2024-01-14T10:32:30Z',
        duration: 2.5,
        triggeredBy: 'webhook'
      },
      {
        id: 'exec-2',
        workflowId: '2',
        status: 'success',
        startTime: '2024-01-14T09:15:00Z',
        endTime: '2024-01-14T09:16:12Z',
        duration: 1.2,
        triggeredBy: 'stripe_webhook'
      },
      {
        id: 'exec-3',
        workflowId: '1',
        status: 'error',
        startTime: '2024-01-13T15:22:00Z',
        endTime: '2024-01-13T15:22:45Z',
        duration: 0.75,
        errorMessage: 'Email service temporarily unavailable',
        triggeredBy: 'webhook'
      },
      {
        id: 'exec-4',
        workflowId: '4',
        status: 'running',
        startTime: '2024-01-14T14:20:00Z',
        triggeredBy: 'api_call'
      }
    ]

    const mockTemplates: WorkflowTemplate[] = [
      {
        id: 'template-1',
        name: 'Slack Notification System',
        description: 'Send notifications to Slack channels for various events',
        provider: 'n8n',
        category: 'notifications',
        difficulty: 'beginner',
        estimatedSetupTime: 15,
        tags: ['slack', 'notifications', 'alerts'],
        preview: 'Webhook → Process Data → Send to Slack'
      },
      {
        id: 'template-2',
        name: 'Database Backup Automation',
        description: 'Automated daily database backups with cloud storage',
        provider: 'n8n',
        category: 'backup',
        difficulty: 'intermediate',
        estimatedSetupTime: 30,
        tags: ['database', 'backup', 'storage'],
        preview: 'Schedule → Backup DB → Upload to Cloud → Notify'
      },
      {
        id: 'template-3',
        name: 'Customer Support Ticket Router',
        description: 'Automatically route support tickets based on content and priority',
        provider: 'make',
        category: 'support',
        difficulty: 'advanced',
        estimatedSetupTime: 45,
        tags: ['support', 'tickets', 'routing', 'ai'],
        preview: 'Email → AI Analysis → Route → Assign → Notify'
      }
    ]

    setWorkflows(mockWorkflows)
    setExecutions(mockExecutions)
    setTemplates(mockTemplates)
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

  const WorkflowExecutions = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Recent Executions
        </CardTitle>
        <CardDescription>
          Monitor workflow execution history and performance
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {executions.map((execution) => {
            const workflow = workflows.find(w => w.id === execution.workflowId)
            return (
              <div key={execution.id} className="flex items-center gap-4 p-3 border rounded-lg">
                <div className={`w-3 h-3 rounded-full ${
                  execution.status === 'success' ? 'bg-green-500' :
                  execution.status === 'error' ? 'bg-red-500' : 'bg-blue-500 animate-pulse'
                }`} />
                <div className="flex-1">
                  <h4 className="font-medium">{workflow?.name}</h4>
                  <p className="text-sm text-muted-foreground">
                    Started: {new Date(execution.startTime).toLocaleString()}
                  </p>
                  {execution.errorMessage && (
                    <p className="text-sm text-red-500 mt-1">{execution.errorMessage}</p>
                  )}
                </div>
                <div className="text-right">
                  <Badge variant={
                    execution.status === 'success' ? 'default' :
                    execution.status === 'error' ? 'destructive' : 'secondary'
                  }>
                    {execution.status}
                  </Badge>
                  {execution.duration && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {execution.duration}s
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )

  const WorkflowTemplates = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Copy className="h-5 w-5" />
          Workflow Templates
        </CardTitle>
        <CardDescription>
          Pre-built workflows to get you started quickly
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card key={template.id} className="cursor-pointer hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{template.name}</CardTitle>
                  <Badge variant={template.provider === 'n8n' ? 'default' : 'secondary'}>
                    {template.provider}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  {template.description}
                </p>
                <div className="text-xs text-muted-foreground mb-2">
                  {template.preview}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex gap-1">
                    {template.tags.slice(0, 2).map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    ~{template.estimatedSetupTime}min
                  </div>
                </div>
                <Button className="w-full mt-3" size="sm">
                  Use Template
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  )

  const WorkflowAnalytics = () => {
    const totalExecutionsToday = executions.filter(e => 
      new Date(e.startTime).toDateString() === new Date().toDateString()
    ).length
    
    const avgSuccessRate = workflows.length > 0 
      ? workflows.reduce((sum, w) => sum + w.successRate, 0) / workflows.length 
      : 0

    const totalErrorsToday = executions.filter(e => 
      e.status === 'error' && new Date(e.startTime).toDateString() === new Date().toDateString()
    ).length

    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Executions Today</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalExecutionsToday}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Success Rate</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgSuccessRate.toFixed(1)}%</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Errors Today</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalErrorsToday}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Workflows</CardTitle>
              <Monitor className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeWorkflows.length}</div>
            </CardContent>
          </Card>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Performance Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {workflows.map((workflow) => (
                <div key={workflow.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <h4 className="font-medium">{workflow.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {workflow.executions} executions • {workflow.successRate}% success
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {workflow.avgExecutionTime}s avg
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {workflow.errorCount} errors
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Workflows</h2>
          <p className="text-muted-foreground">
            Automate your business processes with advanced workflow management
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <a href="http://localhost:5678" target="_blank" rel="noopener">
              <ExternalLink className="mr-2 h-4 w-4" />
              Open n8n
            </a>
          </Button>
          <Button variant="outline" onClick={() => setShowTemplates(true)}>
            <Copy className="mr-2 h-4 w-4" />
            Templates
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

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="workflows">Workflows</TabsTrigger>
          <TabsTrigger value="executions">Executions</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="workflows">
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
                          {workflow.avgExecutionTime && (
                            <span>{workflow.avgExecutionTime}s avg time</span>
                          )}
                          {workflow.lastRun && (
                            <span>Last run: {new Date(workflow.lastRun).toLocaleDateString()}</span>
                          )}
                        </div>
                        {workflow.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {workflow.tags.map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {workflow.webhookUrl && (
                          <div className="text-xs text-muted-foreground">
                            <span className="font-mono bg-muted px-2 py-1 rounded">
                              {workflow.webhookUrl}
                            </span>
                          </div>
                        )}
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
                          <Eye className="h-4 w-4" />
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
        </TabsContent>
        <TabsContent value="executions"><WorkflowExecutions /></TabsContent>
        <TabsContent value="templates"><WorkflowTemplates /></TabsContent>
        <TabsContent value="analytics"><WorkflowAnalytics /></TabsContent>
      </Tabs>


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