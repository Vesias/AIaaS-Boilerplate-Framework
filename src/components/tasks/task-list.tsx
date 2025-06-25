'use client'

import { useState } from 'react'
import { 
  DragDropContext, 
  Droppable, 
  Draggable, 
  DropResult 
} from '@hello-pangea/dnd'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { 
  CheckCircle, 
  Circle, 
  Calendar, 
  User, 
  Clock, 
  Trash2, 
  Edit, 
  Filter,
  SortAsc,
  SortDesc,
  GripVertical,
  MoreHorizontal,
  Flag,
  Tag,
  Search
} from 'lucide-react'
import { cn } from '@/lib/utils'

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
  order?: number
}

interface TaskListProps {
  tasks: Task[]
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void
  onTaskDelete: (taskId: string) => void
  onTaskReorder: (tasks: Task[]) => void
  className?: string
  viewMode?: 'list' | 'compact' | 'detailed'
  allowDragDrop?: boolean
  showFilters?: boolean
  showSearch?: boolean
}

interface TaskFilters {
  status: string[]
  priority: string[]
  assignee: string[]
  tags: string[]
  dateRange: 'all' | 'today' | 'week' | 'month' | 'overdue'
}

export default function TaskList({
  tasks,
  onTaskUpdate,
  onTaskDelete,
  onTaskReorder,
  className,
  viewMode = 'list',
  allowDragDrop = true,
  showFilters = true,
  showSearch = true
}: TaskListProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'title' | 'priority' | 'dueDate' | 'createdAt'>('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [selectedTasks, setSelectedTasks] = useState<string[]>([])
  const [filters, setFilters] = useState<TaskFilters>({
    status: [],
    priority: [],
    assignee: [],
    tags: [],
    dateRange: 'all'
  })
  const [showFiltersPanel, setShowFiltersPanel] = useState(false)

  // Filter and sort tasks
  const filteredAndSortedTasks = tasks
    .filter(task => {
      // Search filter
      const matchesSearch = !searchTerm || 
        task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.content?.toLowerCase().includes(searchTerm.toLowerCase())

      // Status filter
      const matchesStatus = filters.status.length === 0 || 
        filters.status.includes(task.status)

      // Priority filter
      const matchesPriority = filters.priority.length === 0 || 
        filters.priority.includes(task.priority)

      // Assignee filter
      const matchesAssignee = filters.assignee.length === 0 || 
        (task.assignee && filters.assignee.includes(task.assignee))

      // Tags filter
      const matchesTags = filters.tags.length === 0 || 
        filters.tags.some(tag => task.tags.includes(tag))

      // Date range filter
      const matchesDateRange = () => {
        if (filters.dateRange === 'all') return true
        
        const now = new Date()
        const taskDate = new Date(task.updatedAt)
        
        switch (filters.dateRange) {
          case 'today':
            return taskDate.toDateString() === now.toDateString()
          case 'week':
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
            return taskDate >= weekAgo
          case 'month':
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
            return taskDate >= monthAgo
          case 'overdue':
            return !task.completed && task.dueDate && new Date(task.dueDate) < now
          default:
            return true
        }
      }

      return matchesSearch && matchesStatus && matchesPriority && matchesAssignee && matchesTags && matchesDateRange()
    })
    .sort((a, b) => {
      let aValue: any, bValue: any

      switch (sortBy) {
        case 'title':
          aValue = a.title.toLowerCase()
          bValue = b.title.toLowerCase()
          break
        case 'priority':
          const priorityOrder = { high: 3, medium: 2, low: 1 }
          aValue = priorityOrder[a.priority]
          bValue = priorityOrder[b.priority]
          break
        case 'dueDate':
          aValue = a.dueDate ? new Date(a.dueDate).getTime() : 0
          bValue = b.dueDate ? new Date(b.dueDate).getTime() : 0
          break
        case 'createdAt':
          aValue = new Date(a.createdAt).getTime()
          bValue = new Date(b.createdAt).getTime()
          break
        default:
          aValue = a.order || 0
          bValue = b.order || 0
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination || !allowDragDrop) return

    const items = Array.from(filteredAndSortedTasks)
    const [reorderedItem] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, reorderedItem)

    // Update order property
    const updatedTasks = items.map((task, index) => ({
      ...task,
      order: index
    }))

    onTaskReorder(updatedTasks)
  }

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTasks(prev => 
      prev.includes(taskId) 
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    )
  }

  const handleBulkAction = (action: 'complete' | 'delete' | 'archive') => {
    selectedTasks.forEach(taskId => {
      if (action === 'complete') {
        onTaskUpdate(taskId, { completed: true, status: 'done' })
      } else if (action === 'delete') {
        onTaskDelete(taskId)
      }
    })
    setSelectedTasks([])
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive'
      case 'medium': return 'default'
      case 'low': return 'secondary'
      default: return 'outline'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done': return 'bg-green-100 text-green-800'
      case 'in_progress': return 'bg-blue-100 text-blue-800'
      case 'review': return 'bg-yellow-100 text-yellow-800'
      case 'todo': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const isOverdue = (task: Task) => {
    return !task.completed && task.dueDate && new Date(task.dueDate) < new Date()
  }

  const uniqueAssignees = Array.from(new Set(tasks.filter(t => t.assignee).map(t => t.assignee)))
  const uniqueTags = Array.from(new Set(tasks.flatMap(t => t.tags)))

  const TaskItem = ({ task, index }: { task: Task; index: number }) => (
    <div className={cn(
      "group flex items-center gap-3 p-4 border rounded-lg transition-all",
      task.completed && "opacity-60",
      isOverdue(task) && "border-red-200 bg-red-50",
      selectedTasks.includes(task.id) && "border-blue-500 bg-blue-50",
      "hover:shadow-md"
    )}>
      {allowDragDrop && (
        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab opacity-0 group-hover:opacity-100" />
      )}
      
      <Checkbox
        checked={selectedTasks.includes(task.id)}
        onCheckedChange={() => toggleTaskSelection(task.id)}
      />

      <Button
        variant="ghost"
        size="sm"
        onClick={() => onTaskUpdate(task.id, { completed: !task.completed, status: !task.completed ? 'done' : 'todo' })}
        className="p-0 h-auto"
      >
        {task.completed ? (
          <CheckCircle className="h-5 w-5 text-green-500" />
        ) : (
          <Circle className="h-5 w-5" />
        )}
      </Button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className={cn(
            "font-medium truncate",
            task.completed && "line-through text-muted-foreground"
          )}>
            {task.title}
          </h3>
          
          <Badge variant={getPriorityColor(task.priority)} className="flex-shrink-0">
            <Flag className="h-3 w-3 mr-1" />
            {task.priority}
          </Badge>
          
          <Badge className={cn("flex-shrink-0", getStatusColor(task.status))}>
            {task.status.replace('_', ' ')}
          </Badge>
        </div>

        {task.content && viewMode !== 'compact' && (
          <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
            {task.content}
          </p>
        )}

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {task.dueDate && (
            <span className={cn(
              "flex items-center gap-1",
              isOverdue(task) && "text-red-600 font-medium"
            )}>
              <Calendar className="h-3 w-3" />
              {new Date(task.dueDate).toLocaleDateString()}
            </span>
          )}
          
          {task.assignee && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {task.assignee}
            </span>
          )}
          
          {task.estimatedHours && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {task.estimatedHours}h
              {task.actualHours && ` / ${task.actualHours}h`}
            </span>
          )}
        </div>

        {task.tags.length > 0 && viewMode !== 'compact' && (
          <div className="flex flex-wrap gap-1 mt-2">
            {task.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                <Tag className="h-2 w-2 mr-1" />
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onTaskUpdate(task.id, {})} // This would open edit modal
          className="h-8 w-8 p-0"
        >
          <Edit className="h-4 w-4" />
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onTaskDelete(task.id)}
          className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
        >
          <Trash2 className="h-4 w-4" />
        </Button>

        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )

  const FiltersPanel = () => (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Filters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium">Status</label>
          <div className="mt-2 space-y-2">
            {['todo', 'in_progress', 'review', 'done'].map(status => (
              <div key={status} className="flex items-center space-x-2">
                <Checkbox
                  checked={filters.status.includes(status)}
                  onCheckedChange={(checked) => {
                    setFilters(prev => ({
                      ...prev,
                      status: checked 
                        ? [...prev.status, status]
                        : prev.status.filter(s => s !== status)
                    }))
                  }}
                />
                <label className="text-sm capitalize">{status.replace('_', ' ')}</label>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        <div>
          <label className="text-sm font-medium">Priority</label>
          <div className="mt-2 space-y-2">
            {['high', 'medium', 'low'].map(priority => (
              <div key={priority} className="flex items-center space-x-2">
                <Checkbox
                  checked={filters.priority.includes(priority)}
                  onCheckedChange={(checked) => {
                    setFilters(prev => ({
                      ...prev,
                      priority: checked 
                        ? [...prev.priority, priority]
                        : prev.priority.filter(p => p !== priority)
                    }))
                  }}
                />
                <label className="text-sm capitalize">{priority}</label>
              </div>
            ))}
          </div>
        </div>

        {uniqueAssignees.length > 0 && (
          <>
            <Separator />
            <div>
              <label className="text-sm font-medium">Assignee</label>
              <div className="mt-2 space-y-2">
                {uniqueAssignees.map(assignee => (
                  <div key={assignee} className="flex items-center space-x-2">
                    <Checkbox
                      checked={filters.assignee.includes(assignee!)}
                      onCheckedChange={(checked) => {
                        setFilters(prev => ({
                          ...prev,
                          assignee: checked 
                            ? [...prev.assignee, assignee!]
                            : prev.assignee.filter(a => a !== assignee)
                        }))
                      }}
                    />
                    <label className="text-sm">{assignee}</label>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {uniqueTags.length > 0 && (
          <>
            <Separator />
            <div>
              <label className="text-sm font-medium">Tags</label>
              <div className="mt-2 space-y-2 max-h-32 overflow-y-auto">
                {uniqueTags.map(tag => (
                  <div key={tag} className="flex items-center space-x-2">
                    <Checkbox
                      checked={filters.tags.includes(tag)}
                      onCheckedChange={(checked) => {
                        setFilters(prev => ({
                          ...prev,
                          tags: checked 
                            ? [...prev.tags, tag]
                            : prev.tags.filter(t => t !== tag)
                        }))
                      }}
                    />
                    <label className="text-sm">{tag}</label>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <Separator />

        <div>
          <label className="text-sm font-medium">Date Range</label>
          <Select 
            value={filters.dateRange} 
            onValueChange={(value: any) => setFilters(prev => ({ ...prev, dateRange: value }))}
          >
            <SelectTrigger className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button 
          variant="outline" 
          className="w-full"
          onClick={() => setFilters({
            status: [],
            priority: [],
            assignee: [],
            tags: [],
            dateRange: 'all'
          })}
        >
          Clear Filters
        </Button>
      </CardContent>
    </Card>
  )

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header Controls */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1">
          {showSearch && (
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search tasks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="title">Title</SelectItem>
              <SelectItem value="priority">Priority</SelectItem>
              <SelectItem value="dueDate">Due Date</SelectItem>
              <SelectItem value="createdAt">Created</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
          >
            {sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
          </Button>

          {showFilters && (
            <Sheet open={showFiltersPanel} onOpenChange={setShowFiltersPanel}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-2" />
                  Filters
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Filter Tasks</SheetTitle>
                </SheetHeader>
                <div className="mt-6">
                  <FiltersPanel />
                </div>
              </SheetContent>
            </Sheet>
          )}
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedTasks.length > 0 && (
        <Card className="p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {selectedTasks.length} task{selectedTasks.length !== 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => handleBulkAction('complete')}>
                Mark Complete
              </Button>
              <Button size="sm" variant="destructive" onClick={() => handleBulkAction('delete')}>
                Delete
              </Button>
              <Button size="sm" variant="outline" onClick={() => setSelectedTasks([])}>
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Task List */}
      <div className="space-y-2">
        {filteredAndSortedTasks.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-muted-foreground">No tasks found matching your criteria.</p>
            </CardContent>
          </Card>
        ) : allowDragDrop ? (
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="tasks">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                  {filteredAndSortedTasks.map((task, index) => (
                    <Draggable key={task.id} draggableId={task.id} index={index}>
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                        >
                          <TaskItem task={task} index={index} />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        ) : (
          <div className="space-y-2">
            {filteredAndSortedTasks.map((task, index) => (
              <TaskItem key={task.id} task={task} index={index} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}