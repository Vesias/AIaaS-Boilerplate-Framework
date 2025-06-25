'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { 
  Filter, 
  Search, 
  X, 
  Calendar as CalendarIcon,
  User,
  Flag,
  Tag,
  Clock,
  SortAsc,
  SortDesc,
  RefreshCw,
  Save,
  Download,
  Settings,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

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
}

export interface TaskFilters {
  search: string
  status: string[]
  priority: string[]
  assignee: string[]
  tags: string[]
  dateRange: {
    start?: Date
    end?: Date
    preset?: 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom'
  }
  completion: 'all' | 'completed' | 'pending' | 'overdue'
  estimatedHours: {
    min: number
    max: number
  }
  createdDateRange: {
    start?: Date
    end?: Date
  }
  sortBy: 'title' | 'priority' | 'dueDate' | 'createdAt' | 'updatedAt' | 'estimatedHours'
  sortOrder: 'asc' | 'desc'
  showArchived: boolean
}

interface TaskFiltersProps {
  tasks: Task[]
  filters: TaskFilters
  onFiltersChange: (filters: TaskFilters) => void
  onReset: () => void
  className?: string
  compact?: boolean
  showAdvanced?: boolean
  enableSavedFilters?: boolean
}

interface SavedFilter {
  id: string
  name: string
  filters: TaskFilters
  createdAt: string
}

const DEFAULT_FILTERS: TaskFilters = {
  search: '',
  status: [],
  priority: [],
  assignee: [],
  tags: [],
  dateRange: { preset: 'month' },
  completion: 'all',
  estimatedHours: { min: 0, max: 40 },
  createdDateRange: {},
  sortBy: 'updatedAt',
  sortOrder: 'desc',
  showArchived: false
}

const DATE_PRESETS = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'quarter', label: 'This Quarter' },
  { value: 'year', label: 'This Year' },
  { value: 'custom', label: 'Custom Range' }
]

export default function TaskFilters({
  tasks,
  filters,
  onFiltersChange,
  onReset,
  className,
  compact = false,
  showAdvanced = true,
  enableSavedFilters = true
}: TaskFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(!compact)
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([])
  const [saveFilterName, setSaveFilterName] = useState('')
  const [showSaveDialog, setShowSaveDialog] = useState(false)

  // Extract unique values from tasks
  const uniqueAssignees = Array.from(new Set(tasks.filter(t => t.assignee).map(t => t.assignee!)))
  const uniqueTags = Array.from(new Set(tasks.flatMap(t => t.tags)))
  const maxEstimatedHours = Math.max(...tasks.map(t => t.estimatedHours || 0), 40)

  // Load saved filters from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('task-filters')
    if (saved) {
      try {
        setSavedFilters(JSON.parse(saved))
      } catch (error) {
        console.error('Failed to load saved filters:', error)
      }
    }
  }, [])

  // Save filters to localStorage
  const saveCurrentFilters = () => {
    if (!saveFilterName.trim()) return

    const newFilter: SavedFilter = {
      id: Date.now().toString(),
      name: saveFilterName,
      filters: { ...filters },
      createdAt: new Date().toISOString()
    }

    const updatedFilters = [...savedFilters, newFilter]
    setSavedFilters(updatedFilters)
    localStorage.setItem('task-filters', JSON.stringify(updatedFilters))
    setSaveFilterName('')
    setShowSaveDialog(false)
  }

  const loadSavedFilter = (savedFilter: SavedFilter) => {
    onFiltersChange(savedFilter.filters)
  }

  const deleteSavedFilter = (filterId: string) => {
    const updatedFilters = savedFilters.filter(f => f.id !== filterId)
    setSavedFilters(updatedFilters)
    localStorage.setItem('task-filters', JSON.stringify(updatedFilters))
  }

  const updateFilter = (key: keyof TaskFilters, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value
    })
  }

  const updateNestedFilter = (parentKey: string, childKey: string, value: any) => {
    onFiltersChange({
      ...filters,
      [parentKey]: {
        ...(filters as any)[parentKey],
        [childKey]: value
      }
    })
  }

  const toggleArrayFilter = (key: keyof TaskFilters, value: string) => {
    const currentArray = filters[key] as string[]
    const newArray = currentArray.includes(value)
      ? currentArray.filter(item => item !== value)
      : [...currentArray, value]
    
    updateFilter(key, newArray)
  }

  const getActiveFiltersCount = () => {
    let count = 0
    if (filters.search) count++
    if (filters.status.length > 0) count++
    if (filters.priority.length > 0) count++
    if (filters.assignee.length > 0) count++
    if (filters.tags.length > 0) count++
    if (filters.completion !== 'all') count++
    if (filters.dateRange.start || filters.dateRange.end || filters.dateRange.preset !== 'month') count++
    if (filters.estimatedHours.min > 0 || filters.estimatedHours.max < 40) count++
    return count
  }

  const exportFilters = () => {
    const dataStr = JSON.stringify({
      filters,
      savedFilters,
      exportDate: new Date().toISOString()
    }, null, 2)
    
    const blob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `task-filters-${format(new Date(), 'yyyy-MM-dd')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            <CardTitle className="text-base">
              Filters {getActiveFiltersCount() > 0 && `(${getActiveFiltersCount()})`}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {enableSavedFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSaveDialog(true)}
                disabled={getActiveFiltersCount() === 0}
              >
                <Save className="h-4 w-4 mr-1" />
                Save
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={exportFilters}
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onReset}
              disabled={getActiveFiltersCount() === 0}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Reset
            </Button>
            {compact && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="space-y-2">
            <Label htmlFor="search">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Search tasks..."
                value={filters.search}
                onChange={(e) => updateFilter('search', e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Quick Filters Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Status */}
            <div className="space-y-2">
              <Label>Status</Label>
              <div className="space-y-1">
                {['todo', 'in_progress', 'review', 'done'].map((status) => (
                  <div key={status} className="flex items-center space-x-2">
                    <Checkbox
                      id={`status-${status}`}
                      checked={filters.status.includes(status)}
                      onCheckedChange={() => toggleArrayFilter('status', status)}
                    />
                    <Label 
                      htmlFor={`status-${status}`} 
                      className="text-sm font-normal capitalize cursor-pointer"
                    >
                      {status.replace('_', ' ')}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <Label>Priority</Label>
              <div className="space-y-1">
                {['high', 'medium', 'low'].map((priority) => (
                  <div key={priority} className="flex items-center space-x-2">
                    <Checkbox
                      id={`priority-${priority}`}
                      checked={filters.priority.includes(priority)}
                      onCheckedChange={() => toggleArrayFilter('priority', priority)}
                    />
                    <Label 
                      htmlFor={`priority-${priority}`} 
                      className="text-sm font-normal capitalize cursor-pointer"
                    >
                      <Flag className={cn(
                        "h-3 w-3 mr-1 inline",
                        priority === 'high' ? 'text-red-500' :
                        priority === 'medium' ? 'text-yellow-500' : 'text-green-500'
                      )} />
                      {priority}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Completion */}
            <div className="space-y-2">
              <Label>Completion</Label>
              <Select value={filters.completion} onValueChange={(value: any) => updateFilter('completion', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tasks</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sort */}
            <div className="space-y-2">
              <Label>Sort By</Label>
              <div className="flex gap-1">
                <Select value={filters.sortBy} onValueChange={(value: any) => updateFilter('sortBy', value)}>
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="title">Title</SelectItem>
                    <SelectItem value="priority">Priority</SelectItem>
                    <SelectItem value="dueDate">Due Date</SelectItem>
                    <SelectItem value="createdAt">Created</SelectItem>
                    <SelectItem value="updatedAt">Updated</SelectItem>
                    <SelectItem value="estimatedHours">Estimated Hours</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateFilter('sortOrder', filters.sortOrder === 'asc' ? 'desc' : 'asc')}
                >
                  {filters.sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>

          <Separator />

          {/* Advanced Filters */}
          {showAdvanced && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Assignees */}
                {uniqueAssignees.length > 0 && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Assignees
                    </Label>
                    <ScrollArea className="h-24 border rounded-md p-2">
                      <div className="space-y-1">
                        {uniqueAssignees.map((assignee) => (
                          <div key={assignee} className="flex items-center space-x-2">
                            <Checkbox
                              id={`assignee-${assignee}`}
                              checked={filters.assignee.includes(assignee)}
                              onCheckedChange={() => toggleArrayFilter('assignee', assignee)}
                            />
                            <Label 
                              htmlFor={`assignee-${assignee}`} 
                              className="text-sm font-normal cursor-pointer"
                            >
                              {assignee}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {/* Tags */}
                {uniqueTags.length > 0 && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Tag className="h-4 w-4" />
                      Tags
                    </Label>
                    <ScrollArea className="h-24 border rounded-md p-2">
                      <div className="space-y-1">
                        {uniqueTags.map((tag) => (
                          <div key={tag} className="flex items-center space-x-2">
                            <Checkbox
                              id={`tag-${tag}`}
                              checked={filters.tags.includes(tag)}
                              onCheckedChange={() => toggleArrayFilter('tags', tag)}
                            />
                            <Label 
                              htmlFor={`tag-${tag}`} 
                              className="text-sm font-normal cursor-pointer"
                            >
                              {tag}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>

              {/* Date Range */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  Due Date Range
                </Label>
                <div className="flex gap-2">
                  <Select 
                    value={filters.dateRange.preset || 'custom'} 
                    onValueChange={(value) => updateNestedFilter('dateRange', 'preset', value)}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DATE_PRESETS.map((preset) => (
                        <SelectItem key={preset.value} value={preset.value}>
                          {preset.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {filters.dateRange.preset === 'custom' && (
                    <div className="flex gap-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="justify-start text-left font-normal">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {filters.dateRange.start ? format(filters.dateRange.start, "PPP") : "Start date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={filters.dateRange.start}
                            onSelect={(date) => updateNestedFilter('dateRange', 'start', date)}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>

                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="justify-start text-left font-normal">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {filters.dateRange.end ? format(filters.dateRange.end, "PPP") : "End date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={filters.dateRange.end}
                            onSelect={(date) => updateNestedFilter('dateRange', 'end', date)}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}
                </div>
              </div>

              {/* Estimated Hours Range */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Estimated Hours: {filters.estimatedHours.min}h - {filters.estimatedHours.max}h
                </Label>
                <div className="px-2">
                  <Slider
                    value={[filters.estimatedHours.min, filters.estimatedHours.max]}
                    onValueChange={(value) => updateFilter('estimatedHours', { min: value[0], max: value[1] })}
                    max={maxEstimatedHours}
                    min={0}
                    step={0.5}
                    className="w-full"
                  />
                </div>
              </div>

              {/* Additional Options */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="show-archived"
                    checked={filters.showArchived}
                    onCheckedChange={(checked) => updateFilter('showArchived', checked)}
                  />
                  <Label htmlFor="show-archived" className="text-sm">
                    Show archived tasks
                  </Label>
                </div>
              </div>
            </div>
          )}

          {/* Active Filters Summary */}
          {getActiveFiltersCount() > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label className="text-sm font-medium">Active Filters</Label>
                <div className="flex flex-wrap gap-1">
                  {filters.search && (
                    <Badge variant="secondary" className="gap-1">
                      Search: {filters.search}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 hover:bg-transparent"
                        onClick={() => updateFilter('search', '')}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  )}
                  
                  {filters.status.map((status) => (
                    <Badge key={`status-${status}`} variant="secondary" className="gap-1">
                      Status: {status.replace('_', ' ')}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 hover:bg-transparent"
                        onClick={() => toggleArrayFilter('status', status)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                  
                  {filters.priority.map((priority) => (
                    <Badge key={`priority-${priority}`} variant="secondary" className="gap-1">
                      Priority: {priority}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 hover:bg-transparent"
                        onClick={() => toggleArrayFilter('priority', priority)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                  
                  {filters.tags.map((tag) => (
                    <Badge key={`tag-${tag}`} variant="secondary" className="gap-1">
                      Tag: {tag}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 hover:bg-transparent"
                        onClick={() => toggleArrayFilter('tags', tag)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Saved Filters */}
          {enableSavedFilters && savedFilters.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label className="text-sm font-medium">Saved Filters</Label>
                <div className="grid grid-cols-1 gap-2">
                  {savedFilters.map((savedFilter) => (
                    <div key={savedFilter.id} className="flex items-center justify-between p-2 border rounded-lg">
                      <div>
                        <span className="font-medium text-sm">{savedFilter.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {format(new Date(savedFilter.createdAt), 'MMM dd, yyyy')}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => loadSavedFilter(savedFilter)}
                        >
                          Load
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteSavedFilter(savedFilter.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Save Filter Dialog */}
          {showSaveDialog && (
            <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
              <Label className="text-sm font-medium">Save Current Filters</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Filter name"
                  value={saveFilterName}
                  onChange={(e) => setSaveFilterName(e.target.value)}
                />
                <Button onClick={saveCurrentFilters} disabled={!saveFilterName.trim()}>
                  Save
                </Button>
                <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}