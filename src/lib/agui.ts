// Real AG-UI Protocol Implementation using official SDK
// Based on @ag-ui/client specification - Event-driven agent communication

import { EventEmitter } from 'events'
import { 
  AbstractAgent,
  HttpAgent,
  EventType
} from '@ag-ui/client'
import type { 
  RunAgentInput,
  Message,
  State,
  Tool,
  BaseEvent
} from '@ag-ui/core'
import {
  RoomicorAgent,
  RoomicorAgentConfig,
  RoomicorAgentEvent,
  AGUIEventProcessor,
  AGUISession,
  AGUIStreamOptions,
  AGUIResponse,
  AgentTemplates,
  AgentTemplate,
  AgentConfig
} from '@/types/ag-ui'
import { createDatabaseService } from './database'

/**
 * Real AG-UI Protocol Manager
 * Implements the official AG-UI specification with 16 standard event types
 */
export class RoomicorAGUIProtocol extends EventEmitter {
  private db: Awaited<ReturnType<typeof createDatabaseService>> | null = null
  private sessions: Map<string, AGUISession> = new Map()
  private agents: Map<string, RoomicorAgent> = new Map()
  private httpAgents: Map<string, HttpAgent> = new Map()
  private eventProcessor: AGUIEventProcessor
  private activeStreams: Map<string, ReadableStreamDefaultController> = new Map()
  private streamConfig: {
    enableRealTime: boolean
    keepAliveInterval: number
    maxSessionDuration: number
    batchSize: number
  }
  
  constructor(streamConfig?: Partial<typeof this.streamConfig>) {
    super()
    this.streamConfig = {
      enableRealTime: true,
      keepAliveInterval: 30000,
      maxSessionDuration: 3600000, // 1 hour
      batchSize: 10,
      ...streamConfig
    }
    this.eventProcessor = new AGUIEventProcessor()
    this.initializeDatabase()
    this.initializeDefaultAgents()
  }
  
  private async initializeDatabase() {
    try {
      this.db = await createDatabaseService()
    } catch (error) {
      console.warn('Database initialization failed, continuing without persistence:', error)
    }
  }
  
  private initializeDefaultAgents() {
    // Initialize pre-configured agents from templates
    Object.entries(AgentTemplates).forEach(([key, template]) => {
      const agent = new RoomicorAgent(template)
      this.agents.set(template.agentId!, agent)
    })
  }
  
  // Create new AG-UI session with real protocol compliance
  async createSession(
    userId: string, 
    agentId: string, 
    options: Partial<AGUIStreamOptions> = {}
  ): Promise<AGUISession> {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2)}`
    const threadId = `thread_${Date.now()}_${Math.random().toString(36).substring(2)}`
    
    const session: AGUISession = {
      id: sessionId,
      userId,
      agentId,
      threadId,
      status: 'active',
      context: {
        model: options.model || 'gpt-4o-mini',
        temperature: options.temperature || 0.7,
        maxTokens: options.maxTokens || 1000,
        tools: options.tools || [],
        initialMessages: options.initialMessages || [],
        initialState: options.initialState || {}
      },
      history: [],
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    this.sessions.set(sessionId, session)
    
    // Store in database if available
    if (this.db) {
      try {
        await this.db.createAIContext({
          user_id: userId,
          name: `AG-UI Session: ${sessionId}`,
          type: 'agui',
          context_data: session
        })
      } catch (error) {
        console.warn('Failed to persist session to database:', error)
      }
    }
    
    // Emit session created event (AG-UI compliant)
    const sessionEvent = this.eventProcessor.createRunStartEvent(threadId, sessionId)
    this.broadcastEvent(sessionId, sessionEvent)
    this.emit('sessionCreated', session)
    
    return session
  }
  
  // Get session by ID
  getSession(sessionId: string): AGUISession | undefined {
    return this.sessions.get(sessionId)
  }
  
  // Run agent with official AG-UI protocol compliance
  async runAgent(
    sessionId: string, 
    message: string, 
    options: Partial<RunAgentInput> = {}
  ): Promise<AGUIResponse> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }
    
    const agent = this.agents.get(session.agentId)
    if (!agent) {
      throw new Error(`Agent ${session.agentId} not found`)
    }
    
    try {
      // Create run ID following AG-UI protocol
      const runId = `run_${Date.now()}_${Math.random().toString(36).substring(2)}`
      session.runId = runId
      
      // Emit RUN_STARTED event (AG-UI protocol requirement)
      const runStartEvent = this.eventProcessor.createRunStartEvent(session.threadId, runId)
      session.history.push(runStartEvent)
      this.broadcastEvent(sessionId, runStartEvent)
      
      // Prepare run input following AG-UI specification
      const runInput: RunAgentInput = {
        threadId: session.threadId,
        runId,
        message,
        messages: [
          ...session.context.initialMessages,
          {
            role: 'user',
            content: message,
            timestamp: new Date()
          }
        ],
        ...options
      }
      
      // Set up event collection
      const events: RoomicorAgentEvent[] = []
      const eventHandler = (event: RoomicorAgentEvent) => {
        events.push(event)
        session.history.push(event)
        session.updatedAt = new Date()
        
        // Broadcast to active streams
        this.broadcastEvent(sessionId, event)
        
        // Emit to main protocol
        this.emit('agentEvent', event)
      }
      
      // Listen to agent events
      agent.on('event', eventHandler)
      
      // Run the agent (this triggers the AG-UI event sequence)
      await agent.run(runInput)
      
      // Clean up event listener
      agent.off('event', eventHandler)
      
      // Emit RUN_FINISHED event (AG-UI protocol requirement)
      const runFinishEvent = this.eventProcessor.createRunFinishEvent(session.threadId, runId)
      events.push(runFinishEvent)
      session.history.push(runFinishEvent)
      this.broadcastEvent(sessionId, runFinishEvent)
      
      session.status = 'completed'
      
      return {
        success: true,
        events,
        sessionId,
        threadId: session.threadId,
        runId
      }
      
    } catch (error) {
      session.status = 'error'
      
      // Emit ERROR event (AG-UI protocol)
      const errorEvent = this.eventProcessor.createErrorEvent(
        error instanceof Error ? error.message : 'Unknown error',
        session.threadId,
        session.runId
      )
      
      session.history.push(errorEvent)
      this.broadcastEvent(sessionId, errorEvent)
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId,
        threadId: session.threadId,
        runId: session.runId
      }
    }
  }
  
  // Create HTTP Agent for external AG-UI compliant services
  createHttpAgent(
    agentId: string,
    url: string, 
    headers?: Record<string, string>
  ): HttpAgent {
    const httpAgent = new HttpAgent({
      url,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Roomicor-AG-UI/1.0',
        'Accept': 'application/json',
        ...headers
      }
    })
    
    this.httpAgents.set(agentId, httpAgent)
    return httpAgent
  }
  
  // Create custom agent following AG-UI specification
  createCustomAgent(config: RoomicorAgentConfig): RoomicorAgent {
    const agent = new RoomicorAgent(config)
    this.agents.set(config.agentId!, agent)
    return agent
  }
  
  // Get available agents
  getAvailableAgents(): Record<string, RoomicorAgentConfig> {
    const result: Record<string, RoomicorAgentConfig> = {}
    this.agents.forEach((agent, id) => {
      result[id] = agent.config as RoomicorAgentConfig
    })
    return result
  }
  
  // Broadcast AG-UI compliant events to active streams
  private broadcastEvent(sessionId: string, event: RoomicorAgentEvent) {
    const controller = this.activeStreams.get(sessionId)
    if (controller) {
      try {
        const formattedEvent = this.eventProcessor.formatEvent(event)
        controller.enqueue(new TextEncoder().encode(formattedEvent))
      } catch (error) {
        console.error('Error broadcasting AG-UI event:', error)
      }
    }
  }
  
  // Create Server-Sent Events stream (AG-UI transport layer)
  createEventStream(sessionId: string): ReadableStream {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }
    
    const encoder = new TextEncoder()
    
    return new ReadableStream({
      start: (controller) => {
        // Store controller for broadcasting
        this.activeStreams.set(sessionId, controller)
        
        // Send initial AG-UI compliant stream headers
        controller.enqueue(encoder.encode(': AG-UI Protocol Stream v1.0\n\n'))
        
        // Send session initialization event
        const initEvent = {
          type: EventType.RUN_STARTED,
          threadId: session.threadId,
          sessionId,
          timestamp: Date.now()
        }
        controller.enqueue(encoder.encode(this.eventProcessor.formatEvent(initEvent as RoomicorAgentEvent)))
        
        // Send existing events from history
        session.history.forEach(event => {
          const formattedEvent = this.eventProcessor.formatEvent(event)
          controller.enqueue(encoder.encode(formattedEvent))
        })
        
        // Send keep-alive events (AG-UI best practice)
        const keepAlive = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(this.eventProcessor.createKeepAlive()))
          } catch (error) {
            clearInterval(keepAlive)
          }
        }, this.streamConfig.keepAliveInterval)
        
        // Session timeout handling
        const sessionTimeout = setTimeout(() => {
          this.closeSession(sessionId)
        }, this.streamConfig.maxSessionDuration)
        
        // Handle stream cleanup
        return () => {
          this.activeStreams.delete(sessionId)
          clearInterval(keepAlive)
          clearTimeout(sessionTimeout)
        }
      },
      
      cancel: () => {
        this.activeStreams.delete(sessionId)
      }
    })
  }
  
  // Send message to agent (AG-UI TEXT_MESSAGE_CONTENT events)
  async sendMessage(
    sessionId: string, 
    content: string, 
    role: 'user' | 'system' = 'user'
  ): Promise<AGUIResponse> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }
    
    // Create message following AG-UI protocol
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2)}`
    
    // Emit TEXT_MESSAGE_START event
    const messageStartEvent = {
      type: EventType.TEXT_MESSAGE_START,
      messageId,
      threadId: session.threadId,
      runId: session.runId,
      timestamp: Date.now()
    } as RoomicorAgentEvent
    
    session.history.push(messageStartEvent)
    this.broadcastEvent(sessionId, messageStartEvent)
    
    // Emit TEXT_MESSAGE_CONTENT event
    const messageContentEvent = this.eventProcessor.createMessageContentEvent(
      content,
      messageId,
      session.threadId,
      session.runId
    )
    
    session.history.push(messageContentEvent)
    this.broadcastEvent(sessionId, messageContentEvent)
    
    // Process with agent
    return this.runAgent(sessionId, content)
  }
  
  // Update session state (AG-UI STATE_DELTA events)
  updateSessionState(sessionId: string, state: Partial<State>): void {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }
    
    // Merge state updates
    session.context = { ...session.context, ...state }
    session.updatedAt = new Date()
    
    // Emit STATE_DELTA event (AG-UI protocol)
    const stateEvent = this.eventProcessor.createStateDeltaEvent(
      state,
      session.threadId,
      session.runId
    )
    
    session.history.push(stateEvent)
    this.broadcastEvent(sessionId, stateEvent)
    this.emit('stateUpdate', stateEvent)
  }
  
  // Call tool (AG-UI TOOL_CALL events)
  async callTool(
    sessionId: string,
    toolName: string,
    args: any
  ): Promise<any> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }
    
    // Emit TOOL_CALL_START event
    const toolStartEvent = this.eventProcessor.createToolCallStartEvent(
      toolName,
      args,
      session.threadId,
      session.runId
    )
    
    session.history.push(toolStartEvent)
    this.broadcastEvent(sessionId, toolStartEvent)
    
    try {
      // Execute tool (implement tool execution logic here)
      const result = await this.executeTool(toolName, args)
      
      // Emit TOOL_CALL_END event
      const toolEndEvent = {
        type: EventType.TOOL_CALL_END,
        toolName,
        result,
        threadId: session.threadId,
        runId: session.runId,
        timestamp: Date.now()
      } as RoomicorAgentEvent
      
      session.history.push(toolEndEvent)
      this.broadcastEvent(sessionId, toolEndEvent)
      
      return result
      
    } catch (error) {
      // Emit error event
      const errorEvent = this.eventProcessor.createErrorEvent(
        `Tool ${toolName} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        session.threadId,
        session.runId
      )
      
      session.history.push(errorEvent)
      this.broadcastEvent(sessionId, errorEvent)
      
      throw error
    }
  }
  
  // Execute tool implementation
  private async executeTool(toolName: string, args: any): Promise<any> {
    // Implement tool execution logic based on your needs
    // This is a placeholder that can be extended
    switch (toolName) {
      case 'get_time':
        return { time: new Date().toISOString() }
      case 'calculate':
        return { result: eval(args.expression) } // Note: eval is dangerous in production
      default:
        throw new Error(`Unknown tool: ${toolName}`)
    }
  }
  
  // Close session (AG-UI RUN_FINISHED event)
  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      return
    }
    
    // Emit RUN_FINISHED event
    if (session.runId) {
      const finishEvent = this.eventProcessor.createRunFinishEvent(
        session.threadId,
        session.runId
      )
      session.history.push(finishEvent)
      this.broadcastEvent(sessionId, finishEvent)
    }
    
    session.status = 'completed'
    session.updatedAt = new Date()
    
    // Close stream
    const controller = this.activeStreams.get(sessionId)
    if (controller) {
      try {
        controller.close()
      } catch (error) {
        // Stream already closed
      }
    }
    
    // Clean up
    this.sessions.delete(sessionId)
    this.activeStreams.delete(sessionId)
    
    this.emit('sessionClosed', sessionId)
  }
  
  // Clean up finished sessions
  cleanupSessions(olderThanHours: number = 24): number {
    const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000)
    let cleaned = 0
    
    this.sessions.forEach((session, sessionId) => {
      if (session.updatedAt < cutoff && session.status !== 'active') {
        this.closeSession(sessionId)
        cleaned++
      }
    })
    
    return cleaned
  }
  
  // Get session statistics
  getSessionStats(): {
    total: number
    active: number
    completed: number
    error: number
    paused: number
  } {
    const stats = {
      total: this.sessions.size,
      active: 0,
      completed: 0,
      error: 0,
      paused: 0
    }
    
    this.sessions.forEach(session => {
      stats[session.status]++
    })
    
    return stats
  }
  
  // Get AG-UI protocol compliance information
  getProtocolInfo(): {
    version: string
    eventTypes: string[]
    features: string[]
    transport: string[]
  } {
    return {
      version: '1.0',
      eventTypes: [
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
      features: [
        'Real-time streaming',
        'Bidirectional communication',
        'Tool execution',
        'State management',
        'Session persistence',
        'Error handling'
      ],
      transport: [
        'Server-Sent Events (SSE)',
        'HTTP POST',
        'WebSocket (planned)'
      ]
    }
  }
}

// Global AG-UI Protocol instance
export const roomicorAGUI = new RoomicorAGUIProtocol()

// Utility functions for AG-UI protocol
export async function createAGUIStream(
  protocol: RoomicorAGUIProtocol, 
  sessionId: string
): Promise<ReadableStream> {
  return protocol.createEventStream(sessionId)
}

export function formatAGUIEvent(event: RoomicorAgentEvent): string {
  return new AGUIEventProcessor().formatEvent(event)
}

// Agent factory using AG-UI templates
export function createAGUIAgent(
  template: AgentTemplate,
  customConfig?: Partial<RoomicorAgentConfig>
): RoomicorAgent {
  const baseTemplate = AgentTemplates[template]
  const config = { ...baseTemplate, ...customConfig } as RoomicorAgentConfig
  return roomicorAGUI.createCustomAgent(config)
}

// Export all AG-UI related types and utilities
export {
  AGUIEventProcessor,
  AgentTemplates,
  EventType,
  AbstractAgent,
  HttpAgent,
  type RoomicorAgent,
  type RoomicorAgentConfig,
  type RoomicorAgentEvent,
  type AGUISession,
  type AGUIStreamOptions,
  type AGUIResponse,
  type AgentTemplate
}

// Export for backward compatibility with existing code
export type AGUIProtocolClient = RoomicorAGUIProtocol
export const createAGUIClient = async (config?: any) => roomicorAGUI