'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useUser } from '@clerk/nextjs'
import { toast } from 'sonner'

// Types for Model Context Protocol
export interface MCPServer {
  id: string
  name: string
  description: string
  uri: string
  status: 'connected' | 'connecting' | 'disconnected' | 'error'
  capabilities: string[]
  tools: MCPTool[]
  resources: MCPResource[]
  lastActivity?: Date
  error?: string
}

export interface MCPTool {
  name: string
  description: string
  inputSchema: any
  outputSchema?: any
  category?: string
  examples?: any[]
}

export interface MCPResource {
  uri: string
  name: string
  description?: string
  mimeType?: string
  text?: string
  blob?: ArrayBuffer
}

export interface MCPMessage {
  id: string
  type: 'request' | 'response' | 'notification' | 'error'
  method?: string
  params?: any
  result?: any
  error?: {
    code: number
    message: string
    data?: any
  }
  timestamp: Date
}

export interface MCPSessionInfo {
  protocolVersion: string
  serverInfo: {
    name: string
    version: string
  }
  capabilities: {
    tools?: { listChanged?: boolean }
    resources?: { subscribe?: boolean; listChanged?: boolean }
    prompts?: { listChanged?: boolean }
    logging?: {}
  }
}

export interface UseMCPOptions {
  // Server configuration
  servers?: Array<{
    id: string
    name: string
    uri: string
    transport: 'stdio' | 'sse' | 'websocket'
    autoConnect?: boolean
  }>
  
  // Connection options
  timeout?: number
  retryAttempts?: number
  retryDelay?: number
  
  // Features
  enableAutoReconnect?: boolean
  enableResourceCaching?: boolean
  enableToolValidation?: boolean
  
  // Callbacks
  onServerConnected?: (server: MCPServer) => void
  onServerDisconnected?: (serverId: string) => void
  onServerError?: (serverId: string, error: any) => void
  onToolCall?: (serverId: string, tool: string, params: any, result: any) => void
  onResourceUpdate?: (serverId: string, resource: MCPResource) => void
  onMessage?: (serverId: string, message: MCPMessage) => void
}

export interface UseMCPReturn {
  // Server management
  servers: MCPServer[]
  connectedServers: MCPServer[]
  
  // Connection control
  connectServer: (serverId: string) => Promise<void>
  disconnectServer: (serverId: string) => Promise<void>
  reconnectServer: (serverId: string) => Promise<void>
  connectAllServers: () => Promise<void>
  disconnectAllServers: () => Promise<void>
  
  // Tool operations
  listTools: (serverId?: string) => MCPTool[]
  callTool: (serverId: string, toolName: string, params: any) => Promise<any>
  validateToolCall: (serverId: string, toolName: string, params: any) => Promise<boolean>
  
  // Resource operations
  listResources: (serverId?: string) => MCPResource[]
  getResource: (serverId: string, uri: string) => Promise<MCPResource | null>
  subscribeToResource: (serverId: string, uri: string) => Promise<void>
  unsubscribeFromResource: (serverId: string, uri: string) => Promise<void>
  
  // Session management
  getSessionInfo: (serverId: string) => MCPSessionInfo | null
  sendMessage: (serverId: string, message: Omit<MCPMessage, 'id' | 'timestamp'>) => Promise<any>
  
  // State
  isConnecting: boolean
  errors: Record<string, string>
  messages: MCPMessage[]
  
  // Utilities
  findToolsByCategory: (category: string) => Array<{ serverId: string; tool: MCPTool }>
  getServerByTool: (toolName: string) => MCPServer | null
  clearErrors: () => void
  exportState: () => any
}

/**
 * Model Context Protocol Hook
 * Manages connections to MCP servers and provides tool/resource access
 */
export function useMCP(options: UseMCPOptions = {}): UseMCPReturn {
  const {
    servers: initialServers = [],
    timeout = 30000,
    retryAttempts = 3,
    retryDelay = 1000,
    enableAutoReconnect = true,
    enableResourceCaching = true,
    enableToolValidation = true,
    onServerConnected,
    onServerDisconnected,
    onServerError,
    onToolCall,
    onResourceUpdate,
    onMessage,
  } = options

  // Clerk user context
  const { user } = useUser()
  
  // State
  const [servers, setServers] = useState<MCPServer[]>([])
  const [isConnecting, setIsConnecting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [messages, setMessages] = useState<MCPMessage[]>([])
  const [sessionInfo, setSessionInfo] = useState<Record<string, MCPSessionInfo>>({})
  const [resourceCache, setResourceCache] = useState<Record<string, MCPResource>>({})
  
  // Refs
  const connectionsRef = useRef<Record<string, WebSocket | EventSource>>({})
  const reconnectTimeoutsRef = useRef<Record<string, NodeJS.Timeout>>({})

  // Initialize servers
  useEffect(() => {
    const defaultServers: MCPServer[] = [
      {
        id: 'filesystem',
        name: 'File System',
        description: 'Access to local file system operations',
        uri: '/api/mcp/stdio',
        status: 'disconnected',
        capabilities: ['tools', 'resources'],
        tools: [],
        resources: [],
      },
      {
        id: 'database',
        name: 'Database',
        description: 'Database operations and queries',
        uri: '/api/mcp/database',
        status: 'disconnected',
        capabilities: ['tools'],
        tools: [],
        resources: [],
      },
      {
        id: 'web',
        name: 'Web Browser',
        description: 'Web scraping and browser automation',
        uri: '/api/mcp/web',
        status: 'disconnected',
        capabilities: ['tools', 'resources'],
        tools: [],
        resources: [],
      },
    ]

    const configuredServers = initialServers.map(config => ({
      id: config.id,
      name: config.name,
      description: '',
      uri: config.uri,
      status: 'disconnected' as const,
      capabilities: [],
      tools: [],
      resources: [],
    }))

    setServers([...defaultServers, ...configuredServers])
  }, [initialServers])

  // Connect to a specific server
  const connectServer = useCallback(async (serverId: string): Promise<void> => {
    const server = servers.find(s => s.id === serverId)
    if (!server) {
      throw new Error(`Server ${serverId} not found`)
    }

    if (server.status === 'connected' || server.status === 'connecting') {
      return
    }

    setServers(prev => prev.map(s => 
      s.id === serverId ? { ...s, status: 'connecting', error: undefined } : s
    ))

    setErrors(prev => {
      const updated = { ...prev }
      delete updated[serverId]
      return updated
    })

    try {
      // Initialize connection based on transport type
      let connection: WebSocket | EventSource

      if (server.uri.startsWith('ws://') || server.uri.startsWith('wss://')) {
        // WebSocket connection
        connection = new WebSocket(server.uri)
        
        connection.onopen = () => {
          handleServerConnected(serverId)
        }
        
        connection.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data)
            handleMessage(serverId, message)
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error)
          }
        }
        
        connection.onerror = (error) => {
          handleServerError(serverId, error)
        }
        
        connection.onclose = () => {
          handleServerDisconnected(serverId)
        }
        
      } else {
        // Server-Sent Events connection
        connection = new EventSource(server.uri)
        
        connection.onopen = () => {
          handleServerConnected(serverId)
        }
        
        connection.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data)
            handleMessage(serverId, message)
          } catch (error) {
            console.error('Failed to parse SSE message:', error)
          }
        }
        
        connection.onerror = (error) => {
          handleServerError(serverId, error)
        }
      }

      connectionsRef.current[serverId] = connection

      // Set connection timeout
      const timeoutId = setTimeout(() => {
        handleServerError(serverId, new Error('Connection timeout'))
      }, timeout)

      // Clear timeout on successful connection
      const originalOnOpen = connection.onopen
      connection.onopen = (event) => {
        clearTimeout(timeoutId)
        originalOnOpen?.(event)
      }

    } catch (error: any) {
      handleServerError(serverId, error)
    }
  }, [servers, timeout])

  // Handle server connected
  const handleServerConnected = useCallback(async (serverId: string) => {
    try {
      // Initialize MCP session
      const initMessage = {
        jsonrpc: '2.0',
        id: `init-${Date.now()}`,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
            resources: {},
          },
          clientInfo: {
            name: 'Roomicor',
            version: '1.0.0',
          },
        },
      }

      const response = await sendMessage(serverId, initMessage)
      
      if (response?.result) {
        setSessionInfo(prev => ({
          ...prev,
          [serverId]: response.result,
        }))

        // Load tools and resources
        await Promise.all([
          loadServerTools(serverId),
          loadServerResources(serverId),
        ])

        setServers(prev => prev.map(s => 
          s.id === serverId ? { 
            ...s, 
            status: 'connected',
            lastActivity: new Date(),
            error: undefined,
          } : s
        ))

        onServerConnected?.(servers.find(s => s.id === serverId)!)
        toast.success(`Connected to ${servers.find(s => s.id === serverId)?.name}`)
      }
    } catch (error: any) {
      handleServerError(serverId, error)
    }
  }, [servers, onServerConnected])

  // Handle server disconnected
  const handleServerDisconnected = useCallback((serverId: string) => {
    setServers(prev => prev.map(s => 
      s.id === serverId ? { ...s, status: 'disconnected' } : s
    ))

    // Clean up connection
    const connection = connectionsRef.current[serverId]
    if (connection) {
      if (connection instanceof WebSocket) {
        connection.close()
      } else {
        connection.close()
      }
      delete connectionsRef.current[serverId]
    }

    onServerDisconnected?.(serverId)

    // Auto-reconnect if enabled
    if (enableAutoReconnect) {
      const delay = retryDelay * Math.pow(2, servers.find(s => s.id === serverId)?.error ? 1 : 0)
      reconnectTimeoutsRef.current[serverId] = setTimeout(() => {
        connectServer(serverId).catch(console.error)
      }, delay)
    }
  }, [servers, enableAutoReconnect, retryDelay, connectServer, onServerDisconnected])

  // Handle server error
  const handleServerError = useCallback((serverId: string, error: any) => {
    const errorMessage = error?.message || 'Connection error'
    
    setErrors(prev => ({
      ...prev,
      [serverId]: errorMessage,
    }))

    setServers(prev => prev.map(s => 
      s.id === serverId ? { 
        ...s, 
        status: 'error',
        error: errorMessage,
      } : s
    ))

    onServerError?.(serverId, error)
    toast.error(`Server ${serverId}: ${errorMessage}`)
  }, [onServerError])

  // Handle incoming message
  const handleMessage = useCallback((serverId: string, rawMessage: any) => {
    const message: MCPMessage = {
      id: rawMessage.id || `msg-${Date.now()}`,
      type: rawMessage.error ? 'error' : rawMessage.result ? 'response' : 'notification',
      method: rawMessage.method,
      params: rawMessage.params,
      result: rawMessage.result,
      error: rawMessage.error,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, message])
    onMessage?.(serverId, message)

    // Handle specific message types
    if (message.method === 'notifications/resources/updated') {
      handleResourceUpdate(serverId, message.params)
    }
  }, [onMessage])

  // Load server tools
  const loadServerTools = useCallback(async (serverId: string) => {
    try {
      const response = await sendMessage(serverId, {
        jsonrpc: '2.0',
        id: `tools-${Date.now()}`,
        method: 'tools/list',
      })

      if (response?.result?.tools) {
        setServers(prev => prev.map(s => 
          s.id === serverId ? { ...s, tools: response.result.tools } : s
        ))
      }
    } catch (error) {
      console.error(`Failed to load tools for ${serverId}:`, error)
    }
  }, [])

  // Load server resources
  const loadServerResources = useCallback(async (serverId: string) => {
    try {
      const response = await sendMessage(serverId, {
        jsonrpc: '2.0',
        id: `resources-${Date.now()}`,
        method: 'resources/list',
      })

      if (response?.result?.resources) {
        setServers(prev => prev.map(s => 
          s.id === serverId ? { ...s, resources: response.result.resources } : s
        ))
      }
    } catch (error) {
      console.error(`Failed to load resources for ${serverId}:`, error)
    }
  }, [])

  // Handle resource update
  const handleResourceUpdate = useCallback((serverId: string, params: any) => {
    if (params?.uri) {
      getResource(serverId, params.uri).then(resource => {
        if (resource) {
          onResourceUpdate?.(serverId, resource)
        }
      }).catch(console.error)
    }
  }, [onResourceUpdate])

  // Disconnect from a specific server
  const disconnectServer = useCallback(async (serverId: string): Promise<void> => {
    const connection = connectionsRef.current[serverId]
    if (connection) {
      if (connection instanceof WebSocket) {
        connection.close()
      } else {
        connection.close()
      }
    }

    // Clear reconnect timeout
    if (reconnectTimeoutsRef.current[serverId]) {
      clearTimeout(reconnectTimeoutsRef.current[serverId])
      delete reconnectTimeoutsRef.current[serverId]
    }

    handleServerDisconnected(serverId)
  }, [handleServerDisconnected])

  // Reconnect to a specific server
  const reconnectServer = useCallback(async (serverId: string): Promise<void> => {
    await disconnectServer(serverId)
    await connectServer(serverId)
  }, [disconnectServer, connectServer])

  // Connect to all servers
  const connectAllServers = useCallback(async (): Promise<void> => {
    setIsConnecting(true)
    try {
      await Promise.allSettled(
        servers.map(server => connectServer(server.id))
      )
    } finally {
      setIsConnecting(false)
    }
  }, [servers, connectServer])

  // Disconnect from all servers
  const disconnectAllServers = useCallback(async (): Promise<void> => {
    await Promise.allSettled(
      servers.map(server => disconnectServer(server.id))
    )
  }, [servers, disconnectServer])

  // List all tools
  const listTools = useCallback((serverId?: string): MCPTool[] => {
    if (serverId) {
      const server = servers.find(s => s.id === serverId)
      return server?.tools || []
    }
    return servers.flatMap(server => server.tools)
  }, [servers])

  // Call a tool
  const callTool = useCallback(async (serverId: string, toolName: string, params: any = {}): Promise<any> => {
    const server = servers.find(s => s.id === serverId)
    if (!server || server.status !== 'connected') {
      throw new Error(`Server ${serverId} not connected`)
    }

    const tool = server.tools.find(t => t.name === toolName)
    if (!tool) {
      throw new Error(`Tool ${toolName} not found on server ${serverId}`)
    }

    // Validate tool call if enabled
    if (enableToolValidation) {
      const isValid = await validateToolCall(serverId, toolName, params)
      if (!isValid) {
        throw new Error(`Invalid parameters for tool ${toolName}`)
      }
    }

    try {
      const response = await sendMessage(serverId, {
        jsonrpc: '2.0',
        id: `tool-${Date.now()}`,
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: params,
        },
      })

      const result = response?.result
      onToolCall?.(serverId, toolName, params, result)
      
      return result
    } catch (error: any) {
      toast.error(`Tool call failed: ${error.message}`)
      throw error
    }
  }, [servers, enableToolValidation, onToolCall])

  // Validate tool call
  const validateToolCall = useCallback(async (serverId: string, toolName: string, params: any): Promise<boolean> => {
    const server = servers.find(s => s.id === serverId)
    const tool = server?.tools.find(t => t.name === toolName)
    
    if (!tool || !tool.inputSchema) {
      return true // Skip validation if no schema
    }

    // Basic validation against JSON schema
    try {
      // This would integrate with a JSON schema validator
      // For now, just check required properties
      if (tool.inputSchema.required) {
        for (const requiredProp of tool.inputSchema.required) {
          if (!(requiredProp in params)) {
            return false
          }
        }
      }
      return true
    } catch {
      return false
    }
  }, [servers])

  // List resources
  const listResources = useCallback((serverId?: string): MCPResource[] => {
    if (serverId) {
      const server = servers.find(s => s.id === serverId)
      return server?.resources || []
    }
    return servers.flatMap(server => server.resources)
  }, [servers])

  // Get a specific resource
  const getResource = useCallback(async (serverId: string, uri: string): Promise<MCPResource | null> => {
    const server = servers.find(s => s.id === serverId)
    if (!server || server.status !== 'connected') {
      throw new Error(`Server ${serverId} not connected`)
    }

    // Check cache first
    const cacheKey = `${serverId}:${uri}`
    if (enableResourceCaching && resourceCache[cacheKey]) {
      return resourceCache[cacheKey]
    }

    try {
      const response = await sendMessage(serverId, {
        jsonrpc: '2.0',
        id: `resource-${Date.now()}`,
        method: 'resources/read',
        params: { uri },
      })

      const resource = response?.result?.contents?.[0]
      if (resource && enableResourceCaching) {
        setResourceCache(prev => ({
          ...prev,
          [cacheKey]: resource,
        }))
      }

      return resource || null
    } catch (error) {
      console.error(`Failed to get resource ${uri}:`, error)
      return null
    }
  }, [servers, enableResourceCaching, resourceCache])

  // Subscribe to resource updates
  const subscribeToResource = useCallback(async (serverId: string, uri: string): Promise<void> => {
    const server = servers.find(s => s.id === serverId)
    if (!server || server.status !== 'connected') {
      throw new Error(`Server ${serverId} not connected`)
    }

    await sendMessage(serverId, {
      jsonrpc: '2.0',
      id: `subscribe-${Date.now()}`,
      method: 'resources/subscribe',
      params: { uri },
    })
  }, [servers])

  // Unsubscribe from resource updates
  const unsubscribeFromResource = useCallback(async (serverId: string, uri: string): Promise<void> => {
    const server = servers.find(s => s.id === serverId)
    if (!server || server.status !== 'connected') {
      throw new Error(`Server ${serverId} not connected`)
    }

    await sendMessage(serverId, {
      jsonrpc: '2.0',
      id: `unsubscribe-${Date.now()}`,
      method: 'resources/unsubscribe',
      params: { uri },
    })
  }, [servers])

  // Get session info
  const getSessionInfo = useCallback((serverId: string): MCPSessionInfo | null => {
    return sessionInfo[serverId] || null
  }, [sessionInfo])

  // Send message to server
  const sendMessage = useCallback(async (serverId: string, message: any): Promise<any> => {
    const connection = connectionsRef.current[serverId]
    if (!connection) {
      throw new Error(`No connection to server ${serverId}`)
    }

    return new Promise((resolve, reject) => {
      const messageId = message.id || `msg-${Date.now()}`
      const fullMessage = { ...message, id: messageId }

      // Set up response handler
      const handleResponse = (event: MessageEvent) => {
        try {
          const response = JSON.parse(event.data)
          if (response.id === messageId) {
            connection.removeEventListener('message', handleResponse)
            if (response.error) {
              reject(new Error(response.error.message))
            } else {
              resolve(response)
            }
          }
        } catch (error) {
          reject(error)
        }
      }

      connection.addEventListener('message', handleResponse)

      // Send message
      if (connection instanceof WebSocket) {
        connection.send(JSON.stringify(fullMessage))
      } else {
        // For SSE, we'd need to use a different method to send
        fetch(servers.find(s => s.id === serverId)!.uri, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fullMessage),
        }).then(response => response.json())
          .then(resolve)
          .catch(reject)
      }

      // Timeout
      setTimeout(() => {
        connection.removeEventListener('message', handleResponse)
        reject(new Error('Message timeout'))
      }, timeout)
    })
  }, [servers, timeout])

  // Utility functions
  const findToolsByCategory = useCallback((category: string) => {
    return servers.flatMap(server => 
      server.tools
        .filter(tool => tool.category === category)
        .map(tool => ({ serverId: server.id, tool }))
    )
  }, [servers])

  const getServerByTool = useCallback((toolName: string): MCPServer | null => {
    return servers.find(server => 
      server.tools.some(tool => tool.name === toolName)
    ) || null
  }, [servers])

  const clearErrors = useCallback(() => {
    setErrors({})
  }, [])

  const exportState = useCallback(() => {
    return {
      servers: servers.map(s => ({ ...s, status: 'disconnected' })),
      sessionInfo,
      messages: messages.slice(-100), // Keep last 100 messages
      timestamp: new Date().toISOString(),
    }
  }, [servers, sessionInfo, messages])

  // Computed values
  const connectedServers = servers.filter(s => s.status === 'connected')

  // Auto-connect to servers on mount
  useEffect(() => {
    const autoConnectServers = servers.filter(s => 
      initialServers.find(config => config.id === s.id)?.autoConnect !== false
    )

    if (autoConnectServers.length > 0) {
      Promise.allSettled(
        autoConnectServers.map(server => connectServer(server.id))
      ).catch(console.error)
    }

    // Cleanup on unmount
    return () => {
      disconnectAllServers().catch(console.error)
      Object.values(reconnectTimeoutsRef.current).forEach(clearTimeout)
    }
  }, []) // Empty dependency array for mount-only effect

  return {
    // Server management
    servers,
    connectedServers,
    
    // Connection control
    connectServer,
    disconnectServer,
    reconnectServer,
    connectAllServers,
    disconnectAllServers,
    
    // Tool operations
    listTools,
    callTool,
    validateToolCall,
    
    // Resource operations
    listResources,
    getResource,
    subscribeToResource,
    unsubscribeFromResource,
    
    // Session management
    getSessionInfo,
    sendMessage,
    
    // State
    isConnecting,
    errors,
    messages,
    
    // Utilities
    findToolsByCategory,
    getServerByTool,
    clearErrors,
    exportState,
  }
}

/**
 * Specialized hook for file system operations via MCP
 */
export function useMCPFileSystem() {
  const mcp = useMCP({
    servers: [
      {
        id: 'filesystem',
        name: 'File System',
        uri: '/api/mcp/filesystem',
        transport: 'sse',
        autoConnect: true,
      },
    ],
  })

  const readFile = useCallback(async (path: string): Promise<string> => {
    const result = await mcp.callTool('filesystem', 'read_file', { path })
    return result?.content || ''
  }, [mcp])

  const writeFile = useCallback(async (path: string, content: string): Promise<void> => {
    await mcp.callTool('filesystem', 'write_file', { path, content })
  }, [mcp])

  const listFiles = useCallback(async (path: string): Promise<string[]> => {
    const result = await mcp.callTool('filesystem', 'list_files', { path })
    return result?.files || []
  }, [mcp])

  return {
    ...mcp,
    readFile,
    writeFile,
    listFiles,
  }
}

/**
 * Specialized hook for database operations via MCP
 */
export function useMCPDatabase() {
  const mcp = useMCP({
    servers: [
      {
        id: 'database',
        name: 'Database',
        uri: '/api/mcp/database',
        transport: 'sse',
        autoConnect: true,
      },
    ],
  })

  const query = useCallback(async (sql: string, params?: any[]): Promise<any[]> => {
    const result = await mcp.callTool('database', 'query', { sql, params })
    return result?.rows || []
  }, [mcp])

  const execute = useCallback(async (sql: string, params?: any[]): Promise<number> => {
    const result = await mcp.callTool('database', 'execute', { sql, params })
    return result?.affectedRows || 0
  }, [mcp])

  return {
    ...mcp,
    query,
    execute,
  }
}