'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Play, 
  Square, 
  RefreshCw, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Search,
  Filter,
  Download,
  Eye,
  MoreHorizontal,
  Activity,
  Timer,
  Database,
  Zap,
  AlertCircle,
  TrendingUp,
  Calendar,
  User,
  ChevronRight,
  Copy,
  FileText,
  Bug
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { format, formatDistanceToNow, differenceInMilliseconds } from 'date-fns'

export interface WorkflowExecutionStep {
  id: string
  stepId: string
  stepName: string
  stepType: 'trigger' | 'action' | 'condition' | 'loop' | 'delay'
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  startTime: string
  endTime?: string
  duration?: number
  inputData?: any
  outputData?: any
  errorMessage?: string
  retryCount?: number
  logs: {
    timestamp: string
    level: 'info' | 'warn' | 'error' | 'debug'
    message: string
    data?: any
  }[]
}

export interface WorkflowExecution {
  id: string
  workflowId: string
  workflowName: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'timeout'
  trigger: {
    type: string
    source: string
    data?: any
  }
  startTime: string
  endTime?: string
  duration?: number
  totalSteps: number
  completedSteps: number
  failedSteps: number
  inputData?: any
  outputData?: any
  errorMessage?: string
  triggeredBy: string
  environment: 'development' | 'staging' | 'production'
  version: string
  steps: WorkflowExecutionStep[]
  metadata: {
    totalMemoryUsed?: number
    totalCpuTime?: number
    apiCallsCount?: number
    cost?: number
  }
}

interface WorkflowExecutionsProps {
  executions: WorkflowExecution[]
  onStopExecution: (executionId: string) => void
  onRetryExecution: (executionId: string) => void
  onViewLogs: (execution: WorkflowExecution) => void
  className?: string
  showFilters?: boolean
  autoRefresh?: boolean
  refreshInterval?: number
}

interface ExecutionFilters {
  search: string
  status: string[]
  environment: string[]
  dateRange: 'all' | 'today' | 'week' | 'month'
  workflowId?: string
  triggeredBy?: string
}

export default function WorkflowExecutions({
  executions,
  onStopExecution,
  onRetryExecution,
  onViewLogs,
  className,
  showFilters = true,
  autoRefresh = false,
  refreshInterval = 30000
}: WorkflowExecutionsProps) {
  const [filters, setFilters] = useState<ExecutionFilters>({
    search: '',
    status: [],
    environment: [],
    dateRange: 'week'
  })
  const [selectedExecution, setSelectedExecution] = useState<WorkflowExecution | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'detailed'>('list')

  // Filter executions
  const filteredExecutions = useMemo(() => {
    return executions
      .filter(execution => {
        const matchesSearch = !filters.search || 
          execution.workflowName.toLowerCase().includes(filters.search.toLowerCase()) ||
          execution.id.toLowerCase().includes(filters.search.toLowerCase())

        const matchesStatus = filters.status.length === 0 || 
          filters.status.includes(execution.status)

        const matchesEnvironment = filters.environment.length === 0 || 
          filters.environment.includes(execution.environment)

        const matchesDateRange = () => {
          if (filters.dateRange === 'all') return true
          
          const now = new Date()
          const executionDate = new Date(execution.startTime)
          
          switch (filters.dateRange) {
            case 'today':
              return executionDate.toDateString() === now.toDateString()
            case 'week':
              const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
              return executionDate >= weekAgo
            case 'month':
              const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
              return executionDate >= monthAgo
            default:
              return true
          }
        }

        return matchesSearch && matchesStatus && matchesEnvironment && matchesDateRange()
      })
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
  }, [executions, filters])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-blue-100 text-blue-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'failed': return 'bg-red-100 text-red-800'
      case 'cancelled': return 'bg-gray-100 text-gray-800'
      case 'timeout': return 'bg-orange-100 text-orange-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return Activity
      case 'completed': return CheckCircle
      case 'failed': return XCircle
      case 'cancelled': return Square
      case 'timeout': return AlertTriangle
      case 'pending': return Clock
      default: return Clock
    }
  }

  const getStepStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return Activity
      case 'completed': return CheckCircle
      case 'failed': return XCircle
      case 'skipped': return ChevronRight
      case 'pending': return Clock
      default: return Clock
    }
  }

  const calculateProgress = (execution: WorkflowExecution) => {
    if (execution.totalSteps === 0) return 0
    return Math.round((execution.completedSteps / execution.totalSteps) * 100)
  }

  const formatDuration = (ms?: number) => {
    if (!ms) return 'N/A'
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${(ms / 60000).toFixed(1)}m`
  }

  const getEnvironmentColor = (env: string) => {
    switch (env) {
      case 'production': return 'bg-red-100 text-red-800'
      case 'staging': return 'bg-yellow-100 text-yellow-800'
      case 'development': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const ExecutionCard = ({ execution }: { execution: WorkflowExecution }) => {
    const StatusIcon = getStatusIcon(execution.status)
    const progress = calculateProgress(execution)
    const isRunning = execution.status === 'running'

    return (
      <Card className="transition-all hover:shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <StatusIcon className={cn(
                  "h-4 w-4",
                  execution.status === 'running' && "animate-spin",
                  execution.status === 'completed' && "text-green-600",
                  execution.status === 'failed' && "text-red-600",
                  execution.status === 'cancelled' && "text-gray-600"
                )} />
                <CardTitle className="text-base truncate">
                  {execution.workflowName}
                </CardTitle>
                <Badge className={getStatusColor(execution.status)}>
                  {execution.status}
                </Badge>
              </div>
              <CardDescription className="text-sm">
                ID: {execution.id} • Triggered by {execution.triggeredBy}
              </CardDescription>
            </div>
            
            <div className="flex items-center gap-1 ml-4">
              <Badge className={getEnvironmentColor(execution.environment)}>
                {execution.environment}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedExecution(execution)}
              >
                <Eye className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Progress */}
          {isRunning && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{execution.completedSteps}/{execution.totalSteps} steps</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <div className="font-medium">
                {formatDuration(execution.duration)}
              </div>
              <div className="text-muted-foreground">Duration</div>
            </div>
            <div className="text-center">
              <div className="font-medium">{execution.totalSteps}</div>
              <div className="text-muted-foreground">Total Steps</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-red-600">{execution.failedSteps}</div>
              <div className="text-muted-foreground">Failed</div>
            </div>
          </div>

          {/* Error Message */}
          {execution.errorMessage && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                {execution.errorMessage}
              </AlertDescription>
            </Alert>
          )}

          {/* Metadata */}
          {execution.metadata && (
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              {execution.metadata.apiCallsCount && (
                <div>API Calls: {execution.metadata.apiCallsCount}</div>
              )}
              {execution.metadata.cost && (
                <div>Cost: ${execution.metadata.cost.toFixed(4)}</div>
              )}
            </div>
          )}

          <Separator />

          {/* Actions and Timing */}
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              Started {formatDistanceToNow(new Date(execution.startTime), { addSuffix: true })}
            </div>
            <div className="flex gap-2">
              {execution.status === 'running' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onStopExecution(execution.id)}
                >
                  <Square className="h-3 w-3 mr-1" />
                  Stop
                </Button>
              )}
              {(execution.status === 'failed' || execution.status === 'cancelled') && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onRetryExecution(execution.id)}
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Retry
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => onViewLogs(execution)}
              >
                <FileText className="h-3 w-3 mr-1" />
                Logs
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const StepDetail = ({ step }: { step: WorkflowExecutionStep }) => {
    const StatusIcon = getStepStatusIcon(step.status)
    
    return (
      <div className="border rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <StatusIcon className={cn(
              "h-4 w-4",
              step.status === 'running' && "animate-spin text-blue-600",
              step.status === 'completed' && "text-green-600",
              step.status === 'failed' && "text-red-600",
              step.status === 'skipped' && "text-gray-600"
            )} />
            <span className="font-medium">{step.stepName}</span>
            <Badge variant="outline" className="text-xs">
              {step.stepType}
            </Badge>
          </div>
          <div className="text-sm text-muted-foreground">
            {step.duration ? formatDuration(step.duration) : 'Running...'}
          </div>
        </div>
        
        {step.errorMessage && (
          <Alert variant="destructive" className="mb-2">
            <Bug className="h-4 w-4" />
            <AlertDescription>{step.errorMessage}</AlertDescription>
          </Alert>
        )}
        
        {step.retryCount && step.retryCount > 0 && (
          <div className="text-xs text-muted-foreground mb-2">
            Retried {step.retryCount} time{step.retryCount !== 1 ? 's' : ''}
          </div>
        )}
        
        <div className="text-xs text-muted-foreground">
          Started: {format(new Date(step.startTime), 'HH:mm:ss')}
          {step.endTime && (
            <> • Completed: {format(new Date(step.endTime), 'HH:mm:ss')}</>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Workflow Executions</h2>
          <p className="text-muted-foreground">
            Monitor and manage your workflow execution history
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search executions..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-10"
                />
              </div>

              <Select 
                value={filters.dateRange} 
                onValueChange={(value: any) => setFilters(prev => ({ ...prev, dateRange: value }))}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                </SelectContent>
              </Select>

              <Select 
                value={viewMode} 
                onValueChange={(value: any) => setViewMode(value)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="list">List View</SelectItem>
                  <SelectItem value="detailed">Detailed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Executions List */}
      <div className={cn(
        "grid gap-4",
        viewMode === 'detailed' ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
      )}>
        {filteredExecutions.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="text-center py-12">
              <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No executions found</h3>
              <p className="text-muted-foreground">
                No workflow executions match your current filters.
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredExecutions.map((execution) => (
            <ExecutionCard key={execution.id} execution={execution} />
          ))
        )}
      </div>

      {/* Execution Detail Dialog */}
      <Dialog open={!!selectedExecution} onOpenChange={() => setSelectedExecution(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedExecution && (
                <>
                  {React.createElement(getStatusIcon(selectedExecution.status), {
                    className: cn(
                      "h-5 w-5",
                      selectedExecution.status === 'completed' && "text-green-600",
                      selectedExecution.status === 'failed' && "text-red-600",
                      selectedExecution.status === 'running' && "text-blue-600 animate-spin"
                    )
                  })}
                  Execution Details - {selectedExecution.workflowName}
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedExecution && (
            <ScrollArea className="max-h-[60vh]">
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="steps">Steps</TabsTrigger>
                  <TabsTrigger value="logs">Logs</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Execution Info</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>ID:</span>
                          <span className="font-mono">{selectedExecution.id}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Status:</span>
                          <Badge className={getStatusColor(selectedExecution.status)}>
                            {selectedExecution.status}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Environment:</span>
                          <Badge className={getEnvironmentColor(selectedExecution.environment)}>
                            {selectedExecution.environment}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Version:</span>
                          <span>{selectedExecution.version}</span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Timing</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Started:</span>
                          <span>{format(new Date(selectedExecution.startTime), 'PPpp')}</span>
                        </div>
                        {selectedExecution.endTime && (
                          <div className="flex justify-between">
                            <span>Completed:</span>
                            <span>{format(new Date(selectedExecution.endTime), 'PPpp')}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>Duration:</span>
                          <span>{formatDuration(selectedExecution.duration)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Triggered by:</span>
                          <span>{selectedExecution.triggeredBy}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {selectedExecution.metadata && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Performance Metrics</CardTitle>
                      </CardHeader>
                      <CardContent className="grid grid-cols-4 gap-4 text-sm">
                        {selectedExecution.metadata.apiCallsCount && (
                          <div className="text-center">
                            <div className="font-bold text-lg">{selectedExecution.metadata.apiCallsCount}</div>
                            <div className="text-muted-foreground">API Calls</div>
                          </div>
                        )}
                        {selectedExecution.metadata.totalMemoryUsed && (
                          <div className="text-center">
                            <div className="font-bold text-lg">{(selectedExecution.metadata.totalMemoryUsed / 1024 / 1024).toFixed(1)}MB</div>
                            <div className="text-muted-foreground">Memory</div>
                          </div>
                        )}
                        {selectedExecution.metadata.totalCpuTime && (
                          <div className="text-center">
                            <div className="font-bold text-lg">{selectedExecution.metadata.totalCpuTime}ms</div>
                            <div className="text-muted-foreground">CPU Time</div>
                          </div>
                        )}
                        {selectedExecution.metadata.cost && (
                          <div className="text-center">
                            <div className="font-bold text-lg">${selectedExecution.metadata.cost.toFixed(4)}</div>
                            <div className="text-muted-foreground">Cost</div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="steps" className="space-y-3">
                  {selectedExecution.steps.map((step) => (
                    <StepDetail key={step.id} step={step} />
                  ))}
                </TabsContent>

                <TabsContent value="logs" className="space-y-3">
                  <div className="space-y-2">
                    {selectedExecution.steps.flatMap(step => step.logs)
                      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                      .map((log, index) => (
                        <div key={index} className={cn(
                          "p-2 rounded text-xs font-mono",
                          log.level === 'error' && "bg-red-50 text-red-900",
                          log.level === 'warn' && "bg-yellow-50 text-yellow-900",
                          log.level === 'info' && "bg-blue-50 text-blue-900",
                          log.level === 'debug' && "bg-gray-50 text-gray-900"
                        )}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-muted-foreground">
                              {format(new Date(log.timestamp), 'HH:mm:ss.SSS')}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {log.level.toUpperCase()}
                            </Badge>
                          </div>
                          <div>{log.message}</div>
                          {log.data && (
                            <pre className="mt-1 text-xs bg-white p-1 rounded">
                              {JSON.stringify(log.data, null, 2)}
                            </pre>
                          )}
                        </div>
                      ))}
                  </div>
                </TabsContent>
              </Tabs>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}