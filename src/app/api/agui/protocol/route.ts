// Official AG-UI Protocol API Route
// Implements the real AG-UI specification with @ag-ui/client SDK

import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { roomicorAGUI, createAGUIStream } from '@/lib/agui'
import { AgentTemplates, EventType } from '@/types/ag-ui'
import { z } from 'zod'

// AG-UI Protocol Request Schema (following official specification)
const AGUIProtocolRequestSchema = z.object({
  // Core AG-UI fields
  message: z.string().min(1, 'Message is required'),
  agentId: z.string().optional().default('chat-assistant'),
  sessionId: z.string().optional(),
  threadId: z.string().optional(),
  
  // AG-UI standard options
  temperature: z.number().min(0).max(2).optional().default(0.7),
  maxTokens: z.number().min(1).max(4000).optional().default(1000),
  tools: z.array(z.object({
    name: z.string(),
    description: z.string(),
    parameters: z.any()
  })).optional().default([]),
  
  // Initial messages and state (AG-UI protocol)
  initialMessages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
    timestamp: z.string().optional()
  })).optional().default([]),
  
  initialState: z.record(z.any()).optional().default({}),
  
  // Streaming configuration
  stream: z.boolean().optional().default(true)
})

// POST: Create or continue AG-UI session
export async function POST(request: NextRequest) {
  try {
    // Authenticate user (required for AG-UI protocol)
    const { userId } = await auth()
    if (!userId) {
      return new Response(JSON.stringify({ 
        error: 'Authentication required for AG-UI protocol',
        type: 'AUTH_ERROR' 
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Parse and validate AG-UI request
    const rawBody = await request.json()
    const validatedBody = AGUIProtocolRequestSchema.parse(rawBody)
    const { 
      message, 
      agentId, 
      sessionId, 
      temperature, 
      maxTokens, 
      tools, 
      initialMessages, 
      initialState,
      stream 
    } = validatedBody

    // Validate agent exists
    const availableAgents = roomicorAGUI.getAvailableAgents()
    if (!availableAgents[agentId]) {
      return new Response(JSON.stringify({
        error: `Agent '${agentId}' not found`,
        type: 'AGENT_NOT_FOUND',
        availableAgents: Object.keys(availableAgents)
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    let session
    
    // Use existing session or create new one (AG-UI protocol)
    if (sessionId) {
      session = roomicorAGUI.getSession(sessionId)
      if (!session) {
        return new Response(JSON.stringify({
          error: `Session '${sessionId}' not found`,
          type: 'SESSION_NOT_FOUND'
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      
      // Verify session ownership
      if (session.userId !== userId) {
        return new Response(JSON.stringify({
          error: 'Access denied to session',
          type: 'ACCESS_DENIED'
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        })
      }
    } else {
      // Create new AG-UI session
      session = await roomicorAGUI.createSession(userId, agentId, {
        temperature,
        maxTokens,
        tools,
        initialMessages,
        initialState
      })
    }

    if (stream) {
      // Return streaming response following AG-UI protocol
      const eventStream = roomicorAGUI.createEventStream(session.id)
      
      // Process message asynchronously to trigger AG-UI events
      roomicorAGUI.runAgent(session.id, message).catch(error => {
        console.error('AG-UI agent execution error:', error)
      })
      
      return new Response(eventStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'X-AG-UI-Version': '1.0',
          'X-AG-UI-Protocol': 'SSE',
          'X-Session-ID': session.id,
          'X-Thread-ID': session.threadId
        }
      })
    } else {
      // Non-streaming response with AG-UI events
      const response = await roomicorAGUI.runAgent(session.id, message)
      
      return new Response(JSON.stringify({
        success: response.success,
        sessionId: session.id,
        threadId: session.threadId,
        runId: response.runId,
        events: response.events,
        error: response.error,
        protocol: 'AG-UI/1.0'
      }), {
        headers: { 
          'Content-Type': 'application/json',
          'X-AG-UI-Version': '1.0',
          'X-Session-ID': session.id,
          'X-Thread-ID': session.threadId
        }
      })
    }

  } catch (error) {
    console.error('AG-UI Protocol Error:', error)
    
    // AG-UI compliant error response
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Internal server error',
      type: 'PROTOCOL_ERROR',
      timestamp: new Date().toISOString(),
      protocol: 'AG-UI/1.0'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// GET: Protocol information and session management
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return new Response(JSON.stringify({ 
        error: 'Authentication required',
        type: 'AUTH_ERROR' 
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const url = new URL(request.url)
    const action = url.searchParams.get('action')
    const sessionId = url.searchParams.get('sessionId')

    switch (action) {
      case 'session':
        if (!sessionId) {
          return new Response(JSON.stringify({
            error: 'Session ID required',
            type: 'MISSING_PARAMETER'
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          })
        }

        const session = roomicorAGUI.getSession(sessionId)
        if (!session) {
          return new Response(JSON.stringify({
            error: 'Session not found',
            type: 'SESSION_NOT_FOUND'
          }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          })
        }

        if (session.userId !== userId) {
          return new Response(JSON.stringify({
            error: 'Access denied',
            type: 'ACCESS_DENIED'
          }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          })
        }

        return new Response(JSON.stringify({
          session,
          streamUrl: `/api/agui/protocol?action=stream&sessionId=${sessionId}`,
          protocol: 'AG-UI/1.0'
        }), {
          headers: { 'Content-Type': 'application/json' }
        })

      case 'stream':
        if (!sessionId) {
          return new Response(JSON.stringify({
            error: 'Session ID required for streaming',
            type: 'MISSING_PARAMETER'
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          })
        }

        const streamSession = roomicorAGUI.getSession(sessionId)
        if (!streamSession) {
          return new Response(JSON.stringify({
            error: 'Session not found',
            type: 'SESSION_NOT_FOUND'
          }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          })
        }

        if (streamSession.userId !== userId) {
          return new Response(JSON.stringify({
            error: 'Access denied',
            type: 'ACCESS_DENIED'
          }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          })
        }

        // Return existing event stream
        const eventStream = roomicorAGUI.createEventStream(sessionId)
        return new Response(eventStream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Connection': 'keep-alive',
            'X-AG-UI-Version': '1.0',
            'X-Session-ID': sessionId,
            'X-Thread-ID': streamSession.threadId
          }
        })

      case 'stats':
        const stats = roomicorAGUI.getSessionStats()
        return new Response(JSON.stringify({
          stats,
          protocol: 'AG-UI/1.0',
          timestamp: new Date().toISOString()
        }), {
          headers: { 'Content-Type': 'application/json' }
        })

      default:
        // Return AG-UI protocol information
        const protocolInfo = roomicorAGUI.getProtocolInfo()
        const availableAgents = roomicorAGUI.getAvailableAgents()
        const sessionStats = roomicorAGUI.getSessionStats()

        return new Response(JSON.stringify({
          protocol: 'AG-UI',
          version: '1.0',
          specification: 'https://docs.ag-ui.com',
          protocolInfo,
          availableAgents,
          sessionStats,
          endpoints: {
            create: '/api/agui/protocol',
            stream: '/api/agui/protocol?action=stream&sessionId={sessionId}',
            session: '/api/agui/protocol?action=session&sessionId={sessionId}',
            stats: '/api/agui/protocol?action=stats'
          },
          supportedEventTypes: [
            'RUN_STARTED',
            'RUN_FINISHED',
            'TEXT_MESSAGE_START',
            'TEXT_MESSAGE_CONTENT',
            'TEXT_MESSAGE_CHUNK',
            'TEXT_MESSAGE_END',
            'TOOL_CALL_START',
            'TOOL_CALL_CHUNK',
            'TOOL_CALL_ARGS',
            'TOOL_CALL_END',
            'STATE_DELTA',
            'STATE_SNAPSHOT',
            'ERROR'
          ],
          supportedTransports: [
            'Server-Sent Events (SSE)',
            'HTTP POST',
            'WebSocket (planned)'
          ],
          agentTemplates: Object.keys(AgentTemplates)
        }), {
          headers: { 
            'Content-Type': 'application/json',
            'X-AG-UI-Version': '1.0'
          }
        })
    }

  } catch (error) {
    console.error('AG-UI GET Error:', error)
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Internal server error',
      type: 'PROTOCOL_ERROR',
      protocol: 'AG-UI/1.0'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// PUT: Update session state (AG-UI STATE_DELTA events)
export async function PUT(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return new Response(JSON.stringify({ 
        error: 'Authentication required',
        type: 'AUTH_ERROR' 
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const { sessionId, state } = await request.json()
    if (!sessionId || !state) {
      return new Response(JSON.stringify({
        error: 'Session ID and state are required',
        type: 'MISSING_PARAMETER'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const session = roomicorAGUI.getSession(sessionId)
    if (!session) {
      return new Response(JSON.stringify({
        error: 'Session not found',
        type: 'SESSION_NOT_FOUND'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (session.userId !== userId) {
      return new Response(JSON.stringify({
        error: 'Access denied',
        type: 'ACCESS_DENIED'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Update session state (triggers STATE_DELTA event)
    roomicorAGUI.updateSessionState(sessionId, state)

    return new Response(JSON.stringify({
      success: true,
      sessionId,
      updatedState: session.context,
      protocol: 'AG-UI/1.0'
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('AG-UI PUT Error:', error)
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'State update failed',
      type: 'STATE_UPDATE_ERROR',
      protocol: 'AG-UI/1.0'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// DELETE: Close session (AG-UI RUN_FINISHED event)
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return new Response(JSON.stringify({ 
        error: 'Authentication required',
        type: 'AUTH_ERROR' 
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const url = new URL(request.url)
    const sessionId = url.searchParams.get('sessionId')
    
    if (!sessionId) {
      return new Response(JSON.stringify({
        error: 'Session ID required',
        type: 'MISSING_PARAMETER'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const session = roomicorAGUI.getSession(sessionId)
    if (!session) {
      return new Response(JSON.stringify({
        error: 'Session not found',
        type: 'SESSION_NOT_FOUND'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (session.userId !== userId) {
      return new Response(JSON.stringify({
        error: 'Access denied',
        type: 'ACCESS_DENIED'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Close session (triggers RUN_FINISHED event)
    await roomicorAGUI.closeSession(sessionId)

    return new Response(JSON.stringify({
      success: true,
      sessionId,
      status: 'closed',
      protocol: 'AG-UI/1.0'
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('AG-UI DELETE Error:', error)
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Session close failed',
      type: 'SESSION_CLOSE_ERROR',
      protocol: 'AG-UI/1.0'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// OPTIONS: CORS handling
export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
      'X-AG-UI-Version': '1.0'
    }
  })
}