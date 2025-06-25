import { NextRequest, NextResponse } from 'next/server'
import { EventTypes } from '@ag-ui/client'

// Validate AG-UI event structure
function isValidAgentEvent(event: any): boolean {
  return (
    event &&
    typeof event === 'object' &&
    typeof event.type === 'string' &&
    event.payload &&
    typeof event.payload === 'object'
  )
}

// Authentication middleware
function authenticate(req: NextRequest): boolean {
  if (!process.env.AGENT_API_KEY) {
    return true // Allow access if no auth key is configured
  }
  
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  
  return token === process.env.AGENT_API_KEY
}

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    if (!authenticate(req)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const event = await req.json()
    
    // Validate event structure
    if (!isValidAgentEvent(event)) {
      return NextResponse.json(
        { 
          error: 'Invalid event structure',
          expected: {
            type: 'string',
            payload: 'object'
          }
        },
        { status: 400 }
      )
    }

    // Validate event type
    if (!Object.values(EventTypes).includes(event.type)) {
      return NextResponse.json(
        { 
          error: 'Invalid event type',
          type: event.type,
          validTypes: Object.values(EventTypes)
        },
        { status: 400 }
      )
    }

    console.log(`[AG-UI Webhook] Received event: ${event.type}`, {
      type: event.type,
      payload: event.payload,
      timestamp: new Date().toISOString()
    })

    // Process the event based on type
    const result = await processAgentEvent(event)

    return NextResponse.json({
      success: true,
      eventType: event.type,
      result,
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    console.error('[AG-UI Webhook] Error processing webhook:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to process webhook',
        message: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

// Handle GET requests for webhook verification
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const challenge = searchParams.get('challenge')
  
  if (challenge) {
    // Echo back the challenge for webhook verification
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    })
  }
  
  return NextResponse.json({
    status: 'AG-UI webhook endpoint is active',
    supportedEvents: Object.values(EventTypes),
    timestamp: new Date().toISOString()
  })
}

// Process different types of AG-UI events
async function processAgentEvent(event: any) {
  const { type, payload } = event

  try {
    switch (type) {
      case EventTypes.AGENT_MESSAGE:
        return await handleAgentMessage(payload)
        
      case EventTypes.USER_MESSAGE:
        return await handleUserMessage(payload)
        
      case EventTypes.TOOL_CALL:
        return await handleToolCall(payload)
        
      case EventTypes.TOOL_RESULT:
        return await handleToolResult(payload)
        
      case EventTypes.TOOL_REQUEST:
        return await handleToolRequest(payload)
        
      case EventTypes.COMPLETION_REQUEST:
        return await handleCompletionRequest(payload)
        
      case EventTypes.COMPLETION_RESPONSE:
        return await handleCompletionResponse(payload)
        
      case EventTypes.ERROR:
        return await handleError(payload)
        
      case EventTypes.PROCESSING_START:
        return await handleProcessingStart(payload)
        
      case EventTypes.PROCESSING_END:
        return await handleProcessingEnd(payload)
        
      case EventTypes.CONNECTED:
        return await handleConnected(payload)
        
      case EventTypes.DISCONNECTED:
        return await handleDisconnected(payload)
        
      case EventTypes.SESSION_START:
        return await handleSessionStart(payload)
        
      case EventTypes.SESSION_END:
        return await handleSessionEnd(payload)
        
      case EventTypes.HEALTH_CHECK:
        return await handleHealthCheck(payload)
        
      case EventTypes.HEARTBEAT:
        return await handleHeartbeat(payload)
        
      default:
        console.log(`[AG-UI] Unhandled event type: ${type}`)
        return { processed: false, reason: 'Unknown event type' }
    }
  } catch (error: any) {
    console.error(`[AG-UI] Error processing ${type} event:`, error)
    throw error
  }
}

// Event handlers
async function handleAgentMessage(payload: any) {
  console.log('[AG-UI] Agent message:', payload.message || payload.content)
  
  // Store agent message in database, send to analytics, etc.
  // Example: await saveMessageToDatabase('agent', payload.message, payload.sessionId)
  
  return { 
    processed: true, 
    action: 'agent_message_received',
    messageId: payload.id || Date.now().toString()
  }
}

async function handleUserMessage(payload: any) {
  console.log('[AG-UI] User message:', payload.message || payload.content)
  
  // Process user message, trigger analytics, etc.
  // Example: await analyzeUserMessage(payload.message, payload.sessionId)
  
  return { 
    processed: true, 
    action: 'user_message_received',
    messageId: payload.id || Date.now().toString()
  }
}

async function handleToolCall(payload: any) {
  console.log('[AG-UI] Tool call:', {
    tool: payload.tool || payload.name,
    params: payload.params || payload.arguments,
    status: payload.status
  })
  
  // Log tool usage, update metrics, etc.
  // Example: await logToolUsage(payload.tool, payload.params, payload.sessionId)
  
  return { 
    processed: true, 
    action: 'tool_call_logged',
    toolId: payload.id || Date.now().toString()
  }
}

async function handleToolResult(payload: any) {
  console.log('[AG-UI] Tool result:', {
    tool: payload.tool,
    result: payload.result,
    success: !payload.error
  })
  
  // Process tool results, update completion metrics, etc.
  // Example: await updateToolMetrics(payload.tool, !!payload.error)
  
  return { 
    processed: true, 
    action: 'tool_result_processed',
    success: !payload.error
  }
}

async function handleToolRequest(payload: any) {
  console.log('[AG-UI] Tool request:', {
    tool: payload.tool,
    params: payload.params
  })
  
  // Handle tool execution requests
  // This is where you might execute tools on behalf of the agent
  
  return { 
    processed: true, 
    action: 'tool_request_received',
    toolName: payload.tool
  }
}

async function handleCompletionRequest(payload: any) {
  console.log('[AG-UI] Completion request:', {
    prompt: payload.prompt?.substring(0, 100) + '...',
    options: payload.options
  })
  
  // Handle completion requests from agents
  // Example: await processCompletionRequest(payload.prompt, payload.options)
  
  return { 
    processed: true, 
    action: 'completion_request_received'
  }
}

async function handleCompletionResponse(payload: any) {
  console.log('[AG-UI] Completion response:', {
    completion: payload.completion?.substring(0, 100) + '...',
    model: payload.model
  })
  
  // Process completion responses
  // Example: await logCompletionUsage(payload.model, payload.completion.length)
  
  return { 
    processed: true, 
    action: 'completion_response_processed'
  }
}

async function handleError(payload: any) {
  console.error('[AG-UI] Agent error:', {
    error: payload.error || payload.message,
    code: payload.code,
    details: payload.details
  })
  
  // Handle agent errors, send alerts, etc.
  // Example: await alertOnAgentError(payload.error, payload.sessionId)
  
  return { 
    processed: true, 
    action: 'error_logged',
    severity: payload.severity || 'error'
  }
}

async function handleProcessingStart(payload: any) {
  console.log('[AG-UI] Processing started:', payload)
  
  // Track processing start times, update UI states, etc.
  
  return { 
    processed: true, 
    action: 'processing_start_tracked'
  }
}

async function handleProcessingEnd(payload: any) {
  console.log('[AG-UI] Processing ended:', payload)
  
  // Track processing completion, calculate duration, etc.
  
  return { 
    processed: true, 
    action: 'processing_end_tracked'
  }
}

async function handleConnected(payload: any) {
  console.log('[AG-UI] Agent connected:', payload)
  
  // Handle agent connections, update status, etc.
  // Example: await updateAgentStatus(payload.agentId, 'connected')
  
  return { 
    processed: true, 
    action: 'connection_logged'
  }
}

async function handleDisconnected(payload: any) {
  console.log('[AG-UI] Agent disconnected:', payload)
  
  // Handle agent disconnections, clean up resources, etc.
  // Example: await updateAgentStatus(payload.agentId, 'disconnected')
  
  return { 
    processed: true, 
    action: 'disconnection_logged'
  }
}

async function handleSessionStart(payload: any) {
  console.log('[AG-UI] Session started:', {
    sessionId: payload.sessionId,
    agentId: payload.agentId
  })
  
  // Initialize new agent session
  // Example: await createAgentSession(payload.sessionId, payload.agentId)
  
  return { 
    processed: true, 
    action: 'session_started',
    sessionId: payload.sessionId
  }
}

async function handleSessionEnd(payload: any) {
  console.log('[AG-UI] Session ended:', {
    sessionId: payload.sessionId,
    duration: payload.duration
  })
  
  // Clean up agent session
  // Example: await endAgentSession(payload.sessionId, payload.duration)
  
  return { 
    processed: true, 
    action: 'session_ended',
    sessionId: payload.sessionId
  }
}

async function handleHealthCheck(payload: any) {
  console.log('[AG-UI] Health check:', payload)
  
  // Respond to agent health checks
  
  return { 
    processed: true, 
    action: 'health_check_responded',
    status: 'healthy',
    timestamp: new Date().toISOString()
  }
}

async function handleHeartbeat(payload: any) {
  console.log('[AG-UI] Heartbeat:', payload)
  
  // Process agent heartbeats
  // Example: await updateAgentHeartbeat(payload.agentId)
  
  return { 
    processed: true, 
    action: 'heartbeat_received',
    agentId: payload.agentId
  }
}