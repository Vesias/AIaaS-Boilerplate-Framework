'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'
import { useAI } from './ai-provider'
import { toast } from 'sonner'

// Types for MCP Provider
export interface MCPServerConfig {
  id: string
  name: string
  description: string
  uri: string
  transport: 'stdio' | 'sse' | 'websocket'
  autoConnect: boolean
  capabilities: string[]
  tools: MCPTool[]
  resources: MCPResource[]
  status: 'connected' | 'connecting' | 'disconnected' | 'error'
  error?: string
  lastActivity?: Date
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
  serverId: string
  type: 'request' | 'response' | 'notification' | 'error'
  method?: string
  params?: any
  result?: any
  error?: any
  timestamp: Date
}

export interface MCPState {
  isInitialized: boolean
  servers: MCPServerConfig[]
  connectedServers: MCPServerConfig[]
  messages: MCPMessage[]
  isConnecting: boolean
  globalError: string | null
  configuration: {
    autoConnect: boolean
    retryAttempts: number
    retryDelay: number
    timeout: number
    enableResourceCaching: boolean
  }
}

export interface MCPContextValue {
  state: MCPState
  
  // Server management
  addServer: (config: Omit<MCPServerConfig, 'status' | 'tools' | 'resources'>) => void
  removeServer: (serverId: string) => void
  connectServer: (serverId: string) => Promise<void>
  disconnectServer: (serverId: string) => Promise<void>
  reconnectServer: (serverId: string) => Promise<void>
  connectAllServers: () => Promise<void>
  disconnectAllServers: () => Promise<void>
  
  // Tool operations
  listTools: (serverId?: string) => MCPTool[]
  callTool: (serverId: string, toolName: string, params: any) => Promise<any>
  getToolSchema: (serverId: string, toolName: string) => MCPTool | null
  
  // Resource operations
  listResources: (serverId?: string) => MCPResource[]
  getResource: (serverId: string, uri: string) => Promise<MCPResource | null>
  subscribeToResource: (serverId: string, uri: string) => Promise<void>
  
  // Communication
  sendMessage: (serverId: string, message: any) => Promise<any>
  
  // Configuration
  updateConfiguration: (config: Partial<MCPState['configuration']>) => void
  
  // Utilities
  getServerByTool: (toolName: string) => MCPServerConfig | null
  findToolsByCategory: (category: string) => Array<{ serverId: string; tool: MCPTool }>
  exportConfiguration: () => any
  importConfiguration: (config: any) => void
  clearMessages: () => void
}

// Default configuration
const defaultConfiguration: MCPState['configuration'] = {
  autoConnect: true,
  retryAttempts: 3,
  retryDelay: 1000,
  timeout: 30000,
  enableResourceCaching: true,
}

// Default servers
const defaultServers: Omit<MCPServerConfig, 'status' | 'tools' | 'resources'>[] = [
  {
    id: 'filesystem',
    name: 'File System',
    description: 'Access to local file system operations',
    uri: '/api/mcp/filesystem',
    transport: 'sse',
    autoConnect: true,
    capabilities: ['file_operations', 'directory_listing', 'file_search'],
  },
  {
    id: 'database',
    name: 'Database',
    description: 'Database operations and queries',
    uri: '/api/mcp/database',
    transport: 'sse',
    autoConnect: true,
    capabilities: ['sql_queries', 'data_analysis', 'schema_introspection'],
  },
  {
    id: 'web',
    name: 'Web Browser',
    description: 'Web scraping and browser automation',
    uri: '/api/mcp/web',
    transport: 'sse',
    autoConnect: false,
    capabilities: ['web_scraping', 'browser_automation', 'screenshot_capture'],
  },
  {
    id: 'email',
    name: 'Email Service',
    description: 'Email sending and management',
    uri: '/api/mcp/email',
    transport: 'sse',
    autoConnect: false,
    capabilities: ['email_sending', 'email_templates', 'email_validation'],
  },
]

// Context
const MCPContext = createContext<MCPContextValue | undefined>(undefined)

// Provider component
interface MCPProviderProps {
  children: React.ReactNode
  servers?: Omit<MCPServerConfig, 'status' | 'tools' | 'resources'>[]
  configuration?: Partial<MCPState['configuration']>
  autoInitialize?: boolean
}

export function MCPProvider({ 
  children, 
  servers = defaultServers,
  configuration = {},
  autoInitialize = true 
}: MCPProviderProps) {
  const { user } = useUser()
  const { updateProviderStatus, trackUsage, state: aiState } = useAI()
  
  // State
  const [state, setState] = useState<MCPState>({
    isInitialized: false,
    servers: servers.map(server => ({
      ...server,
      status: 'disconnected',
      tools: [],
      resources: [],
    })),
    connectedServers: [],
    messages: [],
    isConnecting: false,
    globalError: null,
    configuration: {
      ...defaultConfiguration,
      ...configuration,
    },
  })

  // Connection management
  const connections = React.useRef<Record<string, WebSocket | EventSource>>({})
  const reconnectTimers = React.useRef<Record<string, NodeJS.Timeout>>({})

  // Add server
  const addServer = useCallback((config: Omit<MCPServerConfig, 'status' | 'tools' | 'resources'>) => {
    setState(prev => ({
      ...prev,
      servers: [...prev.servers, {
        ...config,
        status: 'disconnected',
        tools: [],
        resources: [],
      }],
    }))
  }, [])

  // Remove server
  const removeServer = useCallback((serverId: string) => {
    // Disconnect first
    disconnectServer(serverId)
    
    setState(prev => ({
      ...prev,
      servers: prev.servers.filter(s => s.id !== serverId),
      connectedServers: prev.connectedServers.filter(s => s.id !== serverId),
    }))
  }, [])

  // Connect to server
  const connectServer = useCallback(async (serverId: string): Promise<void> => {
    const server = state.servers.find(s => s.id === serverId)
    if (!server) {
      throw new Error(`Server ${serverId} not found`)
    }

    if (server.status === 'connected' || server.status === 'connecting') {
      return
    }

    // Update status to connecting
    setState(prev => ({
      ...prev,
      servers: prev.servers.map(s =>
        s.id === serverId ? { ...s, status: 'connecting', error: undefined } : s
      ),
    }))

    try {
      let connection: WebSocket | EventSource

      if (server.transport === 'websocket' || server.uri.startsWith('ws')) {
        // WebSocket connection
        connection = new WebSocket(server.uri)
        
        connection.onopen = () => {
          handleServerConnected(serverId)
        }
        
        connection.onmessage = (event) => {
          handleMessage(serverId, JSON.parse(event.data))
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
            const data = JSON.parse(event.data)
            handleMessage(serverId, data)
          } catch (error) {
            console.error('Failed to parse SSE message:', error)
          }
        }
        
        connection.onerror = (error) => {
          handleServerError(serverId, error)
        }
      }

      connections.current[serverId] = connection

      // Set timeout
      setTimeout(() => {
        if (state.servers.find(s => s.id === serverId)?.status === 'connecting') {
          handleServerError(serverId, new Error('Connection timeout'))
        }
      }, state.configuration.timeout)

    } catch (error: any) {
      handleServerError(serverId, error)
    }
  }, [state.servers, state.configuration.timeout])

  // Handle server connected
  const handleServerConnected = useCallback(async (serverId: string) => {
    try {
      // Initialize MCP session
      const initResponse = await sendMessage(serverId, {
        jsonrpc: '2.0',
        id: 'init',
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
      })

      if (initResponse?.result) {
        // Load tools and resources
        await Promise.all([
          loadServerTools(serverId),
          loadServerResources(serverId),
        ])

        setState(prev => ({
          ...prev,
          servers: prev.servers.map(s =>
            s.id === serverId ? { 
              ...s, 
              status: 'connected',
              lastActivity: new Date(),
              error: undefined,
            } : s
          ),
          connectedServers: [
            ...prev.connectedServers.filter(s => s.id !== serverId),
            prev.servers.find(s => s.id === serverId)!,
          ],
        }))

        updateProviderStatus('mcp', {
          enabled: true,
          connected: true,
          servers: state.connectedServers.length + 1,
        })

        toast.success(`MCP server "${serverId}" connected`)
      }
    } catch (error: any) {
      handleServerError(serverId, error)
    }
  }, [state.connectedServers.length])

  // Handle server disconnected
  const handleServerDisconnected = useCallback((serverId: string) => {
    setState(prev => ({
      ...prev,
      servers: prev.servers.map(s =>
        s.id === serverId ? { ...s, status: 'disconnected' } : s
      ),
      connectedServers: prev.connectedServers.filter(s => s.id !== serverId),
    }))

    // Clean up connection
    if (connections.current[serverId]) {
      const connection = connections.current[serverId]
      if (connection instanceof WebSocket) {
        connection.close()
      } else {
        connection.close()
      }
      delete connections.current[serverId]
    }

    // Update global MCP status
    updateProviderStatus('mcp', {
      enabled: true,
      connected: state.connectedServers.length > 1,
      servers: Math.max(0, state.connectedServers.length - 1),
    })

    // Auto-reconnect if configured
    if (state.configuration.autoConnect) {
      const delay = state.configuration.retryDelay
      reconnectTimers.current[serverId] = setTimeout(() => {
        connectServer(serverId).catch(console.error)
      }, delay)
    }
  }, [state.connectedServers.length, state.configuration])

  // Handle server error
  const handleServerError = useCallback((serverId: string, error: any) => {
    const errorMessage = error?.message || 'Connection error'
    
    setState(prev => ({
      ...prev,
      servers: prev.servers.map(s =>
        s.id === serverId ? { 
          ...s, 
          status: 'error',
          error: errorMessage,
        } : s
      ),
    }))

    updateProviderStatus('mcp', {
      enabled: true,
      connected: state.connectedServers.length > 0,
      error: errorMessage,
    })

    toast.error(`MCP server ${serverId}: ${errorMessage}`)
  }, [state.connectedServers.length])

  // Handle incoming message
  const handleMessage = useCallback((serverId: string, data: any) => {
    const message: MCPMessage = {
      id: data.id || `msg-${Date.now()}`,
      serverId,
      type: data.error ? 'error' : data.result ? 'response' : 'notification',
      method: data.method,
      params: data.params,
      result: data.result,
      error: data.error,
      timestamp: new Date(),
    }

    setState(prev => ({
      ...prev,
      messages: [...prev.messages.slice(-99), message], // Keep last 100 messages
    }))

    // Handle specific message types
    if (message.method === 'notifications/tools/list_changed') {
      loadServerTools(serverId)
    } else if (message.method === 'notifications/resources/list_changed') {
      loadServerResources(serverId)
    }
  }, [])

  // Load server tools
  const loadServerTools = useCallback(async (serverId: string) => {
    try {
      const response = await sendMessage(serverId, {
        jsonrpc: '2.0',
        id: `tools-${Date.now()}`,
        method: 'tools/list',
      })

      if (response?.result?.tools) {
        setState(prev => ({
          ...prev,
          servers: prev.servers.map(s =>
            s.id === serverId ? { ...s, tools: response.result.tools } : s
          ),
          connectedServers: prev.connectedServers.map(s =>
            s.id === serverId ? { ...s, tools: response.result.tools } : s
          ),
        }))
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
        setState(prev => ({
          ...prev,
          servers: prev.servers.map(s =>
            s.id === serverId ? { ...s, resources: response.result.resources } : s
          ),
          connectedServers: prev.connectedServers.map(s =>
            s.id === serverId ? { ...s, resources: response.result.resources } : s
          ),
        }))
      }
    } catch (error) {
      console.error(`Failed to load resources for ${serverId}:`, error)
    }
  }, [])

  // Disconnect server
  const disconnectServer = useCallback(async (serverId: string) => {
    const connection = connections.current[serverId]
    if (connection) {
      if (connection instanceof WebSocket) {
        connection.close()
      } else {
        connection.close()
      }
    }

    if (reconnectTimers.current[serverId]) {
      clearTimeout(reconnectTimers.current[serverId])
      delete reconnectTimers.current[serverId]
    }

    handleServerDisconnected(serverId)
  }, [handleServerDisconnected])

  // Reconnect server
  const reconnectServer = useCallback(async (serverId: string) => {
    await disconnectServer(serverId)
    await connectServer(serverId)
  }, [disconnectServer, connectServer])

  // Connect all servers
  const connectAllServers = useCallback(async () => {
    setState(prev => ({ ...prev, isConnecting: true }))
    
    try {
      await Promise.allSettled(
        state.servers
          .filter(s => s.autoConnect)
          .map(s => connectServer(s.id))
      )
    } finally {
      setState(prev => ({ ...prev, isConnecting: false }))
    }
  }, [state.servers, connectServer])

  // Disconnect all servers
  const disconnectAllServers = useCallback(async () => {
    await Promise.allSettled(
      state.connectedServers.map(s => disconnectServer(s.id))
    )
  }, [state.connectedServers, disconnectServer])

  // List tools
  const listTools = useCallback((serverId?: string): MCPTool[] => {
    if (serverId) {
      const server = state.connectedServers.find(s => s.id === serverId)
      return server?.tools || []
    }
    return state.connectedServers.flatMap(s => s.tools)
  }, [state.connectedServers])

  // Call tool
  const callTool = useCallback(async (serverId: string, toolName: string, params: any = {}): Promise<any> => {
    const server = state.connectedServers.find(s => s.id === serverId)
    if (!server) {
      throw new Error(`Server ${serverId} not connected`)
    }

    const tool = server.tools.find(t => t.name === toolName)
    if (!tool) {
      throw new Error(`Tool ${toolName} not found on server ${serverId}`)
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

      // Track usage
      const estimatedTokens = Math.ceil((JSON.stringify(params).length + JSON.stringify(response).length) / 4)
      const estimatedCost = estimatedTokens * 0.00001 // Lower cost for MCP tools
      trackUsage('mcp', estimatedTokens, estimatedCost)

      return response?.result
    } catch (error: any) {
      toast.error(`MCP tool call failed: ${error.message}`)
      throw error
    }
  }, [state.connectedServers, trackUsage])

  // Get tool schema
  const getToolSchema = useCallback((serverId: string, toolName: string): MCPTool | null => {
    const server = state.connectedServers.find(s => s.id === serverId)
    return server?.tools.find(t => t.name === toolName) || null
  }, [state.connectedServers])

  // List resources
  const listResources = useCallback((serverId?: string): MCPResource[] => {
    if (serverId) {
      const server = state.connectedServers.find(s => s.id === serverId)
      return server?.resources || []
    }
    return state.connectedServers.flatMap(s => s.resources)
  }, [state.connectedServers])

  // Get resource
  const getResource = useCallback(async (serverId: string, uri: string): Promise<MCPResource | null> => {
    const server = state.connectedServers.find(s => s.id === serverId)
    if (!server) {
      throw new Error(`Server ${serverId} not connected`)
    }

    try {
      const response = await sendMessage(serverId, {
        jsonrpc: '2.0',
        id: `resource-${Date.now()}`,
        method: 'resources/read',
        params: { uri },
      })

      return response?.result?.contents?.[0] || null
    } catch (error) {
      console.error(`Failed to get resource ${uri}:`, error)
      return null
    }
  }, [state.connectedServers])

  // Subscribe to resource
  const subscribeToResource = useCallback(async (serverId: string, uri: string) => {
    await sendMessage(serverId, {
      jsonrpc: '2.0',
      id: `subscribe-${Date.now()}`,
      method: 'resources/subscribe',
      params: { uri },
    })
  }, [])

  // Send message
  const sendMessage = useCallback(async (serverId: string, message: any): Promise<any> => {
    const connection = connections.current[serverId]
    if (!connection) {
      throw new Error(`No connection to server ${serverId}`)
    }

    return new Promise((resolve, reject) => {
      const messageId = message.id || `msg-${Date.now()}`
      const fullMessage = { ...message, id: messageId }

      const timeout = setTimeout(() => {
        reject(new Error('Message timeout'))
      }, state.configuration.timeout)

      const handleResponse = (event: MessageEvent) => {
        try {
          const response = JSON.parse(event.data)
          if (response.id === messageId) {
            clearTimeout(timeout)
            connection.removeEventListener('message', handleResponse)
            
            if (response.error) {
              reject(new Error(response.error.message))
            } else {
              resolve(response)
            }
          }
        } catch (error) {
          clearTimeout(timeout)
          reject(error)
        }
      }

      connection.addEventListener('message', handleResponse)

      if (connection instanceof WebSocket) {
        connection.send(JSON.stringify(fullMessage))
      } else {
        // For SSE, use POST to send messages
        fetch(state.servers.find(s => s.id === serverId)!.uri, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fullMessage),
        }).then(response => response.json())
          .then(resolve)
          .catch(reject)
          .finally(() => clearTimeout(timeout))
      }
    })
  }, [state.configuration.timeout, state.servers])

  // Update configuration
  const updateConfiguration = useCallback((config: Partial<MCPState['configuration']>) => {
    setState(prev => ({
      ...prev,
      configuration: { ...prev.configuration, ...config },
    }))
  }, [])

  // Utility functions
  const getServerByTool = useCallback((toolName: string): MCPServerConfig | null => {
    return state.connectedServers.find(server =>
      server.tools.some(tool => tool.name === toolName)
    ) || null
  }, [state.connectedServers])

  const findToolsByCategory = useCallback((category: string) => {
    return state.connectedServers.flatMap(server =>
      server.tools
        .filter(tool => tool.category === category)
        .map(tool => ({ serverId: server.id, tool }))
    )
  }, [state.connectedServers])

  const exportConfiguration = useCallback(() => {
    return {
      servers: state.servers.map(s => ({
        id: s.id,
        name: s.name,
        description: s.description,
        uri: s.uri,
        transport: s.transport,
        autoConnect: s.autoConnect,
        capabilities: s.capabilities,
      })),
      configuration: state.configuration,
      timestamp: new Date().toISOString(),
    }
  }, [state])

  const importConfiguration = useCallback((config: any) => {
    if (config.servers) {
      setState(prev => ({
        ...prev,
        servers: config.servers.map((s: any) => ({
          ...s,
          status: 'disconnected' as const,
          tools: [],
          resources: [],
        })),
      }))
    }
    
    if (config.configuration) {
      setState(prev => ({
        ...prev,
        configuration: { ...prev.configuration, ...config.configuration },
      }))
    }
  }, [])

  const clearMessages = useCallback(() => {
    setState(prev => ({ ...prev, messages: [] }))
  }, [])

  // Auto-initialize
  useEffect(() => {
    if (autoInitialize && user && aiState.isEnabled && !state.isInitialized) {
      setState(prev => ({ ...prev, isInitialized: true }))
      connectAllServers().catch(console.error)
    }
  }, [autoInitialize, user, aiState.isEnabled, state.isInitialized, connectAllServers])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnectAllServers().catch(console.error)
      Object.values(reconnectTimers.current).forEach(clearTimeout)
    }
  }, [disconnectAllServers])

  const contextValue: MCPContextValue = {
    state,
    
    // Server management
    addServer,
    removeServer,
    connectServer,
    disconnectServer,
    reconnectServer,
    connectAllServers,
    disconnectAllServers,
    
    // Tool operations
    listTools,
    callTool,
    getToolSchema,
    
    // Resource operations
    listResources,
    getResource,
    subscribeToResource,
    
    // Communication
    sendMessage,
    
    // Configuration
    updateConfiguration,
    
    // Utilities
    getServerByTool,
    findToolsByCategory,
    exportConfiguration,
    importConfiguration,
    clearMessages,
  }

  return (
    <MCPContext.Provider value={contextValue}>
      {children}
    </MCPContext.Provider>
  )
}

// Hook to use MCP context
export function useMCPProvider(): MCPContextValue {
  const context = useContext(MCPContext)
  if (context === undefined) {
    throw new Error('useMCPProvider must be used within an MCPProvider')
  }
  return context
}

// Custom hooks for specific MCP features
export function useMCPServers() {
  const { state, connectServer, disconnectServer, addServer, removeServer } = useMCPProvider()
  
  return {
    servers: state.servers,
    connectedServers: state.connectedServers,
    isConnecting: state.isConnecting,
    connectServer,
    disconnectServer,
    addServer,
    removeServer,
    
    // Status helpers
    getServerStatus: (serverId: string) => state.servers.find(s => s.id === serverId)?.status,
    isServerConnected: (serverId: string) => state.connectedServers.some(s => s.id === serverId),
  }
}

export function useMCPTools() {
  const { listTools, callTool, getToolSchema, findToolsByCategory, getServerByTool } = useMCPProvider()
  
  return {
    listTools,
    callTool,
    getToolSchema,
    findToolsByCategory,
    getServerByTool,
    
    // Convenience methods
    hastool: (toolName: string) => !!getServerByTool(toolName),
    getToolsByServer: (serverId: string) => listTools(serverId),
    getAllTools: () => listTools(),
  }
}

export function useMCPResources() {
  const { listResources, getResource, subscribeToResource } = useMCPProvider()
  
  return {
    listResources,
    getResource,
    subscribeToResource,
    
    // Convenience methods
    getResourcesByServer: (serverId: string) => listResources(serverId),
    getAllResources: () => listResources(),
  }
}