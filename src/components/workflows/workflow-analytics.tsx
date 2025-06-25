'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart,
  Legend
} from 'recharts'
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  CheckCircle, 
  XCircle, 
  Clock,
  Zap,
  AlertTriangle,
  BarChart3,
  PieChart as PieChartIcon,
  LineChart as LineChartIcon,
  Download,
  RefreshCw,
  Calendar,
  DollarSign,
  Timer,
  Target,
  AlertCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { format, subDays, subWeeks, subMonths, startOfDay, endOfDay } from 'date-fns'

export interface WorkflowExecution {
  id: string
  workflowId: string
  workflowName: string
  status: 'completed' | 'failed' | 'cancelled' | 'timeout'
  startTime: string
  endTime?: string
  duration?: number
  totalSteps: number
  completedSteps: number
  failedSteps: number
  triggeredBy: string
  environment: 'development' | 'staging' | 'production'
  metadata: {
    totalMemoryUsed?: number
    totalCpuTime?: number
    apiCallsCount?: number
    cost?: number
  }
}

export interface Workflow {
  id: string
  name: string
  category: string
  status: 'active' | 'inactive'
  complexity: 'simple' | 'medium' | 'complex'
  createdAt: string
  executionCount: number
  successRate: number
  avgExecutionTime: number
}

interface WorkflowAnalyticsProps {
  workflows: Workflow[]
  executions: WorkflowExecution[]
  className?: string
  dateRange?: 'week' | 'month' | 'quarter' | 'year'
  onDateRangeChange?: (range: 'week' | 'month' | 'quarter' | 'year') => void
}

interface AnalyticsData {
  totalExecutions: number
  successfulExecutions: number
  failedExecutions: number
  averageExecutionTime: number
  totalCost: number
  totalApiCalls: number
  successRate: number
  executionTrend: { date: string; successful: number; failed: number; total: number }[]
  workflowPerformance: { name: string; executions: number; successRate: number; avgTime: number }[]
  statusDistribution: { name: string; value: number; color: string }[]
  executionsByEnvironment: { name: string; value: number; color: string }[]
  costTrend: { date: string; cost: number }[]
  errorAnalysis: { workflow: string; errorCount: number; commonErrors: string[] }[]
  performanceMetrics: {
    averageMemoryUsage: number
    averageCpuTime: number
    peakMemoryUsage: number
    peakCpuTime: number
  }
}

const COLORS = {
  completed: '#10b981',
  failed: '#ef4444',
  cancelled: '#6b7280',
  timeout: '#f59e0b',
  development: '#10b981',
  staging: '#f59e0b',
  production: '#ef4444'
}

export default function WorkflowAnalytics({ 
  workflows, 
  executions, 
  className,
  dateRange = 'month',
  onDateRangeChange
}: WorkflowAnalyticsProps) {
  const [selectedView, setSelectedView] = useState<'overview' | 'performance' | 'costs' | 'errors'>('overview')
  const [selectedWorkflow, setSelectedWorkflow] = useState<string>('all')

  // Calculate analytics data
  const analyticsData: AnalyticsData = useMemo(() => {
    const now = new Date()
    let startDate: Date

    switch (dateRange) {
      case 'week':
        startDate = subWeeks(now, 1)
        break
      case 'month':
        startDate = subMonths(now, 1)
        break
      case 'quarter':
        startDate = subMonths(now, 3)
        break
      case 'year':
        startDate = subMonths(now, 12)
        break
      default:
        startDate = subMonths(now, 1)
    }

    // Filter executions by date range and workflow
    const filteredExecutions = executions.filter(execution => {
      const executionDate = new Date(execution.startTime)
      const matchesDate = executionDate >= startDate
      const matchesWorkflow = selectedWorkflow === 'all' || execution.workflowId === selectedWorkflow
      
      return matchesDate && matchesWorkflow
    })

    const totalExecutions = filteredExecutions.length
    const successfulExecutions = filteredExecutions.filter(e => e.status === 'completed').length
    const failedExecutions = filteredExecutions.filter(e => e.status === 'failed').length
    const successRate = totalExecutions > 0 ? (successfulExecutions / totalExecutions * 100) : 0

    // Calculate average execution time
    const executionsWithTime = filteredExecutions.filter(e => e.duration)
    const averageExecutionTime = executionsWithTime.length > 0
      ? executionsWithTime.reduce((sum, e) => sum + (e.duration || 0), 0) / executionsWithTime.length
      : 0

    // Calculate total cost and API calls
    const totalCost = filteredExecutions.reduce((sum, e) => sum + (e.metadata.cost || 0), 0)
    const totalApiCalls = filteredExecutions.reduce((sum, e) => sum + (e.metadata.apiCallsCount || 0), 0)

    // Execution trend data
    const executionTrend = []
    const days = dateRange === 'week' ? 7 : dateRange === 'month' ? 30 : dateRange === 'quarter' ? 90 : 365
    
    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(now, i)
      const dayStart = startOfDay(date)
      const dayEnd = endOfDay(date)
      
      const dayExecutions = filteredExecutions.filter(e => {
        const execDate = new Date(e.startTime)
        return execDate >= dayStart && execDate <= dayEnd
      })
      
      const successful = dayExecutions.filter(e => e.status === 'completed').length
      const failed = dayExecutions.filter(e => e.status === 'failed').length
      
      executionTrend.push({
        date: format(date, 'MMM dd'),
        successful,
        failed,
        total: dayExecutions.length
      })
    }

    // Workflow performance
    const workflowStats = new Map()
    filteredExecutions.forEach(execution => {
      const workflowId = execution.workflowId
      if (!workflowStats.has(workflowId)) {
        workflowStats.set(workflowId, {
          name: execution.workflowName,
          executions: 0,
          successful: 0,
          totalTime: 0,
          timeCount: 0
        })
      }
      
      const stats = workflowStats.get(workflowId)
      stats.executions++
      if (execution.status === 'completed') stats.successful++
      if (execution.duration) {
        stats.totalTime += execution.duration
        stats.timeCount++
      }
    })

    const workflowPerformance = Array.from(workflowStats.values()).map(stats => ({
      name: stats.name,
      executions: stats.executions,
      successRate: stats.executions > 0 ? (stats.successful / stats.executions * 100) : 0,
      avgTime: stats.timeCount > 0 ? stats.totalTime / stats.timeCount : 0
    })).sort((a, b) => b.executions - a.executions)

    // Status distribution
    const statusCounts = filteredExecutions.reduce((acc, execution) => {
      acc[execution.status] = (acc[execution.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const statusDistribution = Object.entries(statusCounts).map(([status, count]) => ({
      name: status.charAt(0).toUpperCase() + status.slice(1),
      value: count,
      color: COLORS[status as keyof typeof COLORS] || '#6b7280'
    }))

    // Environment distribution
    const envCounts = filteredExecutions.reduce((acc, execution) => {
      acc[execution.environment] = (acc[execution.environment] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const executionsByEnvironment = Object.entries(envCounts).map(([env, count]) => ({
      name: env.charAt(0).toUpperCase() + env.slice(1),
      value: count,
      color: COLORS[env as keyof typeof COLORS] || '#6b7280'
    }))

    // Cost trend
    const costTrend = []
    for (let i = 29; i >= 0; i--) {
      const date = subDays(now, i)
      const dayStart = startOfDay(date)
      const dayEnd = endOfDay(date)
      
      const dayCost = filteredExecutions
        .filter(e => {
          const execDate = new Date(e.startTime)
          return execDate >= dayStart && execDate <= dayEnd
        })
        .reduce((sum, e) => sum + (e.metadata.cost || 0), 0)
      
      costTrend.push({
        date: format(date, 'MMM dd'),
        cost: dayCost
      })
    }

    // Error analysis
    const errorsByWorkflow = new Map()
    filteredExecutions
      .filter(e => e.status === 'failed')
      .forEach(execution => {
        const workflowName = execution.workflowName
        if (!errorsByWorkflow.has(workflowName)) {
          errorsByWorkflow.set(workflowName, {
            workflow: workflowName,
            errorCount: 0,
            commonErrors: []
          })
        }
        errorsByWorkflow.get(workflowName).errorCount++
      })

    const errorAnalysis = Array.from(errorsByWorkflow.values())
      .sort((a, b) => b.errorCount - a.errorCount)

    // Performance metrics
    const performanceMetrics = {
      averageMemoryUsage: filteredExecutions.reduce((sum, e) => sum + (e.metadata.totalMemoryUsed || 0), 0) / filteredExecutions.length,
      averageCpuTime: filteredExecutions.reduce((sum, e) => sum + (e.metadata.totalCpuTime || 0), 0) / filteredExecutions.length,
      peakMemoryUsage: Math.max(...filteredExecutions.map(e => e.metadata.totalMemoryUsed || 0)),
      peakCpuTime: Math.max(...filteredExecutions.map(e => e.metadata.totalCpuTime || 0))
    }

    return {
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      averageExecutionTime,
      totalCost,
      totalApiCalls,
      successRate,
      executionTrend,
      workflowPerformance,
      statusDistribution,
      executionsByEnvironment,
      costTrend,
      errorAnalysis,
      performanceMetrics
    }
  }, [workflows, executions, dateRange, selectedWorkflow])

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${(ms / 60000).toFixed(1)}m`
  }

  const formatMemory = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`
  }

  const StatCard = ({ 
    title, 
    value, 
    change, 
    trend, 
    icon: Icon, 
    description,
    color = "text-gray-600"
  }: {
    title: string
    value: string | number
    change?: number
    trend?: 'up' | 'down'
    icon: any
    description?: string
    color?: string
  }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={cn("h-4 w-4", color)} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {change !== undefined && (
          <div className={cn(
            "flex items-center text-xs",
            trend === 'up' ? 'text-green-600' : 'text-red-600'
          )}>
            {trend === 'up' ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
            {Math.abs(change)}% from last period
          </div>
        )}
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  )

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Workflow Analytics</h2>
          <p className="text-muted-foreground">
            Performance insights and metrics for your automation workflows
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedWorkflow} onValueChange={setSelectedWorkflow}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Workflows</SelectItem>
              {workflows.map(workflow => (
                <SelectItem key={workflow.id} value={workflow.id}>
                  {workflow.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={dateRange} onValueChange={onDateRangeChange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="quarter">This Quarter</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>
          
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Executions"
          value={analyticsData.totalExecutions}
          icon={Activity}
          description={`${analyticsData.successfulExecutions} successful`}
        />
        <StatCard
          title="Success Rate"
          value={`${Math.round(analyticsData.successRate)}%`}
          icon={CheckCircle}
          color="text-green-600"
          description={`${analyticsData.failedExecutions} failed`}
        />
        <StatCard
          title="Avg Execution Time"
          value={formatDuration(analyticsData.averageExecutionTime)}
          icon={Timer}
          color="text-blue-600"
        />
        <StatCard
          title="Total Cost"
          value={`$${analyticsData.totalCost.toFixed(2)}`}
          icon={DollarSign}
          color="text-purple-600"
          description={`${analyticsData.totalApiCalls} API calls`}
        />
      </div>

      {/* Main Analytics */}
      <Tabs value={selectedView} onValueChange={(value: any) => setSelectedView(value)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="costs">Costs</TabsTrigger>
          <TabsTrigger value="errors">Errors</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Execution Trend */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LineChartIcon className="h-5 w-5" />
                  Execution Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analyticsData.executionTrend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Area 
                        type="monotone" 
                        dataKey="successful" 
                        stackId="1" 
                        stroke="#10b981" 
                        fill="#10b981" 
                        fillOpacity={0.6}
                        name="Successful"
                      />
                      <Area 
                        type="monotone" 
                        dataKey="failed" 
                        stackId="1" 
                        stroke="#ef4444" 
                        fill="#ef4444" 
                        fillOpacity={0.6}
                        name="Failed"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Status Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChartIcon className="h-5 w-5" />
                  Status Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={analyticsData.statusDistribution}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {analyticsData.statusDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Workflow Performance */}
          <Card>
            <CardHeader>
              <CardTitle>Workflow Performance</CardTitle>
              <CardDescription>
                Performance metrics for each workflow
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analyticsData.workflowPerformance.slice(0, 10).map((workflow) => (
                  <div key={workflow.name} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{workflow.name}</span>
                      <div className="flex items-center gap-4 text-sm">
                        <span>{workflow.executions} executions</span>
                        <span className={cn(
                          "font-medium",
                          workflow.successRate >= 90 ? "text-green-600" : 
                          workflow.successRate >= 70 ? "text-yellow-600" : "text-red-600"
                        )}>
                          {Math.round(workflow.successRate)}% success
                        </span>
                        <span className="text-muted-foreground">
                          {formatDuration(workflow.avgTime)} avg
                        </span>
                      </div>
                    </div>
                    <Progress value={workflow.successRate} className="h-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          {/* Performance Metrics */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Avg Memory Usage</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatMemory(analyticsData.performanceMetrics.averageMemoryUsage)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Peak: {formatMemory(analyticsData.performanceMetrics.peakMemoryUsage)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Avg CPU Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatDuration(analyticsData.performanceMetrics.averageCpuTime)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Peak: {formatDuration(analyticsData.performanceMetrics.peakCpuTime)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">API Calls</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analyticsData.totalApiCalls}</div>
                <p className="text-xs text-muted-foreground">
                  {(analyticsData.totalApiCalls / analyticsData.totalExecutions || 0).toFixed(1)} per execution
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Efficiency Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Math.round(analyticsData.successRate * 0.6 + 
                    (analyticsData.averageExecutionTime < 30000 ? 40 : 20))}
                </div>
                <p className="text-xs text-muted-foreground">Based on success rate & speed</p>
              </CardContent>
            </Card>
          </div>

          {/* Environment Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Executions by Environment</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analyticsData.executionsByEnvironment}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#3b82f6">
                      {analyticsData.executionsByEnvironment.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="costs" className="space-y-6">
          {/* Cost Trend */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Cost Trend
              </CardTitle>
              <CardDescription>
                Daily cost breakdown over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analyticsData.costTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip formatter={(value) => `$${Number(value).toFixed(4)}`} />
                    <Line 
                      type="monotone" 
                      dataKey="cost" 
                      stroke="#8b5cf6" 
                      strokeWidth={2}
                      dot={{ fill: '#8b5cf6' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Cost Breakdown */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Total Cost</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${analyticsData.totalCost.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">
                  ${(analyticsData.totalCost / Math.max(analyticsData.totalExecutions, 1)).toFixed(4)} per execution
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Daily Average</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${(analyticsData.totalCost / 30).toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground">Based on 30-day period</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Projected Monthly</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${(analyticsData.totalCost * 30 / 30).toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground">Based on current usage</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="errors" className="space-y-6">
          {/* Error Analysis */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Error Analysis
              </CardTitle>
              <CardDescription>
                Workflows with the highest error rates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analyticsData.errorAnalysis.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                    <p>No errors detected in the selected time period</p>
                  </div>
                ) : (
                  analyticsData.errorAnalysis.map((error) => (
                    <div key={error.workflow} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <AlertCircle className="h-5 w-5 text-red-500" />
                        <div>
                          <div className="font-medium">{error.workflow}</div>
                          <div className="text-sm text-muted-foreground">
                            {error.errorCount} error{error.errorCount !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>
                      <Badge variant="destructive">
                        {error.errorCount}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Error Rate Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Error Rate Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analyticsData.executionTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line 
                      type="monotone" 
                      dataKey="failed" 
                      stroke="#ef4444" 
                      strokeWidth={2}
                      name="Failed Executions"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}