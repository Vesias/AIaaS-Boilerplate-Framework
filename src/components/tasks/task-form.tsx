'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { 
  Calendar as CalendarIcon, 
  Plus, 
  X, 
  User, 
  Clock, 
  Flag, 
  Tag,
  Save,
  Copy,
  FileText,
  Lightbulb,
  Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

const taskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be less than 200 characters'),
  content: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']),
  status: z.enum(['todo', 'in_progress', 'review', 'done']),
  dueDate: z.date().optional(),
  assignee: z.string().optional(),
  tags: z.array(z.string()),
  estimatedHours: z.number().min(0).optional(),
  actualHours: z.number().min(0).optional(),
  dependencies: z.array(z.string()).optional(),
  attachments: z.array(z.string()).optional(),
  isRecurring: z.boolean().default(false),
  recurringPattern: z.enum(['daily', 'weekly', 'monthly']).optional(),
  notifyAssignee: z.boolean().default(true),
  isTemplate: z.boolean().default(false)
})

type TaskFormData = z.infer<typeof taskSchema>

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
  dependencies?: string[]
  attachments?: string[]
  isRecurring?: boolean
  recurringPattern?: 'daily' | 'weekly' | 'monthly'
}

interface TaskFormProps {
  task?: Task
  onSubmit: (data: TaskFormData) => void
  onCancel: () => void
  availableAssignees?: string[]
  availableTags?: string[]
  availableTasks?: Task[] // For dependencies
  isLoading?: boolean
  className?: string
  showAdvanced?: boolean
}

interface TaskTemplate {
  id: string
  name: string
  description: string
  data: Partial<TaskFormData>
}

const DEFAULT_TEMPLATES: TaskTemplate[] = [
  {
    id: 'bug-fix',
    name: 'Bug Fix',
    description: 'Template for bug fix tasks',
    data: {
      priority: 'high',
      tags: ['bug', 'development'],
      estimatedHours: 2
    }
  },
  {
    id: 'feature',
    name: 'New Feature',
    description: 'Template for new feature development',
    data: {
      priority: 'medium',
      tags: ['feature', 'development'],
      estimatedHours: 8
    }
  },
  {
    id: 'documentation',
    name: 'Documentation',
    description: 'Template for documentation tasks',
    data: {
      priority: 'low',
      tags: ['documentation'],
      estimatedHours: 1
    }
  },
  {
    id: 'testing',
    name: 'Testing',
    description: 'Template for testing tasks',
    data: {
      priority: 'medium',
      tags: ['testing', 'qa'],
      estimatedHours: 3
    }
  }
]

export default function TaskForm({
  task,
  onSubmit,
  onCancel,
  availableAssignees = [],
  availableTags = [],
  availableTasks = [],
  isLoading = false,
  className,
  showAdvanced = true
}: TaskFormProps) {
  const [newTag, setNewTag] = useState('')
  const [showTemplates, setShowTemplates] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplate | null>(null)
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([])
  const [loadingAI, setLoadingAI] = useState(false)

  const form = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: task?.title || '',
      content: task?.content || '',
      priority: task?.priority || 'medium',
      status: task?.status || 'todo',
      dueDate: task?.dueDate ? new Date(task.dueDate) : undefined,
      assignee: task?.assignee || '',
      tags: task?.tags || [],
      estimatedHours: task?.estimatedHours,
      actualHours: task?.actualHours,
      dependencies: task?.dependencies || [],
      attachments: task?.attachments || [],
      isRecurring: task?.isRecurring || false,
      recurringPattern: task?.recurringPattern,
      notifyAssignee: true,
      isTemplate: false
    }
  })

  const watchedTitle = form.watch('title')
  const watchedContent = form.watch('content')
  const watchedTags = form.watch('tags')
  const watchedIsRecurring = form.watch('isRecurring')

  // Generate AI suggestions based on title and content
  useEffect(() => {
    if (watchedTitle && watchedTitle.length > 5) {
      generateAISuggestions()
    }
  }, [watchedTitle, watchedContent])

  const generateAISuggestions = async () => {
    setLoadingAI(true)
    // Simulate AI processing
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    const suggestions = [
      `Consider breaking down "${watchedTitle}" into smaller subtasks`,
      'Add relevant tags for better organization',
      'Set a realistic deadline for this task',
      'Assign an appropriate team member',
      'Estimate the time required accurately'
    ]
    
    setAiSuggestions(suggestions)
    setLoadingAI(false)
  }

  const handleSubmit = (data: TaskFormData) => {
    onSubmit(data)
  }

  const addTag = (tag: string) => {
    const currentTags = form.getValues('tags')
    if (tag && !currentTags.includes(tag)) {
      form.setValue('tags', [...currentTags, tag])
    }
    setNewTag('')
  }

  const removeTag = (tagToRemove: string) => {
    const currentTags = form.getValues('tags')
    form.setValue('tags', currentTags.filter(tag => tag !== tagToRemove))
  }

  const applyTemplate = (template: TaskTemplate) => {
    Object.entries(template.data).forEach(([key, value]) => {
      if (value !== undefined) {
        form.setValue(key as keyof TaskFormData, value as any)
      }
    })
    setSelectedTemplate(template)
    setShowTemplates(false)
  }

  const duplicateTask = () => {
    if (task) {
      form.setValue('title', `${task.title} (Copy)`)
      // Reset some fields for the duplicate
      form.setValue('status', 'todo')
      form.setValue('dueDate', undefined)
      form.setValue('actualHours', undefined)
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-500'
      case 'medium': return 'text-yellow-500'
      case 'low': return 'text-green-500'
      default: return 'text-gray-500'
    }
  }

  return (
    <div className={cn("space-y-6", className)}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              {task ? 'Edit Task' : 'Create New Task'}
            </CardTitle>
            <div className="flex gap-2">
              {task && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={duplicateTask}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicate
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowTemplates(!showTemplates)}
              >
                <FileText className="h-4 w-4 mr-2" />
                Templates
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              {/* Templates Panel */}
              {showTemplates && (
                <div className="p-4 border rounded-lg bg-muted/30">
                  <h4 className="font-medium mb-3">Task Templates</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {DEFAULT_TEMPLATES.map((template) => (
                      <Button
                        key={template.id}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => applyTemplate(template)}
                        className="justify-start h-auto p-3"
                      >
                        <div className="text-left">
                          <div className="font-medium">{template.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {template.description}
                          </div>
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Basic Information */}
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter task title"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter task description"
                          rows={4}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="low">
                              <div className="flex items-center gap-2">
                                <Flag className={cn("h-4 w-4", getPriorityColor('low'))} />
                                Low
                              </div>
                            </SelectItem>
                            <SelectItem value="medium">
                              <div className="flex items-center gap-2">
                                <Flag className={cn("h-4 w-4", getPriorityColor('medium'))} />
                                Medium
                              </div>
                            </SelectItem>
                            <SelectItem value="high">
                              <div className="flex items-center gap-2">
                                <Flag className={cn("h-4 w-4", getPriorityColor('high'))} />
                                High
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="todo">To Do</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="review">Review</SelectItem>
                            <SelectItem value="done">Done</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="dueDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Due Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  "pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  format(field.value, "PPP")
                                ) : (
                                  <span>Pick a date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) =>
                                date < new Date(new Date().setHours(0, 0, 0, 0))
                              }
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="assignee"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Assignee</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select assignee" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="">No assignee</SelectItem>
                            {availableAssignees.map((assignee) => (
                              <SelectItem key={assignee} value={assignee}>
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4" />
                                  {assignee}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="estimatedHours"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estimated Hours</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              type="number"
                              placeholder="0.5"
                              step="0.5"
                              min="0"
                              className="pl-10"
                              {...field}
                              value={field.value || ''}
                              onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {task?.actualHours !== undefined && (
                    <FormField
                      control={form.control}
                      name="actualHours"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Actual Hours</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                              <Input
                                type="number"
                                placeholder="0.5"
                                step="0.5"
                                min="0"
                                className="pl-10"
                                {...field}
                                value={field.value || ''}
                                onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                {/* Tags */}
                <FormField
                  control={form.control}
                  name="tags"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tags</FormLabel>
                      <FormControl>
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <Tag className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                              <Input
                                placeholder="Add tag"
                                value={newTag}
                                onChange={(e) => setNewTag(e.target.value)}
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault()
                                    addTag(newTag)
                                  }
                                }}
                                className="pl-10"
                              />
                            </div>
                            <Button
                              type="button"
                              onClick={() => addTag(newTag)}
                              disabled={!newTag}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                          
                          {availableTags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {availableTags.map((tag) => (
                                <Button
                                  key={tag}
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => addTag(tag)}
                                  disabled={watchedTags.includes(tag)}
                                >
                                  {tag}
                                </Button>
                              ))}
                            </div>
                          )}
                          
                          {watchedTags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {watchedTags.map((tag) => (
                                <Badge key={tag} variant="secondary" className="gap-1">
                                  {tag}
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeTag(tag)}
                                    className="h-auto p-0 hover:bg-transparent"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Advanced Options */}
              {showAdvanced && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <h4 className="font-medium">Advanced Options</h4>
                    
                    <div className="grid grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="isRecurring"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Recurring Task</FormLabel>
                              <div className="text-sm text-muted-foreground">
                                This task repeats on a schedule
                              </div>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="notifyAssignee"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Notify Assignee</FormLabel>
                              <div className="text-sm text-muted-foreground">
                                Send notification to assignee
                              </div>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    {watchedIsRecurring && (
                      <FormField
                        control={form.control}
                        name="recurringPattern"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Recurring Pattern</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select pattern" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="daily">Daily</SelectItem>
                                <SelectItem value="weekly">Weekly</SelectItem>
                                <SelectItem value="monthly">Monthly</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {availableTasks.length > 0 && (
                      <FormField
                        control={form.control}
                        name="dependencies"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Dependencies</FormLabel>
                            <FormControl>
                              <Select onValueChange={(value) => {
                                const currentDeps = field.value || []
                                if (!currentDeps.includes(value)) {
                                  field.onChange([...currentDeps, value])
                                }
                              }}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Add dependency" />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableTasks
                                    .filter(t => t.id !== task?.id)
                                    .map((availableTask) => (
                                      <SelectItem key={availableTask.id} value={availableTask.id}>
                                        {availableTask.title}
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                            </FormControl>
                            {field.value && field.value.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {field.value.map((depId) => {
                                  const depTask = availableTasks.find(t => t.id === depId)
                                  return depTask ? (
                                    <Badge key={depId} variant="outline" className="gap-1">
                                      {depTask.title}
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          field.onChange(field.value?.filter(id => id !== depId))
                                        }}
                                        className="h-auto p-0 hover:bg-transparent"
                                      >
                                        <X className="h-3 w-3" />
                                      </Button>
                                    </Badge>
                                  ) : null
                                })}
                              </div>
                            )}
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>
                </>
              )}

              {/* AI Suggestions */}
              {aiSuggestions.length > 0 && (
                <>
                  <Separator />
                  <Card className="bg-blue-50 border-blue-200">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Lightbulb className="h-4 w-4 text-blue-600" />
                        AI Suggestions
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-24">
                        <ul className="space-y-1 text-sm">
                          {aiSuggestions.map((suggestion, index) => (
                            <li key={index} className="flex items-start gap-2">
                              <span className="text-blue-600">•</span>
                              <span>{suggestion}</span>
                            </li>
                          ))}
                        </ul>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Save className="mr-2 h-4 w-4" />
                  {task ? 'Update Task' : 'Create Task'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}