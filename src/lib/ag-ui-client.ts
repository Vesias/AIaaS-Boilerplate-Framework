import { AgentClient, EventTypes } from '@ag-ui/client'

export interface AgentClientConfig {
  url?: string
  transport?: 'sse' | 'websocket' | 'webhook'
  apiKey?: string
  headers?: Record<string, string>
  timeout?: number
  retryInterval?: number
  maxRetries?: number
}

export interface AgentMessage {
  id: string
  type: 'user' | 'agent' | 'system' | 'tool'
  content: string
  timestamp: Date
  metadata?: Record<string, any>
}

export interface ToolCall {
  id: string
  name: string
  params: any
  status: 'pending' | 'running' | 'completed' | 'failed'
  result?: any
  error?: string
}

export function createAgentClient(config: AgentClientConfig = {}): AgentClient {
  const defaultConfig = {
    url: process.env.NEXT_PUBLIC_AGENT_URL || 'http://localhost:8000/agent',
    transport: 'sse' as const,
    timeout: 30000,
    retryInterval: 1000,
    maxRetries: 3,
  }

  const finalConfig = { ...defaultConfig, ...config }

  const client = new AgentClient({
    url: finalConfig.url,
    transport: finalConfig.transport,
    headers: {
      'Content-Type': 'application/json',
      ...(finalConfig.apiKey && {
        'Authorization': `Bearer ${finalConfig.apiKey}`,
      }),
      ...(process.env.AGENT_API_KEY && {
        'Authorization': `Bearer ${process.env.AGENT_API_KEY}`,
      }),
      ...finalConfig.headers,
    },
    timeout: finalConfig.timeout,
    retryInterval: finalConfig.retryInterval,
    maxRetries: finalConfig.maxRetries,
  })

  return client
}

export class AgentSession {
  private client: AgentClient
  private messages: AgentMessage[] = []
  private toolCalls: ToolCall[] = []
  private listeners: Map<string, Function[]> = new Map()
  private sessionId: string
  private connected: boolean = false

  constructor(config: AgentClientConfig = {}) {
    this.client = createAgentClient(config)
    this.sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    this.setupEventHandlers()
  }

  private setupEventHandlers() {
    this.client.on(EventTypes.CONNECTED, () => {
      this.connected = true
      this.emit('connected')
    })

    this.client.on(EventTypes.DISCONNECTED, () => {
      this.connected = false
      this.emit('disconnected')
    })

    this.client.on(EventTypes.AGENT_MESSAGE, (event) => {
      const message: AgentMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'agent',
        content: event.payload.message || event.payload.content || '',
        timestamp: new Date(),
        metadata: event.payload.metadata,
      }
      this.messages.push(message)
      this.emit('message', message)
    })

    this.client.on(EventTypes.USER_MESSAGE, (event) => {
      const message: AgentMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'user',
        content: event.payload.message || event.payload.content || '',
        timestamp: new Date(),
        metadata: event.payload.metadata,
      }
      this.messages.push(message)
      this.emit('message', message)
    })

    this.client.on(EventTypes.TOOL_CALL, (event) => {
      const toolCall: ToolCall = {
        id: event.payload.id || `tool_${Date.now()}`,
        name: event.payload.tool || event.payload.name,
        params: event.payload.params || event.payload.arguments,
        status: event.payload.status || 'running',
      }

      const existingIndex = this.toolCalls.findIndex(tc => tc.id === toolCall.id)
      if (existingIndex >= 0) {
        this.toolCalls[existingIndex] = { ...this.toolCalls[existingIndex], ...toolCall }
      } else {
        this.toolCalls.push(toolCall)
      }

      this.emit('toolCall', toolCall)
    })

    this.client.on(EventTypes.TOOL_RESULT, (event) => {
      const toolCall = this.toolCalls.find(tc => 
        tc.id === event.payload.id || tc.name === event.payload.tool
      )

      if (toolCall) {
        toolCall.status = 'completed'
        toolCall.result = event.payload.result
        this.emit('toolResult', toolCall)
      }
    })

    this.client.on(EventTypes.ERROR, (event) => {
      const error = {
        message: event.payload.error || event.payload.message || 'Unknown error',
        code: event.payload.code,
        details: event.payload.details,
      }
      this.emit('error', error)
    })

    this.client.on(EventTypes.PROCESSING_START, () => {
      this.emit('processingStart')
    })

    this.client.on(EventTypes.PROCESSING_END, () => {
      this.emit('processingEnd')
    })
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect()
    } catch (error: any) {
      throw new Error(`Failed to connect to agent: ${error.message}`)
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.client.disconnect()
    } catch (error: any) {
      console.warn('Error disconnecting from agent:', error)
    }
  }

  async sendMessage(content: string, metadata?: Record<string, any>): Promise<void> {
    if (!this.connected) {
      throw new Error('Agent is not connected')
    }

    const message: AgentMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'user',
      content,
      timestamp: new Date(),
      metadata,
    }

    this.messages.push(message)
    this.emit('message', message)

    await this.client.send({
      type: EventTypes.USER_MESSAGE,
      payload: {
        message: content,
        sessionId: this.sessionId,
        metadata,
      },
    })
  }

  async callTool(toolName: string, params: any): Promise<string> {
    if (!this.connected) {
      throw new Error('Agent is not connected')
    }

    const toolCallId = `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    await this.client.send({
      type: EventTypes.TOOL_REQUEST,
      payload: {
        id: toolCallId,
        tool: toolName,
        params,
        sessionId: this.sessionId,
      },
    })

    return toolCallId
  }

  async requestCompletion(prompt: string, options?: any): Promise<void> {
    if (!this.connected) {
      throw new Error('Agent is not connected')
    }

    await this.client.send({
      type: EventTypes.COMPLETION_REQUEST,
      payload: {
        prompt,
        sessionId: this.sessionId,
        ...options,
      },
    })
  }

  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(callback)
  }

  off(event: string, callback: Function): void {
    const eventListeners = this.listeners.get(event)
    if (eventListeners) {
      const index = eventListeners.indexOf(callback)
      if (index > -1) {
        eventListeners.splice(index, 1)
      }
    }
  }

  private emit(event: string, ...args: any[]): void {
    const eventListeners = this.listeners.get(event)
    if (eventListeners) {
      eventListeners.forEach(callback => {
        try {
          callback(...args)
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error)
        }
      })
    }
  }

  // Getters
  get isConnected(): boolean {
    return this.connected
  }

  get allMessages(): AgentMessage[] {
    return [...this.messages]
  }

  get allToolCalls(): ToolCall[] {
    return [...this.toolCalls]
  }

  get id(): string {
    return this.sessionId
  }

  // Message management
  clearMessages(): void {
    this.messages = []
    this.emit('messagesCleared')
  }

  getMessageById(id: string): AgentMessage | undefined {
    return this.messages.find(msg => msg.id === id)
  }

  removeMessage(id: string): boolean {
    const index = this.messages.findIndex(msg => msg.id === id)
    if (index > -1) {
      this.messages.splice(index, 1)
      this.emit('messageRemoved', id)
      return true
    }
    return false
  }

  // Tool call management
  getToolCallById(id: string): ToolCall | undefined {
    return this.toolCalls.find(tc => tc.id === id)
  }

  getToolCallsByName(name: string): ToolCall[] {
    return this.toolCalls.filter(tc => tc.name === name)
  }

  getPendingToolCalls(): ToolCall[] {
    return this.toolCalls.filter(tc => tc.status === 'pending' || tc.status === 'running')
  }
}

// Utility functions for common operations
export async function quickAgentMessage(
  message: string,
  config: AgentClientConfig = {}
): Promise<AgentMessage[]> {
  const session = new AgentSession(config)
  const responses: AgentMessage[] = []

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      session.disconnect()
      reject(new Error('Agent response timeout'))
    }, 30000)

    session.on('message', (msg: AgentMessage) => {
      if (msg.type === 'agent') {
        responses.push(msg)
      }
    })

    session.on('processingEnd', () => {
      clearTimeout(timeout)
      session.disconnect()
      resolve(responses)
    })

    session.on('error', (error: any) => {
      clearTimeout(timeout)
      session.disconnect()
      reject(error)
    })

    session.connect().then(() => {
      session.sendMessage(message)
    }).catch(reject)
  })
}

export async function quickToolCall(
  toolName: string,
  params: any,
  config: AgentClientConfig = {}
): Promise<ToolCall> {
  const session = new AgentSession(config)

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      session.disconnect()
      reject(new Error('Tool call timeout'))
    }, 30000)

    session.on('toolResult', (toolCall: ToolCall) => {
      if (toolCall.name === toolName) {
        clearTimeout(timeout)
        session.disconnect()
        resolve(toolCall)
      }
    })

    session.on('error', (error: any) => {
      clearTimeout(timeout)
      session.disconnect()
      reject(error)
    })

    session.connect().then(() => {
      session.callTool(toolName, params)
    }).catch(reject)
  })
}

// Event type re-exports for convenience
export { EventTypes } from '@ag-ui/client'
export type { AgentEvent } from '@ag-ui/client'