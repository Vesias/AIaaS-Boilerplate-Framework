import { EventTypes } from '@ag-ui/client'

// Mock AgentServer class since the actual @ag-ui/server package might not be available
interface AgentServerOptions {
  name: string
  version: string
  capabilities?: string[]
}

export interface AgentEventHandler {
  (event: AgentEvent): Promise<void> | void
}

export interface AgentEvent {
  type: string
  payload: any
  sessionId?: string
  timestamp?: string
}

export class CustomAgentBackend {
  private name: string
  private version: string
  private capabilities: string[]
  private eventHandlers: Map<string, AgentEventHandler[]> = new Map()
  private isRunning: boolean = false
  private sessions: Map<string, AgentSession> = new Map()

  constructor(options: AgentServerOptions) {
    this.name = options.name
    this.version = options.version
    this.capabilities = options.capabilities || []
    this.setupDefaultHandlers()
  }

  private setupDefaultHandlers() {
    // Handle user messages
    this.on(EventTypes.USER_MESSAGE, async (event) => {
      const { message, sessionId } = event.payload
      console.log(`[Agent Backend] User message: ${message}`)

      // Emit processing start
      this.emit({
        type: EventTypes.PROCESSING_START,
        payload: { sessionId },
        sessionId,
      })

      // Simulate agent thinking time
      await this.delay(1000 + Math.random() * 2000)

      // Generate response based on message content
      const response = await this.generateResponse(message, sessionId)

      // Send agent response
      this.emit({
        type: EventTypes.AGENT_MESSAGE,
        payload: {
          message: response,
          sessionId,
        },
        sessionId,
      })

      // Emit processing end
      this.emit({
        type: EventTypes.PROCESSING_END,
        payload: { sessionId },
        sessionId,
      })
    })

    // Handle tool requests
    this.on(EventTypes.TOOL_REQUEST, async (event) => {
      const { tool, params, sessionId } = event.payload
      console.log(`[Agent Backend] Tool request: ${tool}`, params)

      // Emit tool call start
      this.emit({
        type: EventTypes.TOOL_CALL,
        payload: {
          tool,
          params,
          status: 'running',
          sessionId,
        },
        sessionId,
      })

      try {
        // Execute the tool
        const result = await this.executeTool(tool, params, sessionId)

        // Emit successful tool result
        this.emit({
          type: EventTypes.TOOL_RESULT,
          payload: {
            tool,
            result,
            status: 'completed',
            sessionId,
          },
          sessionId,
        })
      } catch (error: any) {
        // Emit tool error
        this.emit({
          type: EventTypes.TOOL_RESULT,
          payload: {
            tool,
            error: error.message,
            status: 'failed',
            sessionId,
          },
          sessionId,
        })
      }
    })

    // Handle completion requests
    this.on(EventTypes.COMPLETION_REQUEST, async (event) => {
      const { prompt, options, sessionId } = event.payload
      console.log(`[Agent Backend] Completion request: ${prompt.substring(0, 100)}...`)

      try {
        // Generate completion
        const completion = await this.generateCompletion(prompt, options, sessionId)

        // Emit completion response
        this.emit({
          type: EventTypes.COMPLETION_RESPONSE,
          payload: {
            completion,
            model: 'custom-agent-model',
            sessionId,
          },
          sessionId,
        })
      } catch (error: any) {
        this.emit({
          type: EventTypes.ERROR,
          payload: {
            error: error.message,
            context: 'completion_request',
            sessionId,
          },
          sessionId,
        })
      }
    })

    // Handle session management
    this.on(EventTypes.SESSION_START, async (event) => {
      const { sessionId } = event.payload
      console.log(`[Agent Backend] Starting session: ${sessionId}`)

      const session = new AgentSession(sessionId)
      this.sessions.set(sessionId, session)

      // Send welcome message
      this.emit({
        type: EventTypes.AGENT_MESSAGE,
        payload: {
          message: `Hello! I'm ${this.name} v${this.version}. How can I help you today?`,
          sessionId,
        },
        sessionId,
      })
    })

    this.on(EventTypes.SESSION_END, async (event) => {
      const { sessionId } = event.payload
      console.log(`[Agent Backend] Ending session: ${sessionId}`)

      const session = this.sessions.get(sessionId)
      if (session) {
        session.end()
        this.sessions.delete(sessionId)
      }
    })

    // Handle health checks
    this.on(EventTypes.HEALTH_CHECK, async (event) => {
      this.emit({
        type: EventTypes.HEARTBEAT,
        payload: {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          sessions: this.sessions.size,
        },
      })
    })
  }

  // Event management
  on(eventType: string, handler: AgentEventHandler): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, [])
    }
    this.eventHandlers.get(eventType)!.push(handler)
  }

  off(eventType: string, handler: AgentEventHandler): void {
    const handlers = this.eventHandlers.get(eventType)
    if (handlers) {
      const index = handlers.indexOf(handler)
      if (index > -1) {
        handlers.splice(index, 1)
      }
    }
  }

  emit(event: AgentEvent): void {
    const handlers = this.eventHandlers.get(event.type)
    if (handlers) {
      handlers.forEach(handler => {
        try {
          const result = handler(event)
          if (result instanceof Promise) {
            result.catch(error => {
              console.error(`[Agent Backend] Error in event handler for ${event.type}:`, error)
            })
          }
        } catch (error) {
          console.error(`[Agent Backend] Error in event handler for ${event.type}:`, error)
        }
      })
    }

    // Log all events for debugging
    console.log(`[Agent Backend] Emitted event: ${event.type}`, event.payload)
  }

  // Core agent capabilities
  private async generateResponse(message: string, sessionId?: string): Promise<string> {
    const lowerMessage = message.toLowerCase()

    // Simple pattern matching for demo purposes
    if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
      return "Hello! I'm your AI assistant. How can I help you today?"
    }

    if (lowerMessage.includes('weather')) {
      return "I'd be happy to help with weather information! However, I'll need to use a weather tool to get current data. Let me call that for you."
    }

    if (lowerMessage.includes('calculate') || lowerMessage.includes('math')) {
      return "I can help with calculations! What would you like me to calculate?"
    }

    if (lowerMessage.includes('time')) {
      const now = new Date()
      return `The current time is ${now.toLocaleTimeString()}.`
    }

    if (lowerMessage.includes('date')) {
      const now = new Date()
      return `Today's date is ${now.toLocaleDateString()}.`
    }

    if (lowerMessage.includes('help')) {
      return `I can assist you with various tasks including:
- Answering questions
- Performing calculations
- Providing weather information (with tools)
- General conversation
- And much more! What would you like to do?`
    }

    // Default response
    const responses = [
      "That's an interesting question! Let me think about that...",
      "I understand what you're asking. Here's my thoughts on that...",
      "Based on what you've said, I think...",
      "That's a great point! Let me elaborate on that...",
      "I see what you mean. From my perspective...",
    ]

    const randomResponse = responses[Math.floor(Math.random() * responses.length)]
    return `${randomResponse} Could you provide more details about what you're looking for?`
  }

  private async executeTool(toolName: string, params: any, sessionId?: string): Promise<any> {
    console.log(`[Agent Backend] Executing tool: ${toolName}`, params)

    // Simulate tool execution time
    await this.delay(500 + Math.random() * 1500)

    switch (toolName) {
      case 'calculator':
        return this.executeCalculator(params)

      case 'weather':
        return this.executeWeatherTool(params)

      case 'search':
        return this.executeSearchTool(params)

      case 'timestamp':
        return this.executeTimestampTool(params)

      case 'uuid':
        return this.executeUuidTool(params)

      default:
        throw new Error(`Unknown tool: ${toolName}`)
    }
  }

  private executeCalculator(params: any): any {
    const { operation, a, b } = params

    switch (operation) {
      case 'add':
        return { result: a + b, expression: `${a} + ${b} = ${a + b}` }
      case 'subtract':
        return { result: a - b, expression: `${a} - ${b} = ${a - b}` }
      case 'multiply':
        return { result: a * b, expression: `${a} × ${b} = ${a * b}` }
      case 'divide':
        if (b === 0) throw new Error('Division by zero')
        return { result: a / b, expression: `${a} ÷ ${b} = ${a / b}` }
      default:
        throw new Error(`Unknown operation: ${operation}`)
    }
  }

  private executeWeatherTool(params: any): any {
    const { location } = params
    
    // Mock weather data
    const mockWeather = {
      location,
      temperature: Math.floor(Math.random() * 30) + 10,
      condition: ['Sunny', 'Cloudy', 'Rainy', 'Snowy'][Math.floor(Math.random() * 4)],
      humidity: Math.floor(Math.random() * 100),
      windSpeed: Math.floor(Math.random() * 20),
    }

    return {
      ...mockWeather,
      description: `Weather in ${location}: ${mockWeather.temperature}°C, ${mockWeather.condition}, ${mockWeather.humidity}% humidity, ${mockWeather.windSpeed} km/h wind`
    }
  }

  private executeSearchTool(params: any): any {
    const { query } = params
    
    // Mock search results
    return {
      query,
      results: [
        {
          title: `Information about ${query}`,
          url: `https://example.com/search?q=${encodeURIComponent(query)}`,
          snippet: `Here are some relevant details about ${query}...`,
        },
        {
          title: `${query} - Wikipedia`,
          url: `https://en.wikipedia.org/wiki/${encodeURIComponent(query)}`,
          snippet: `Learn more about ${query} on Wikipedia...`,
        },
      ],
      count: 2,
    }
  }

  private executeTimestampTool(params: any): any {
    const { format = 'iso' } = params
    const now = new Date()

    switch (format) {
      case 'iso':
        return { timestamp: now.toISOString(), format: 'ISO 8601' }
      case 'unix':
        return { timestamp: Math.floor(now.getTime() / 1000), format: 'Unix timestamp' }
      case 'readable':
        return { timestamp: now.toLocaleString(), format: 'Human readable' }
      default:
        return { timestamp: now.toISOString(), format: 'ISO 8601 (default)' }
    }
  }

  private executeUuidTool(params: any): any {
    const { count = 1 } = params
    const uuids = []

    for (let i = 0; i < Math.min(count, 10); i++) {
      const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0
        const v = c === 'x' ? r : (r & 0x3 | 0x8)
        return v.toString(16)
      })
      uuids.push(uuid)
    }

    return { uuids, count: uuids.length }
  }

  private async generateCompletion(prompt: string, options: any = {}, sessionId?: string): Promise<string> {
    // Simulate completion generation
    await this.delay(1000 + Math.random() * 2000)

    const maxLength = options.maxLength || 200
    const completions = [
      "Based on the prompt, here's a thoughtful completion that addresses the key points...",
      "To continue this train of thought, I would suggest considering the following aspects...",
      "The completion for this prompt involves several important considerations...",
      "Building upon the provided context, the most logical continuation would be...",
    ]

    let completion = completions[Math.floor(Math.random() * completions.length)]
    
    // Truncate if needed
    if (completion.length > maxLength) {
      completion = completion.substring(0, maxLength - 3) + '...'
    }

    return completion
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // Server lifecycle
  start(port: number = 8000): Promise<void> {
    return new Promise((resolve) => {
      this.isRunning = true
      console.log(`[Agent Backend] ${this.name} v${this.version} running on port ${port}`)
      console.log(`[Agent Backend] Capabilities: ${this.capabilities.join(', ') || 'none'}`)
      
      // Emit server start event
      this.emit({
        type: EventTypes.CONNECTED,
        payload: {
          name: this.name,
          version: this.version,
          capabilities: this.capabilities,
          port,
        },
      })

      resolve()
    })
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      this.isRunning = false
      
      // End all active sessions
      this.sessions.forEach(session => session.end())
      this.sessions.clear()
      
      // Emit server stop event
      this.emit({
        type: EventTypes.DISCONNECTED,
        payload: {
          name: this.name,
          reason: 'shutdown',
        },
      })

      console.log(`[Agent Backend] ${this.name} stopped`)
      resolve()
    })
  }

  get status() {
    return {
      name: this.name,
      version: this.version,
      isRunning: this.isRunning,
      activeSessions: this.sessions.size,
      capabilities: this.capabilities,
      uptime: process.uptime(),
    }
  }
}

// Agent session management
class AgentSession {
  public id: string
  public startTime: Date
  public endTime?: Date
  public messageCount: number = 0
  public toolCalls: number = 0

  constructor(sessionId: string) {
    this.id = sessionId
    this.startTime = new Date()
  }

  incrementMessageCount(): void {
    this.messageCount++
  }

  incrementToolCalls(): void {
    this.toolCalls++
  }

  end(): void {
    this.endTime = new Date()
  }

  get duration(): number {
    const end = this.endTime || new Date()
    return end.getTime() - this.startTime.getTime()
  }

  get isActive(): boolean {
    return !this.endTime
  }
}

// Factory function for easy setup
export function createCustomAgent(name: string, capabilities: string[] = []): CustomAgentBackend {
  return new CustomAgentBackend({
    name,
    version: '1.0.0',
    capabilities,
  })
}

// Pre-configured agent instances
export const defaultAgent = createCustomAgent('Roomicor Assistant', [
  'chat',
  'calculations',
  'weather',
  'search',
  'timestamps',
  'uuid-generation'
])

export const calculatorAgent = createCustomAgent('Calculator Agent', [
  'mathematical-operations',
  'equation-solving',
  'unit-conversion'
])

export const weatherAgent = createCustomAgent('Weather Agent', [
  'current-weather',
  'weather-forecasts',
  'location-lookup'
])