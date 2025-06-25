// AG-UI Protocol Types and Interfaces

// Re-export core types from the AG-UI client
export type { AgentEvent } from '@ag-ui/client'
export { EventTypes } from '@ag-ui/client'

// Transport types
export type AgentTransport = 'sse' | 'websocket' | 'webhook'

export interface AgentTransportOptions {
  url: string
  headers?: Record<string, string>
  timeout?: number
  retryInterval?: number
  maxRetries?: number
  withCredentials?: boolean
}

// Agent client configuration
export interface AgentClientOptions extends AgentTransportOptions {
  transport: AgentTransport
  autoReconnect?: boolean
  heartbeatInterval?: number
  debug?: boolean
}

// Event payload types for each event type
export interface UserMessagePayload {
  message: string
  sessionId?: string
  metadata?: Record<string, any>
  timestamp?: string
}

export interface AgentMessagePayload {
  message: string
  sessionId?: string
  metadata?: Record<string, any>
  timestamp?: string
  reasoning?: string
  confidence?: number
}

export interface ToolCallPayload {
  id?: string
  tool: string
  name?: string
  params?: any
  arguments?: any
  status?: 'pending' | 'running' | 'completed' | 'failed'
  sessionId?: string
  timestamp?: string
}

export interface ToolResultPayload {
  id?: string
  tool: string
  result?: any
  error?: string
  status?: 'completed' | 'failed'
  sessionId?: string
  timestamp?: string
  duration?: number
}

export interface ToolRequestPayload {
  id?: string
  tool: string
  params: any
  sessionId?: string
  priority?: 'low' | 'normal' | 'high'
  timeout?: number
}

export interface CompletionRequestPayload {
  prompt: string
  sessionId?: string
  options?: CompletionOptions
  model?: string
  temperature?: number
  maxTokens?: number
  stopSequences?: string[]
}

export interface CompletionResponsePayload {
  completion: string
  sessionId?: string
  model?: string
  usage?: TokenUsage
  finishReason?: 'stop' | 'length' | 'content_filter'
}

export interface ErrorPayload {
  error: string
  message?: string
  code?: string | number
  details?: any
  sessionId?: string
  timestamp?: string
  severity?: 'low' | 'medium' | 'high' | 'critical'
}

export interface ProcessingStartPayload {
  sessionId?: string
  operation?: string
  estimatedDuration?: number
  timestamp?: string
}

export interface ProcessingEndPayload {
  sessionId?: string
  operation?: string
  duration?: number
  success?: boolean
  timestamp?: string
}

export interface ConnectedPayload {
  agentId?: string
  sessionId?: string
  capabilities?: string[]
  timestamp?: string
  version?: string
}

export interface DisconnectedPayload {
  agentId?: string
  sessionId?: string
  reason?: string
  timestamp?: string
  reconnect?: boolean
}

export interface SessionStartPayload {
  sessionId: string
  agentId?: string
  userId?: string
  timestamp?: string
  context?: Record<string, any>
}

export interface SessionEndPayload {
  sessionId: string
  duration?: number
  messageCount?: number
  toolCallCount?: number
  timestamp?: string
  reason?: string
}

export interface HealthCheckPayload {
  timestamp?: string
  requestId?: string
}

export interface HeartbeatPayload {
  agentId?: string
  status?: 'healthy' | 'degraded' | 'unhealthy'
  timestamp?: string
  uptime?: number
  load?: number
  memory?: number
  activeConnections?: number
}

// Structured event types with proper payloads
export interface TypedAgentEvent<T = any> {
  type: string
  payload: T
  sessionId?: string
  timestamp?: string
  id?: string
}

// Event type mappings
export interface AgentEventMap {
  [EventTypes.USER_MESSAGE]: TypedAgentEvent<UserMessagePayload>
  [EventTypes.AGENT_MESSAGE]: TypedAgentEvent<AgentMessagePayload>
  [EventTypes.TOOL_CALL]: TypedAgentEvent<ToolCallPayload>
  [EventTypes.TOOL_RESULT]: TypedAgentEvent<ToolResultPayload>
  [EventTypes.TOOL_REQUEST]: TypedAgentEvent<ToolRequestPayload>
  [EventTypes.COMPLETION_REQUEST]: TypedAgentEvent<CompletionRequestPayload>
  [EventTypes.COMPLETION_RESPONSE]: TypedAgentEvent<CompletionResponsePayload>
  [EventTypes.ERROR]: TypedAgentEvent<ErrorPayload>
  [EventTypes.PROCESSING_START]: TypedAgentEvent<ProcessingStartPayload>
  [EventTypes.PROCESSING_END]: TypedAgentEvent<ProcessingEndPayload>
  [EventTypes.CONNECTED]: TypedAgentEvent<ConnectedPayload>
  [EventTypes.DISCONNECTED]: TypedAgentEvent<DisconnectedPayload>
  [EventTypes.SESSION_START]: TypedAgentEvent<SessionStartPayload>
  [EventTypes.SESSION_END]: TypedAgentEvent<SessionEndPayload>
  [EventTypes.HEALTH_CHECK]: TypedAgentEvent<HealthCheckPayload>
  [EventTypes.HEARTBEAT]: TypedAgentEvent<HeartbeatPayload>
}

// Message and conversation types
export interface AgentMessage {
  id: string
  type: 'user' | 'agent' | 'system' | 'tool'
  content: string
  timestamp: Date
  sessionId?: string
  metadata?: Record<string, any>
  reasoning?: string
  confidence?: number
  toolCalls?: ToolCall[]
}

export interface ToolCall {
  id: string
  name: string
  params: any
  status: 'pending' | 'running' | 'completed' | 'failed'
  result?: any
  error?: string
  timestamp: Date
  duration?: number
}

export interface AgentSession {
  id: string
  agentId?: string
  userId?: string
  startTime: Date
  endTime?: Date
  messages: AgentMessage[]
  toolCalls: ToolCall[]
  context: Record<string, any>
  status: 'active' | 'ended' | 'error'
}

// Completion and generation types
export interface CompletionOptions {
  model?: string
  temperature?: number
  maxTokens?: number
  topP?: number
  frequencyPenalty?: number
  presencePenalty?: number
  stopSequences?: string[]
  stream?: boolean
}

export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

// Tool definition types
export interface ToolDefinition {
  name: string
  description: string
  parameters: ToolParameterSchema
  required?: string[]
  examples?: ToolExample[]
}

export interface ToolParameterSchema {
  type: 'object'
  properties: Record<string, ToolParameter>
  required?: string[]
  additionalProperties?: boolean
}

export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  description?: string
  enum?: any[]
  default?: any
  minimum?: number
  maximum?: number
  minLength?: number
  maxLength?: number
  pattern?: string
  items?: ToolParameter
  properties?: Record<string, ToolParameter>
}

export interface ToolExample {
  description: string
  parameters: any
  result: any
}

// Agent capabilities and metadata
export interface AgentCapabilities {
  tools?: string[]
  models?: string[]
  languages?: string[]
  maxTokens?: number
  supportsStreaming?: boolean
  supportsFiles?: boolean
  supportsImages?: boolean
  customCapabilities?: Record<string, any>
}

export interface AgentMetadata {
  id: string
  name: string
  description?: string
  version: string
  capabilities: AgentCapabilities
  author?: string
  tags?: string[]
  homepage?: string
  repository?: string
  license?: string
}

// Connection and status types
export interface AgentConnectionState {
  status: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error'
  lastConnected?: Date
  lastDisconnected?: Date
  connectionAttempts: number
  error?: string
  latency?: number
}

export interface AgentHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  uptime: number
  memory: {
    used: number
    total: number
    percentage: number
  }
  load: {
    avg1min: number
    avg5min: number
    avg15min: number
  }
  connections: {
    active: number
    total: number
  }
  errors: {
    recent: number
    total: number
  }
  lastCheck: Date
}

// Error types
export class AgentError extends Error {
  constructor(
    message: string,
    public code?: string | number,
    public details?: any,
    public sessionId?: string
  ) {
    super(message)
    this.name = 'AgentError'
  }
}

export class AgentConnectionError extends AgentError {
  constructor(message: string, details?: any) {
    super(message, 'CONNECTION_ERROR', details)
    this.name = 'AgentConnectionError'
  }
}

export class AgentTimeoutError extends AgentError {
  constructor(message: string, timeout: number) {
    super(message, 'TIMEOUT_ERROR', { timeout })
    this.name = 'AgentTimeoutError'
  }
}

export class AgentToolError extends AgentError {
  constructor(message: string, toolName: string, details?: any) {
    super(message, 'TOOL_ERROR', { toolName, ...details })
    this.name = 'AgentToolError'
  }
}

// Event listener types
export type AgentEventListener<T = any> = (event: TypedAgentEvent<T>) => void | Promise<void>

export interface AgentEventListeners {
  [EventTypes.USER_MESSAGE]?: AgentEventListener<UserMessagePayload>
  [EventTypes.AGENT_MESSAGE]?: AgentEventListener<AgentMessagePayload>
  [EventTypes.TOOL_CALL]?: AgentEventListener<ToolCallPayload>
  [EventTypes.TOOL_RESULT]?: AgentEventListener<ToolResultPayload>
  [EventTypes.TOOL_REQUEST]?: AgentEventListener<ToolRequestPayload>
  [EventTypes.COMPLETION_REQUEST]?: AgentEventListener<CompletionRequestPayload>
  [EventTypes.COMPLETION_RESPONSE]?: AgentEventListener<CompletionResponsePayload>
  [EventTypes.ERROR]?: AgentEventListener<ErrorPayload>
  [EventTypes.PROCESSING_START]?: AgentEventListener<ProcessingStartPayload>
  [EventTypes.PROCESSING_END]?: AgentEventListener<ProcessingEndPayload>
  [EventTypes.CONNECTED]?: AgentEventListener<ConnectedPayload>
  [EventTypes.DISCONNECTED]?: AgentEventListener<DisconnectedPayload>
  [EventTypes.SESSION_START]?: AgentEventListener<SessionStartPayload>
  [EventTypes.SESSION_END]?: AgentEventListener<SessionEndPayload>
  [EventTypes.HEALTH_CHECK]?: AgentEventListener<HealthCheckPayload>
  [EventTypes.HEARTBEAT]?: AgentEventListener<HeartbeatPayload>
  // Generic fallback for unknown events
  [key: string]: AgentEventListener<any>
}

// Utility types
export type AgentEventType = keyof AgentEventMap
export type AgentEventPayload<T extends AgentEventType> = AgentEventMap[T]['payload']

// Hook and component prop types
export interface UseAgentOptions {
  url?: string
  transport?: AgentTransport
  apiKey?: string
  autoConnect?: boolean
  autoReconnect?: boolean
  persistMessages?: boolean
  heartbeatInterval?: number
  timeout?: number
  retryInterval?: number
  maxRetries?: number
  debug?: boolean
  onEvent?: (event: TypedAgentEvent) => void
  onMessage?: (message: AgentMessage) => void
  onToolCall?: (toolCall: ToolCall) => void
  onError?: (error: AgentError) => void
  onConnect?: () => void
  onDisconnect?: () => void
}

export interface AgentChatProps {
  url?: string
  transport?: AgentTransport
  apiKey?: string
  className?: string
  showHeader?: boolean
  showStatus?: boolean
  showToolCalls?: boolean
  placeholder?: string
  maxHeight?: string
  disabled?: boolean
  autoFocus?: boolean
  onMessage?: (message: AgentMessage) => void
  onError?: (error: AgentError) => void
}

// Configuration and setup types
export interface AgentConfig {
  name: string
  version: string
  url: string
  transport: AgentTransport
  apiKey?: string
  capabilities?: AgentCapabilities
  metadata?: Partial<AgentMetadata>
  options?: Partial<AgentClientOptions>
}

export interface AgentRegistry {
  [agentId: string]: AgentConfig
}

// Webhook and API types
export interface WebhookEvent {
  id: string
  type: string
  payload: any
  timestamp: string
  source: string
  signature?: string
}

export interface WebhookResponse {
  success: boolean
  eventType: string
  result?: any
  error?: string
  timestamp: string
}

// Analytics and metrics types
export interface AgentMetrics {
  sessionCount: number
  messageCount: number
  toolCallCount: number
  errorCount: number
  averageResponseTime: number
  uptime: number
  lastActivity: Date
}

export interface AgentUsageStats {
  daily: AgentMetrics
  weekly: AgentMetrics
  monthly: AgentMetrics
  total: AgentMetrics
}

// Export commonly used type guards
export function isAgentMessage(message: any): message is AgentMessage {
  return (
    message &&
    typeof message.id === 'string' &&
    typeof message.content === 'string' &&
    ['user', 'agent', 'system', 'tool'].includes(message.type) &&
    message.timestamp instanceof Date
  )
}

export function isToolCall(toolCall: any): toolCall is ToolCall {
  return (
    toolCall &&
    typeof toolCall.id === 'string' &&
    typeof toolCall.name === 'string' &&
    ['pending', 'running', 'completed', 'failed'].includes(toolCall.status) &&
    toolCall.timestamp instanceof Date
  )
}

export function isAgentError(error: any): error is AgentError {
  return error instanceof AgentError
}