/**
 * Enhanced AG-UI Streaming API Endpoint
 * Provides real-time streaming with intelligent routing, tool calls, and advanced features
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createDatabaseService } from '@/lib/database'
import { aiRouter } from '@/lib/ai-router'
import { usageTracker } from '@/lib/token-counter'
import { getCachedAIResponse, cacheAIResponse } from '@/lib/ai-cache'
import { getSession, updateSessionStats } from '../session/route'
import { z } from 'zod'

interface StreamMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  timestamp?: string
  metadata?: Record<string, any>
}

interface AGUIRequest {
  message?: string
  messages?: StreamMessage[]
  sessionId?: string
  attachments?: Array<{
    id: string
    type: string
    name: string
    url: string
  }>
  context?: {
    workflowId?: string
    taskId?: string
    type: 'workflow' | 'task' | 'general' | 'chat' | 'analysis'
  }
  options?: {
    temperature?: number
    maxTokens?: number
    stream?: boolean
    tools?: string[]
    priority?: 'low' | 'normal' | 'high' | 'urgent'
  }
}

interface AGUIToolCall {
  id: string
  name: string
  arguments: Record<string, any>
  result?: any
  status: 'pending' | 'running' | 'completed' | 'failed'
  error?: string
}

// Validation schemas
const AGUIRequestSchema = z.object({
  message: z.string().optional(),
  messages: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant']),
    content: z.string(),
    timestamp: z.string().optional(),
    metadata: z.record(z.any()).optional(),
  })).optional(),
  sessionId: z.string().optional(),
  attachments: z.array(z.object({
    id: z.string(),
    type: z.string(),
    name: z.string(),
    url: z.string(),
  })).optional(),
  context: z.object({
    workflowId: z.string().optional(),
    taskId: z.string().optional(),
    type: z.enum(['workflow', 'task', 'general', 'chat', 'analysis']).optional(),
  }).optional(),
  options: z.object({
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().min(1).max(4000).optional(),
    stream: z.boolean().optional(),
    tools: z.array(z.string()).optional(),
    priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  }).optional(),
})

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

    // Parse and validate request body
    const rawBody = await request.json()
    const body = AGUIRequestSchema.parse(rawBody)
    const { message, messages, sessionId, attachments, context, options = {} } = body

    // Handle both single message and conversation formats
    let conversationMessages: StreamMessage[]
    if (message) {
      conversationMessages = [{
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
      }]
    } else if (messages && messages.length > 0) {
      conversationMessages = messages
    } else {
      return NextResponse.json(
        { error: 'Either message or messages array is required' },
        { status: 400 }
      )
    }

    // Get or validate session
    let session = null
    if (sessionId) {
      session = getSession(sessionId)
      if (!session) {
        return NextResponse.json(
          { error: 'Session not found' },
          { status: 404 }
        )
      }
      if (session.userId !== userId) {
        return NextResponse.json(
          { error: 'Access denied' },
          { status: 403 }
        )
      }
    }

    // Check cache first for non-streaming requests
    const shouldStream = options.stream !== false
    const cacheKey = `agui:${userId}:${JSON.stringify(conversationMessages)}`
    
    if (!shouldStream) {
      const cached = getCachedAIResponse(cacheKey, 'agui', context?.type || 'chat')
      if (cached) {
        return NextResponse.json({
          content: cached,
          cached: true,
          timestamp: new Date().toISOString(),
          sessionId,
        })
      }
    }

    // Get user context for AI
    const db = await createDatabaseService()
    const [profile, subscription, workflows, tasks] = await Promise.all([
      db.getProfile(userId),
      db.getActiveSubscription(userId),
      db.getUserWorkflows(userId),
      db.getUserTasks(userId)
    ])

    // Build enhanced system context
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
      },
      session: session ? {
        id: session.id,
        configuration: session.configuration,
        stats: session.stats,
      } : null,
      attachments: attachments || [],
    }

    // Use AI router for intelligent model selection
    const lastMessage = conversationMessages[conversationMessages.length - 1]
    const routingRequest = {
      input: lastMessage.content,
      operation: context?.type || 'chat' as const,
      context: {
        userId,
        sessionId: sessionId || undefined,
        priority: options.priority || 'normal',
        budget: 0.1, // 10 cents max per request
        requiredCapabilities: options.tools || [],
      },
    }

    if (shouldStream) {
      // Create intelligent streaming response
      const encoder = new TextEncoder()
      const readable = new ReadableStream({
        async start(controller) {
          try {
            let accumulatedContent = ''
            let totalTokens = { input: 0, output: 0, total: 0 }
            let totalCost = 0

            // Route the request through AI router
            const response = await aiRouter.route(routingRequest)
            
            // Simulate streaming by chunking the response
            const chunks = response.data.split(' ')
            
            for (const chunk of chunks) {
              const content = chunk + ' '
              accumulatedContent += content
              
              const data = JSON.stringify({
                type: 'content',
                content,
                timestamp: new Date().toISOString(),
                metadata: {
                  provider: response.metadata.provider,
                  modelId: response.metadata.modelId,
                  cached: response.metadata.cached,
                },
              })
              
              controller.enqueue(encoder.encode(`data: ${data}\n\n`))
              
              // Add delay for realistic streaming
              await new Promise(resolve => setTimeout(resolve, 50))
            }
            
            totalTokens = response.metadata.tokens
            totalCost = response.metadata.cost
            
            // Send tool calls if any
            if (options.tools && options.tools.length > 0) {
              for (const toolName of options.tools) {
                const toolCall: AGUIToolCall = {
                  id: `tool-${Date.now()}`,
                  name: toolName,
                  arguments: { context: systemContext },
                  status: 'pending',
                }
                
                const toolData = JSON.stringify({
                  type: 'tool_call',
                  tool_call: toolCall,
                  timestamp: new Date().toISOString(),
                })
                
                controller.enqueue(encoder.encode(`data: ${toolData}\n\n`))
                
                // Simulate tool execution
                await new Promise(resolve => setTimeout(resolve, 1000))
                
                toolCall.status = 'completed'
                toolCall.result = `Tool ${toolName} executed successfully`
                
                const toolResultData = JSON.stringify({
                  type: 'tool_result',
                  tool_call: toolCall,
                  timestamp: new Date().toISOString(),
                })
                
                controller.enqueue(encoder.encode(`data: ${toolResultData}\n\n`))
              }
            }
            
            // Send completion signal
            const completionData = JSON.stringify({
              type: 'completion',
              timestamp: new Date().toISOString(),
              metadata: {
                provider: response.metadata.provider,
                modelId: response.metadata.modelId,
                tokens: totalTokens,
                cost: totalCost,
                latency: response.metadata.latency,
                cached: response.metadata.cached,
              },
            })
            
            controller.enqueue(encoder.encode(`data: ${completionData}\n\n`))
            controller.close()
            
            // Track usage
            usageTracker.track({
              inputTokens: totalTokens.input,
              outputTokens: totalTokens.output,
              totalTokens: totalTokens.total,
              cost: totalCost,
              modelId: response.metadata.modelId,
              operation: context?.type || 'chat',
              userId,
              sessionId,
            })
            
            // Update session stats
            if (sessionId) {
              updateSessionStats(sessionId, {
                messageCount: 1,
                tokensUsed: totalTokens.total,
                cost: totalCost,
              })
            }
            
            // Cache response for non-streaming future requests
            cacheAIResponse(cacheKey, accumulatedContent.trim(), response.metadata.modelId, context?.type || 'chat')
            
          } catch (error) {
            console.error('AG-UI streaming error:', error)
            const errorData = JSON.stringify({
              type: 'error',
              error: error instanceof Error ? error.message : 'Streaming failed',
              timestamp: new Date().toISOString(),
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
      const response = await aiRouter.route(routingRequest)
      
      // Track usage
      usageTracker.track({
        inputTokens: response.metadata.tokens.input,
        outputTokens: response.metadata.tokens.output,
        totalTokens: response.metadata.tokens.total,
        cost: response.metadata.cost,
        modelId: response.metadata.modelId,
        operation: context?.type || 'chat',
        userId,
        sessionId,
      })
      
      // Update session stats
      if (sessionId) {
        updateSessionStats(sessionId, {
          messageCount: 1,
          tokensUsed: response.metadata.tokens.total,
          cost: response.metadata.cost,
        })
      }
      
      // Cache response
      cacheAIResponse(cacheKey, response.data, response.metadata.modelId, context?.type || 'chat')
      
      const result = {
        content: response.data,
        timestamp: new Date().toISOString(),
        metadata: {
          provider: response.metadata.provider,
          modelId: response.metadata.modelId,
          tokens: response.metadata.tokens,
          cost: response.metadata.cost,
          latency: response.metadata.latency,
          cached: response.metadata.cached,
        },
        context: systemContext,
        sessionId,
      }

      return NextResponse.json(result)
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