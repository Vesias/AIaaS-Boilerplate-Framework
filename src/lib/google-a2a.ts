/**
 * Google AI-to-AI (A2A) Protocol Implementation
 * Enables cross-system AI coordination and communication
 */

import { google } from 'googleapis'
import { GoogleAuth } from 'google-auth-library'

// Google A2A Configuration
export interface GoogleA2AConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
  projectId?: string
  scopes: string[]
}

// A2A Message Structure
export interface A2AMessage {
  id: string
  sourceAgent: string
  targetAgent: string
  messageType: 'request' | 'response' | 'notification' | 'coordination'
  payload: any
  metadata: {
    timestamp: string
    priority: 'low' | 'medium' | 'high' | 'critical'
    ttl?: number // Time to live in seconds
    correlationId?: string
    sessionId?: string
  }
  security: {
    signature?: string
    encryption?: 'none' | 'aes256' | 'rsa'
    accessLevel: 'public' | 'internal' | 'restricted'
  }
}

// Agent Registration
export interface A2AAgent {
  id: string
  name: string
  description: string
  capabilities: string[]
  endpoints: {
    webhook?: string
    api?: string
    socket?: string
  }
  status: 'active' | 'inactive' | 'busy' | 'maintenance'
  lastHeartbeat: string
  version: string
}

// A2A Protocol Events
export type A2AEventType = 
  | 'agent.registered'
  | 'agent.unregistered'
  | 'agent.status.changed'
  | 'message.sent'
  | 'message.received'
  | 'message.failed'
  | 'coordination.request'
  | 'coordination.response'
  | 'system.health.check'

export interface A2AEvent {
  type: A2AEventType
  agentId: string
  timestamp: string
  data: any
}

// Google A2A Client Class
export class GoogleA2AClient {
  private auth: GoogleAuth
  private config: GoogleA2AConfig
  private agents: Map<string, A2AAgent> = new Map()
  private messageQueue: A2AMessage[] = []
  private eventListeners: Map<A2AEventType, Function[]> = new Map()

  constructor(config: GoogleA2AConfig) {
    this.config = config
    this.auth = new GoogleAuth({
      scopes: config.scopes,
      credentials: {
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uris: [config.redirectUri]
      }
    })

    // Initialize event listeners
    Object.values([
      'agent.registered',
      'agent.unregistered', 
      'agent.status.changed',
      'message.sent',
      'message.received',
      'message.failed',
      'coordination.request',
      'coordination.response',
      'system.health.check'
    ] as A2AEventType[]).forEach(eventType => {
      this.eventListeners.set(eventType, [])
    })
  }

  // Agent Management
  async registerAgent(agent: Omit<A2AAgent, 'lastHeartbeat'>): Promise<boolean> {
    try {
      const fullAgent: A2AAgent = {
        ...agent,
        lastHeartbeat: new Date().toISOString()
      }

      this.agents.set(agent.id, fullAgent)
      
      await this.emitEvent({
        type: 'agent.registered',
        agentId: agent.id,
        timestamp: new Date().toISOString(),
        data: fullAgent
      })

      console.log(`Agent registered: ${agent.id}`)
      return true
    } catch (error) {
      console.error('Error registering agent:', error)
      return false
    }
  }

  async unregisterAgent(agentId: string): Promise<boolean> {
    try {
      const agent = this.agents.get(agentId)
      if (!agent) return false

      this.agents.delete(agentId)
      
      await this.emitEvent({
        type: 'agent.unregistered',
        agentId,
        timestamp: new Date().toISOString(),
        data: { agentId }
      })

      console.log(`Agent unregistered: ${agentId}`)
      return true
    } catch (error) {
      console.error('Error unregistering agent:', error)
      return false
    }
  }

  async updateAgentStatus(agentId: string, status: A2AAgent['status']): Promise<boolean> {
    try {
      const agent = this.agents.get(agentId)
      if (!agent) return false

      agent.status = status
      agent.lastHeartbeat = new Date().toISOString()
      
      await this.emitEvent({
        type: 'agent.status.changed',
        agentId,
        timestamp: new Date().toISOString(),
        data: { status, previousStatus: agent.status }
      })

      return true
    } catch (error) {
      console.error('Error updating agent status:', error)
      return false
    }
  }

  getAgent(agentId: string): A2AAgent | undefined {
    return this.agents.get(agentId)
  }

  getAllAgents(): A2AAgent[] {
    return Array.from(this.agents.values())
  }

  getActiveAgents(): A2AAgent[] {
    return Array.from(this.agents.values()).filter(agent => agent.status === 'active')
  }

  // Message Handling
  async sendMessage(message: Omit<A2AMessage, 'id' | 'metadata.timestamp'>): Promise<boolean> {
    try {
      const fullMessage: A2AMessage = {
        ...message,
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        metadata: {
          ...message.metadata,
          timestamp: new Date().toISOString()
        }
      }

      // Validate target agent exists and is active
      const targetAgent = this.agents.get(message.targetAgent)
      if (!targetAgent) {
        throw new Error(`Target agent not found: ${message.targetAgent}`)
      }

      if (targetAgent.status !== 'active') {
        throw new Error(`Target agent is not active: ${message.targetAgent} (status: ${targetAgent.status})`)
      }

      // Add to message queue
      this.messageQueue.push(fullMessage)

      // Deliver message
      await this.deliverMessage(fullMessage, targetAgent)

      await this.emitEvent({
        type: 'message.sent',
        agentId: message.sourceAgent,
        timestamp: new Date().toISOString(),
        data: { messageId: fullMessage.id, targetAgent: message.targetAgent }
      })

      return true
    } catch (error) {
      console.error('Error sending message:', error)
      
      await this.emitEvent({
        type: 'message.failed',
        agentId: message.sourceAgent,
        timestamp: new Date().toISOString(),
        data: { error: error.message, targetAgent: message.targetAgent }
      })

      return false
    }
  }

  private async deliverMessage(message: A2AMessage, targetAgent: A2AAgent): Promise<void> {
    // Try webhook delivery first
    if (targetAgent.endpoints.webhook) {
      try {
        const response = await fetch(targetAgent.endpoints.webhook, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-A2A-Source': message.sourceAgent,
            'X-A2A-Message-Id': message.id,
            'X-A2A-Message-Type': message.messageType
          },
          body: JSON.stringify(message)
        })

        if (response.ok) {
          await this.emitEvent({
            type: 'message.received',
            agentId: targetAgent.id,
            timestamp: new Date().toISOString(),
            data: { messageId: message.id, sourceAgent: message.sourceAgent }
          })
          return
        }
      } catch (error) {
        console.error('Webhook delivery failed:', error)
      }
    }

    // Try API endpoint delivery
    if (targetAgent.endpoints.api) {
      try {
        const response = await fetch(`${targetAgent.endpoints.api}/a2a/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await this.getAccessToken()}`
          },
          body: JSON.stringify(message)
        })

        if (response.ok) {
          await this.emitEvent({
            type: 'message.received',
            agentId: targetAgent.id,
            timestamp: new Date().toISOString(),
            data: { messageId: message.id, sourceAgent: message.sourceAgent }
          })
          return
        }
      } catch (error) {
        console.error('API delivery failed:', error)
      }
    }

    throw new Error('All delivery methods failed')
  }

  // Coordination Methods
  async requestCoordination(
    initiatorAgent: string,
    targetAgents: string[],
    coordinationType: string,
    payload: any
  ): Promise<string> {
    const coordinationId = `coord_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Send coordination request to all target agents
    const promises = targetAgents.map(targetAgent =>
      this.sendMessage({
        sourceAgent: initiatorAgent,
        targetAgent,
        messageType: 'coordination',
        payload: {
          coordinationId,
          type: coordinationType,
          role: 'participant',
          data: payload
        },
        metadata: {
          priority: 'high',
          correlationId: coordinationId
        },
        security: {
          accessLevel: 'internal'
        }
      })
    )

    await Promise.all(promises)

    await this.emitEvent({
      type: 'coordination.request',
      agentId: initiatorAgent,
      timestamp: new Date().toISOString(),
      data: { coordinationId, targetAgents, type: coordinationType }
    })

    return coordinationId
  }

  async respondToCoordination(
    respondingAgent: string,
    coordinationId: string,
    response: 'accept' | 'decline' | 'propose_alternative',
    data?: any
  ): Promise<boolean> {
    try {
      // Find the original coordination request
      const originalMessage = this.messageQueue.find(msg =>
        msg.metadata.correlationId === coordinationId &&
        msg.messageType === 'coordination'
      )

      if (!originalMessage) {
        throw new Error('Original coordination request not found')
      }

      // Send response back to initiator
      await this.sendMessage({
        sourceAgent: respondingAgent,
        targetAgent: originalMessage.sourceAgent,
        messageType: 'response',
        payload: {
          coordinationId,
          response,
          data
        },
        metadata: {
          priority: 'high',
          correlationId: coordinationId
        },
        security: {
          accessLevel: 'internal'
        }
      })

      await this.emitEvent({
        type: 'coordination.response',
        agentId: respondingAgent,
        timestamp: new Date().toISOString(),
        data: { coordinationId, response }
      })

      return true
    } catch (error) {
      console.error('Error responding to coordination:', error)
      return false
    }
  }

  // Health Check and Monitoring
  async performHealthCheck(): Promise<{
    totalAgents: number
    activeAgents: number
    inactiveAgents: number
    queuedMessages: number
    lastHealthCheck: string
  }> {
    const agents = Array.from(this.agents.values())
    const healthData = {
      totalAgents: agents.length,
      activeAgents: agents.filter(a => a.status === 'active').length,
      inactiveAgents: agents.filter(a => a.status !== 'active').length,
      queuedMessages: this.messageQueue.length,
      lastHealthCheck: new Date().toISOString()
    }

    await this.emitEvent({
      type: 'system.health.check',
      agentId: 'system',
      timestamp: new Date().toISOString(),
      data: healthData
    })

    return healthData
  }

  // Event System
  addEventListener(eventType: A2AEventType, listener: Function): void {
    const listeners = this.eventListeners.get(eventType) || []
    listeners.push(listener)
    this.eventListeners.set(eventType, listeners)
  }

  removeEventListener(eventType: A2AEventType, listener: Function): void {
    const listeners = this.eventListeners.get(eventType) || []
    const index = listeners.indexOf(listener)
    if (index > -1) {
      listeners.splice(index, 1)
      this.eventListeners.set(eventType, listeners)
    }
  }

  private async emitEvent(event: A2AEvent): Promise<void> {
    const listeners = this.eventListeners.get(event.type) || []
    const promises = listeners.map(listener => {
      try {
        return Promise.resolve(listener(event))
      } catch (error) {
        console.error('Event listener error:', error)
        return Promise.resolve()
      }
    })

    await Promise.allSettled(promises)
  }

  // Authentication
  private async getAccessToken(): Promise<string> {
    try {
      const authClient = await this.auth.getClient()
      const response = await authClient.getAccessToken()
      return response.token || ''
    } catch (error) {
      console.error('Error getting access token:', error)
      return ''
    }
  }

  // Cleanup
  async cleanup(): Promise<void> {
    // Clear all agents
    this.agents.clear()
    
    // Clear message queue
    this.messageQueue.length = 0
    
    // Clear event listeners
    this.eventListeners.clear()
  }
}

// Factory function to create A2A client
export function createGoogleA2AClient(): GoogleA2AClient {
  const config: GoogleA2AConfig = {
    clientId: process.env.GOOGLE_A2A_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_A2A_CLIENT_SECRET!,
    redirectUri: process.env.GOOGLE_A2A_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`,
    projectId: process.env.GOOGLE_A2A_PROJECT_ID,
    scopes: [
      'https://www.googleapis.com/auth/cloud-platform',
      'https://www.googleapis.com/auth/ai-platform'
    ]
  }

  return new GoogleA2AClient(config)
}

// Pre-configured agents for common integrations
export const defaultA2AAgents = {
  copilotKit: {
    id: 'copilotkit-agent',
    name: 'CopilotKit AI Assistant',
    description: 'Primary AI assistant for user interactions',
    capabilities: ['chat', 'task_creation', 'data_retrieval', 'user_guidance'],
    endpoints: {
      api: '/api/copilotkit'
    },
    status: 'active' as const,
    version: '1.0.0'
  },
  
  mcpAgent: {
    id: 'mcp-agent',
    name: 'Model Context Protocol Agent',
    description: 'Advanced AI context management and tool execution',
    capabilities: ['context_management', 'tool_execution', 'resource_access'],
    endpoints: {
      api: '/api/mcp'
    },
    status: 'active' as const,
    version: '1.0.0'
  },
  
  aguiAgent: {
    id: 'agui-agent',
    name: 'AG-UI Protocol Agent',
    description: 'AI-generated UI components and interactions',
    capabilities: ['ui_generation', 'component_creation', 'interface_optimization'],
    endpoints: {
      api: '/api/ag-ui',
      webhook: '/api/ag-ui/webhook'
    },
    status: 'active' as const,
    version: '1.0.0'
  },
  
  workflowAgent: {
    id: 'workflow-agent',
    name: 'Workflow Automation Agent',
    description: 'Manages n8n and Make.com workflow automations',
    capabilities: ['workflow_execution', 'automation_management', 'event_processing'],
    endpoints: {
      webhook: '/api/webhooks/automation'
    },
    status: 'active' as const,
    version: '1.0.0'
  }
}