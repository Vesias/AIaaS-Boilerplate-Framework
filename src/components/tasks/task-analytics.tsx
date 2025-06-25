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
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  Calendar,
  User,
  Flag,
  Target,
  BarChart3,
  PieChart as PieChartIcon,
  LineChart as LineChartIcon,
  Download,
  RefreshCw,
  Filter
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { format, subDays, subWeeks, subMonths, startOfWeek, startOfMonth, startOfYear } from 'date-fns'

export interface Task {
  id: string
  title: string
  content?: string
  completed: boolean
  priority: 'low' | 'medium' | 'high'
  status: 'todo' | 'in_progress' | 'review' | 'done'
  dueDate?: string
  assignee?: string
  tags: string[]
  estimatedHours?: number
  actualHours?: number
  createdAt: string
  updatedAt: string
  completedAt?: string
}

interface TaskAnalyticsProps {
  tasks: Task[]
  className?: string
  showExport?: boolean
  showFilters?: boolean
  dateRange?: 'week' | 'month' | 'quarter' | 'year'
  onDateRangeChange?: (range: 'week' | 'month' | 'quarter' | 'year') => void
}

interface AnalyticsData {
  totalTasks: number
  completedTasks: number
  pendingTasks: number
  overdueTasks: number
  averageCompletionTime: number
  productivityScore: number
  completionRate: number
  estimateAccuracy: number
  priorityDistribution: { name: string; value: number; color: string }[]
  statusDistribution: { name: string; value: number; color: string }[]
  completionTrend: { date: string; completed: number; created: number }[]
  productivityTrend: { date: string; productivity: number }[]
  timeSpentByPriority: { priority: string; estimated: number; actual: number }[]
  tasksByAssignee: { assignee: string; completed: number; pending: number; total: number }[]
  tagsPerformance: { tag: string; tasks: number; completionRate: number; avgTime: number }[]
}

const COLORS = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#10b981',
  todo: '#6b7280',
  in_progress: '#3b82f6',
  review: '#f59e0b',
  done: '#10b981'
}

export default function TaskAnalytics({ 
  tasks, 
  className,
  showExport = true,
  showFilters = true,
  dateRange = 'month',
  onDateRangeChange
}: TaskAnalyticsProps) {
  const [selectedView, setSelectedView] = useState<'overview' | 'productivity' | 'team' | 'trends'>('overview')
  const [selectedAssignee, setSelectedAssignee] = useState<string>('all')
  const [selectedTag, setSelectedTag] = useState<string>('all')

  // Calculate analytics data
  const analyticsData: AnalyticsData = useMemo(() => {
    const now = new Date()
    let startDate: Date

    switch (dateRange) {
      case 'week':
        startDate = startOfWeek(now)
        break
      case 'month':
        startDate = startOfMonth(now)
        break
      case 'quarter':
        startDate = subMonths(now, 3)
        break
      case 'year':
        startDate = startOfYear(now)
        break
      default:
        startDate = startOfMonth(now)
    }

    // Filter tasks by date range and other filters
    const filteredTasks = tasks.filter(task => {
      const taskDate = new Date(task.createdAt)
      const matchesDate = taskDate >= startDate
      const matchesAssignee = selectedAssignee === 'all' || task.assignee === selectedAssignee
      const matchesTag = selectedTag === 'all' || task.tags.includes(selectedTag)
      
      return matchesDate && matchesAssignee && matchesTag
    })

    const totalTasks = filteredTasks.length
    const completedTasks = filteredTasks.filter(t => t.completed).length
    const pendingTasks = totalTasks - completedTasks
    const overdueTasks = filteredTasks.filter(t => 
      !t.completed && t.dueDate && new Date(t.dueDate) < now
    ).length

    // Calculate average completion time
    const completedTasksWithTime = filteredTasks.filter(t => 
      t.completed && t.completedAt && t.createdAt
    )
    const averageCompletionTime = completedTasksWithTime.length > 0
      ? completedTasksWithTime.reduce((sum, task) => {
          const created = new Date(task.createdAt).getTime()
          const completed = new Date(task.completedAt!).getTime()
          return sum + (completed - created) / (1000 * 60 * 60 * 24) // days
        }, 0) / completedTasksWithTime.length
      : 0

    // Calculate productivity score (0-100)
    const onTimeCompletions = filteredTasks.filter(t => 
      t.completed && t.dueDate && t.completedAt && 
      new Date(t.completedAt) <= new Date(t.dueDate)
    ).length
    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks * 100) : 0
    const onTimeRate = completedTasks > 0 ? (onTimeCompletions / completedTasks * 100) : 0
    const productivityScore = Math.round((completionRate * 0.6) + (onTimeRate * 0.4))

    // Calculate estimate accuracy
    const tasksWithEstimates = filteredTasks.filter(t => 
      t.estimatedHours && t.actualHours && t.completed
    )
    const estimateAccuracy = tasksWithEstimates.length > 0
      ? tasksWithEstimates.reduce((sum, task) => {
          const accuracy = Math.min(task.estimatedHours!, task.actualHours!) / 
                          Math.max(task.estimatedHours!, task.actualHours!) * 100
          return sum + accuracy
        }, 0) / tasksWithEstimates.length
      : 0

    // Priority distribution
    const priorityDistribution = [
      { 
        name: 'High', 
        value: filteredTasks.filter(t => t.priority === 'high').length,
        color: COLORS.high
      },
      { 
        name: 'Medium', 
        value: filteredTasks.filter(t => t.priority === 'medium').length,
        color: COLORS.medium
      },
      { 
        name: 'Low', 
        value: filteredTasks.filter(t => t.priority === 'low').length,
        color: COLORS.low
      }
    ]

    // Status distribution
    const statusDistribution = [
      { 
        name: 'To Do', 
        value: filteredTasks.filter(t => t.status === 'todo').length,
        color: COLORS.todo
      },
      { 
        name: 'In Progress', 
        value: filteredTasks.filter(t => t.status === 'in_progress').length,
        color: COLORS.in_progress
      },
      { 
        name: 'Review', 
        value: filteredTasks.filter(t => t.status === 'review').length,
        color: COLORS.review
      },
      { 
        name: 'Done', 
        value: filteredTasks.filter(t => t.status === 'done').length,
        color: COLORS.done
      }
    ]

    // Completion trend (last 30 days)
    const completionTrend = []
    for (let i = 29; i >= 0; i--) {
      const date = subDays(now, i)
      const dateStr = format(date, 'MMM dd')
      const completed = filteredTasks.filter(t => 
        t.completedAt && format(new Date(t.completedAt), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
      ).length
      const created = filteredTasks.filter(t => 
        format(new Date(t.createdAt), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
      ).length
      
      completionTrend.push({ date: dateStr, completed, created })
    }

    // Productivity trend (weekly averages)
    const productivityTrend = []
    for (let i = 11; i >= 0; i--) {
      const weekStart = subWeeks(now, i)
      const weekEnd = subWeeks(now, i - 1)
      const weekTasks = filteredTasks.filter(t => {
        const taskDate = new Date(t.createdAt)
        return taskDate >= weekStart && taskDate < weekEnd
      })
      
      const weekCompleted = weekTasks.filter(t => t.completed).length
      const weekTotal = weekTasks.length
      const productivity = weekTotal > 0 ? Math.round(weekCompleted / weekTotal * 100) : 0
      
      productivityTrend.push({
        date: format(weekStart, 'MMM dd'),
        productivity
      })
    }

    // Time spent by priority
    const timeSpentByPriority = ['high', 'medium', 'low'].map(priority => {
      const priorityTasks = filteredTasks.filter(t => t.priority === priority)
      const estimated = priorityTasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0)
      const actual = priorityTasks.reduce((sum, t) => sum + (t.actualHours || 0), 0)
      
      return { priority, estimated, actual }
    })

    // Tasks by assignee
    const assignees = Array.from(new Set(filteredTasks.filter(t => t.assignee).map(t => t.assignee!)))
    const tasksByAssignee = assignees.map(assignee => {
      const assigneeTasks = filteredTasks.filter(t => t.assignee === assignee)
      const completed = assigneeTasks.filter(t => t.completed).length
      const pending = assigneeTasks.length - completed
      
      return { assignee, completed, pending, total: assigneeTasks.length }
    })

    // Tags performance
    const allTags = Array.from(new Set(filteredTasks.flatMap(t => t.tags)))
    const tagsPerformance = allTags.map(tag => {
      const tagTasks = filteredTasks.filter(t => t.tags.includes(tag))
      const completedTagTasks = tagTasks.filter(t => t.completed)
      const completionRate = tagTasks.length > 0 ? completedTagTasks.length / tagTasks.length * 100 : 0
      const avgTime = completedTagTasks.length > 0
        ? completedTagTasks.reduce((sum, t) => sum + (t.actualHours || 0), 0) / completedTagTasks.length
        : 0
      
      return { tag, tasks: tagTasks.length, completionRate, avgTime }
    }).sort((a, b) => b.tasks - a.tasks)

    return {
      totalTasks,
      completedTasks,
      pendingTasks,
      overdueTasks,
      averageCompletionTime,
      productivityScore,
      completionRate,
      estimateAccuracy,
      priorityDistribution,
      statusDistribution,
      completionTrend,
      productivityTrend,
      timeSpentByPriority,
      tasksByAssignee,
      tagsPerformance
    }
  }, [tasks, dateRange, selectedAssignee, selectedTag])

  const uniqueAssignees = Array.from(new Set(tasks.filter(t => t.assignee).map(t => t.assignee)))
  const uniqueTags = Array.from(new Set(tasks.flatMap(t => t.tags)))

  const exportData = () => {
    const data = {
      summary: {
        totalTasks: analyticsData.totalTasks,
        completedTasks: analyticsData.completedTasks,
        completionRate: analyticsData.completionRate,
        productivityScore: analyticsData.productivityScore
      },
      trends: analyticsData.completionTrend,
      teamPerformance: analyticsData.tasksByAssignee
    }
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `task-analytics-${format(new Date(), 'yyyy-MM-dd')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const StatCard = ({ 
    title, 
    value, 
    change, 
    trend, 
    icon: Icon, 
    description 
  }: {
    title: string
    value: string | number
    change?: number
    trend?: 'up' | 'down'
    icon: any
    description?: string
  }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
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
          <h2 className="text-2xl font-bold">Task Analytics</h2>
          <p className="text-muted-foreground">
            Insights and performance metrics for your tasks
          </p>
        </div>
        <div className="flex items-center gap-2">
          {showFilters && (
            <>
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
              
              <Select value={selectedAssignee} onValueChange={setSelectedAssignee}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="All Assignees" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Assignees</SelectItem>
                  {uniqueAssignees.map(assignee => (
                    <SelectItem key={assignee} value={assignee}>{assignee}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
          
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          
          {showExport && (
            <Button variant="outline" size="sm" onClick={exportData}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          )}
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Tasks"
          value={analyticsData.totalTasks}
          icon={BarChart3}
          description={`${analyticsData.pendingTasks} pending`}
        />
        <StatCard
          title="Completion Rate"
          value={`${Math.round(analyticsData.completionRate)}%`}
          icon={CheckCircle}
          description={`${analyticsData.completedTasks} completed`}
        />
        <StatCard
          title="Productivity Score"
          value={analyticsData.productivityScore}
          icon={Target}
          description="Based on completion & timing"
        />
        <StatCard
          title="Avg. Completion Time"
          value={`${Math.round(analyticsData.averageCompletionTime)}d`}
          icon={Clock}
          description="Days to complete"
        />
      </div>

      {/* Main Analytics */}
      <Tabs value={selectedView} onValueChange={(value: any) => setSelectedView(value)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="productivity">Productivity</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Priority Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChartIcon className="h-5 w-5" />
                  Priority Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={analyticsData.priorityDistribution}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {analyticsData.priorityDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Status Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Status Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analyticsData.statusDistribution}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="#8884d8">
                        {analyticsData.statusDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Time Accuracy */}
          <Card>
            <CardHeader>
              <CardTitle>Time Estimation Accuracy</CardTitle>
              <CardDescription>
                How well estimated vs actual time align
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Overall Accuracy</span>
                  <span className="text-sm text-muted-foreground">
                    {Math.round(analyticsData.estimateAccuracy)}%
                  </span>
                </div>
                <Progress value={analyticsData.estimateAccuracy} className="h-2" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="productivity" className="space-y-6">
          {/* Completion Trend */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LineChartIcon className="h-5 w-5" />
                Task Completion Trend
              </CardTitle>
              <CardDescription>
                Daily task creation and completion over the last 30 days
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analyticsData.completionTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="completed" stroke="#10b981" name="Completed" />
                    <Line type="monotone" dataKey="created" stroke="#3b82f6" name="Created" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Time Spent by Priority */}
          <Card>
            <CardHeader>
              <CardTitle>Time Spent by Priority</CardTitle>
              <CardDescription>
                Estimated vs actual time spent on different priority tasks
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analyticsData.timeSpentByPriority}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="priority" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="estimated" fill="#94a3b8" name="Estimated Hours" />
                    <Bar dataKey="actual" fill="#3b82f6" name="Actual Hours" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team" className="space-y-6">
          {/* Team Performance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Team Performance
              </CardTitle>
              <CardDescription>
                Task completion by team member
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analyticsData.tasksByAssignee.map((member) => (
                  <div key={member.assignee} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{member.assignee}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{member.total} total</Badge>
                        <span className="text-sm text-muted-foreground">
                          {Math.round(member.completed / member.total * 100)}%
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <div 
                        className="h-2 bg-green-500 rounded-l"
                        style={{ width: `${member.completed / member.total * 100}%` }}
                      />
                      <div 
                        className="h-2 bg-gray-300 rounded-r"
                        style={{ width: `${member.pending / member.total * 100}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{member.completed} completed</span>
                      <span>{member.pending} pending</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Tags Performance */}
          <Card>
            <CardHeader>
              <CardTitle>Tags Performance</CardTitle>
              <CardDescription>
                Performance metrics by task tags
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analyticsData.tagsPerformance.slice(0, 10).map((tag) => (
                  <div key={tag.tag} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{tag.tag}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {tag.tasks} tasks
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className={cn(
                        "font-medium",
                        tag.completionRate >= 80 ? "text-green-600" : 
                        tag.completionRate >= 60 ? "text-yellow-600" : "text-red-600"
                      )}>
                        {Math.round(tag.completionRate)}%
                      </span>
                      <span className="text-muted-foreground">
                        {tag.avgTime.toFixed(1)}h avg
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          {/* Productivity Trend */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Productivity Trend
              </CardTitle>
              <CardDescription>
                Weekly productivity percentage over the last 12 weeks
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analyticsData.productivityTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Area 
                      type="monotone" 
                      dataKey="productivity" 
                      stroke="#3b82f6" 
                      fill="#3b82f6" 
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Key Insights */}
          <Card>
            <CardHeader>
              <CardTitle>Key Insights</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-900">High Performance</h4>
                    <p className="text-sm text-blue-700">
                      Your productivity score of {analyticsData.productivityScore} is above average
                    </p>
                  </div>
                </div>

                {analyticsData.overdueTasks > 0 && (
                  <div className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-yellow-900">Attention Needed</h4>
                      <p className="text-sm text-yellow-700">
                        You have {analyticsData.overdueTasks} overdue tasks that need attention
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-green-900">Time Management</h4>
                    <p className="text-sm text-green-700">
                      Your time estimation accuracy is {Math.round(analyticsData.estimateAccuracy)}%
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}