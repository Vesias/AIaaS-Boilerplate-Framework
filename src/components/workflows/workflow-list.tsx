'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { 
  Play, 
  Pause, 
  Square, 
  Edit, 
  Copy, 
  Trash2, 
  Share, 
  Download, 
  Upload,
  MoreHorizontal,
  Search,
  Filter,
  SortAsc,
  SortDesc,
  Plus,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Eye,
  Settings,
  Activity,
  Zap,
  TrendingUp,
  Users,
  GitBranch,
  Star,
  Archive,
  RefreshCw
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { format, formatDistanceToNow } from 'date-fns'

export interface WorkflowExecution {
  id: string
  workflowId: string
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  startTime: string
  endTime?: string
  duration?: number
  triggeredBy: string
  inputData?: any
  outputData?: any
  errorMessage?: string
  stepResults: {
    stepId: string
    stepName: string
    status: 'pending' | 'running' | 'completed' | 'failed'
    startTime: string
    endTime?: string
    duration?: number
    errorMessage?: string
  }[]
}

export interface Workflow {
  id: string
  name: string
  description: string
  status: 'active' | 'inactive' | 'draft'
  category: string
  tags: string[]
  version: number
  nodeCount: number
  complexity: 'simple' | 'medium' | 'complex'
  createdAt: string
  updatedAt: string
  lastExecuted?: string
  createdBy: string
  sharedWith: string[]
  isTemplate: boolean
  isFavorite: boolean
  executionCount: number
  successRate: number
  avgExecutionTime: number
  settings: {
    timeout: number
    retryAttempts: number
    errorHandling: 'stop' | 'continue' | 'retry'
    schedule?: {
      enabled: boolean
      cron: string
      timezone: string
    }
  }
  permissions: {
    canEdit: boolean
    canExecute: boolean
    canShare: boolean
    canDelete: boolean
  }
}

interface WorkflowListProps {
  workflows: Workflow[]
  executions: WorkflowExecution[]
  onEdit: (workflow: Workflow) => void
  onExecute: (workflowId: string) => void
  onStop: (executionId: string) => void
  onDuplicate: (workflow: Workflow) => void
  onDelete: (workflowId: string) => void
  onShare: (workflow: Workflow) => void
  onToggleStatus: (workflowId: string, status: 'active' | 'inactive') => void
  onToggleFavorite: (workflowId: string, isFavorite: boolean) => void
  className?: string
  viewMode?: 'grid' | 'list' | 'compact'
  enableBulkActions?: boolean
  showExecutions?: boolean
}

interface WorkflowFilters {
  search: string
  status: string[]
  category: string[]
  tags: string[]
  complexity: string[]
  createdBy: string[]
  dateRange: 'all' | 'today' | 'week' | 'month' | 'year'
  sortBy: 'name' | 'updated' | 'created' | 'executions' | 'success_rate'
  sortOrder: 'asc' | 'desc'
  showFavorites: boolean
  showTemplates: boolean
}

const DEFAULT_FILTERS: WorkflowFilters = {
  search: '',
  status: [],
  category: [],
  tags: [],
  complexity: [],
  createdBy: [],
  dateRange: 'all',
  sortBy: 'updated',
  sortOrder: 'desc',
  showFavorites: false,
  showTemplates: false
}

export default function WorkflowList({
  workflows,
  executions,
  onEdit,
  onExecute,
  onStop,
  onDuplicate,
  onDelete,
  onShare,
  onToggleStatus,
  onToggleFavorite,
  className,
  viewMode = 'grid',
  enableBulkActions = true,
  showExecutions = true
}: WorkflowListProps) {
  const [filters, setFilters] = useState<WorkflowFilters>(DEFAULT_FILTERS)
  const [selectedWorkflows, setSelectedWorkflows] = useState<string[]>([])
  const [showFiltersPanel, setShowFiltersPanel] = useState(false)
  const [deleteDialogWorkflow, setDeleteDialogWorkflow] = useState<Workflow | null>(null)
  const [shareDialogWorkflow, setShareDialogWorkflow] = useState<Workflow | null>(null)

  // Extract unique values for filters
  const uniqueCategories = Array.from(new Set(workflows.map(w => w.category).filter(Boolean)))
  const uniqueTags = Array.from(new Set(workflows.flatMap(w => w.tags)))
  const uniqueCreators = Array.from(new Set(workflows.map(w => w.createdBy).filter(Boolean)))

  // Filter and sort workflows
  const filteredWorkflows = useMemo(() => {
    return workflows
      .filter(workflow => {
        // Search filter
        const matchesSearch = !filters.search || 
          workflow.name.toLowerCase().includes(filters.search.toLowerCase()) ||
          workflow.description.toLowerCase().includes(filters.search.toLowerCase())

        // Status filter
        const matchesStatus = filters.status.length === 0 || 
          filters.status.includes(workflow.status)

        // Category filter
        const matchesCategory = filters.category.length === 0 || 
          filters.category.includes(workflow.category)

        // Tags filter
        const matchesTags = filters.tags.length === 0 || 
          filters.tags.some(tag => workflow.tags.includes(tag))

        // Complexity filter
        const matchesComplexity = filters.complexity.length === 0 || 
          filters.complexity.includes(workflow.complexity)

        // Creator filter
        const matchesCreator = filters.createdBy.length === 0 || 
          filters.createdBy.includes(workflow.createdBy)

        // Date range filter
        const matchesDateRange = () => {
          if (filters.dateRange === 'all') return true
          
          const now = new Date()
          const workflowDate = new Date(workflow.updatedAt)
          
          switch (filters.dateRange) {
            case 'today':
              return workflowDate.toDateString() === now.toDateString()
            case 'week':
              const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
              return workflowDate >= weekAgo
            case 'month':
              const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
              return workflowDate >= monthAgo
            case 'year':
              const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
              return workflowDate >= yearAgo
            default:
              return true
          }
        }

        // Special filters
        const matchesFavorites = !filters.showFavorites || workflow.isFavorite
        const matchesTemplates = !filters.showTemplates || workflow.isTemplate

        return matchesSearch && matchesStatus && matchesCategory && matchesTags && 
               matchesComplexity && matchesCreator && matchesDateRange() && 
               matchesFavorites && matchesTemplates
      })
      .sort((a, b) => {
        let aValue: any, bValue: any

        switch (filters.sortBy) {
          case 'name':
            aValue = a.name.toLowerCase()
            bValue = b.name.toLowerCase()
            break
          case 'created':
            aValue = new Date(a.createdAt).getTime()
            bValue = new Date(b.createdAt).getTime()
            break
          case 'updated':
            aValue = new Date(a.updatedAt).getTime()
            bValue = new Date(b.updatedAt).getTime()
            break
          case 'executions':
            aValue = a.executionCount
            bValue = b.executionCount
            break
          case 'success_rate':
            aValue = a.successRate
            bValue = b.successRate
            break
          default:
            aValue = new Date(a.updatedAt).getTime()
            bValue = new Date(b.updatedAt).getTime()
        }

        if (filters.sortOrder === 'asc') {
          return aValue > bValue ? 1 : -1
        } else {
          return aValue < bValue ? 1 : -1
        }
      })
  }, [workflows, filters])

  // Get recent executions for each workflow
  const getWorkflowExecutions = (workflowId: string) => {
    return executions
      .filter(exec => exec.workflowId === workflowId)
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      .slice(0, 5)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'inactive': return 'bg-gray-100 text-gray-800'
      case 'draft': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'simple': return 'bg-green-100 text-green-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'complex': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getExecutionStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'text-blue-600'
      case 'completed': return 'text-green-600'
      case 'failed': return 'text-red-600'
      case 'cancelled': return 'text-gray-600'
      default: return 'text-gray-600'
    }
  }

  const getExecutionStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return Activity
      case 'completed': return CheckCircle
      case 'failed': return XCircle
      case 'cancelled': return Square
      default: return Clock
    }
  }

  const handleBulkAction = (action: 'activate' | 'deactivate' | 'delete' | 'duplicate') => {
    selectedWorkflows.forEach(workflowId => {
      const workflow = workflows.find(w => w.id === workflowId)
      if (!workflow) return

      switch (action) {
        case 'activate':
          onToggleStatus(workflowId, 'active')
          break
        case 'deactivate':
          onToggleStatus(workflowId, 'inactive')
          break
        case 'delete':
          onDelete(workflowId)
          break
        case 'duplicate':
          onDuplicate(workflow)
          break
      }
    })
    setSelectedWorkflows([])
  }

  const toggleWorkflowSelection = (workflowId: string) => {
    setSelectedWorkflows(prev => 
      prev.includes(workflowId) 
        ? prev.filter(id => id !== workflowId)
        : [...prev, workflowId]
    )
  }

  const WorkflowCard = ({ workflow }: { workflow: Workflow }) => {
    const recentExecutions = getWorkflowExecutions(workflow.id)
    const isRunning = recentExecutions.some(exec => exec.status === 'running')

    return (
      <Card className={cn(
        "transition-all hover:shadow-md",
        selectedWorkflows.includes(workflow.id) && "ring-2 ring-blue-500"
      )}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              {enableBulkActions && (
                <Checkbox
                  checked={selectedWorkflows.includes(workflow.id)}
                  onCheckedChange={() => toggleWorkflowSelection(workflow.id)}
                  className="mt-1"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <CardTitle className="text-lg truncate">{workflow.name}</CardTitle>
                  {workflow.isFavorite && (
                    <Star className="h-4 w-4 text-yellow-500 fill-current" />
                  )}
                  {workflow.isTemplate && (
                    <Badge variant="outline" className="text-xs">Template</Badge>
                  )}
                </div>
                <CardDescription className="text-sm mb-2 line-clamp-2">
                  {workflow.description}
                </CardDescription>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={getStatusColor(workflow.status)}>
                    {workflow.status}
                  </Badge>
                  <Badge className={getComplexityColor(workflow.complexity)}>
                    {workflow.complexity}
                  </Badge>
                  {workflow.category && (
                    <Badge variant="outline">{workflow.category}</Badge>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onToggleFavorite(workflow.id, !workflow.isFavorite)}
              >
                <Star className={cn(
                  "h-4 w-4",
                  workflow.isFavorite ? "text-yellow-500 fill-current" : "text-gray-400"
                )} />
              </Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Workflow Actions</DialogTitle>
                  </DialogHeader>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      onClick={() => onEdit(workflow)}
                      disabled={!workflow.permissions.canEdit}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => onDuplicate(workflow)}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Duplicate
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShareDialogWorkflow(workflow)}
                      disabled={!workflow.permissions.canShare}
                    >
                      <Share className="h-4 w-4 mr-2" />
                      Share
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => onToggleStatus(
                        workflow.id, 
                        workflow.status === 'active' ? 'inactive' : 'active'
                      )}
                    >
                      {workflow.status === 'active' ? (
                        <>
                          <Pause className="h-4 w-4 mr-2" />
                          Deactivate
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-2" />
                          Activate
                        </>
                      )}
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => setDeleteDialogWorkflow(workflow)}
                      disabled={!workflow.permissions.canDelete}
                      className="col-span-2"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Statistics */}
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <div className="font-medium">{workflow.executionCount}</div>
              <div className="text-muted-foreground">Executions</div>
            </div>
            <div className="text-center">
              <div className="font-medium">{workflow.successRate}%</div>
              <div className="text-muted-foreground">Success Rate</div>
            </div>
            <div className="text-center">
              <div className="font-medium">{workflow.nodeCount}</div>
              <div className="text-muted-foreground">Nodes</div>
            </div>
          </div>

          <Separator />

          {/* Recent Executions */}
          {showExecutions && recentExecutions.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Recent Executions</span>
                {isRunning && (
                  <Badge variant="secondary" className="animate-pulse">
                    Running
                  </Badge>
                )}
              </div>
              <div className="space-y-1">
                {recentExecutions.slice(0, 3).map((execution) => {
                  const StatusIcon = getExecutionStatusIcon(execution.status)
                  return (
                    <div key={execution.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <StatusIcon className={cn("h-3 w-3", getExecutionStatusColor(execution.status))} />
                        <span className="text-muted-foreground">
                          {formatDistanceToNow(new Date(execution.startTime), { addSuffix: true })}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {execution.duration ? `${execution.duration}ms` : 'Running'}
                      </Badge>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Tags */}
          {workflow.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {workflow.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          <Separator />

          {/* Actions */}
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              Updated {formatDistanceToNow(new Date(workflow.updatedAt), { addSuffix: true })}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onEdit(workflow)}
                disabled={!workflow.permissions.canEdit}
              >
                <Edit className="h-3 w-3 mr-1" />
                Edit
              </Button>
              <Button
                size="sm"
                onClick={() => onExecute(workflow.id)}
                disabled={!workflow.permissions.canExecute || workflow.status !== 'active'}
              >
                <Play className="h-3 w-3 mr-1" />
                Run
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Workflows</h2>
          <p className="text-muted-foreground">
            Manage and execute your automation workflows
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowFiltersPanel(!showFiltersPanel)}>
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Workflow
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search workflows..."
            value={filters.search}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            className="pl-10"
          />
        </div>

        <Select 
          value={filters.sortBy} 
          onValueChange={(value: any) => setFilters(prev => ({ ...prev, sortBy: value }))}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="updated">Last Updated</SelectItem>
            <SelectItem value="created">Created Date</SelectItem>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="executions">Executions</SelectItem>
            <SelectItem value="success_rate">Success Rate</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setFilters(prev => ({ 
            ...prev, 
            sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc' 
          }))}
        >
          {filters.sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
        </Button>
      </div>

      {/* Bulk Actions */}
      {enableBulkActions && selectedWorkflows.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {selectedWorkflows.length} workflow{selectedWorkflows.length !== 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => handleBulkAction('activate')}>
                Activate
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleBulkAction('deactivate')}>
                Deactivate
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleBulkAction('duplicate')}>
                Duplicate
              </Button>
              <Button size="sm" variant="destructive" onClick={() => handleBulkAction('delete')}>
                Delete
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedWorkflows([])}>
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Workflows Grid */}
      <div className={cn(
        "grid gap-4",
        viewMode === 'grid' && "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
        viewMode === 'list' && "grid-cols-1",
        viewMode === 'compact' && "grid-cols-1 md:grid-cols-2"
      )}>
        {filteredWorkflows.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="text-center py-12">
              <Zap className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No workflows found</h3>
              <p className="text-muted-foreground mb-4">
                {workflows.length === 0 
                  ? "Create your first workflow to get started with automation."
                  : "Try adjusting your filters or search criteria."
                }
              </p>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Workflow
              </Button>
            </CardContent>
          </Card>
        ) : (
          filteredWorkflows.map((workflow) => (
            <WorkflowCard key={workflow.id} workflow={workflow} />
          ))
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteDialogWorkflow} onOpenChange={() => setDeleteDialogWorkflow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Workflow</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteDialogWorkflow?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteDialogWorkflow) {
                  onDelete(deleteDialogWorkflow.id)
                  setDeleteDialogWorkflow(null)
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Share Dialog */}
      <Dialog open={!!shareDialogWorkflow} onOpenChange={() => setShareDialogWorkflow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Workflow</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Current Access</h4>
              <div className="space-y-2">
                {shareDialogWorkflow?.sharedWith.map((user) => (
                  <div key={user} className="flex items-center justify-between p-2 border rounded">
                    <span>{user}</span>
                    <Button variant="ghost" size="sm">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-medium mb-2">Add User</h4>
              <div className="flex gap-2">
                <Input placeholder="Enter email address" />
                <Button>Add</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}