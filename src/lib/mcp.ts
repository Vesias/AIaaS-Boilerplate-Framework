/**
 * Enhanced Model Context Protocol (MCP) Implementation
 * Advanced features, error handling, caching, and multi-transport support
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { createDatabaseService } from './database'
import { EventEmitter } from 'events'

// Enhanced types for MCP
export interface MCPServerConfig {
  name: string
  url: string
  transport: 'sse' | 'websocket' | 'stdio'
  authentication?: {
    type: 'bearer' | 'apikey' | 'oauth'
    token?: string
    config?: Record<string, any>
  }
  capabilities?: {
    tools?: boolean
    resources?: boolean
    prompts?: boolean
    roots?: boolean
    sampling?: boolean
  }
  retryConfig?: {
    maxRetries: number
    retryDelay: number
    backoffMultiplier: number
  }
  timeout?: number
  metadata?: Record<string, any>
}

export interface MCPToolDefinition {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, any>
    required?: string[]
  }
  outputSchema?: {
    type: 'object'
    properties: Record<string, any>
  }
  examples?: Array<{
    input: Record<string, any>
    output: any
    description?: string
  }>
  metadata?: Record<string, any>
}

export interface MCPResource {
  uri: string
  name: string
  description: string
  mimeType: string
  size?: number
  lastModified?: Date
  metadata?: Record<string, any>
}

export interface MCPPromptTemplate {
  name: string
  description: string
  arguments: Array<{
    name: string
    description: string
    required: boolean
    type: string
    default?: any
  }>
  template: string
  examples?: Array<{
    arguments: Record<string, any>
    expectedOutput: string
  }>
  metadata?: Record<string, any>
}

export interface MCPExecutionContext {
  serverId: string
  sessionId: string
  userId?: string
  timestamp: Date
  metadata?: Record<string, any>
}

export interface MCPToolResult {
  success: boolean
  content: Array<{
    type: 'text' | 'image' | 'resource'
    text?: string
    data?: any
    mimeType?: string
  }>
  error?: {
    code: string
    message: string
    details?: any
  }
  metadata?: Record<string, any>
  executionTime?: number
}

export interface MCPCacheEntry {
  key: string
  value: any
  timestamp: Date
  ttl: number
  metadata?: Record<string, any>
}

/**
 * Enhanced MCP Client with advanced features
 */
export class EnhancedMCPClient extends EventEmitter {
  private client: Client | null = null
  private transport: any = null
  private config: MCPServerConfig
  private db: Awaited<ReturnType<typeof createDatabaseService>>
  private cache: Map<string, MCPCacheEntry> = new Map()
  private connectionState: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected'
  private retryCount: number = 0
  private healthCheckInterval?: NodeJS.Timeout
  private sessionId: string

  constructor(config: MCPServerConfig, db: Awaited<ReturnType<typeof createDatabaseService>>) {
    super()
    this.config = config
    this.db = db
    this.sessionId = this.generateSessionId()

    // Set up retry configuration defaults
    this.config.retryConfig = {
      maxRetries: 3,
      retryDelay: 1000,
      backoffMultiplier: 2,
      ...this.config.retryConfig,
    }

    this.config.timeout = this.config.timeout || 30000
  }

  /**
   * Connect to MCP server with retry logic
   */
  async connect(): Promise<boolean> {
    if (this.connectionState === 'connected') {
      return true
    }

    this.connectionState = 'connecting'
    this.emit('connecting', { serverId: this.config.name })

    try {
      await this.establishConnection()
      this.connectionState = 'connected'
      this.retryCount = 0
      
      // Start health checking
      this.startHealthCheck()
      
      // Log connection
      await this.logConnection('connected')
      
      this.emit('connected', {
        serverId: this.config.name,
        sessionId: this.sessionId,
      })
      
      return true
    } catch (error: any) {
      this.connectionState = 'error'
      this.emit('error', {
        serverId: this.config.name,
        error: error.message,
        retryCount: this.retryCount,
      })

      // Retry logic
      if (this.retryCount < this.config.retryConfig!.maxRetries) {
        this.retryCount++
        const delay = this.config.retryConfig!.retryDelay * 
                     Math.pow(this.config.retryConfig!.backoffMultiplier, this.retryCount - 1)
        
        console.log(`Retrying connection to ${this.config.name} in ${delay}ms (attempt ${this.retryCount})`)
        
        setTimeout(() => {
          this.connect()
        }, delay)
      }

      return false
    }
  }

  /**
   * Establish connection based on transport type
   */
  private async establishConnection(): Promise<void> {
    // Close existing connection
    if (this.client) {
      await this.disconnect()
    }

    // Create transport based on configuration
    switch (this.config.transport) {
      case 'sse':
        this.transport = new SSEClientTransport({
          url: this.config.url,
          headers: this.buildHeaders(),
        })
        break
      
      default:
        throw new Error(`Transport type ${this.config.transport} not supported`)
    }

    // Create client
    this.client = new Client({
      name: `roomicor-enhanced-mcp-${this.config.name}`,
      version: '2.0.0',
    }, {
      capabilities: {
        roots: { listChanged: true },
        sampling: {},
        ...this.config.capabilities,
      },
    })

    // Connect with timeout
    const connectPromise = this.client.connect(this.transport)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Connection timeout')), this.config.timeout)
    })

    await Promise.race([connectPromise, timeoutPromise])
  }

  /**
   * Build headers for authentication
   */
  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'X-Session-ID': this.sessionId,
      'X-Client-Version': '2.0.0',
    }

    if (this.config.authentication) {
      switch (this.config.authentication.type) {
        case 'bearer':
          if (this.config.authentication.token) {
            headers['Authorization'] = `Bearer ${this.config.authentication.token}`
          }
          break
          
        case 'apikey':
          if (this.config.authentication.token) {
            headers['X-API-Key'] = this.config.authentication.token
          }
          break
      }
    }

    return headers
  }

  /**
   * Disconnect from server
   */
  async disconnect(): Promise<void> {
    this.stopHealthCheck()
    
    if (this.client) {
      try {
        await this.client.close()
      } catch (error) {
        console.warn('Error closing MCP client:', error)
      }
      this.client = null
    }

    if (this.transport) {
      try {
        await this.transport.close()
      } catch (error) {
        console.warn('Error closing MCP transport:', error)
      }
      this.transport = null
    }

    this.connectionState = 'disconnected'
    await this.logConnection('disconnected')
    this.emit('disconnected', { serverId: this.config.name })
  }

  /**
   * List available tools with caching
   */
  async listTools(useCache: boolean = true): Promise<MCPToolDefinition[]> {
    const cacheKey = `tools:${this.config.name}`
    
    if (useCache) {
      const cached = this.getFromCache(cacheKey)
      if (cached) {
        return cached
      }
    }

    this.ensureConnected()
    
    try {
      const response = await this.client!.request('tools/list', {})
      const tools = response.tools || []
      
      // Cache result
      this.setCache(cacheKey, tools, 300000) // 5 minutes
      
      return tools
    } catch (error: any) {
      throw new MCPError(`Failed to list tools: ${error.message}`, 'TOOLS_LIST_ERROR', error)
    }
  }

  /**
   * Call tool with enhanced error handling and caching
   */
  async callTool(
    name: string,
    arguments_: Record<string, any>,
    context?: MCPExecutionContext,
    useCache: boolean = false
  ): Promise<MCPToolResult> {
    const startTime = Date.now()
    
    // Generate cache key if caching enabled
    const cacheKey = useCache ? `tool:${name}:${JSON.stringify(arguments_)}` : null
    
    if (cacheKey && useCache) {
      const cached = this.getFromCache(cacheKey)
      if (cached) {
        return cached
      }
    }

    this.ensureConnected()
    
    try {
      // Validate tool exists
      const tools = await this.listTools()
      const toolDef = tools.find(t => t.name === name)
      if (!toolDef) {
        throw new MCPError(`Tool "${name}" not found`, 'TOOL_NOT_FOUND')
      }

      // Validate arguments
      this.validateToolArguments(toolDef, arguments_)

      // Execute tool
      const response = await this.client!.request('tools/call', {
        name,
        arguments: arguments_,
      })

      const result: MCPToolResult = {
        success: true,
        content: response.content || [],
        executionTime: Date.now() - startTime,
        metadata: {
          toolName: name,
          serverId: this.config.name,
          sessionId: this.sessionId,
          timestamp: new Date().toISOString(),
          ...context,
        },
      }

      // Cache if enabled
      if (cacheKey && useCache) {
        this.setCache(cacheKey, result, 60000) // 1 minute for tool results
      }

      // Log execution
      await this.logToolExecution(name, arguments_, result, context)

      this.emit('toolCalled', { name, arguments: arguments_, result, context })
      
      return result
    } catch (error: any) {
      const result: MCPToolResult = {
        success: false,
        content: [],
        error: {
          code: error.code || 'TOOL_EXECUTION_ERROR',
          message: error.message,
          details: error.details,
        },
        executionTime: Date.now() - startTime,
        metadata: {
          toolName: name,
          serverId: this.config.name,
          sessionId: this.sessionId,
          timestamp: new Date().toISOString(),
          ...context,
        },
      }

      await this.logToolExecution(name, arguments_, result, context)
      this.emit('toolError', { name, arguments: arguments_, error, context })
      
      return result
    }
  }

  /**
   * List resources with metadata
   */
  async listResources(useCache: boolean = true): Promise<MCPResource[]> {
    const cacheKey = `resources:${this.config.name}`
    
    if (useCache) {
      const cached = this.getFromCache(cacheKey)
      if (cached) {
        return cached
      }
    }

    this.ensureConnected()
    
    try {
      const response = await this.client!.request('resources/list', {})
      const resources = response.resources || []
      
      // Enhance with metadata
      const enhancedResources = resources.map((resource: any) => ({
        ...resource,
        lastModified: resource.lastModified ? new Date(resource.lastModified) : undefined,
      }))
      
      this.setCache(cacheKey, enhancedResources, 180000) // 3 minutes
      
      return enhancedResources
    } catch (error: any) {
      throw new MCPError(`Failed to list resources: ${error.message}`, 'RESOURCES_LIST_ERROR', error)
    }
  }

  /**
   * Read resource with caching
   */
  async readResource(uri: string, useCache: boolean = true): Promise<any> {
    const cacheKey = useCache ? `resource:${uri}` : null
    
    if (cacheKey && useCache) {
      const cached = this.getFromCache(cacheKey)
      if (cached) {
        return cached
      }
    }

    this.ensureConnected()
    
    try {
      const response = await this.client!.request('resources/read', { uri })
      const contents = response.contents || []
      
      if (cacheKey && useCache) {
        this.setCache(cacheKey, contents, 120000) // 2 minutes
      }
      
      return contents
    } catch (error: any) {
      throw new MCPError(`Failed to read resource "${uri}": ${error.message}`, 'RESOURCE_READ_ERROR', error)
    }
  }

  /**
   * Get prompt template
   */
  async getPrompt(
    name: string,
    arguments_: Record<string, any>,
    useCache: boolean = false
  ): Promise<any> {
    const cacheKey = useCache ? `prompt:${name}:${JSON.stringify(arguments_)}` : null
    
    if (cacheKey && useCache) {
      const cached = this.getFromCache(cacheKey)
      if (cached) {
        return cached
      }
    }

    this.ensureConnected()
    
    try {
      const response = await this.client!.request('prompts/get', {
        name,
        arguments: arguments_,
      })
      
      if (cacheKey && useCache) {
        this.setCache(cacheKey, response, 300000) // 5 minutes
      }
      
      return response
    } catch (error: any) {
      throw new MCPError(`Failed to get prompt "${name}": ${error.message}`, 'PROMPT_GET_ERROR', error)
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    if (this.connectionState !== 'connected') {
      return false
    }

    try {
      // Try to list tools as a health check
      await this.listTools(false)
      return true
    } catch (error) {
      this.emit('healthCheckFailed', {
        serverId: this.config.name,
        error: error instanceof Error ? error.message : String(error),
      })
      return false
    }
  }

  /**
   * Start periodic health checking
   */
  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      const isHealthy = await this.healthCheck()
      if (!isHealthy) {
        console.warn(`Health check failed for MCP server: ${this.config.name}`)
        // Attempt reconnection
        await this.connect()
      }
    }, 30000) // Check every 30 seconds
  }

  /**
   * Stop health checking
   */
  private stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = undefined
    }
  }

  /**
   * Validate tool arguments against schema
   */
  private validateToolArguments(toolDef: MCPToolDefinition, arguments_: Record<string, any>): void {
    const { inputSchema } = toolDef
    
    // Basic validation - in production, use a proper JSON schema validator
    if (inputSchema.required) {
      for (const required of inputSchema.required) {
        if (!(required in arguments_)) {
          throw new MCPError(
            `Missing required argument: ${required}`,
            'INVALID_ARGUMENTS',
            { toolName: toolDef.name, missing: required }
          )
        }
      }
    }
  }

  /**
   * Cache management
   */
  private setCache(key: string, value: any, ttl: number): void {
    this.cache.set(key, {
      key,
      value,
      timestamp: new Date(),
      ttl,
    })

    // Schedule cleanup
    setTimeout(() => {
      this.cache.delete(key)
    }, ttl)
  }

  private getFromCache(key: string): any {
    const entry = this.cache.get(key)
    if (!entry) {
      return null
    }

    const now = Date.now()
    const expired = now - entry.timestamp.getTime() > entry.ttl
    
    if (expired) {
      this.cache.delete(key)
      return null
    }

    return entry.value
  }

  /**
   * Clear cache
   */
  clearCache(pattern?: string): void {
    if (pattern) {
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key)
        }
      }
    } else {
      this.cache.clear()
    }
  }

  /**
   * Logging
   */
  private async logConnection(status: 'connected' | 'disconnected'): Promise<void> {
    try {
      // In a real implementation, this would log to your database
      console.log(`MCP ${status}: ${this.config.name} at ${new Date().toISOString()}`)
    } catch (error) {
      console.warn('Failed to log connection:', error)
    }
  }

  private async logToolExecution(
    toolName: string,
    arguments_: Record<string, any>,
    result: MCPToolResult,
    context?: MCPExecutionContext
  ): Promise<void> {
    try {
      // In a real implementation, this would log to your database
      console.log(`Tool executed: ${toolName} - ${result.success ? 'SUCCESS' : 'FAILED'}`)
    } catch (error) {
      console.warn('Failed to log tool execution:', error)
    }
  }

  /**
   * Utility methods
   */
  private ensureConnected(): void {
    if (this.connectionState !== 'connected' || !this.client) {
      throw new MCPError('MCP client is not connected', 'NOT_CONNECTED')
    }
  }

  private generateSessionId(): string {
    return `mcp_session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  /**
   * Get connection info
   */
  getConnectionInfo(): {
    serverId: string
    sessionId: string
    state: string
    retryCount: number
    config: MCPServerConfig
  } {
    return {
      serverId: this.config.name,
      sessionId: this.sessionId,
      state: this.connectionState,
      retryCount: this.retryCount,
      config: this.config,
    }
  }

  /**
   * Get cache stats
   */
  getCacheStats(): {
    size: number
    keys: string[]
    memoryUsage: number
  } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      memoryUsage: JSON.stringify(Array.from(this.cache.values())).length,
    }
  }
}

/**
 * MCP Server Manager
 * Manages multiple MCP server connections
 */
export class MCPServerManager extends EventEmitter {
  private servers: Map<string, EnhancedMCPClient> = new Map()
  private db: Awaited<ReturnType<typeof createDatabaseService>>

  constructor(db: Awaited<ReturnType<typeof createDatabaseService>>) {
    super()
    this.db = db
  }

  /**
   * Add MCP server
   */
  async addServer(config: MCPServerConfig): Promise<EnhancedMCPClient> {
    if (this.servers.has(config.name)) {
      throw new Error(`Server ${config.name} already exists`)
    }

    const client = new EnhancedMCPClient(config, this.db)
    
    // Forward events
    client.on('connected', (data) => this.emit('serverConnected', data))
    client.on('disconnected', (data) => this.emit('serverDisconnected', data))
    client.on('error', (data) => this.emit('serverError', data))
    client.on('toolCalled', (data) => this.emit('toolCalled', data))
    client.on('toolError', (data) => this.emit('toolError', data))

    this.servers.set(config.name, client)
    
    // Auto-connect
    await client.connect()
    
    return client
  }

  /**
   * Remove server
   */
  async removeServer(serverId: string): Promise<void> {
    const client = this.servers.get(serverId)
    if (client) {
      await client.disconnect()
      this.servers.delete(serverId)
    }
  }

  /**
   * Get server client
   */
  getServer(serverId: string): EnhancedMCPClient | undefined {
    return this.servers.get(serverId)
  }

  /**
   * List all servers
   */
  listServers(): Array<{
    serverId: string
    state: string
    config: MCPServerConfig
  }> {
    return Array.from(this.servers.entries()).map(([id, client]) => ({
      serverId: id,
      state: client.getConnectionInfo().state,
      config: client.getConnectionInfo().config,
    }))
  }

  /**
   * Call tool on any server
   */
  async callTool(
    serverId: string,
    toolName: string,
    arguments_: Record<string, any>,
    context?: MCPExecutionContext
  ): Promise<MCPToolResult> {
    const client = this.servers.get(serverId)
    if (!client) {
      throw new MCPError(`Server ${serverId} not found`, 'SERVER_NOT_FOUND')
    }

    return client.callTool(toolName, arguments_, context)
  }

  /**
   * Broadcast tool call to all connected servers
   */
  async broadcastToolCall(
    toolName: string,
    arguments_: Record<string, any>,
    context?: MCPExecutionContext
  ): Promise<Map<string, MCPToolResult>> {
    const results = new Map<string, MCPToolResult>()
    
    const promises = Array.from(this.servers.entries()).map(async ([serverId, client]) => {
      try {
        const result = await client.callTool(toolName, arguments_, context)
        results.set(serverId, result)
      } catch (error) {
        results.set(serverId, {
          success: false,
          content: [],
          error: {
            code: 'BROADCAST_ERROR',
            message: error instanceof Error ? error.message : String(error),
          },
        })
      }
    })

    await Promise.allSettled(promises)
    return results
  }

  /**
   * Cleanup all servers
   */
  async cleanup(): Promise<void> {
    const promises = Array.from(this.servers.values()).map(client => 
      client.disconnect().catch(console.warn)
    )
    
    await Promise.allSettled(promises)
    this.servers.clear()
  }
}

/**
 * Enhanced MCP Error class
 */
export class MCPError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any,
    public serverId?: string
  ) {
    super(message)
    this.name = 'MCPError'
  }
}

/**
 * Factory functions
 */
export async function createEnhancedMCPClient(config: MCPServerConfig): Promise<EnhancedMCPClient> {
  const db = await createDatabaseService()
  return new EnhancedMCPClient(config, db)
}

export async function createMCPServerManager(): Promise<MCPServerManager> {
  const db = await createDatabaseService()
  return new MCPServerManager(db)
}

/**
 * Utility functions
 */
export const MCPUtils = {
  /**
   * Create default server config
   */
  createServerConfig: (
    name: string,
    url: string,
    transport: 'sse' | 'websocket' | 'stdio' = 'sse'
  ): MCPServerConfig => ({
    name,
    url,
    transport,
    capabilities: {
      tools: true,
      resources: true,
      prompts: true,
      roots: true,
      sampling: false,
    },
    retryConfig: {
      maxRetries: 3,
      retryDelay: 1000,
      backoffMultiplier: 2,
    },
    timeout: 30000,
  }),

  /**
   * Validate server config
   */
  validateServerConfig: (config: MCPServerConfig): string[] => {
    const errors: string[] = []
    
    if (!config.name) errors.push('Server name is required')
    if (!config.url) errors.push('Server URL is required')
    if (!['sse', 'websocket', 'stdio'].includes(config.transport)) {
      errors.push('Invalid transport type')
    }
    
    return errors
  },
}

// Export types
export type {
  MCPServerConfig,
  MCPToolDefinition,
  MCPResource,
  MCPPromptTemplate,
  MCPExecutionContext,
  MCPToolResult,
  MCPCacheEntry,
}