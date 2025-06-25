'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Calendar, CheckCircle, Circle, Clock, Filter, BarChart3, Kanban, List, Grid, Brain, TrendingUp, Archive, User, AlertTriangle, Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'

interface Task {
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
}

interface AITaskSuggestion {
  id: string
  title: string
  description: string
  priority: 'low' | 'medium' | 'high'
  estimatedHours: number
  tags: string[]
  reasoning: string
}

export default function TasksPage() {
  const { userId } = useAuth()
  const { toast } = useToast()
  const [tasks, setTasks] = useState<Task[]>([])
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState<'list' | 'kanban' | 'calendar'>('list')
  const [aiSuggestions, setAiSuggestions] = useState<AITaskSuggestion[]>([])
  const [loadingAI, setLoadingAI] = useState(false)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [dateRange, setDateRange] = useState<'all' | 'today' | 'week' | 'month'>('all')

  // Mock data for demonstration
  useEffect(() => {
    // In a real app, this would fetch from your API
    const mockTasks: Task[] = [
      {
        id: '1',
        title: 'Set up payment processing',
        content: 'Configure Stripe webhooks and test payments',
        completed: false,
        priority: 'high',
        status: 'in_progress',
        dueDate: '2024-01-15',
        assignee: 'John Doe',
        tags: ['backend', 'payments'],
        estimatedHours: 8,
        actualHours: 5,
        createdAt: '2024-01-10',
        updatedAt: '2024-01-14'
      },
      {
        id: '2',
        title: 'Design user dashboard',
        content: 'Create wireframes and implement dashboard UI',
        completed: true,
        priority: 'medium',
        status: 'done',
        assignee: 'Jane Smith',
        tags: ['frontend', 'ui'],
        estimatedHours: 12,
        actualHours: 10,
        createdAt: '2024-01-08',
        updatedAt: '2024-01-12'
      },
      {
        id: '3',
        title: 'Write API documentation',
        content: 'Document all API endpoints with examples',
        completed: false,
        priority: 'low',
        status: 'todo',
        dueDate: '2024-01-20',
        assignee: 'Mike Johnson',
        tags: ['documentation'],
        estimatedHours: 6,
        createdAt: '2024-01-12',
        updatedAt: '2024-01-12'
      },
      {
        id: '4',
        title: 'Implement user authentication',
        content: 'Set up Clerk authentication and user management',
        completed: false,
        priority: 'high',
        status: 'review',
        dueDate: '2024-01-18',
        assignee: 'Sarah Wilson',
        tags: ['backend', 'auth'],
        estimatedHours: 10,
        actualHours: 12,
        createdAt: '2024-01-11',
        updatedAt: '2024-01-15'
      }
    ]
    setTasks(mockTasks)
    setLoading(false)
    generateAISuggestions()
  }, [])

  const generateAISuggestions = async () => {
    setLoadingAI(true)
    // Simulate AI processing
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    const suggestions: AITaskSuggestion[] = [
      {
        id: 'ai-1',
        title: 'Implement real-time notifications',
        description: 'Based on your payment processing work, users would benefit from real-time payment status notifications',
        priority: 'medium',
        estimatedHours: 6,
        tags: ['frontend', 'notifications'],
        reasoning: 'Improves user experience and reduces support tickets'
      },
      {
        id: 'ai-2',
        title: 'Add task time tracking',
        description: 'Your dashboard shows time estimates - adding time tracking would improve project management',
        priority: 'low',
        estimatedHours: 4,
        tags: ['frontend', 'productivity'],
        reasoning: 'Helps with better time estimation and productivity insights'
      },
      {
        id: 'ai-3',
        title: 'Set up error monitoring',
        description: 'With authentication and payments in place, error monitoring becomes critical',
        priority: 'high',
        estimatedHours: 3,
        tags: ['backend', 'monitoring'],
        reasoning: 'Essential for production readiness and user experience'
      }
    ]
    
    setAiSuggestions(suggestions)
    setLoadingAI(false)
  }

  const filteredTasks = tasks.filter(task => {
    const matchesFilter = filter === 'all' || 
      (filter === 'completed' && task.completed) ||
      (filter === 'pending' && !task.completed) ||
      (filter === 'overdue' && !task.completed && task.dueDate && new Date(task.dueDate) < new Date())
    
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.content?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesTags = selectedTags.length === 0 || selectedTags.some(tag => task.tags.includes(tag))
    
    const matchesDate = dateRange === 'all' || (
      dateRange === 'today' && new Date(task.updatedAt).toDateString() === new Date().toDateString()
    ) || (
      dateRange === 'week' && new Date(task.updatedAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    ) || (
      dateRange === 'month' && new Date(task.updatedAt) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    )
    
    return matchesFilter && matchesSearch && matchesTags && matchesDate
  })

  const taskStats = {
    total: tasks.length,
    completed: tasks.filter(t => t.completed).length,
    pending: tasks.filter(t => !t.completed).length,
    overdue: tasks.filter(t => 
      !t.completed && 
      t.dueDate && 
      new Date(t.dueDate) < new Date()
    ).length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    review: tasks.filter(t => t.status === 'review').length,
    totalEstimatedHours: tasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0),
    totalActualHours: tasks.reduce((sum, t) => sum + (t.actualHours || 0), 0),
    completionRate: tasks.length > 0 ? Math.round((tasks.filter(t => t.completed).length / tasks.length) * 100) : 0
  }

  const allTags = Array.from(new Set(tasks.flatMap(task => task.tags)))

  const handleCreateTask = async (formData: FormData) => {
    const tagsString = formData.get('tags') as string
    const newTask: Task = {
      id: Date.now().toString(),
      title: formData.get('title') as string,
      content: formData.get('content') as string,
      completed: false,
      priority: (formData.get('priority') as 'low' | 'medium' | 'high') || 'medium',
      status: 'todo',
      dueDate: formData.get('dueDate') as string || undefined,
      assignee: formData.get('assignee') as string || undefined,
      tags: tagsString ? tagsString.split(',').map(tag => tag.trim()) : [],
      estimatedHours: parseInt(formData.get('estimatedHours') as string) || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    setTasks(prev => [newTask, ...prev])
    setShowTaskForm(false)
    toast({
      title: "Task created",
      description: "Your task has been created successfully."
    })
  }

  const createTaskFromAI = (suggestion: AITaskSuggestion) => {
    const newTask: Task = {
      id: Date.now().toString(),
      title: suggestion.title,
      content: suggestion.description + '\n\nAI Reasoning: ' + suggestion.reasoning,
      completed: false,
      priority: suggestion.priority,
      status: 'todo',
      tags: suggestion.tags,
      estimatedHours: suggestion.estimatedHours,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    setTasks(prev => [newTask, ...prev])
    setAiSuggestions(prev => prev.filter(s => s.id !== suggestion.id))
    toast({
      title: "AI task created",
      description: "Task created from AI suggestion."
    })
  }

  const toggleTask = (id: string) => {
    setTasks(prev => prev.map(task => 
      task.id === id ? { 
        ...task, 
        completed: !task.completed,
        status: !task.completed ? 'done' : 'todo',
        updatedAt: new Date().toISOString()
      } : task
    ))
  }

  const updateTaskStatus = (id: string, status: Task['status']) => {
    setTasks(prev => prev.map(task => 
      task.id === id ? { 
        ...task, 
        status,
        completed: status === 'done',
        updatedAt: new Date().toISOString()
      } : task
    ))
  }

  const deleteTask = (id: string) => {
    setTasks(prev => prev.filter(task => task.id !== id))
    toast({
      title: "Task deleted",
      description: "The task has been removed."
    })
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-500'
      case 'medium': return 'text-yellow-500'
      case 'low': return 'text-green-500'
      default: return 'text-gray-500'
    }
  }

  const KanbanBoard = () => {
    const columns = [
      { id: 'todo', title: 'To Do', tasks: filteredTasks.filter(t => t.status === 'todo') },
      { id: 'in_progress', title: 'In Progress', tasks: filteredTasks.filter(t => t.status === 'in_progress') },
      { id: 'review', title: 'Review', tasks: filteredTasks.filter(t => t.status === 'review') },
      { id: 'done', title: 'Done', tasks: filteredTasks.filter(t => t.status === 'done') }
    ]

    return (
      <div className="grid grid-cols-4 gap-4 h-96">
        {columns.map((column) => (
          <Card key={column.id} className="flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                {column.title} ({column.tasks.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1">
              <ScrollArea className="h-full">
                <div className="space-y-2">
                  {column.tasks.map((task) => (
                    <div
                      key={task.id}
                      className="p-3 bg-muted/50 rounded-lg border cursor-pointer hover:bg-muted/70"
                      onClick={() => updateTaskStatus(task.id, column.id as Task['status'])}
                    >
                      <h4 className="font-medium text-sm">{task.title}</h4>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className={getPriorityColor(task.priority)}>
                          {task.priority}
                        </Badge>
                        {task.dueDate && (
                          <Badge variant="outline" className="text-xs">
                            {new Date(task.dueDate).toLocaleDateString()}
                          </Badge>
                        )}
                      </div>
                      {task.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {task.tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const CalendarView = () => {
    const tasksWithDates = filteredTasks.filter(t => t.dueDate)
    const today = new Date()
    const weekTasks = tasksWithDates.filter(t => {
      const taskDate = new Date(t.dueDate!)
      const diffTime = Math.abs(taskDate.getTime() - today.getTime())
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      return diffDays <= 7
    })

    return (
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Tasks (Next 7 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {weekTasks.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No tasks with due dates in the next week
              </p>
            ) : (
              weekTasks.map((task) => (
                <div key={task.id} className="flex items-center gap-4 p-3 border rounded-lg">
                  <div className="flex-1">
                    <h4 className="font-medium">{task.title}</h4>
                    <p className="text-sm text-muted-foreground">
                      Due: {new Date(task.dueDate!).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant="outline" className={getPriorityColor(task.priority)}>
                    {task.priority}
                  </Badge>
                  <Badge variant={task.completed ? 'default' : 'secondary'}>
                    {task.status}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Tasks</h2>
          <p className="text-muted-foreground">
            Manage your tasks and stay productive with AI-powered insights
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => generateAISuggestions()} disabled={loadingAI}>
            {loadingAI ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Brain className="mr-2 h-4 w-4" />}
            AI Suggestions
          </Button>
          <Button onClick={() => setShowTaskForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Task
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
            <Circle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{taskStats.total}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{taskStats.completed}</div>
            <p className="text-xs text-muted-foreground">
              {taskStats.completionRate}% completion rate
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{taskStats.inProgress}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Review</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{taskStats.review}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <Calendar className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{taskStats.overdue}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Time Efficiency</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {taskStats.totalEstimatedHours > 0 ? 
                Math.round((taskStats.totalActualHours / taskStats.totalEstimatedHours) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              {taskStats.totalActualHours}h / {taskStats.totalEstimatedHours}h
            </p>
          </CardContent>
        </Card>
      </div>

      {/* AI Suggestions */}
      {aiSuggestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              AI Task Suggestions
            </CardTitle>
            <CardDescription>
              AI-powered task recommendations based on your current projects
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {aiSuggestions.map((suggestion) => (
                <div key={suggestion.id} className="p-4 border rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium">{suggestion.title}</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        {suggestion.description}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className={getPriorityColor(suggestion.priority)}>
                          {suggestion.priority}
                        </Badge>
                        <Badge variant="secondary">
                          {suggestion.estimatedHours}h
                        </Badge>
                        {suggestion.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2 italic">
                        💡 {suggestion.reasoning}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => createTaskFromAI(suggestion)}>
                        <Plus className="h-3 w-3 mr-1" />
                        Create
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => setAiSuggestions(prev => prev.filter(s => s.id !== suggestion.id))}
                      >
                        <Archive className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* View Mode Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <Input
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tasks</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'kanban' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('kanban')}
          >
            <Kanban className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'calendar' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('calendar')}
          >
            <Calendar className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tag Filter */}
      {allTags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Tags:</span>
          {allTags.map((tag) => (
            <Button
              key={tag}
              variant={selectedTags.includes(tag) ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setSelectedTags(prev => 
                  prev.includes(tag) 
                    ? prev.filter(t => t !== tag)
                    : [...prev, tag]
                )
              }}
            >
              {tag}
            </Button>
          ))}
          {selectedTags.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedTags([])}
            >
              Clear
            </Button>
          )}
        </div>
      )}

      {/* Tasks Content */}
      {loading ? (
        <Card>
          <CardContent className="text-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            Loading tasks...
          </CardContent>
        </Card>
      ) : (
        <>
          {viewMode === 'list' && (
            <Card>
              <CardHeader>
                <CardTitle>Tasks</CardTitle>
                <CardDescription>
                  Your current tasks and their status
                </CardDescription>
              </CardHeader>
              <CardContent>
                {filteredTasks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No tasks found. Create your first task to get started!
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredTasks.map((task) => (
                      <div
                        key={task.id}
                        className={`flex items-center gap-4 p-4 border rounded-lg ${
                          task.completed ? 'bg-muted/50' : ''
                        }`}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleTask(task.id)}
                          className="p-0 h-auto"
                        >
                          {task.completed ? (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          ) : (
                            <Circle className="h-5 w-5" />
                          )}
                        </Button>
                        
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className={`font-medium ${task.completed ? 'line-through text-muted-foreground' : ''}`}>
                              {task.title}
                            </h3>
                            <Badge variant="outline" className={getPriorityColor(task.priority)}>
                              {task.priority}
                            </Badge>
                            <Badge variant={task.status === 'done' ? 'default' : 'secondary'}>
                              {task.status.replace('_', ' ')}
                            </Badge>
                          </div>
                          {task.content && (
                            <p className={`text-sm ${task.completed ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
                              {task.content}
                            </p>
                          )}
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>Created: {new Date(task.createdAt).toLocaleDateString()}</span>
                            {task.dueDate && (
                              <span className={new Date(task.dueDate) < new Date() && !task.completed ? 'text-red-500' : ''}>
                                Due: {new Date(task.dueDate).toLocaleDateString()}
                              </span>
                            )}
                            {task.assignee && (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {task.assignee}
                              </span>
                            )}
                            {task.estimatedHours && (
                              <span>
                                Est: {task.estimatedHours}h
                                {task.actualHours && ` / Actual: ${task.actualHours}h`}
                              </span>
                            )}
                          </div>
                          {task.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {task.tags.map((tag) => (
                                <Badge key={tag} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Select
                            value={task.status}
                            onValueChange={(value) => updateTaskStatus(task.id, value as Task['status'])}
                          >
                            <SelectTrigger className="w-[120px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="todo">To Do</SelectItem>
                              <SelectItem value="in_progress">In Progress</SelectItem>
                              <SelectItem value="review">Review</SelectItem>
                              <SelectItem value="done">Done</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteTask(task.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {viewMode === 'kanban' && <KanbanBoard />}
          {viewMode === 'calendar' && <CalendarView />}
        </>
      )}

      {/* Create Task Dialog */}
      <Dialog open={showTaskForm} onOpenChange={setShowTaskForm}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
          </DialogHeader>
          <form action={handleCreateTask} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                name="title"
                placeholder="Enter task title"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="content">Description</Label>
              <Textarea
                id="content"
                name="content"
                placeholder="Enter task description (optional)"
                rows={3}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select name="priority" defaultValue="medium">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="dueDate">Due Date</Label>
                <Input
                  id="dueDate"
                  name="dueDate"
                  type="date"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="assignee">Assignee</Label>
                <Input
                  id="assignee"
                  name="assignee"
                  placeholder="Enter assignee name (optional)"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="estimatedHours">Estimated Hours</Label>
                <Input
                  id="estimatedHours"
                  name="estimatedHours"
                  type="number"
                  placeholder="Enter estimated hours"
                  min="0.5"
                  step="0.5"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                name="tags"
                placeholder="Enter tags separated by commas (e.g., frontend, urgent)"
              />
            </div>
            
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowTaskForm(false)}>
                Cancel
              </Button>
              <Button type="submit">
                Create Task
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}