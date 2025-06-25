/**
 * Google A2A (Agent-to-Agent) Protocol Implementation
 * Advanced AI agent communication protocol with proper authentication and message handling
 */

import { google } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'
import { createDatabaseService } from './database'

// Types for A2A protocol
export interface A2AMessage {
  id: string
  conversationId: string
  senderId: string
  receiverId: string
  messageType: 'text' | 'command' | 'data' | 'event' | 'response'
  content: {
    text?: string
    data?: any
    metadata?: Record<string, any>
  }
  timestamp: Date
  status: 'pending' | 'sent' | 'delivered' | 'acknowledged' | 'failed'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  requiresResponse?: boolean
  parentMessageId?: string
}

export interface A2AAgent {
  id: string
  name: string
  type: 'user' | 'system' | 'service'
  capabilities: string[]
  endpoint?: string
  authToken?: string
  isActive: boolean
  lastSeen?: Date
  metadata?: Record<string, any>
}

export interface A2AConversation {
  id: string
  participants: string[]
  topic?: string
  status: 'active' | 'paused' | 'completed' | 'archived'
  createdAt: Date
  updatedAt: Date
  metadata?: Record<string, any>
}

export interface A2AProtocolConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
  scopes: string[]
  serviceAccountKeyPath?: string
}

export interface A2AMessageHandler {
  messageType: string
  handler: (message: A2AMessage, context: A2AContext) => Promise<A2AMessage | null>
}

export interface A2AContext {
  conversation: A2AConversation
  sender: A2AAgent
  receiver: A2AAgent
  history: A2AMessage[]
}

/**
 * Google A2A Protocol Client
 * Handles authentication, message routing, and agent communication
 */
export class A2AProtocolClient {
  private oauth2Client: OAuth2Client
  private config: A2AProtocolConfig
  private db: Awaited<ReturnType<typeof createDatabaseService>>
  private messageHandlers: Map<string, A2AMessageHandler['handler']> = new Map()
  private activeConversations: Map<string, A2AConversation> = new Map()
  private connectedAgents: Map<string, A2AAgent> = new Map()

  constructor(config: A2AProtocolConfig, db: Awaited<ReturnType<typeof createDatabaseService>>) {
    this.config = config
    this.db = db
    this.oauth2Client = new OAuth2Client(
      config.clientId,
      config.clientSecret,
      config.redirectUri
    )

    // Initialize default message handlers
    this.initializeDefaultHandlers()
  }

  /**
   * Initialize OAuth2 authentication
   */
  async authenticate(accessToken?: string): Promise<boolean> {
    try {
      if (accessToken) {
        this.oauth2Client.setCredentials({ access_token: accessToken })
      } else {
        // For service account authentication
        if (this.config.serviceAccountKeyPath) {
          const auth = new google.auth.GoogleAuth({
            keyFile: this.config.serviceAccountKeyPath,
            scopes: this.config.scopes,
          })
          const client = await auth.getClient()
          this.oauth2Client = client as OAuth2Client
        }
      }

      // Verify authentication
      const tokenInfo = await this.oauth2Client.getTokenInfo(
        this.oauth2Client.credentials.access_token!
      )
      
      return !!tokenInfo.sub
    } catch (error: any) {
      console.error('A2A authentication failed:', error)
      return false
    }
  }

  /**
   * Generate OAuth2 authorization URL
   */
  getAuthUrl(): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: this.config.scopes,
      prompt: 'consent',
    })
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string): Promise<boolean> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code)
      this.oauth2Client.setCredentials(tokens)
      return true
    } catch (error: any) {
      console.error('Token exchange failed:', error)
      return false
    }
  }

  /**
   * Register a new agent
   */
  async registerAgent(agent: Omit<A2AAgent, 'id' | 'isActive' | 'lastSeen'>): Promise<A2AAgent> {
    const newAgent: A2AAgent = {
      ...agent,
      id: this.generateAgentId(),
      isActive: true,
      lastSeen: new Date(),
    }

    this.connectedAgents.set(newAgent.id, newAgent)
    
    // Store in database
    await this.db.createAIContext({
      user_id: 'system',
      name: `A2A Agent: ${newAgent.name}`,
      type: 'a2a',
      context_data: newAgent,
    })

    return newAgent
  }

  /**
   * Create a new conversation
   */
  async createConversation(
    participants: string[],
    topic?: string,
    metadata?: Record<string, any>
  ): Promise<A2AConversation> {
    const conversation: A2AConversation = {
      id: this.generateConversationId(),
      participants,
      topic,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata,
    }

    this.activeConversations.set(conversation.id, conversation)
    
    // Store in database
    await this.db.createAIContext({
      user_id: 'system',
      name: `A2A Conversation: ${topic || conversation.id}`,
      type: 'a2a',
      context_data: conversation,
    })

    return conversation
  }

  /**
   * Send message to another agent
   */
  async sendMessage(
    conversationId: string,
    receiverId: string,
    content: A2AMessage['content'],
    messageType: A2AMessage['messageType'] = 'text',
    priority: A2AMessage['priority'] = 'normal',
    requiresResponse: boolean = false
  ): Promise<A2AMessage> {
    const conversation = this.activeConversations.get(conversationId)
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`)
    }

    const receiver = this.connectedAgents.get(receiverId)
    if (!receiver) {
      throw new Error(`Agent ${receiverId} not found`)
    }

    const message: A2AMessage = {
      id: this.generateMessageId(),
      conversationId,
      senderId: 'system', // This would be the authenticated agent's ID
      receiverId,
      messageType,
      content,
      timestamp: new Date(),
      status: 'pending',
      priority,
      requiresResponse,
    }

    // Route message based on agent type and endpoint
    try {
      await this.routeMessage(message, receiver)
      message.status = 'sent'
    } catch (error: any) {
      message.status = 'failed'
      console.error('Failed to route message:', error)
    }

    return message
  }

  /**
   * Route message to appropriate handler
   */
  private async routeMessage(message: A2AMessage, receiver: A2AAgent): Promise<void> {
    if (receiver.endpoint) {
      // Send to external endpoint
      await this.sendToEndpoint(message, receiver.endpoint, receiver.authToken)
    } else {
      // Handle locally
      await this.handleMessageLocally(message)
    }
  }

  /**
   * Send message to external endpoint
   */
  private async sendToEndpoint(
    message: A2AMessage,
    endpoint: string,
    authToken?: string
  ): Promise<void> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-A2A-Protocol-Version': '1.0',
    }

    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message,
        timestamp: new Date().toISOString(),
        protocol: 'A2A',
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
  }

  /**
   * Handle message locally using registered handlers
   */
  private async handleMessageLocally(message: A2AMessage): Promise<void> {
    const handler = this.messageHandlers.get(message.messageType)
    if (!handler) {
      console.warn(`No handler registered for message type: ${message.messageType}`)
      return
    }

    try {
      const conversation = this.activeConversations.get(message.conversationId)!
      const sender = this.connectedAgents.get(message.senderId)!
      const receiver = this.connectedAgents.get(message.receiverId)!

      const context: A2AContext = {
        conversation,
        sender,
        receiver,
        history: [], // This would be populated from database
      }

      const response = await handler(message, context)
      
      if (response && message.requiresResponse) {
        // Send response back
        await this.sendMessage(
          message.conversationId,
          message.senderId,
          response.content,
          'response',
          'normal',
          false
        )
      }
    } catch (error: any) {
      console.error('Error handling message locally:', error)
    }
  }

  /**
   * Register message handler
   */
  registerMessageHandler(
    messageType: string,
    handler: A2AMessageHandler['handler']
  ): void {
    this.messageHandlers.set(messageType, handler)
  }

  /**
   * Get conversation history
   */
  async getConversationHistory(conversationId: string): Promise<A2AMessage[]> {
    // This would query the database for message history
    // For now, return empty array
    return []
  }

  /**
   * Update agent status
   */
  async updateAgentStatus(agentId: string, isActive: boolean): Promise<void> {
    const agent = this.connectedAgents.get(agentId)
    if (agent) {
      agent.isActive = isActive
      agent.lastSeen = new Date()
      this.connectedAgents.set(agentId, agent)
    }
  }

  /**
   * Get active agents
   */
  getActiveAgents(): A2AAgent[] {
    return Array.from(this.connectedAgents.values()).filter(agent => agent.isActive)
  }

  /**
   * Initialize default message handlers
   */
  private initializeDefaultHandlers(): void {
    // Ping handler
    this.registerMessageHandler('ping', async (message, context) => {
      return {
        id: this.generateMessageId(),
        conversationId: message.conversationId,
        senderId: message.receiverId,
        receiverId: message.senderId,
        messageType: 'response',
        content: {
          text: 'pong',
          metadata: { originalMessageId: message.id },
        },
        timestamp: new Date(),
        status: 'sent',
        priority: 'normal',
      }
    })

    // Status request handler
    this.registerMessageHandler('status', async (message, context) => {
      const agent = context.receiver
      return {
        id: this.generateMessageId(),
        conversationId: message.conversationId,
        senderId: message.receiverId,
        receiverId: message.senderId,
        messageType: 'response',
        content: {
          data: {
            agentId: agent.id,
            name: agent.name,
            capabilities: agent.capabilities,
            isActive: agent.isActive,
            lastSeen: agent.lastSeen,
          },
        },
        timestamp: new Date(),
        status: 'sent',
        priority: 'normal',
      }
    })

    // Command execution handler
    this.registerMessageHandler('command', async (message, context) => {
      const command = message.content.data?.command
      if (!command) {
        throw new Error('No command specified')
      }

      // Execute command based on agent capabilities
      const result = await this.executeCommand(command, message.content.data?.args || {}, context)
      
      return {
        id: this.generateMessageId(),
        conversationId: message.conversationId,
        senderId: message.receiverId,
        receiverId: message.senderId,
        messageType: 'response',
        content: {
          data: result,
          metadata: { 
            command,
            executedAt: new Date().toISOString(),
          },
        },
        timestamp: new Date(),
        status: 'sent',
        priority: message.priority,
      }
    })
  }

  /**
   * Execute command based on agent capabilities
   */
  private async executeCommand(
    command: string,
    args: Record<string, any>,
    context: A2AContext
  ): Promise<any> {
    const agent = context.receiver
    
    if (!agent.capabilities.includes(command)) {
      throw new Error(`Agent ${agent.name} does not support command: ${command}`)
    }

    // Execute based on command type
    switch (command) {
      case 'get_info':
        return {
          agentInfo: agent,
          conversationInfo: context.conversation,
          timestamp: new Date().toISOString(),
        }

      case 'list_capabilities':
        return {
          capabilities: agent.capabilities,
          agentType: agent.type,
        }

      case 'process_data':
        return {
          processed: true,
          inputData: args.data,
          result: `Processed ${JSON.stringify(args.data)}`,
          processedAt: new Date().toISOString(),
        }

      default:
        throw new Error(`Unknown command: ${command}`)
    }
  }

  /**
   * Generate unique identifiers
   */
  private generateAgentId(): string {
    return `agent_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  private generateConversationId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    // Close all active conversations
    for (const conversation of this.activeConversations.values()) {
      conversation.status = 'completed'
    }

    // Mark all agents as inactive
    for (const agent of this.connectedAgents.values()) {
      agent.isActive = false
    }

    this.activeConversations.clear()
    this.connectedAgents.clear()
    this.messageHandlers.clear()
  }
}

/**
 * A2A Protocol Server
 * Handles incoming A2A messages and agent registration
 */
export class A2AProtocolServer {
  private client: A2AProtocolClient
  private registeredEndpoints: Map<string, (message: A2AMessage) => Promise<any>> = new Map()

  constructor(client: A2AProtocolClient) {
    this.client = client
  }

  /**
   * Handle incoming A2A message
   */
  async handleIncomingMessage(payload: any): Promise<any> {
    try {
      const message: A2AMessage = payload.message
      
      if (!this.validateMessage(message)) {
        throw new Error('Invalid message format')
      }

      // Process the message
      const result = await this.processMessage(message)
      
      return {
        success: true,
        messageId: message.id,
        result,
        timestamp: new Date().toISOString(),
      }
    } catch (error: any) {
      console.error('Error handling incoming A2A message:', error)
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      }
    }
  }

  /**
   * Process incoming message
   */
  private async processMessage(message: A2AMessage): Promise<any> {
    // Find handler for the endpoint or message type
    const handler = this.registeredEndpoints.get(message.receiverId) ||
                   this.registeredEndpoints.get(message.messageType)

    if (handler) {
      return await handler(message)
    }

    // Fallback to client's local handler
    return await this.client['handleMessageLocally'](message)
  }

  /**
   * Register endpoint handler
   */
  registerEndpoint(
    endpoint: string,
    handler: (message: A2AMessage) => Promise<any>
  ): void {
    this.registeredEndpoints.set(endpoint, handler)
  }

  /**
   * Validate message format
   */
  private validateMessage(message: any): message is A2AMessage {
    return (
      message &&
      typeof message.id === 'string' &&
      typeof message.conversationId === 'string' &&
      typeof message.senderId === 'string' &&
      typeof message.receiverId === 'string' &&
      typeof message.messageType === 'string' &&
      message.content &&
      message.timestamp
    )
  }
}

/**
 * Factory function to create A2A client
 */
export async function createA2AClient(config: A2AProtocolConfig): Promise<A2AProtocolClient> {
  const db = await createDatabaseService()
  return new A2AProtocolClient(config, db)
}

/**
 * Factory function to create A2A server
 */
export async function createA2AServer(config: A2AProtocolConfig): Promise<A2AProtocolServer> {
  const client = await createA2AClient(config)
  return new A2AProtocolServer(client)
}

/**
 * Utility functions for A2A protocol
 */
export const A2AUtils = {
  /**
   * Create default agent configuration
   */
  createDefaultAgent: (
    name: string,
    type: A2AAgent['type'],
    capabilities: string[] = []
  ): Omit<A2AAgent, 'id' | 'isActive' | 'lastSeen'> => ({
    name,
    type,
    capabilities: [
      'ping',
      'status',
      'get_info',
      'list_capabilities',
      ...capabilities,
    ],
  }),

  /**
   * Create message template
   */
  createMessage: (
    conversationId: string,
    receiverId: string,
    content: A2AMessage['content'],
    messageType: A2AMessage['messageType'] = 'text'
  ): Omit<A2AMessage, 'id' | 'senderId' | 'timestamp' | 'status'> => ({
    conversationId,
    receiverId,
    messageType,
    content,
    priority: 'normal',
  }),

  /**
   * Validate agent capabilities
   */
  validateCapabilities: (capabilities: string[]): boolean => {
    const validCapabilities = [
      'ping', 'status', 'get_info', 'list_capabilities',
      'command', 'process_data', 'send_notification',
      'file_operations', 'database_access', 'api_calls'
    ]
    
    return capabilities.every(cap => validCapabilities.includes(cap))
  }
}

// Export types
export type {
  A2AMessage,
  A2AAgent,
  A2AConversation,
  A2AProtocolConfig,
  A2AMessageHandler,
  A2AContext,
}