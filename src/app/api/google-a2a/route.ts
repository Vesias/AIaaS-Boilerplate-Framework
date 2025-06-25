/**
 * Google A2A Protocol API Endpoint
 * Handles agent registration, messaging, and coordination
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createGoogleA2AClient, defaultA2AAgents, A2AMessage, A2AAgent } from '@/lib/google-a2a'
import { createDatabaseService } from '@/lib/database'

// Global A2A client instance (in production, this should be managed differently)
let a2aClient: ReturnType<typeof createGoogleA2AClient> | null = null

function getA2AClient() {
  if (!a2aClient) {
    a2aClient = createGoogleA2AClient()
    
    // Register default agents on initialization
    Object.values(defaultA2AAgents).forEach(async (agent) => {
      await a2aClient!.registerAgent(agent)
    })
  }
  return a2aClient
}

// GET - Get agent status and health information
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const client = getA2AClient()
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action')

    switch (action) {
      case 'health':
        const healthData = await client.performHealthCheck()
        return NextResponse.json({ health: healthData })

      case 'agents':
        const agents = client.getAllAgents()
        return NextResponse.json({ agents })

      case 'active-agents':
        const activeAgents = client.getActiveAgents()
        return NextResponse.json({ agents: activeAgents })

      case 'agent':
        const agentId = searchParams.get('id')
        if (!agentId) {
          return NextResponse.json({ error: 'Agent ID required' }, { status: 400 })
        }
        const agent = client.getAgent(agentId)
        if (!agent) {
          return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
        }
        return NextResponse.json({ agent })

      default:
        return NextResponse.json({
          message: 'Google A2A Protocol API',
          endpoints: {
            'GET ?action=health': 'System health check',
            'GET ?action=agents': 'List all agents',
            'GET ?action=active-agents': 'List active agents',
            'GET ?action=agent&id=<agentId>': 'Get specific agent',
            'POST': 'Send A2A message or register agent',
            'PUT': 'Update agent status',
            'DELETE': 'Unregister agent'
          }
        })
    }
  } catch (error) {
    console.error('A2A GET error:', error)
    return NextResponse.json(
      { error: 'Failed to process A2A request' },
      { status: 500 }
    )
  }
}

// POST - Send A2A message or register agent
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const client = getA2AClient()
    const body = await req.json()
    const { action, ...data } = body

    switch (action) {
      case 'send-message':
        const { sourceAgent, targetAgent, messageType, payload, metadata, security } = data
        
        if (!sourceAgent || !targetAgent || !messageType || !payload) {
          return NextResponse.json(
            { error: 'Missing required fields: sourceAgent, targetAgent, messageType, payload' },
            { status: 400 }
          )
        }

        const message: Omit<A2AMessage, 'id' | 'metadata.timestamp'> = {
          sourceAgent,
          targetAgent,
          messageType,
          payload,
          metadata: {
            priority: 'medium',
            ...metadata
          },
          security: {
            accessLevel: 'internal',
            ...security
          }
        }

        const success = await client.sendMessage(message)
        
        if (success) {
          return NextResponse.json({ success: true, message: 'Message sent successfully' })
        } else {
          return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
        }

      case 'register-agent':
        const { agent } = data
        
        if (!agent || !agent.id || !agent.name) {
          return NextResponse.json(
            { error: 'Missing required agent fields: id, name' },
            { status: 400 }
          )
        }

        const agentData: Omit<A2AAgent, 'lastHeartbeat'> = {
          id: agent.id,
          name: agent.name,
          description: agent.description || '',
          capabilities: agent.capabilities || [],
          endpoints: agent.endpoints || {},
          status: agent.status || 'active',
          version: agent.version || '1.0.0'
        }

        const registered = await client.registerAgent(agentData)
        
        if (registered) {
          return NextResponse.json({ success: true, message: 'Agent registered successfully' })
        } else {
          return NextResponse.json({ error: 'Failed to register agent' }, { status: 500 })
        }

      case 'request-coordination':
        const { initiatorAgent, targetAgents, coordinationType, coordinationPayload } = data
        
        if (!initiatorAgent || !targetAgents || !coordinationType) {
          return NextResponse.json(
            { error: 'Missing required fields: initiatorAgent, targetAgents, coordinationType' },
            { status: 400 }
          )
        }

        const coordinationId = await client.requestCoordination(
          initiatorAgent,
          targetAgents,
          coordinationType,
          coordinationPayload
        )

        return NextResponse.json({ 
          success: true, 
          coordinationId,
          message: 'Coordination request sent'
        })

      case 'respond-coordination':
        const { respondingAgent, coordinationId: responseCoordinationId, response, responseData } = data
        
        if (!respondingAgent || !responseCoordinationId || !response) {
          return NextResponse.json(
            { error: 'Missing required fields: respondingAgent, coordinationId, response' },
            { status: 400 }
          )
        }

        const responded = await client.respondToCoordination(
          respondingAgent,
          responseCoordinationId,
          response,
          responseData
        )

        if (responded) {
          return NextResponse.json({ success: true, message: 'Coordination response sent' })
        } else {
          return NextResponse.json({ error: 'Failed to respond to coordination' }, { status: 500 })
        }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (error) {
    console.error('A2A POST error:', error)
    return NextResponse.json(
      { error: 'Failed to process A2A request' },
      { status: 500 }
    )
  }
}

// PUT - Update agent status
export async function PUT(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const client = getA2AClient()
    const body = await req.json()
    const { agentId, status } = body

    if (!agentId || !status) {
      return NextResponse.json(
        { error: 'Missing required fields: agentId, status' },
        { status: 400 }
      )
    }

    const validStatuses = ['active', 'inactive', 'busy', 'maintenance']
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    const updated = await client.updateAgentStatus(agentId, status)
    
    if (updated) {
      return NextResponse.json({ success: true, message: 'Agent status updated' })
    } else {
      return NextResponse.json({ error: 'Failed to update agent status' }, { status: 500 })
    }
  } catch (error) {
    console.error('A2A PUT error:', error)
    return NextResponse.json(
      { error: 'Failed to update agent' },
      { status: 500 }
    )
  }
}

// DELETE - Unregister agent
export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const client = getA2AClient()
    const { searchParams } = new URL(req.url)
    const agentId = searchParams.get('id')

    if (!agentId) {
      return NextResponse.json({ error: 'Agent ID required' }, { status: 400 })
    }

    const unregistered = await client.unregisterAgent(agentId)
    
    if (unregistered) {
      return NextResponse.json({ success: true, message: 'Agent unregistered' })
    } else {
      return NextResponse.json({ error: 'Failed to unregister agent' }, { status: 500 })
    }
  } catch (error) {
    console.error('A2A DELETE error:', error)
    return NextResponse.json(
      { error: 'Failed to unregister agent' },
      { status: 500 }
    )
  }
}