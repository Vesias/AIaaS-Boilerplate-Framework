// Model Context Protocol (MCP) Types

// Core MCP Protocol Types
export interface MCPMessage {
  jsonrpc: '2.0'
  id?: string | number
  method?: string
  params?: any
  result?: any
  error?: MCPError
}

export interface MCPError {
  code: number
  message: string
  data?: any
}

export interface MCPCapabilities {
  tools?: Record<string, any>
  resources?: Record<string, any>
  prompts?: Record<string, any>
  roots?: {
    listChanged?: boolean
  }
  sampling?: Record<string, any>
}

export interface MCPServerInfo {
  name: string
  version: string
  protocolVersion?: string
}

// Tool-related types
export interface MCPTool {
  name: string
  description: string
  inputSchema: MCPToolInputSchema
}

export interface MCPToolInputSchema {
  type: 'object'
  properties: Record<string, MCPToolProperty>
  required?: string[]
  additionalProperties?: boolean
}

export interface MCPToolProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  description?: string
  enum?: string[]
  minimum?: number
  maximum?: number
  items?: MCPToolProperty
  properties?: Record<string, MCPToolProperty>
}

export interface MCPToolCallRequest {
  name: string
  arguments: Record<string, any>
}

export interface MCPToolCallResult {
  content: MCPContent[]
  isError?: boolean
}

export interface MCPContent {
  type: 'text' | 'image' | 'resource'
  text?: string
  data?: string
  mimeType?: string
}

// Resource-related types
export interface MCPResource {
  uri: string
  name: string
  description?: string
  mimeType?: string
}

export interface MCPResourceContents {
  contents: MCPResourceContent[]
}

export interface MCPResourceContent {
  uri: string
  mimeType?: string
  text?: string
  blob?: string
}

export interface MCPResourceTemplate {
  uriTemplate: string
  name: string
  description?: string
  mimeType?: string
}

// Prompt-related types
export interface MCPPrompt {
  name: string
  description?: string
  arguments?: MCPPromptArgument[]
}

export interface MCPPromptArgument {
  name: string
  description?: string
  required?: boolean
}

export interface MCPPromptMessage {
  role: 'user' | 'assistant' | 'system'
  content: MCPContent
}

export interface MCPGetPromptResult {
  description?: string
  messages: MCPPromptMessage[]
}

// Sampling-related types
export interface MCPSamplingMessage {
  role: 'user' | 'assistant'
  content: MCPContent
}

export interface MCPCreateMessageRequest {
  messages: MCPSamplingMessage[]
  modelPreferences?: MCPModelPreferences
  systemPrompt?: string
  includeContext?: 'none' | 'thisServer' | 'allServers'
  temperature?: number
  maxTokens?: number
  stopSequences?: string[]
  metadata?: Record<string, any>
}

export interface MCPModelPreferences {
  hints?: MCPModelHint[]
  costPriority?: number
  speedPriority?: number
  intelligencePriority?: number
}

export interface MCPModelHint {
  name?: string
}

// Pagination types
export interface MCPPaginatedRequest {
  cursor?: string
}

export interface MCPPaginatedResult<T> {
  data: T[]
  nextCursor?: string
}

// Root-related types
export interface MCPRoot {
  uri: string
  name?: string
}

// Progress types
export interface MCPProgress {
  progress?: number
  total?: number
}

export interface MCPProgressNotification {
  progressToken: string | number
  progress: number
  total?: number
}

// Logging types
export type MCPLogLevel = 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency'

export interface MCPLogMessage {
  level: MCPLogLevel
  data?: any
  logger?: string
}

// Transport types
export interface MCPTransportOptions {
  url?: string
  headers?: Record<string, string>
  timeout?: number
}

export interface MCPSSETransportOptions extends MCPTransportOptions {
  withCredentials?: boolean
  retryInterval?: number
  maxRetries?: number
}

export interface MCPStdioTransportOptions {
  command: string
  args?: string[]
  env?: Record<string, string>
  cwd?: string
}

// Client types
export interface MCPClientOptions {
  name: string
  version: string
  capabilities?: MCPCapabilities
}

export interface MCPClientConfig {
  serverUrl: string
  authToken?: string
  timeout?: number
  retryInterval?: number
  maxRetries?: number
}

// Server types
export interface MCPServerOptions {
  name: string
  version: string
  capabilities?: MCPCapabilities
}

export interface MCPRequestHandler<T = any, R = any> {
  (request: MCPRequest<T>): Promise<R>
}

export interface MCPRequest<T = any> {
  method: string
  params: T
}

// Utility types
export type MCPRequestMethod = 
  | 'initialize'
  | 'tools/list'
  | 'tools/call'
  | 'resources/list'
  | 'resources/read'
  | 'resources/templates/list'
  | 'prompts/list'
  | 'prompts/get'
  | 'completion/complete'
  | 'roots/list'
  | 'sampling/createMessage'
  | 'logging/setLevel'
  | 'ping'

export type MCPNotificationMethod =
  | 'notifications/initialized'
  | 'notifications/progress'
  | 'notifications/message'
  | 'notifications/resources/updated'
  | 'notifications/tools/updated'
  | 'notifications/prompts/updated'
  | 'notifications/roots/updated'

// Error codes
export const MCP_ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  SERVER_ERROR_START: -32099,
  SERVER_ERROR_END: -32000,
} as const

export type MCPErrorCode = typeof MCP_ERROR_CODES[keyof typeof MCP_ERROR_CODES]

// Custom error class
export class MCPProtocolError extends Error {
  constructor(
    public code: MCPErrorCode,
    message: string,
    public data?: any
  ) {
    super(message)
    this.name = 'MCPProtocolError'
  }

  toJSON(): MCPError {
    return {
      code: this.code,
      message: this.message,
      data: this.data,
    }
  }
}

// Request/Response type mappings
export interface MCPRequestResponseMap {
  'initialize': {
    request: {
      protocolVersion: string
      capabilities: MCPCapabilities
      clientInfo: MCPServerInfo
    }
    response: {
      protocolVersion: string
      capabilities: MCPCapabilities
      serverInfo: MCPServerInfo
    }
  }
  'tools/list': {
    request: MCPPaginatedRequest
    response: MCPPaginatedResult<MCPTool>
  }
  'tools/call': {
    request: MCPToolCallRequest
    response: MCPToolCallResult
  }
  'resources/list': {
    request: MCPPaginatedRequest
    response: MCPPaginatedResult<MCPResource>
  }
  'resources/read': {
    request: { uri: string }
    response: MCPResourceContents
  }
  'resources/templates/list': {
    request: MCPPaginatedRequest
    response: MCPPaginatedResult<MCPResourceTemplate>
  }
  'prompts/list': {
    request: MCPPaginatedRequest
    response: MCPPaginatedResult<MCPPrompt>
  }
  'prompts/get': {
    request: {
      name: string
      arguments?: Record<string, string>
    }
    response: MCPGetPromptResult
  }
  'roots/list': {
    request: Record<string, never>
    response: {
      roots: MCPRoot[]
    }
  }
  'sampling/createMessage': {
    request: MCPCreateMessageRequest
    response: {
      role: 'assistant'
      content: MCPContent
      model: string
      stopReason?: 'endTurn' | 'stopSequence' | 'maxTokens'
    }
  }
}

// Utility type to get request type for a method
export type MCPRequestType<T extends keyof MCPRequestResponseMap> = 
  MCPRequestResponseMap[T]['request']

// Utility type to get response type for a method
export type MCPResponseType<T extends keyof MCPRequestResponseMap> = 
  MCPRequestResponseMap[T]['response']

// Event types for client/server
export interface MCPEventMap {
  'connect': []
  'disconnect': []
  'error': [MCPProtocolError]
  'notification': [string, any]
  'progress': [MCPProgressNotification]
  'resource_updated': [string]
  'tool_updated': [string]
  'prompt_updated': [string]
  'root_updated': [string]
}

export type MCPEventName = keyof MCPEventMap
export type MCPEventArgs<T extends MCPEventName> = MCPEventMap[T]