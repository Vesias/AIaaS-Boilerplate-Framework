'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Brain, 
  Plus, 
  RefreshCw, 
  Lightbulb, 
  Clock, 
  Flag, 
  Loader2,
  CheckCircle,
  X,
  Sparkles,
  TrendingUp,
  Target,
  Zap,
  Archive,
  AlertTriangle,
  Calendar,
  Star
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
}

export interface AITaskSuggestion {
  id: string
  title: string
  description: string
  priority: 'low' | 'medium' | 'high'
  estimatedHours: number
  tags: string[]
  reasoning: string
  confidence: number
  category: 'optimization' | 'completion' | 'planning' | 'maintenance' | 'innovation'
  dependencies?: string[]
  suggestedAssignee?: string
  suggestedDueDate?: string
  relatedTasks?: string[]
  benefits: string[]
  risks?: string[]
}

interface AITaskSuggestionsProps {
  tasks: Task[]
  onCreateTask: (suggestion: AITaskSuggestion) => void
  onDismissSuggestion: (suggestionId: string) => void
  className?: string
  maxSuggestions?: number
  autoRefresh?: boolean
  refreshInterval?: number // minutes
  showCategories?: boolean
  showConfidenceScore?: boolean
}

const SUGGESTION_CATEGORIES = {
  optimization: {
    name: 'Optimization',
    description: 'Improve existing processes',
    icon: TrendingUp,
    color: 'bg-blue-100 text-blue-800'
  },
  completion: {
    name: 'Completion',
    description: 'Finish incomplete tasks',
    icon: CheckCircle,
    color: 'bg-green-100 text-green-800'
  },
  planning: {
    name: 'Planning',
    description: 'Strategic planning tasks',
    icon: Target,
    color: 'bg-purple-100 text-purple-800'
  },
  maintenance: {
    name: 'Maintenance',
    description: 'System maintenance tasks',
    icon: Zap,
    color: 'bg-yellow-100 text-yellow-800'
  },
  innovation: {
    name: 'Innovation',
    description: 'New ideas and features',
    icon: Sparkles,
    color: 'bg-pink-100 text-pink-800'
  }
}

export default function AITaskSuggestions({
  tasks,
  onCreateTask,
  onDismissSuggestion,
  className,
  maxSuggestions = 6,
  autoRefresh = false,
  refreshInterval = 30,
  showCategories = true,
  showConfidenceScore = true
}: AITaskSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<AITaskSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [dismissedSuggestions, setDismissedSuggestions] = useState<string[]>([])

  // Generate AI suggestions based on current tasks
  const generateSuggestions = async () => {
    setLoading(true)
    setError(null)
    
    try {
      // Simulate AI processing delay
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      const newSuggestions = await analyzeTasks(tasks)
      setSuggestions(newSuggestions.filter(s => !dismissedSuggestions.includes(s.id)))
      setLastRefresh(new Date())
    } catch (err) {
      setError('Failed to generate AI suggestions. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // AI analysis logic (simulated)
  const analyzeTasks = async (taskList: Task[]): Promise<AITaskSuggestion[]> => {
    const suggestions: AITaskSuggestion[] = []
    
    // Analyze completion patterns
    const incompleteTasks = taskList.filter(t => !t.completed)
    const overdueTasks = taskList.filter(t => 
      !t.completed && t.dueDate && new Date(t.dueDate) < new Date()
    )
    const highPriorityTasks = taskList.filter(t => t.priority === 'high' && !t.completed)
    
    // Generate suggestions based on analysis
    
    // 1. Optimization suggestions
    if (taskList.length > 10) {
      suggestions.push({
        id: 'ai-opt-1',
        title: 'Implement task automation workflow',
        description: 'Create automated workflows for recurring tasks to improve efficiency and reduce manual work.',
        priority: 'medium',
        estimatedHours: 4,
        tags: ['automation', 'optimization'],
        reasoning: 'You have many recurring tasks that could benefit from automation',
        confidence: 85,
        category: 'optimization',
        benefits: [
          'Reduce manual work by 60%',
          'Improve consistency',
          'Free up time for strategic work'
        ],
        suggestedDueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      })
    }

    // 2. Completion suggestions
    if (overdueTasks.length > 3) {
      suggestions.push({
        id: 'ai-comp-1',
        title: 'Overdue task cleanup session',
        description: 'Dedicate focused time to address overdue tasks and prevent future delays.',
        priority: 'high',
        estimatedHours: 2,
        tags: ['cleanup', 'overdue'],
        reasoning: `You have ${overdueTasks.length} overdue tasks that need immediate attention`,
        confidence: 95,
        category: 'completion',
        benefits: [
          'Clear task backlog',
          'Improve team morale',
          'Meet deadlines'
        ],
        risks: ['Burnout if rushed'],
        suggestedDueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString()
      })
    }

    // 3. Planning suggestions
    const projectTags = Array.from(new Set(taskList.flatMap(t => t.tags)))
    if (projectTags.length > 5) {
      suggestions.push({
        id: 'ai-plan-1',
        title: 'Project milestone review meeting',
        description: 'Schedule review meetings for active projects to ensure alignment and progress tracking.',
        priority: 'medium',
        estimatedHours: 1,
        tags: ['planning', 'review', 'meeting'],
        reasoning: 'Multiple active projects would benefit from regular milestone reviews',
        confidence: 75,
        category: 'planning',
        benefits: [
          'Better project visibility',
          'Early risk identification',
          'Team alignment'
        ]
      })
    }

    // 4. Maintenance suggestions
    const oldTasks = taskList.filter(t => {
      const taskAge = (new Date().getTime() - new Date(t.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      return taskAge > 30 && !t.completed
    })
    
    if (oldTasks.length > 5) {
      suggestions.push({
        id: 'ai-maint-1',
        title: 'Archive old completed tasks',
        description: 'Clean up task list by archiving old completed tasks to improve organization.',
        priority: 'low',
        estimatedHours: 0.5,
        tags: ['maintenance', 'cleanup'],
        reasoning: 'Your task list has grown large and could benefit from cleanup',
        confidence: 80,
        category: 'maintenance',
        benefits: [
          'Improved task list performance',
          'Better organization',
          'Reduced clutter'
        ]
      })
    }

    // 5. Innovation suggestions
    const recentTasksCount = taskList.filter(t => {
      const taskAge = (new Date().getTime() - new Date(t.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      return taskAge <= 7
    }).length
    
    if (recentTasksCount > 10) {
      suggestions.push({
        id: 'ai-innov-1',
        title: 'Implement AI-powered task prioritization',
        description: 'Add machine learning to automatically prioritize tasks based on urgency, importance, and dependencies.',
        priority: 'low',
        estimatedHours: 6,
        tags: ['ai', 'innovation', 'prioritization'],
        reasoning: 'High task volume would benefit from intelligent prioritization',
        confidence: 70,
        category: 'innovation',
        benefits: [
          'Smarter task prioritization',
          'Reduced decision fatigue',
          'Better time management'
        ],
        risks: ['Implementation complexity']
      })
    }

    // 6. Time tracking suggestions
    const tasksWithoutEstimates = taskList.filter(t => !t.estimatedHours)
    if (tasksWithoutEstimates.length > taskList.length * 0.5) {
      suggestions.push({
        id: 'ai-track-1',
        title: 'Add time estimates to existing tasks',
        description: 'Review and add time estimates to tasks missing this information for better planning.',
        priority: 'medium',
        estimatedHours: 1,
        tags: ['time-tracking', 'planning'],
        reasoning: 'Many tasks lack time estimates, making planning difficult',
        confidence: 88,
        category: 'optimization',
        benefits: [
          'Better project planning',
          'Improved time management',
          'More accurate deadlines'
        ]
      })
    }

    return suggestions.slice(0, maxSuggestions)
  }

  // Auto refresh functionality
  useEffect(() => {
    generateSuggestions()
  }, [tasks])

  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      generateSuggestions()
    }, refreshInterval * 60 * 1000)

    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval])

  const handleCreateTask = (suggestion: AITaskSuggestion) => {
    onCreateTask(suggestion)
    handleDismiss(suggestion.id)
  }

  const handleDismiss = (suggestionId: string) => {
    setDismissedSuggestions(prev => [...prev, suggestionId])
    setSuggestions(prev => prev.filter(s => s.id !== suggestionId))
    onDismissSuggestion(suggestionId)
  }

  const filteredSuggestions = selectedCategory === 'all' 
    ? suggestions 
    : suggestions.filter(s => s.category === selectedCategory)

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive'
      case 'medium': return 'default'
      case 'low': return 'secondary'
      default: return 'outline'
    }
  }

  const getCategoryIcon = (category: string) => {
    return SUGGESTION_CATEGORIES[category as keyof typeof SUGGESTION_CATEGORIES]?.icon || Lightbulb
  }

  return (
    <div className={cn("space-y-4", className)}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-blue-600" />
              <CardTitle>AI Task Suggestions</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={generateSuggestions}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                {loading ? 'Analyzing...' : 'Refresh'}
              </Button>
            </div>
          </div>
          <CardDescription>
            AI-powered task recommendations based on your work patterns and current projects
            {lastRefresh && (
              <span className="block text-xs text-muted-foreground mt-1">
                Last updated: {lastRefresh.toLocaleTimeString()}
              </span>
            )}
          </CardDescription>
        </CardHeader>

        {error && (
          <CardContent className="pb-0">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </CardContent>
        )}

        <CardContent>
          {/* Category Filter */}
          {showCategories && suggestions.length > 0 && (
            <div className="mb-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={selectedCategory === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory('all')}
                >
                  All ({suggestions.length})
                </Button>
                {Object.entries(SUGGESTION_CATEGORIES).map(([key, category]) => {
                  const count = suggestions.filter(s => s.category === key).length
                  if (count === 0) return null
                  
                  const Icon = category.icon
                  return (
                    <Button
                      key={key}
                      variant={selectedCategory === key ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedCategory(key)}
                      className="gap-1"
                    >
                      <Icon className="h-3 w-3" />
                      {category.name} ({count})
                    </Button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Suggestions List */}
          {loading ? (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
              <p className="text-muted-foreground">Analyzing your tasks...</p>
              <p className="text-xs text-muted-foreground mt-1">
                This may take a few moments
              </p>
            </div>
          ) : filteredSuggestions.length === 0 ? (
            <div className="text-center py-8">
              <Brain className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-muted-foreground">
                {suggestions.length === 0 
                  ? "No suggestions available. Try adding more tasks or refreshing."
                  : "No suggestions in this category."
                }
              </p>
            </div>
          ) : (
            <ScrollArea className="h-96">
              <div className="space-y-4">
                {filteredSuggestions.map((suggestion) => {
                  const CategoryIcon = getCategoryIcon(suggestion.category)
                  
                  return (
                    <Card key={suggestion.id} className="border-l-4 border-l-blue-500">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-start gap-3 flex-1">
                            <div className="p-2 rounded-lg bg-blue-100">
                              <CategoryIcon className="h-4 w-4 text-blue-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium mb-1">{suggestion.title}</h4>
                              <p className="text-sm text-muted-foreground mb-2">
                                {suggestion.description}
                              </p>
                              
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant={getPriorityColor(suggestion.priority)}>
                                  <Flag className="h-3 w-3 mr-1" />
                                  {suggestion.priority}
                                </Badge>
                                
                                <Badge variant="outline">
                                  <Clock className="h-3 w-3 mr-1" />
                                  {suggestion.estimatedHours}h
                                </Badge>
                                
                                {showCategories && (
                                  <Badge 
                                    variant="outline" 
                                    className={SUGGESTION_CATEGORIES[suggestion.category as keyof typeof SUGGESTION_CATEGORIES]?.color}
                                  >
                                    {SUGGESTION_CATEGORIES[suggestion.category as keyof typeof SUGGESTION_CATEGORIES]?.name}
                                  </Badge>
                                )}
                                
                                {showConfidenceScore && (
                                  <Badge variant="outline" className="gap-1">
                                    <Star className="h-3 w-3" />
                                    {suggestion.confidence}%
                                  </Badge>
                                )}
                              </div>

                              {suggestion.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-2">
                                  {suggestion.tags.map((tag) => (
                                    <Badge key={tag} variant="secondary" className="text-xs">
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1 ml-2">
                            <Button
                              size="sm"
                              onClick={() => handleCreateTask(suggestion)}
                              className="whitespace-nowrap"
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Create
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDismiss(suggestion.id)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>

                        <Separator className="my-3" />

                        <div className="space-y-2">
                          <div className="flex items-start gap-2">
                            <Lightbulb className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-muted-foreground italic">
                              {suggestion.reasoning}
                            </p>
                          </div>

                          {suggestion.benefits.length > 0 && (
                            <div className="flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <div className="text-xs">
                                <span className="font-medium text-green-700">Benefits:</span>
                                <ul className="list-disc list-inside text-muted-foreground ml-2">
                                  {suggestion.benefits.map((benefit, index) => (
                                    <li key={index}>{benefit}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          )}

                          {suggestion.risks && suggestion.risks.length > 0 && (
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                              <div className="text-xs">
                                <span className="font-medium text-yellow-700">Risks:</span>
                                <ul className="list-disc list-inside text-muted-foreground ml-2">
                                  {suggestion.risks.map((risk, index) => (
                                    <li key={index}>{risk}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          )}

                          {suggestion.suggestedDueDate && (
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-blue-500" />
                              <span className="text-xs text-muted-foreground">
                                Suggested due date: {new Date(suggestion.suggestedDueDate).toLocaleDateString()}
                              </span>
                            </div>
                          )}

                          {showConfidenceScore && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium">AI Confidence:</span>
                              <Progress value={suggestion.confidence} className="h-1 flex-1" />
                              <span className="text-xs text-muted-foreground">
                                {suggestion.confidence}%
                              </span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  )
}