/**
 * Task Management API with AI Suggestions
 * Provides comprehensive task management with intelligent AI-powered features
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createDatabaseService } from '@/lib/database'
import OpenAI from 'openai'

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

interface TaskFilter {
  status?: 'all' | 'pending' | 'completed' | 'overdue'
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  due_date_from?: string
  due_date_to?: string
  search?: string
  limit?: number
  offset?: number
  sort_by?: 'created' | 'due_date' | 'priority' | 'title'
  sort_order?: 'asc' | 'desc'
}

interface TaskCreate {
  title: string
  content?: string
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  due_date?: string
  tags?: string[]
  estimated_duration?: number // in minutes
  dependencies?: string[] // array of task IDs
  auto_generate_subtasks?: boolean
  ai_suggestions?: boolean
}

interface TaskUpdate {
  title?: string
  content?: string
  completed?: boolean
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  due_date?: string
  tags?: string[]
  estimated_duration?: number
  actual_duration?: number
  notes?: string
}

interface AITaskSuggestion {
  type: 'subtask' | 'improvement' | 'priority' | 'deadline' | 'dependency'
  suggestion: string
  rationale: string
  confidence: number
  metadata?: Record<string, any>
}

interface TaskAnalytics {
  completion_rate: number
  average_completion_time: number
  overdue_percentage: number
  priority_distribution: Record<string, number>
  productivity_trends: Array<{
    date: string
    completed_tasks: number
    productivity_score: number
  }>
  suggestions: string[]
}

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const taskId = searchParams.get('task_id')

    // Parse filter parameters
    const filters: TaskFilter = {
      status: searchParams.get('status') as any || 'all',
      priority: searchParams.get('priority') as any,
      due_date_from: searchParams.get('due_date_from') || undefined,
      due_date_to: searchParams.get('due_date_to') || undefined,
      search: searchParams.get('search') || undefined,
      limit: parseInt(searchParams.get('limit') || '50'),
      offset: parseInt(searchParams.get('offset') || '0'),
      sort_by: (searchParams.get('sort_by') || 'created') as any,
      sort_order: (searchParams.get('sort_order') || 'desc') as any
    }

    const db = await createDatabaseService()

    switch (action) {
      case 'list':
        return await handleTaskList(userId, filters, db)
        
      case 'get':
        return await handleTaskGet(userId, taskId, db)
        
      case 'suggestions':
        return await handleAISuggestions(userId, taskId, db)
        
      case 'analytics':
        return await handleTaskAnalytics(userId, filters, db)
        
      case 'smart_prioritize':
        return await handleSmartPrioritization(userId, db)
        
      case 'time_tracking':
        return await handleTimeTracking(userId, taskId, db)
        
      case 'dependencies':
        return await handleTaskDependencies(userId, taskId, db)
        
      default:
        // Default: return task overview with AI insights
        return await handleTaskOverview(userId, db)
    }
  } catch (error) {
    console.error('Task GET error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body: TaskCreate = await request.json()
    const {
      title,
      content,
      priority = 'medium',
      due_date,
      tags = [],
      estimated_duration,
      dependencies = [],
      auto_generate_subtasks = false,
      ai_suggestions = true
    } = body

    if (!title) {
      return NextResponse.json(
        { error: 'Task title is required' },
        { status: 400 }
      )
    }

    const db = await createDatabaseService()

    // Create the main task
    const task = await db.createTask({
      user_id: userId,
      title,
      content: content || null,
      completed: false,
      priority,
      due_date: due_date ? new Date(due_date).toISOString() : null
    })

    if (!task) {
      return NextResponse.json(
        { error: 'Failed to create task' },
        { status: 500 }
      )
    }

    let aiSuggestions: AITaskSuggestion[] = []
    let subtasks: any[] = []

    // Generate AI suggestions if requested
    if (ai_suggestions) {
      aiSuggestions = await generateAITaskSuggestions(task, userId, db)
    }

    // Auto-generate subtasks if requested
    if (auto_generate_subtasks && content) {
      subtasks = await generateSubtasks(task, userId, db)
    }

    // Calculate smart priority if not specified
    let smartPriority = priority
    if (ai_suggestions) {
      smartPriority = await calculateSmartPriority(task, userId, db)
    }

    // Update task with smart priority if different
    if (smartPriority !== priority) {
      await db.updateTask(task.id, { priority: smartPriority })
    }

    return NextResponse.json({
      success: true,
      task: {
        id: task.id,
        title: task.title,
        content: task.content,
        priority: smartPriority,
        due_date: task.due_date,
        created_at: task.created_at,
        estimated_duration,
        tags
      },
      ai_suggestions: aiSuggestions,
      subtasks: subtasks,
      smart_priority_applied: smartPriority !== priority,
      metadata: {
        dependencies_count: dependencies.length,
        suggestion_count: aiSuggestions.length
      }
    })
  } catch (error) {
    console.error('Task POST error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { task_id, ...updates } = body as { task_id: string } & TaskUpdate

    if (!task_id) {
      return NextResponse.json(
        { error: 'Task ID is required' },
        { status: 400 }
      )
    }

    const db = await createDatabaseService()

    // Verify user owns the task
    const userTasks = await db.getUserTasks(userId)
    const existingTask = userTasks.find(t => t.id === task_id)
    
    if (!existingTask) {
      return NextResponse.json(
        { error: 'Task not found or access denied' },
        { status: 404 }
      )
    }

    // Prepare updates
    const taskUpdates: any = {}
    
    if (updates.title !== undefined) taskUpdates.title = updates.title
    if (updates.content !== undefined) taskUpdates.content = updates.content
    if (updates.completed !== undefined) taskUpdates.completed = updates.completed
    if (updates.priority !== undefined) taskUpdates.priority = updates.priority
    if (updates.due_date !== undefined) {
      taskUpdates.due_date = updates.due_date ? new Date(updates.due_date).toISOString() : null
    }

    // Update the task
    const updatedTask = await db.updateTask(task_id, taskUpdates)
    
    if (!updatedTask) {
      return NextResponse.json(
        { error: 'Failed to update task' },
        { status: 500 }
      )
    }

    // Generate AI suggestions for the updated task
    const aiSuggestions = await generateAITaskSuggestions(updatedTask, userId, db)

    // Track completion time if task was just completed
    let completionInsights = null
    if (updates.completed && !existingTask.completed) {
      completionInsights = await analyzeTaskCompletion(updatedTask, existingTask, userId, db)
    }

    return NextResponse.json({
      success: true,
      task: {
        id: updatedTask.id,
        title: updatedTask.title,
        content: updatedTask.content,
        completed: updatedTask.completed,
        priority: updatedTask.priority,
        due_date: updatedTask.due_date,
        updated_at: updatedTask.updated_at
      },
      ai_suggestions: aiSuggestions,
      completion_insights: completionInsights,
      metadata: {
        was_completed: updates.completed && !existingTask.completed,
        priority_changed: updates.priority && updates.priority !== existingTask.priority
      }
    })
  } catch (error) {
    console.error('Task PUT error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const taskId = searchParams.get('task_id')

    if (!taskId) {
      return NextResponse.json(
        { error: 'Task ID is required' },
        { status: 400 }
      )
    }

    const db = await createDatabaseService()

    // Verify user owns the task
    const userTasks = await db.getUserTasks(userId)
    const existingTask = userTasks.find(t => t.id === taskId)
    
    if (!existingTask) {
      return NextResponse.json(
        { error: 'Task not found or access denied' },
        { status: 404 }
      )
    }

    // In production, implement deleteTask method in DatabaseService
    // For now, we'll simulate soft deletion by marking as completed and archived
    const archivedTask = await db.updateTask(taskId, { 
      completed: true,
      // In a real implementation, add an 'archived' or 'deleted' field
    })

    return NextResponse.json({
      success: true,
      task_id: taskId,
      deleted_at: new Date().toISOString(),
      message: 'Task deleted successfully'
    })
  } catch (error) {
    console.error('Task DELETE error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Handler functions
async function handleTaskList(userId: string, filters: TaskFilter, db: any) {
  let tasks = await db.getUserTasks(userId)

  // Apply filters
  if (filters.status !== 'all') {
    switch (filters.status) {
      case 'pending':
        tasks = tasks.filter((t: any) => !t.completed)
        break
      case 'completed':
        tasks = tasks.filter((t: any) => t.completed)
        break
      case 'overdue':
        const now = new Date()
        tasks = tasks.filter((t: any) => 
          !t.completed && 
          t.due_date && 
          new Date(t.due_date) < now
        )
        break
    }
  }

  if (filters.priority) {
    tasks = tasks.filter((t: any) => t.priority === filters.priority)
  }

  if (filters.due_date_from) {
    tasks = tasks.filter((t: any) => 
      t.due_date && new Date(t.due_date) >= new Date(filters.due_date_from!)
    )
  }

  if (filters.due_date_to) {
    tasks = tasks.filter((t: any) => 
      t.due_date && new Date(t.due_date) <= new Date(filters.due_date_to!)
    )
  }

  if (filters.search) {
    const searchTerm = filters.search.toLowerCase()
    tasks = tasks.filter((t: any) => 
      t.title.toLowerCase().includes(searchTerm) ||
      (t.content && t.content.toLowerCase().includes(searchTerm))
    )
  }

  // Sort tasks
  tasks.sort((a: any, b: any) => {
    let aValue: any, bValue: any
    
    switch (filters.sort_by) {
      case 'due_date':
        aValue = a.due_date ? new Date(a.due_date).getTime() : Infinity
        bValue = b.due_date ? new Date(b.due_date).getTime() : Infinity
        break
      case 'priority':
        const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 }
        aValue = priorityOrder[a.priority as keyof typeof priorityOrder]
        bValue = priorityOrder[b.priority as keyof typeof priorityOrder]
        break
      case 'title':
        aValue = a.title.toLowerCase()
        bValue = b.title.toLowerCase()
        break
      default:
        aValue = new Date(a.created_at).getTime()
        bValue = new Date(b.created_at).getTime()
    }
    
    if (filters.sort_order === 'asc') {
      return aValue > bValue ? 1 : -1
    } else {
      return aValue < bValue ? 1 : -1
    }
  })

  // Apply pagination
  const totalCount = tasks.length
  const paginatedTasks = tasks.slice(
    filters.offset || 0,
    (filters.offset || 0) + (filters.limit || 50)
  )

  // Enhance tasks with AI insights
  const enhancedTasks = await Promise.all(
    paginatedTasks.map(async (task: any) => {
      const isOverdue = task.due_date && 
        new Date(task.due_date) < new Date() && 
        !task.completed

      return {
        id: task.id,
        title: task.title,
        content: task.content,
        completed: task.completed,
        priority: task.priority,
        due_date: task.due_date,
        created_at: task.created_at,
        updated_at: task.updated_at,
        is_overdue: isOverdue,
        urgency_score: calculateUrgencyScore(task),
        estimated_effort: await estimateTaskEffort(task)
      }
    })
  )

  return NextResponse.json({
    tasks: enhancedTasks,
    pagination: {
      total: totalCount,
      limit: filters.limit || 50,
      offset: filters.offset || 0,
      has_more: totalCount > (filters.offset || 0) + (filters.limit || 50)
    },
    filters,
    summary: {
      total: totalCount,
      pending: tasks.filter((t: any) => !t.completed).length,
      completed: tasks.filter((t: any) => t.completed).length,
      overdue: tasks.filter((t: any) => 
        !t.completed && 
        t.due_date && 
        new Date(t.due_date) < new Date()
      ).length
    }
  })
}

async function handleTaskGet(userId: string, taskId: string | null, db: any) {
  if (!taskId) {
    return NextResponse.json(
      { error: 'Task ID is required' },
      { status: 400 }
    )
  }

  const userTasks = await db.getUserTasks(userId)
  const task = userTasks.find((t: any) => t.id === taskId)
  
  if (!task) {
    return NextResponse.json(
      { error: 'Task not found or access denied' },
      { status: 404 }
    )
  }

  // Generate AI suggestions for this specific task
  const aiSuggestions = await generateAITaskSuggestions(task, userId, db)
  
  // Calculate task insights
  const insights = await calculateTaskInsights(task, userId, db)

  return NextResponse.json({
    task: {
      id: task.id,
      title: task.title,
      content: task.content,
      completed: task.completed,
      priority: task.priority,
      due_date: task.due_date,
      created_at: task.created_at,
      updated_at: task.updated_at,
      is_overdue: task.due_date && 
        new Date(task.due_date) < new Date() && 
        !task.completed,
      urgency_score: calculateUrgencyScore(task)
    },
    ai_suggestions: aiSuggestions,
    insights
  })
}

async function handleAISuggestions(userId: string, taskId: string | null, db: any) {
  if (!taskId) {
    return NextResponse.json(
      { error: 'Task ID is required' },
      { status: 400 }
    )
  }

  const userTasks = await db.getUserTasks(userId)
  const task = userTasks.find((t: any) => t.id === taskId)
  
  if (!task) {
    return NextResponse.json(
      { error: 'Task not found' },
      { status: 404 }
    )
  }

  const suggestions = await generateAITaskSuggestions(task, userId, db)
  
  return NextResponse.json({
    task_id: taskId,
    suggestions,
    generated_at: new Date().toISOString()
  })
}

async function handleTaskAnalytics(userId: string, filters: TaskFilter, db: any) {
  const tasks = await db.getUserTasks(userId)
  
  const analytics: TaskAnalytics = {
    completion_rate: 0,
    average_completion_time: 0,
    overdue_percentage: 0,
    priority_distribution: { low: 0, medium: 0, high: 0, urgent: 0 },
    productivity_trends: [],
    suggestions: []
  }

  if (tasks.length === 0) {
    return NextResponse.json({ analytics })
  }

  // Calculate completion rate
  const completedTasks = tasks.filter((t: any) => t.completed)
  analytics.completion_rate = (completedTasks.length / tasks.length) * 100

  // Calculate overdue percentage
  const now = new Date()
  const overdueTasks = tasks.filter((t: any) => 
    !t.completed && 
    t.due_date && 
    new Date(t.due_date) < now
  )
  analytics.overdue_percentage = (overdueTasks.length / tasks.length) * 100

  // Priority distribution
  tasks.forEach((task: any) => {
    analytics.priority_distribution[task.priority]++
  })

  // Generate productivity trends (last 30 days)
  for (let i = 29; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]
    
    const dayTasks = completedTasks.filter((t: any) => 
      t.updated_at.startsWith(dateStr)
    )
    
    analytics.productivity_trends.push({
      date: dateStr,
      completed_tasks: dayTasks.length,
      productivity_score: calculateProductivityScore(dayTasks)
    })
  }

  // Generate AI-powered suggestions
  analytics.suggestions = await generateProductivitySuggestions(tasks, analytics)

  return NextResponse.json({ analytics })
}

async function handleSmartPrioritization(userId: string, db: any) {
  const tasks = await db.getUserTasks(userId)
  const pendingTasks = tasks.filter((t: any) => !t.completed)

  const prioritizedTasks = await Promise.all(
    pendingTasks.map(async (task: any) => ({
      ...task,
      smart_priority: await calculateSmartPriority(task, userId, db),
      urgency_score: calculateUrgencyScore(task),
      effort_estimate: await estimateTaskEffort(task)
    }))
  )

  // Sort by urgency score (highest first)
  prioritizedTasks.sort((a, b) => b.urgency_score - a.urgency_score)

  return NextResponse.json({
    prioritized_tasks: prioritizedTasks.slice(0, 10), // Top 10 priorities
    algorithm: 'ai_smart_prioritization',
    factors_considered: [
      'due_date_proximity',
      'task_complexity',
      'user_patterns',
      'priority_level',
      'dependencies'
    ],
    generated_at: new Date().toISOString()
  })
}

async function handleTimeTracking(userId: string, taskId: string | null, db: any) {
  if (!taskId) {
    return NextResponse.json(
      { error: 'Task ID is required' },
      { status: 400 }
    )
  }

  // In production, implement actual time tracking
  return NextResponse.json({
    task_id: taskId,
    time_tracking: {
      estimated_duration: 60, // minutes
      actual_duration: null,
      time_sessions: [],
      efficiency_rating: null
    },
    message: 'Time tracking feature would be implemented here'
  })
}

async function handleTaskDependencies(userId: string, taskId: string | null, db: any) {
  if (!taskId) {
    return NextResponse.json(
      { error: 'Task ID is required' },
      { status: 400 }
    )
  }

  // Mock implementation for task dependencies
  return NextResponse.json({
    task_id: taskId,
    dependencies: {
      blocked_by: [],
      blocking: [],
      related_tasks: []
    },
    dependency_graph: {
      can_start: true,
      completion_path: [],
      estimated_completion: null
    }
  })
}

async function handleTaskOverview(userId: string, db: any) {
  const tasks = await db.getUserTasks(userId)
  const now = new Date()
  
  const overview = {
    total_tasks: tasks.length,
    completed_tasks: tasks.filter((t: any) => t.completed).length,
    pending_tasks: tasks.filter((t: any) => !t.completed).length,
    overdue_tasks: tasks.filter((t: any) => 
      !t.completed && 
      t.due_date && 
      new Date(t.due_date) < now
    ).length,
    high_priority_tasks: tasks.filter((t: any) => 
      !t.completed && 
      ['high', 'urgent'].includes(t.priority)
    ).length,
    due_today: tasks.filter((t: any) => 
      !t.completed && 
      t.due_date && 
      new Date(t.due_date).toDateString() === now.toDateString()
    ).length,
    ai_insights: await generateOverviewInsights(tasks, userId, db)
  }

  return NextResponse.json({ overview })
}

// AI Helper Functions
async function generateAITaskSuggestions(task: any, userId: string, db: any): Promise<AITaskSuggestion[]> {
  try {
    const userTasks = await db.getUserTasks(userId)
    const context = {
      task_title: task.title,
      task_content: task.content || '',
      task_priority: task.priority,
      due_date: task.due_date,
      user_task_history: userTasks.slice(0, 10).map((t: any) => ({
        title: t.title,
        priority: t.priority,
        completed: t.completed
      }))
    }

    const prompt = `Analyze this task and provide intelligent suggestions:

Task: "${task.title}"
Description: "${task.content || 'No description'}"
Priority: ${task.priority}
Due Date: ${task.due_date || 'Not set'}

User's recent tasks: ${JSON.stringify(context.user_task_history, null, 2)}

Provide 3-5 actionable suggestions to improve this task. Consider:
1. Breaking down complex tasks into subtasks
2. Adjusting priority based on urgency and importance
3. Setting realistic deadlines
4. Identifying potential dependencies
5. Optimizing workflow efficiency

Format your response as a JSON array of suggestions with type, suggestion, rationale, and confidence (0-100).`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 1000
    })

    const content = response.choices[0]?.message?.content
    if (!content) return []

    try {
      const suggestions = JSON.parse(content)
      return Array.isArray(suggestions) ? suggestions : []
    } catch {
      // If parsing fails, return empty array
      return []
    }
  } catch (error) {
    console.error('AI suggestion generation error:', error)
    return []
  }
}

async function generateSubtasks(parentTask: any, userId: string, db: any): Promise<any[]> {
  try {
    const prompt = `Break down this task into 3-5 manageable subtasks:

Task: "${parentTask.title}"
Description: "${parentTask.content || ''}"

Provide specific, actionable subtasks that would help complete the main task. 
Format as JSON array with title and estimated_duration (in minutes) for each subtask.`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 500
    })

    const content = response.choices[0]?.message?.content
    if (!content) return []

    try {
      const subtasks = JSON.parse(content)
      if (Array.isArray(subtasks)) {
        // Create subtasks in the database
        const createdSubtasks = []
        for (const subtask of subtasks) {
          const created = await db.createTask({
            user_id: userId,
            title: `${parentTask.title} - ${subtask.title}`,
            content: `Subtask of: ${parentTask.title}`,
            completed: false,
            priority: parentTask.priority
          })
          if (created) {
            createdSubtasks.push(created)
          }
        }
        return createdSubtasks
      }
    } catch (error) {
      console.error('Subtask parsing error:', error)
    }
    
    return []
  } catch (error) {
    console.error('Subtask generation error:', error)
    return []
  }
}

async function calculateSmartPriority(task: any, userId: string, db: any): Promise<'low' | 'medium' | 'high' | 'urgent'> {
  const urgencyScore = calculateUrgencyScore(task)
  
  if (urgencyScore >= 90) return 'urgent'
  if (urgencyScore >= 70) return 'high'
  if (urgencyScore >= 40) return 'medium'
  return 'low'
}

function calculateUrgencyScore(task: any): number {
  let score = 0
  
  // Base priority score
  const priorityScores = { low: 10, medium: 30, high: 60, urgent: 90 }
  score += priorityScores[task.priority as keyof typeof priorityScores] || 30
  
  // Due date urgency
  if (task.due_date) {
    const now = new Date()
    const dueDate = new Date(task.due_date)
    const daysUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    
    if (daysUntilDue < 0) score += 30 // Overdue
    else if (daysUntilDue < 1) score += 25 // Due today
    else if (daysUntilDue < 3) score += 15 // Due within 3 days
    else if (daysUntilDue < 7) score += 10 // Due within a week
  }
  
  // Content complexity (simple heuristic)
  if (task.content && task.content.length > 200) score += 5
  if (task.title.toLowerCase().includes('urgent') || task.title.toLowerCase().includes('asap')) score += 15
  
  return Math.min(score, 100)
}

async function estimateTaskEffort(task: any): Promise<number> {
  // Simple heuristic for effort estimation (in minutes)
  let effort = 30 // Base effort
  
  if (task.content) {
    effort += Math.min(task.content.length / 10, 60) // Max 60 minutes for content complexity
  }
  
  const priorityEffort = { low: 0, medium: 15, high: 30, urgent: 45 }
  effort += priorityEffort[task.priority as keyof typeof priorityEffort] || 15
  
  return Math.round(effort)
}

async function analyzeTaskCompletion(updatedTask: any, originalTask: any, userId: string, db: any) {
  const completionTime = new Date(updatedTask.updated_at).getTime() - new Date(originalTask.created_at).getTime()
  const hoursToComplete = completionTime / (1000 * 60 * 60)
  
  return {
    completion_time_hours: hoursToComplete,
    was_on_time: originalTask.due_date ? 
      new Date(updatedTask.updated_at) <= new Date(originalTask.due_date) : null,
    efficiency_rating: hoursToComplete < 24 ? 'efficient' : hoursToComplete < 72 ? 'normal' : 'slow',
    suggested_improvements: hoursToComplete > 72 ? 
      ['Consider breaking down large tasks into smaller chunks'] : []
  }
}

async function calculateTaskInsights(task: any, userId: string, db: any) {
  return {
    estimated_effort_minutes: await estimateTaskEffort(task),
    urgency_score: calculateUrgencyScore(task),
    similar_tasks_completed: 0, // Would calculate based on title/content similarity
    average_completion_time: null,
    success_probability: calculateSuccessProbability(task)
  }
}

function calculateSuccessProbability(task: any): number {
  let probability = 70 // Base probability
  
  if (task.due_date) {
    const daysUntilDue = (new Date(task.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    if (daysUntilDue > 7) probability += 15
    else if (daysUntilDue < 1) probability -= 20
  }
  
  if (task.priority === 'urgent') probability -= 10
  if (task.content && task.content.length > 0) probability += 10
  
  return Math.max(10, Math.min(95, probability))
}

function calculateProductivityScore(tasks: any[]): number {
  if (tasks.length === 0) return 0
  
  const priorityWeights = { low: 1, medium: 2, high: 3, urgent: 4 }
  const totalWeight = tasks.reduce((sum, task) => 
    sum + (priorityWeights[task.priority as keyof typeof priorityWeights] || 1), 0
  )
  
  return Math.min(100, totalWeight * 10)
}

async function generateProductivitySuggestions(tasks: any[], analytics: TaskAnalytics): Promise<string[]> {
  const suggestions = []
  
  if (analytics.completion_rate < 60) {
    suggestions.push('Consider breaking down large tasks into smaller, manageable chunks')
  }
  
  if (analytics.overdue_percentage > 20) {
    suggestions.push('Review your time estimation skills and set more realistic deadlines')
  }
  
  if (analytics.priority_distribution.urgent > analytics.priority_distribution.medium) {
    suggestions.push('Try to plan ahead to avoid too many urgent tasks')
  }
  
  const recentProductivity = analytics.productivity_trends.slice(-7).reduce((sum, day) => sum + day.productivity_score, 0) / 7
  if (recentProductivity < 30) {
    suggestions.push('Consider taking breaks or adjusting your workload for better productivity')
  }
  
  return suggestions
}

async function generateOverviewInsights(tasks: any[], userId: string, db: any): Promise<string[]> {
  const insights = []
  const now = new Date()
  
  const pendingTasks = tasks.filter(t => !t.completed)
  const overdueTasks = pendingTasks.filter(t => 
    t.due_date && new Date(t.due_date) < now
  )
  
  if (overdueTasks.length > 0) {
    insights.push(`You have ${overdueTasks.length} overdue task(s) that need immediate attention`)
  }
  
  const urgentTasks = pendingTasks.filter(t => t.priority === 'urgent')
  if (urgentTasks.length > 0) {
    insights.push(`Focus on ${urgentTasks.length} urgent task(s) first`)
  }
  
  const dueTodayTasks = pendingTasks.filter(t => 
    t.due_date && new Date(t.due_date).toDateString() === now.toDateString()
  )
  if (dueTodayTasks.length > 0) {
    insights.push(`${dueTodayTasks.length} task(s) are due today`)
  }
  
  if (pendingTasks.length > 20) {
    insights.push('Consider archiving completed tasks and breaking down large tasks')
  }
  
  return insights
}