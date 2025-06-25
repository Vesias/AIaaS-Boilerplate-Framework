/**
 * AG-UI Protocol Implementation
 * Advanced UI-driven agent communication with streaming events and real-time updates
 */

import { EventEmitter } from 'events'
import { createDatabaseService } from './database'

// Types for AG-UI protocol
export interface AGUIEvent {
  id: string
  type: string
  payload: any
  timestamp: Date
  source: string
  target?: string
  metadata?: Record<string, any>
}

export interface AGUIComponent {
  id: string
  type: 'button' | 'input' | 'display' | 'container' | 'form' | 'chart' | 'table' | 'custom'
  properties: Record<string, any>
  style?: Record<string, any>
  children?: AGUIComponent[]
  events?: string[]
  visible?: boolean
  enabled?: boolean
}

export interface AGUILayout {
  id: string
  name: string
  components: AGUIComponent[]
  style?: Record<string, any>
  responsive?: boolean
  metadata?: Record<string, any>
}

export interface AGUISession {
  id: string
  userId: string
  agentId: string
  layout: AGUILayout
  state: Record<string, any>
  status: 'active' | 'paused' | 'completed' | 'error'
  createdAt: Date
  updatedAt: Date
  eventHistory: AGUIEvent[]
}

export interface AGUIAgent {
  id: string
  name: string
  description: string
  capabilities: string[]
  layouts: AGUILayout[]
  eventHandlers: Map<string, (event: AGUIEvent, session: AGUISession) => Promise<AGUIEvent[]>>
  isActive: boolean
  configuration?: Record<string, any>
}

export interface AGUIStreamConfig {
  enableRealTime: boolean
  batchSize: number
  flushInterval: number
  compression: boolean
  authentication: {
    required: boolean
    method: 'jwt' | 'apikey' | 'oauth'
    config: Record<string, any>
  }
}

export interface AGUIMessageStream {
  sessionId: string
  events: AGUIEvent[]
  metadata: {
    timestamp: Date
    batchId: string
    sequenceNumber: number
    totalEvents: number
  }
}

/**
 * AG-UI Protocol Client
 * Manages UI components, events, and real-time communication
 */
export class AGUIProtocolClient extends EventEmitter {
  private db: Awaited<ReturnType<typeof createDatabaseService>>
  private activeSessions: Map<string, AGUISession> = new Map()
  private registeredAgents: Map<string, AGUIAgent> = new Map()
  private eventStreams: Map<string, WebSocket> = new Map()
  private streamConfig: AGUIStreamConfig
  private eventQueue: Map<string, AGUIEvent[]> = new Map()
  private flushTimers: Map<string, NodeJS.Timeout> = new Map()

  constructor(
    db: Awaited<ReturnType<typeof createDatabaseService>>,
    streamConfig: Partial<AGUIStreamConfig> = {}
  ) {
    super()
    this.db = db
    this.streamConfig = {
      enableRealTime: true,
      batchSize: 10,
      flushInterval: 1000,
      compression: false,
      authentication: {
        required: false,
        method: 'jwt',
        config: {},
      },
      ...streamConfig,
    }

    this.initializeEventHandling()
  }

  /**
   * Register a new AG-UI agent
   */
  async registerAgent(agent: Omit<AGUIAgent, 'id' | 'eventHandlers'>): Promise<AGUIAgent> {
    const newAgent: AGUIAgent = {
      ...agent,
      id: this.generateAgentId(),
      eventHandlers: new Map(),
    }

    this.registeredAgents.set(newAgent.id, newAgent)

    // Store in database
    await this.db.createAIContext({
      user_id: 'system',
      name: `AG-UI Agent: ${newAgent.name}`,
      type: 'agui',
      context_data: {
        agent: newAgent,
        layouts: newAgent.layouts,
      },
    })

    this.emit('agentRegistered', newAgent)
    return newAgent
  }

  /**
   * Create a new AG-UI session
   */
  async createSession(
    userId: string,
    agentId: string,
    layoutId?: string,
    initialState?: Record<string, any>
  ): Promise<AGUISession> {
    const agent = this.registeredAgents.get(agentId)
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`)
    }

    let layout: AGUILayout
    if (layoutId) {
      layout = agent.layouts.find(l => l.id === layoutId)!
      if (!layout) {
        throw new Error(`Layout ${layoutId} not found for agent ${agentId}`)
      }
    } else {
      layout = agent.layouts[0] || this.createDefaultLayout()
    }

    const session: AGUISession = {
      id: this.generateSessionId(),
      userId,
      agentId,
      layout,
      state: initialState || {},
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      eventHistory: [],
    }

    this.activeSessions.set(session.id, session)

    // Initialize event queue for this session
    this.eventQueue.set(session.id, [])

    // Store in database
    await this.db.createAIContext({
      user_id: userId,
      name: `AG-UI Session: ${session.id}`,
      type: 'agui',
      context_data: session,
    })

    this.emit('sessionCreated', session)
    return session
  }

  /**
   * Send event to a session
   */
  async sendEvent(
    sessionId: string,
    eventType: string,
    payload: any,
    source: string = 'client',
    target?: string
  ): Promise<void> {
    const session = this.activeSessions.get(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }

    const event: AGUIEvent = {
      id: this.generateEventId(),
      type: eventType,
      payload,
      timestamp: new Date(),
      source,
      target,
      metadata: {
        sessionId,
        userId: session.userId,
        agentId: session.agentId,
      },
    }

    // Add to session history
    session.eventHistory.push(event)
    session.updatedAt = new Date()

    // Process event
    await this.processEvent(event, session)

    // Queue for streaming
    if (this.streamConfig.enableRealTime) {
      this.queueEventForStreaming(sessionId, event)
    }

    this.emit('eventSent', event, session)
  }

  /**
   * Process an event through the agent's handlers
   */
  private async processEvent(event: AGUIEvent, session: AGUISession): Promise<void> {
    const agent = this.registeredAgents.get(session.agentId)
    if (!agent) {
      console.warn(`Agent ${session.agentId} not found for event processing`)
      return
    }

    const handler = agent.eventHandlers.get(event.type) || agent.eventHandlers.get('*')
    if (!handler) {
      console.warn(`No handler found for event type: ${event.type}`)
      return
    }

    try {
      const responseEvents = await handler(event, session)
      
      // Send response events
      for (const responseEvent of responseEvents) {
        await this.sendEvent(
          session.id,
          responseEvent.type,
          responseEvent.payload,
          'agent',
          responseEvent.target
        )
      }
    } catch (error: any) {
      console.error('Error processing event:', error)
      
      // Send error event
      await this.sendEvent(
        session.id,
        'error',
        {
          message: error.message,
          originalEvent: event,
        },
        'system'
      )
    }
  }

  /**
   * Queue event for streaming
   */
  private queueEventForStreaming(sessionId: string, event: AGUIEvent): void {
    const queue = this.eventQueue.get(sessionId) || []
    queue.push(event)
    this.eventQueue.set(sessionId, queue)

    // Flush if batch size reached
    if (queue.length >= this.streamConfig.batchSize) {
      this.flushEventQueue(sessionId)
    } else {
      // Schedule flush
      this.scheduleFlush(sessionId)
    }
  }

  /**
   * Schedule event queue flush
   */
  private scheduleFlush(sessionId: string): void {
    const existingTimer = this.flushTimers.get(sessionId)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    const timer = setTimeout(() => {
      this.flushEventQueue(sessionId)
    }, this.streamConfig.flushInterval)

    this.flushTimers.set(sessionId, timer)
  }

  /**
   * Flush event queue for a session
   */
  private flushEventQueue(sessionId: string): void {
    const queue = this.eventQueue.get(sessionId)
    if (!queue || queue.length === 0) {
      return
    }

    const stream: AGUIMessageStream = {
      sessionId,
      events: [...queue],
      metadata: {
        timestamp: new Date(),
        batchId: this.generateBatchId(),
        sequenceNumber: Date.now(),
        totalEvents: queue.length,
      },
    }

    // Clear queue
    this.eventQueue.set(sessionId, [])

    // Clear timer
    const timer = this.flushTimers.get(sessionId)
    if (timer) {
      clearTimeout(timer)
      this.flushTimers.delete(sessionId)
    }

    // Emit stream
    this.emit('eventStream', stream)

    // Send to WebSocket if connected
    const ws = this.eventStreams.get(sessionId)
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(stream))
    }
  }

  /**
   * Connect WebSocket for real-time streaming
   */
  connectWebSocket(sessionId: string, ws: WebSocket): void {
    this.eventStreams.set(sessionId, ws)

    ws.on('close', () => {
      this.eventStreams.delete(sessionId)
      this.emit('websocketDisconnected', sessionId)
    })

    ws.on('error', (error) => {
      console.error(`WebSocket error for session ${sessionId}:`, error)
      this.eventStreams.delete(sessionId)
    })

    this.emit('websocketConnected', sessionId)
  }

  /**
   * Update session layout
   */
  async updateLayout(sessionId: string, layout: AGUILayout): Promise<void> {
    const session = this.activeSessions.get(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }

    session.layout = layout
    session.updatedAt = new Date()

    await this.sendEvent(sessionId, 'layoutUpdated', { layout }, 'system')
  }

  /**
   * Update session state
   */
  async updateState(
    sessionId: string,
    stateUpdates: Record<string, any>,
    merge: boolean = true
  ): Promise<void> {
    const session = this.activeSessions.get(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }

    if (merge) {
      session.state = { ...session.state, ...stateUpdates }
    } else {
      session.state = stateUpdates
    }

    session.updatedAt = new Date()

    await this.sendEvent(sessionId, 'stateUpdated', { state: session.state }, 'system')
  }

  /**
   * Get session information
   */
  getSession(sessionId: string): AGUISession | undefined {
    return this.activeSessions.get(sessionId)
  }

  /**
   * Get active sessions for a user
   */
  getUserSessions(userId: string): AGUISession[] {
    return Array.from(this.activeSessions.values()).filter(
      session => session.userId === userId
    )
  }

  /**
   * Close session
   */
  async closeSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId)
    if (!session) {
      return
    }

    session.status = 'completed'
    session.updatedAt = new Date()

    // Flush remaining events
    this.flushEventQueue(sessionId)

    // Close WebSocket
    const ws = this.eventStreams.get(sessionId)
    if (ws) {
      ws.close()
    }

    // Clean up
    this.activeSessions.delete(sessionId)
    this.eventQueue.delete(sessionId)
    this.eventStreams.delete(sessionId)

    const timer = this.flushTimers.get(sessionId)
    if (timer) {
      clearTimeout(timer)
      this.flushTimers.delete(sessionId)
    }

    this.emit('sessionClosed', sessionId)
  }

  /**
   * Register event handler for an agent
   */
  registerEventHandler(
    agentId: string,
    eventType: string,
    handler: (event: AGUIEvent, session: AGUISession) => Promise<AGUIEvent[]>
  ): void {
    const agent = this.registeredAgents.get(agentId)
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`)
    }

    agent.eventHandlers.set(eventType, handler)
  }

  /**
   * Initialize default event handling
   */
  private initializeEventHandling(): void {
    // Handle session cleanup on process exit
    process.on('exit', () => {
      this.cleanup()
    })

    process.on('SIGINT', () => {
      this.cleanup()
      process.exit()
    })
  }

  /**
   * Create default layout
   */
  private createDefaultLayout(): AGUILayout {
    return {
      id: 'default',
      name: 'Default Layout',
      components: [
        {
          id: 'container',
          type: 'container',
          properties: {
            title: 'AG-UI Interface',
          },
          children: [
            {
              id: 'message-display',
              type: 'display',
              properties: {
                text: 'Welcome to AG-UI Protocol',
              },
              events: ['display'],
            },
            {
              id: 'input-field',
              type: 'input',
              properties: {
                placeholder: 'Enter your message...',
                type: 'text',
              },
              events: ['input', 'change'],
            },
            {
              id: 'send-button',
              type: 'button',
              properties: {
                text: 'Send',
                variant: 'primary',
              },
              events: ['click'],
            },
          ],
        },
      ],
    }
  }

  /**
   * Generate unique identifiers
   */
  private generateAgentId(): string {
    return `agui_agent_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  private generateSessionId(): string {
    return `agui_session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  private generateEventId(): string {
    return `agui_event_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    // Close all sessions
    for (const sessionId of this.activeSessions.keys()) {
      this.closeSession(sessionId)
    }

    // Clear all timers
    for (const timer of this.flushTimers.values()) {
      clearTimeout(timer)
    }

    this.activeSessions.clear()
    this.registeredAgents.clear()
    this.eventStreams.clear()
    this.eventQueue.clear()
    this.flushTimers.clear()
  }
}

/**
 * AG-UI Component Builder
 * Utility class for building UI components programmatically
 */
export class AGUIComponentBuilder {
  private component: AGUIComponent

  constructor(type: AGUIComponent['type'], id?: string) {
    this.component = {
      id: id || this.generateComponentId(),
      type,
      properties: {},
    }
  }

  setProperty(key: string, value: any): this {
    this.component.properties[key] = value
    return this
  }

  setProperties(properties: Record<string, any>): this {
    this.component.properties = { ...this.component.properties, ...properties }
    return this
  }

  setStyle(style: Record<string, any>): this {
    this.component.style = { ...this.component.style, ...style }
    return this
  }

  addEvent(event: string): this {
    if (!this.component.events) {
      this.component.events = []
    }
    this.component.events.push(event)
    return this
  }

  addChild(child: AGUIComponent): this {
    if (!this.component.children) {
      this.component.children = []
    }
    this.component.children.push(child)
    return this
  }

  setVisible(visible: boolean): this {
    this.component.visible = visible
    return this
  }

  setEnabled(enabled: boolean): this {
    this.component.enabled = enabled
    return this
  }

  build(): AGUIComponent {
    return { ...this.component }
  }

  private generateComponentId(): string {
    return `comp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  // Static factory methods for common components
  static button(text: string, id?: string): AGUIComponentBuilder {
    return new AGUIComponentBuilder('button', id)
      .setProperty('text', text)
      .addEvent('click')
  }

  static input(placeholder: string, type: string = 'text', id?: string): AGUIComponentBuilder {
    return new AGUIComponentBuilder('input', id)
      .setProperty('placeholder', placeholder)
      .setProperty('type', type)
      .addEvent('input')
      .addEvent('change')
  }

  static display(text: string, id?: string): AGUIComponentBuilder {
    return new AGUIComponentBuilder('display', id)
      .setProperty('text', text)
      .addEvent('display')
  }

  static container(title?: string, id?: string): AGUIComponentBuilder {
    const builder = new AGUIComponentBuilder('container', id)
    if (title) {
      builder.setProperty('title', title)
    }
    return builder
  }
}

/**
 * Factory function to create AG-UI client
 */
export async function createAGUIClient(
  streamConfig?: Partial<AGUIStreamConfig>
): Promise<AGUIProtocolClient> {
  const db = await createDatabaseService()
  return new AGUIProtocolClient(db, streamConfig)
}

/**
 * Pre-built AG-UI agents for common use cases
 */
export const AGUIAgents = {
  /**
   * Chat agent with message history
   */
  createChatAgent: (): Omit<AGUIAgent, 'id' | 'eventHandlers'> => ({
    name: 'Chat Agent',
    description: 'Interactive chat interface with message history',
    capabilities: ['chat', 'history', 'typing_indicators'],
    isActive: true,
    layouts: [
      {
        id: 'chat-layout',
        name: 'Chat Interface',
        components: [
          AGUIComponentBuilder.container('Chat', 'chat-container')
            .addChild(
              AGUIComponentBuilder.display('', 'message-history')
                .setProperty('type', 'rich_text')
                .setStyle({ height: '400px', overflow: 'auto' })
                .build()
            )
            .addChild(
              AGUIComponentBuilder.input('Type your message...', 'text', 'message-input')
                .setStyle({ width: '100%' })
                .build()
            )
            .addChild(
              AGUIComponentBuilder.button('Send', 'send-button')
                .setProperty('variant', 'primary')
                .build()
            )
            .build(),
        ],
      },
    ],
  }),

  /**
   * Form builder agent
   */
  createFormAgent: (): Omit<AGUIAgent, 'id' | 'eventHandlers'> => ({
    name: 'Form Builder Agent',
    description: 'Dynamic form creation and validation',
    capabilities: ['form_building', 'validation', 'data_collection'],
    isActive: true,
    layouts: [
      {
        id: 'form-layout',
        name: 'Dynamic Form',
        components: [
          AGUIComponentBuilder.container('Form Builder', 'form-container')
            .setProperty('type', 'form')
            .build(),
        ],
      },
    ],
  }),

  /**
   * Dashboard agent with charts and metrics
   */
  createDashboardAgent: (): Omit<AGUIAgent, 'id' | 'eventHandlers'> => ({
    name: 'Dashboard Agent',
    description: 'Real-time dashboard with charts and metrics',
    capabilities: ['charts', 'metrics', 'real_time_updates'],
    isActive: true,
    layouts: [
      {
        id: 'dashboard-layout',
        name: 'Analytics Dashboard',
        components: [
          AGUIComponentBuilder.container('Dashboard', 'dashboard-container')
            .addChild({
              id: 'metrics-chart',
              type: 'chart',
              properties: {
                chartType: 'line',
                title: 'Metrics Over Time',
              },
              events: ['dataUpdate'],
            })
            .addChild({
              id: 'stats-table',
              type: 'table',
              properties: {
                columns: ['Metric', 'Value', 'Change'],
                sortable: true,
              },
              events: ['sort', 'filter'],
            })
            .build(),
        ],
      },
    ],
  }),
}

// Export types
export type {
  AGUIEvent,
  AGUIComponent,
  AGUILayout,
  AGUISession,
  AGUIAgent,
  AGUIStreamConfig,
  AGUIMessageStream,
}