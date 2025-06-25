// Custom AG-UI Types Implementation
// This replaces the problematic @ag-ui/client types

export interface AGUIEvent {
  type: 'TEXT_MESSAGE_CONTENT' | 'TOOL_CALL_START' | 'TOOL_CALL_END' | 'STATE_DELTA' | 'ERROR' | 'AGENT_MESSAGE' | 'AGENT_THINKING'
  content?: string
  toolName?: string
  args?: Record<string, any>
  result?: any
  state?: any
  error?: string
  timestamp: number
  agentId?: string
  metadata?: Record<string, any>
}

export interface AGUISession {
  id: string
  userId: string
  agentId: string
  status: 'active' | 'paused' | 'completed' | 'error'
  context: Record<string, any>
  history: AGUIEvent[]
  createdAt: Date
  updatedAt: Date
}

export interface AGUIAgent {
  id: string
  name: string
  description: string
  capabilities: string[]
  model: string
  systemPrompt: string
  tools: AGUITool[]
  config: Record<string, any>
}

export interface AGUITool {
  name: string
  description: string
  parameters: Record<string, any>
  handler: (args: any) => Promise<any>
}

export interface AGUIMessage {
  id: string
  sessionId: string
  agentId: string
  content: string
  role: 'user' | 'assistant' | 'system'
  type: 'text' | 'tool_call' | 'tool_result'
  timestamp: Date
  metadata?: Record<string, any>
}

export interface AGUIStreamOptions {
  sessionId: string
  agentId?: string
  model?: string
  temperature?: number
  maxTokens?: number
  tools?: AGUITool[]
}

export interface AGUIResponse {
  success: boolean
  data?: any
  error?: string
  events?: AGUIEvent[]
}

// Event type definitions
export const EventTypes = {
  AGENT_MESSAGE: 'AGENT_MESSAGE',
  AGENT_THINKING: 'AGENT_THINKING',
  TOOL_CALL_START: 'TOOL_CALL_START',
  TOOL_CALL_END: 'TOOL_CALL_END',
  STATE_DELTA: 'STATE_DELTA',
  ERROR: 'ERROR',
  TEXT_MESSAGE_CONTENT: 'TEXT_MESSAGE_CONTENT'
} as const

export type EventType = keyof typeof EventTypes

// Stream processing utilities
export class AGUIStreamProcessor {
  private encoder = new TextEncoder()
  
  formatEvent(event: AGUIEvent): string {
    return `data: ${JSON.stringify(event)}\n\n`
  }
  
  createKeepAlive(): string {
    return `: keepalive\n\n`
  }
  
  createErrorEvent(error: string): AGUIEvent {
    return {
      type: 'ERROR',
      error,
      timestamp: Date.now()
    }
  }
  
  createMessageEvent(content: string, agentId?: string): AGUIEvent {
    return {
      type: 'AGENT_MESSAGE',
      content,
      agentId,
      timestamp: Date.now()
    }
  }
}

// Default agent configurations
export const DefaultAgents = {
  CHAT_ASSISTANT: {
    id: 'chat-assistant',
    name: 'Chat Assistant',
    description: 'General purpose conversational AI',
    capabilities: ['chat', 'analysis', 'reasoning'],
    model: 'gpt-4o-mini',
    systemPrompt: 'You are a helpful AI assistant. Respond concisely and accurately.',
    tools: [],
    config: {
      temperature: 0.7,
      maxTokens: 1000
    }
  },
  TASK_MANAGER: {
    id: 'task-manager',
    name: 'Task Manager',
    description: 'AI assistant specialized in task management',
    capabilities: ['task_creation', 'scheduling', 'prioritization'],
    model: 'gpt-4o-mini',
    systemPrompt: 'You are a task management specialist. Help users organize and prioritize their work.',
    tools: [],
    config: {
      temperature: 0.3,
      maxTokens: 800
    }
  },
  WORKFLOW_BUILDER: {
    id: 'workflow-builder',
    name: 'Workflow Builder',
    description: 'AI assistant for creating and optimizing workflows',
    capabilities: ['workflow_design', 'automation', 'optimization'],
    model: 'gpt-4o',
    systemPrompt: 'You are a workflow automation expert. Help users design efficient automated processes.',
    tools: [],
    config: {
      temperature: 0.4,
      maxTokens: 1200
    }
  }
} as const