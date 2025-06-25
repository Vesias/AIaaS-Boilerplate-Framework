/**
 * AG-UI Session Management API
 * Creates and manages AG-UI sessions with streaming capabilities
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { aiRouter } from '@/lib/ai-router'
import { usageTracker } from '@/lib/token-counter'
import { z } from 'zod'

// Types for AG-UI sessions
interface AGUISession {
  id: string
  userId?: string
  status: 'initializing' | 'active' | 'paused' | 'completed' | 'error'
  startTime: Date
  lastActivity: Date
  configuration: AGUIConfiguration
  metadata: Record<string, any>
  stats: {
    messageCount: number
    toolCallCount: number
    tokensUsed: number
    cost: number
  }
}

interface AGUIConfiguration {
  model: string
  temperature: number
  maxTokens: number
  systemPrompt?: string
  tools: string[]
  capabilities: string[]
  streaming: boolean
  safety: {
    contentFiltering: boolean
    rateLimiting: boolean
    maxRequestsPerMinute: number
  }
}

// Validation schemas
const CreateSessionSchema = z.object({
  userId: z.string().optional(),
  configuration: z.object({
    model: z.string().default('gpt-4o'),
    temperature: z.number().min(0).max(2).default(0.7),
    maxTokens: z.number().min(1).max(4000).default(2000),
    systemPrompt: z.string().optional(),
    tools: z.array(z.string()).default([]),
    capabilities: z.array(z.string()).default([]),
    streaming: z.boolean().default(true),
    safety: z.object({
      contentFiltering: z.boolean().default(true),
      rateLimiting: z.boolean().default(true),
      maxRequestsPerMinute: z.number().default(60),
    }).default({}),
  }).optional(),
})

const UpdateConfigSchema = z.object({
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(1).max(4000).optional(),
  systemPrompt: z.string().optional(),
  tools: z.array(z.string()).optional(),
  capabilities: z.array(z.string()).optional(),
  streaming: z.boolean().optional(),
  safety: z.object({
    contentFiltering: z.boolean().optional(),
    rateLimiting: z.boolean().optional(),
    maxRequestsPerMinute: z.number().optional(),
  }).optional(),
})

// In-memory session storage (in production, use Redis or database)
const sessions = new Map<string, AGUISession>()
const userSessions = new Map<string, string[]>() // userId -> sessionIds

// Default configuration
const defaultConfiguration: AGUIConfiguration = {
  model: 'gpt-4o',
  temperature: 0.7,
  maxTokens: 2000,
  systemPrompt: 'You are an AI assistant for Roomicor. Help users with tasks, automation, and business operations.',
  tools: ['web_search', 'calculator', 'file_manager', 'database_query', 'email_sender'],
  capabilities: [
    'web_access',
    'file_operations',
    'email_integration',
    'database_access',
    'automation_tools',
  ],
  streaming: true,
  safety: {
    contentFiltering: true,
    rateLimiting: true,
    maxRequestsPerMinute: 60,
  },
}

// POST /api/agui/session - Create new session
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    const body = await request.json()
    
    const { userId: requestUserId, configuration } = CreateSessionSchema.parse(body)
    const finalUserId = userId || requestUserId

    // Generate session ID
    const sessionId = `agui-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Merge configuration with defaults
    const sessionConfig = {
      ...defaultConfiguration,
      ...configuration,
      safety: {
        ...defaultConfiguration.safety,
        ...configuration?.safety,
      },
    }

    // Create session
    const session: AGUISession = {
      id: sessionId,
      userId: finalUserId,
      status: 'active',
      startTime: new Date(),
      lastActivity: new Date(),
      configuration: sessionConfig,
      metadata: {
        userAgent: request.headers.get('user-agent'),
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        createdAt: new Date().toISOString(),
      },
      stats: {
        messageCount: 0,
        toolCallCount: 0,
        tokensUsed: 0,
        cost: 0,
      },
    }

    // Store session
    sessions.set(sessionId, session)
    
    if (finalUserId) {
      const existingSessions = userSessions.get(finalUserId) || []
      userSessions.set(finalUserId, [...existingSessions, sessionId])
    }

    // Track session creation
    usageTracker.track({
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      cost: 0,
      modelId: sessionConfig.model,
      operation: 'session_create',
      userId: finalUserId,
      sessionId,
    })

    return NextResponse.json({
      id: sessionId,
      status: session.status,
      configuration: sessionConfig,
      metadata: session.metadata,
    })

  } catch (error: any) {
    console.error('Failed to create AG-UI session:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Invalid request format',
        details: error.errors,
      }, { status: 400 })
    }

    return NextResponse.json({
      error: 'Failed to create session',
      message: error.message,
    }, { status: 500 })
  }
}

// GET /api/agui/session - List user sessions
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({
        error: 'Authentication required',
      }, { status: 401 })
    }

    const userSessionIds = userSessions.get(userId) || []
    const userSessionData = userSessionIds
      .map(id => sessions.get(id))
      .filter(Boolean)
      .map(session => ({
        id: session!.id,
        status: session!.status,
        startTime: session!.startTime,
        lastActivity: session!.lastActivity,
        stats: session!.stats,
        configuration: {
          model: session!.configuration.model,
          streaming: session!.configuration.streaming,
        },
      }))

    return NextResponse.json({
      sessions: userSessionData,
      total: userSessionData.length,
    })

  } catch (error: any) {
    console.error('Failed to list sessions:', error)
    return NextResponse.json({
      error: 'Failed to list sessions',
      message: error.message,
    }, { status: 500 })
  }
}

// GET /api/agui/session/[id] - Get specific session
export async function GET_SESSION(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { userId } = await auth()
    const sessionId = params.id

    const session = sessions.get(sessionId)
    if (!session) {
      return NextResponse.json({
        error: 'Session not found',
      }, { status: 404 })
    }

    // Check ownership
    if (userId && session.userId !== userId) {
      return NextResponse.json({
        error: 'Access denied',
      }, { status: 403 })
    }

    return NextResponse.json({
      id: session.id,
      status: session.status,
      startTime: session.startTime,
      lastActivity: session.lastActivity,
      configuration: session.configuration,
      metadata: session.metadata,
      stats: session.stats,
    })

  } catch (error: any) {
    console.error('Failed to get session:', error)
    return NextResponse.json({
      error: 'Failed to get session',
      message: error.message,
    }, { status: 500 })
  }
}

// PATCH /api/agui/session/[id]/config - Update session configuration
export async function PATCH_CONFIG(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { userId } = await auth()
    const sessionId = params.id
    const body = await request.json()

    const updates = UpdateConfigSchema.parse(body)

    const session = sessions.get(sessionId)
    if (!session) {
      return NextResponse.json({
        error: 'Session not found',
      }, { status: 404 })
    }

    // Check ownership
    if (userId && session.userId !== userId) {
      return NextResponse.json({
        error: 'Access denied',
      }, { status: 403 })
    }

    // Update configuration
    session.configuration = {
      ...session.configuration,
      ...updates,
      safety: {
        ...session.configuration.safety,
        ...updates.safety,
      },
    }
    session.lastActivity = new Date()

    sessions.set(sessionId, session)

    return NextResponse.json({
      id: sessionId,
      configuration: session.configuration,
      lastActivity: session.lastActivity,
    })

  } catch (error: any) {
    console.error('Failed to update session configuration:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Invalid configuration format',
        details: error.errors,
      }, { status: 400 })
    }

    return NextResponse.json({
      error: 'Failed to update configuration',
      message: error.message,
    }, { status: 500 })
  }
}

// POST /api/agui/session/[id]/pause - Pause session
export async function POST_PAUSE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { userId } = await auth()
    const sessionId = params.id

    const session = sessions.get(sessionId)
    if (!session) {
      return NextResponse.json({
        error: 'Session not found',
      }, { status: 404 })
    }

    // Check ownership
    if (userId && session.userId !== userId) {
      return NextResponse.json({
        error: 'Access denied',
      }, { status: 403 })
    }

    session.status = 'paused'
    session.lastActivity = new Date()
    sessions.set(sessionId, session)

    return NextResponse.json({
      id: sessionId,
      status: session.status,
      lastActivity: session.lastActivity,
    })

  } catch (error: any) {
    console.error('Failed to pause session:', error)
    return NextResponse.json({
      error: 'Failed to pause session',
      message: error.message,
    }, { status: 500 })
  }
}

// POST /api/agui/session/[id]/resume - Resume session
export async function POST_RESUME(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { userId } = await auth()
    const sessionId = params.id

    const session = sessions.get(sessionId)
    if (!session) {
      return NextResponse.json({
        error: 'Session not found',
      }, { status: 404 })
    }

    // Check ownership
    if (userId && session.userId !== userId) {
      return NextResponse.json({
        error: 'Access denied',
      }, { status: 403 })
    }

    session.status = 'active'
    session.lastActivity = new Date()
    sessions.set(sessionId, session)

    return NextResponse.json({
      id: sessionId,
      status: session.status,
      lastActivity: session.lastActivity,
    })

  } catch (error: any) {
    console.error('Failed to resume session:', error)
    return NextResponse.json({
      error: 'Failed to resume session',
      message: error.message,
    }, { status: 500 })
  }
}

// DELETE /api/agui/session/[id] - Delete session
export async function DELETE_SESSION(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { userId } = await auth()
    const sessionId = params.id

    const session = sessions.get(sessionId)
    if (!session) {
      return NextResponse.json({
        error: 'Session not found',
      }, { status: 404 })
    }

    // Check ownership
    if (userId && session.userId !== userId) {
      return NextResponse.json({
        error: 'Access denied',
      }, { status: 403 })
    }

    // Remove from storage
    sessions.delete(sessionId)
    
    if (session.userId) {
      const userSessionIds = userSessions.get(session.userId) || []
      userSessions.set(
        session.userId,
        userSessionIds.filter(id => id !== sessionId)
      )
    }

    // Track session deletion
    usageTracker.track({
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      cost: 0,
      modelId: session.configuration.model,
      operation: 'session_delete',
      userId: session.userId,
      sessionId,
    })

    return NextResponse.json({
      id: sessionId,
      deleted: true,
    })

  } catch (error: any) {
    console.error('Failed to delete session:', error)
    return NextResponse.json({
      error: 'Failed to delete session',
      message: error.message,
    }, { status: 500 })
  }
}

// GET /api/agui/session/health - Health check
export async function GET_HEALTH() {
  return NextResponse.json({
    status: 'healthy',
    sessionCount: sessions.size,
    userCount: userSessions.size,
    availableModels: ['gpt-4o', 'gpt-4', 'gpt-3.5-turbo', 'claude-3-sonnet'],
    availableTools: [
      'web_search',
      'calculator',
      'file_manager',
      'database_query',
      'email_sender',
      'image_generator',
      'code_executor',
      'pdf_reader',
    ],
    timestamp: new Date().toISOString(),
  })
}

// Cleanup old sessions (run periodically)
setInterval(() => {
  const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago
  
  for (const [sessionId, session] of sessions.entries()) {
    if (session.lastActivity < cutoffTime && session.status !== 'active') {
      sessions.delete(sessionId)
      
      if (session.userId) {
        const userSessionIds = userSessions.get(session.userId) || []
        userSessions.set(
          session.userId,
          userSessionIds.filter(id => id !== sessionId)
        )
      }
    }
  }
}, 60 * 60 * 1000) // Run every hour

// Export session getter for other modules
export function getSession(sessionId: string): AGUISession | undefined {
  return sessions.get(sessionId)
}

export function updateSessionStats(sessionId: string, stats: Partial<AGUISession['stats']>): void {
  const session = sessions.get(sessionId)
  if (session) {
    session.stats = { ...session.stats, ...stats }
    session.lastActivity = new Date()
    sessions.set(sessionId, session)
  }
}