// Real AG-UI Protocol Implementation
// Based on official @ag-ui/client specification

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
import { Observable } from 'rxjs'

// Re-export official AG-UI types
export {
  AbstractAgent,
  HttpAgent,
  EventType,
  type RunAgentInput,
  type Message,
  type State,
  type Tool,
  type BaseEvent
}

// AgentConfig interface (not exported from @ag-ui/core)
export interface AgentConfig {
  agentId?: string
  description?: string
  threadId?: string
  initialMessages?: Message[]
  initialState?: State
  debug?: boolean
}

// Extended interfaces for our application
export interface RoomicorAgentConfig extends AgentConfig {
  userId?: string
  capabilities?: string[]
  model?: string
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
}

export interface RoomicorAgentEvent extends BaseEvent {
  userId?: string
  metadata?: Record<string, any>
  cost?: number
  latency?: number
}

export interface AGUISession {
  id: string
  userId: string
  agentId: string
  threadId: string
  runId?: string
  status: 'active' | 'paused' | 'completed' | 'error'
  context: Record<string, any>
  history: RoomicorAgentEvent[]
  createdAt: Date
  updatedAt: Date
}

export interface AGUIStreamOptions {
  sessionId: string
  threadId?: string
  agentId?: string
  model?: string
  temperature?: number
  maxTokens?: number
  tools?: Tool[]
  initialMessages?: Message[]
  initialState?: State
}

export interface AGUIResponse {
  success: boolean
  data?: any
  error?: string
  events?: RoomicorAgentEvent[]
  sessionId?: string
  threadId?: string
  runId?: string
}

// Event processing utilities
export class AGUIEventProcessor {
  private encoder = new TextEncoder()
  
  formatEvent(event: RoomicorAgentEvent): string {
    return `data: ${JSON.stringify(event)}\n\n`
  }
  
  createKeepAlive(): string {
    return `: keepalive\n\n`
  }
  
  createErrorEvent(error: string, threadId?: string, runId?: string): RoomicorAgentEvent {
    return {
      type: EventType.RUN_ERROR,
      error,
      threadId,
      runId,
      timestamp: Date.now()
    } as RoomicorAgentEvent
  }
  
  createRunStartEvent(threadId: string, runId: string): RoomicorAgentEvent {
    return {
      type: EventType.RUN_STARTED,
      threadId,
      runId,
      timestamp: Date.now()
    } as RoomicorAgentEvent
  }
  
  createRunFinishEvent(threadId: string, runId: string): RoomicorAgentEvent {
    return {
      type: EventType.RUN_FINISHED,
      threadId,
      runId,
      timestamp: Date.now()
    } as RoomicorAgentEvent
  }
  
  createMessageContentEvent(content: string, messageId: string, threadId?: string, runId?: string): RoomicorAgentEvent {
    return {
      type: EventType.TEXT_MESSAGE_CONTENT,
      messageId,
      delta: content,
      threadId,
      runId,
      timestamp: Date.now()
    } as RoomicorAgentEvent
  }
  
  createToolCallStartEvent(toolName: string, args: any, threadId?: string, runId?: string): RoomicorAgentEvent {
    return {
      type: EventType.TOOL_CALL_START,
      toolName,
      args,
      threadId,
      runId,
      timestamp: Date.now()
    } as RoomicorAgentEvent
  }
  
  createStateDeltaEvent(state: State, threadId?: string, runId?: string): RoomicorAgentEvent {
    return {
      type: EventType.STATE_DELTA,
      state,
      threadId,
      runId,
      timestamp: Date.now()
    } as RoomicorAgentEvent
  }
}

// Custom agent implementation for Roomicor
export class RoomicorAgent extends AbstractAgent {
  private config: RoomicorAgentConfig
  private eventProcessor: AGUIEventProcessor
  
  constructor(config: RoomicorAgentConfig) {
    super(config)
    this.config = config
    this.eventProcessor = new AGUIEventProcessor()
  }
  
  protected run(input: RunAgentInput): Observable<BaseEvent> {
    const { threadId, runId } = input
    
    return new Observable<BaseEvent>(subscriber => {
      try {
        // Emit run started event
        subscriber.next(this.eventProcessor.createRunStartEvent(threadId, runId))
        
        // Process with AI (simplified for now)
        const lastMessage = input.messages[input.messages.length - 1]
        const messageContent = typeof lastMessage?.content === 'string' 
          ? lastMessage.content 
          : 'Hello from AG-UI!'
        
        // Emit message content
        subscriber.next(this.eventProcessor.createMessageContentEvent(
          messageContent, 
          `msg_${Date.now()}`, 
          threadId, 
          runId
        ))
        
        // Emit run finished event
        subscriber.next(this.eventProcessor.createRunFinishEvent(threadId, runId))
        
        subscriber.complete()
        
      } catch (error) {
        subscriber.next(this.eventProcessor.createErrorEvent(
          error instanceof Error ? error.message : 'Unknown error',
          threadId,
          runId
        ))
        subscriber.error(error)
      }
    })
  }
}

// Pre-configured agent templates
export const AgentTemplates: Record<string, RoomicorAgentConfig> = {
  CHAT_ASSISTANT: {
    agentId: 'chat-assistant',
    description: 'General purpose conversational AI assistant',
    capabilities: ['chat', 'analysis', 'reasoning'],
    model: 'gpt-4o-mini',
    systemPrompt: 'You are a helpful AI assistant. Respond concisely and accurately.',
    temperature: 0.7,
    maxTokens: 1000
  },
  TASK_MANAGER: {
    agentId: 'task-manager', 
    description: 'AI assistant specialized in task management',
    capabilities: ['task_creation', 'scheduling', 'prioritization'],
    model: 'gpt-4o-mini',
    systemPrompt: 'You are a task management specialist. Help users organize and prioritize their work.',
    temperature: 0.3,
    maxTokens: 800
  },
  WORKFLOW_BUILDER: {
    agentId: 'workflow-builder',
    description: 'AI assistant for creating and optimizing workflows', 
    capabilities: ['workflow_design', 'automation', 'optimization'],
    model: 'gpt-4o',
    systemPrompt: 'You are a workflow automation expert. Help users design efficient automated processes.',
    temperature: 0.4,
    maxTokens: 1200
  },
  INVOICE_SPECIALIST: {
    agentId: 'invoice-specialist',
    description: 'AI assistant for invoice generation and management',
    capabilities: ['invoice_creation', 'tax_calculation', 'compliance'],
    model: 'gpt-4o',
    systemPrompt: 'You are an invoice specialist. Help users create compliant invoices and manage billing.',
    temperature: 0.2,
    maxTokens: 1000
  }
}

export type AgentTemplate = keyof typeof AgentTemplates