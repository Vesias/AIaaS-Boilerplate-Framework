/**
 * AG-UI Streaming API Endpoint
 * Provides real-time streaming for AG-UI (Autonomous Generation UI) interactions
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createDatabaseService } from '@/lib/database'
import OpenAI from 'openai'

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

interface StreamMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  timestamp?: string
  metadata?: Record<string, any>
}

interface AGUIRequest {
  messages: StreamMessage[]
  context?: {
    workflowId?: string
    taskId?: string
    type: 'workflow' | 'task' | 'general'
  }
  options?: {
    temperature?: number
    maxTokens?: number
    stream?: boolean
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

    // Parse request body
    const body: AGUIRequest = await request.json()
    const { messages, context, options = {} } = body

    // Validate required fields
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Messages array is required and cannot be empty' },
        { status: 400 }
      )
    }

    // Get user context for AI
    const db = await createDatabaseService()
    const [profile, subscription, workflows, tasks] = await Promise.all([
      db.getProfile(userId),
      db.getActiveSubscription(userId),
      db.getUserWorkflows(userId),
      db.getUserTasks(userId)
    ])

    // Build system context
    const systemContext = {
      user: {
        id: userId,
        email: profile?.email,
        name: profile ? `${profile.first_name} ${profile.last_name}`.trim() : 'User',
        hasActiveSubscription: !!subscription && subscription.status === 'active'
      },
      workflows: {
        total: workflows.length,
        active: workflows.filter(w => w.active).length,
        recent: workflows.slice(0, 3).map(w => ({
          id: w.id,
          name: w.name,
          type: w.n8n_id ? 'n8n' : w.make_id ? 'make' : 'custom'
        }))
      },
      tasks: {
        total: tasks.length,
        pending: tasks.filter(t => !t.completed).length,
        overdue: tasks.filter(t => 
          !t.completed && 
          t.due_date && 
          new Date(t.due_date) < new Date()
        ).length,
        recent: tasks.slice(0, 5).map(t => ({
          id: t.id,
          title: t.title,
          priority: t.priority,
          completed: t.completed
        }))
      }
    }

    // Create enhanced system message
    const systemMessage: StreamMessage = {
      role: 'system',
      content: `You are AG-UI, an autonomous generation UI assistant for Roomicor SaaS platform. 

User Context:
- Name: ${systemContext.user.name}
- Email: ${systemContext.user.email}
- Subscription: ${systemContext.user.hasActiveSubscription ? 'Active' : 'Inactive'}
- Workflows: ${systemContext.workflows.total} total (${systemContext.workflows.active} active)
- Tasks: ${systemContext.tasks.total} total (${systemContext.tasks.pending} pending, ${systemContext.tasks.overdue} overdue)

Current Context: ${context?.type || 'general'}
${context?.workflowId ? `Workflow ID: ${context.workflowId}` : ''}
${context?.taskId ? `Task ID: ${context.taskId}` : ''}

Available Features:
- Workflow automation with n8n and Make.com
- Task management with AI assistance
- Subscription management
- Invoice and billing management
- Real-time streaming responses

Recent Workflows:
${systemContext.workflows.recent.map(w => `- ${w.name} (${w.type})`).join('\n')}

Recent Tasks:
${systemContext.tasks.recent.map(t => `- ${t.title} [${t.priority}] ${t.completed ? '✓' : '○'}`).join('\n')}

You should:
1. Provide helpful, contextual responses
2. Use the user's data to give personalized assistance
3. Suggest relevant workflows or automations
4. Help with task management and prioritization
5. Provide clear, actionable advice
6. Stream responses for better user experience

Be concise but comprehensive, and always maintain a helpful, professional tone.`
    }

    // Prepare messages for OpenAI
    const chatMessages = [
      systemMessage,
      ...messages.map(msg => ({
        role: msg.role as 'system' | 'user' | 'assistant',
        content: msg.content
      }))
    ]

    // Check if streaming is requested
    const shouldStream = options.stream !== false

    if (shouldStream) {
      // Create streaming response
      const stream = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: chatMessages,
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 2000,
        stream: true,
      })

      // Create a ReadableStream for Server-Sent Events
      const encoder = new TextEncoder()
      const readable = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of stream) {
              const content = chunk.choices[0]?.delta?.content || ''
              if (content) {
                const data = JSON.stringify({
                  type: 'content',
                  content,
                  timestamp: new Date().toISOString()
                })
                controller.enqueue(encoder.encode(`data: ${data}\n\n`))
              }
            }
            
            // Send completion signal
            const completionData = JSON.stringify({
              type: 'completion',
              timestamp: new Date().toISOString()
            })
            controller.enqueue(encoder.encode(`data: ${completionData}\n\n`))
            controller.close()
          } catch (error) {
            console.error('Streaming error:', error)
            const errorData = JSON.stringify({
              type: 'error',
              error: 'Streaming failed',
              timestamp: new Date().toISOString()
            })
            controller.enqueue(encoder.encode(`data: ${errorData}\n\n`))
            controller.close()
          }
        }
      })

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      })
    } else {
      // Create non-streaming response
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: chatMessages,
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 2000,
        stream: false,
      })

      const response = {
        content: completion.choices[0]?.message?.content || '',
        timestamp: new Date().toISOString(),
        usage: completion.usage,
        model: completion.model,
        context: systemContext
      }

      return NextResponse.json(response)
    }
  } catch (error) {
    console.error('AG-UI streaming error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
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

    // Return AG-UI status and capabilities
    const db = await createDatabaseService()
    const profile = await db.getProfile(userId)
    
    return NextResponse.json({
      status: 'active',
      version: '1.0.0',
      capabilities: [
        'real-time-streaming',
        'context-awareness',
        'workflow-integration',
        'task-management',
        'personalized-responses'
      ],
      user: {
        id: userId,
        name: profile ? `${profile.first_name} ${profile.last_name}`.trim() : 'User',
        email: profile?.email
      },
      endpoints: {
        stream: '/api/agui/stream',
        webhook: '/api/ag-ui/webhook'
      },
      models: {
        primary: 'gpt-4o-mini',
        fallback: 'gpt-3.5-turbo'
      },
      limits: {
        maxTokens: 4000,
        maxMessages: 50,
        rateLimitPerHour: 100
      }
    })
  } catch (error) {
    console.error('AG-UI status error:', error)
    return NextResponse.json(
      { error: 'Failed to get AG-UI status' },
      { status: 500 }
    )
  }
}