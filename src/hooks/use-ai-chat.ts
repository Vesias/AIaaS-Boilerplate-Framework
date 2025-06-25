'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useUser } from '@clerk/nextjs'
import { toast } from 'sonner'
import { useCopilot } from './use-copilot'
import { useMCP } from './use-mcp'
import { useAGUI } from './use-agui'
import { useA2A } from './use-a2a'

// Types for universal AI chat
export interface AIProvider {
  id: 'copilot' | 'mcp' | 'agui' | 'a2a' | 'openai' | 'anthropic' | 'custom'
  name: string
  description: string
  capabilities: string[]
  available: boolean
  status: 'connected' | 'connecting' | 'disconnected' | 'error'
  config?: Record<string, any>
}

export interface AIMessage {
  id: string
  provider: AIProvider['id']
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  timestamp: Date
  metadata?: Record<string, any>
  toolCalls?: AIToolCall[]
  attachments?: AIAttachment[]
  tokens?: number
  cost?: number
}

export interface AIToolCall {
  id: string
  name: string
  arguments: Record<string, any>
  result?: any
  status: 'pending' | 'running' | 'completed' | 'failed'
  provider: AIProvider['id']
  error?: string
}

export interface AIAttachment {
  id: string
  type: 'image' | 'document' | 'audio' | 'video' | 'file'
  name: string
  url: string
  size: number
  mimeType: string
}

export interface AIConversation {
  id: string
  title: string
  messages: AIMessage[]
  providers: AIProvider['id'][]
  context: Record<string, any>
  startedAt: Date
  lastActivity: Date
  metadata: Record<string, any>
}

export interface AIConfiguration {
  defaultProvider: AIProvider['id']
  fallbackProviders: AIProvider['id'][]
  autoSwitching: boolean
  costOptimization: boolean
  maxTokens: number
  temperature: number
  streaming: boolean
  tools: string[]
  safety: {
    contentFiltering: boolean
    rateLimiting: boolean
    maxRequestsPerMinute: number
  }
}

export interface UseAIChatOptions {
  // Provider selection
  preferredProvider?: AIProvider['id']
  fallbackProviders?: AIProvider['id'][]
  autoSwitching?: boolean
  
  // Configuration
  configuration?: Partial<AIConfiguration>
  
  // Features
  enableMultiProvider?: boolean
  enableToolCalls?: boolean
  enableStreaming?: boolean
  enableConversationHistory?: boolean
  enableCostTracking?: boolean
  
  // Optimization
  costOptimization?: boolean
  performanceOptimization?: boolean
  
  // Callbacks
  onMessage?: (message: AIMessage) => void
  onProviderSwitch?: (fromProvider: AIProvider['id'], toProvider: AIProvider['id']) => void
  onToolCall?: (toolCall: AIToolCall) => void
  onError?: (error: any, provider: AIProvider['id']) => void
  onCostUpdate?: (cost: number, tokens: number) => void
}

export interface UseAIChatReturn {
  // Providers
  providers: AIProvider[]
  activeProvider: AIProvider | null
  availableProviders: AIProvider[]
  
  // Conversation
  messages: AIMessage[]
  conversations: AIConversation[]
  currentConversation: AIConversation | null
  
  // Actions
  sendMessage: (content: string, options?: {
    provider?: AIProvider['id']
    attachments?: File[]
    toolCalls?: string[]
    stream?: boolean
  }) => Promise<void>
  
  // Provider management
  switchProvider: (providerId: AIProvider['id']) => Promise<void>
  selectBestProvider: (criteria: {
    capability?: string
    cost?: boolean
    speed?: boolean
    availability?: boolean
  }) => AIProvider | null
  
  // Conversation management
  startConversation: (title?: string, providers?: AIProvider['id'][]) => AIConversation
  switchConversation: (conversationId: string) => void
  clearConversation: () => void
  deleteConversation: (conversationId: string) => void
  
  // Tools and capabilities
  availableTools: string[]
  callTool: (toolName: string, args: any, provider?: AIProvider['id']) => Promise<any>
  
  // State
  isLoading: boolean
  isStreaming: boolean
  error: string | null
  
  // Metrics
  totalTokens: number
  totalCost: number
  providerUsage: Record<AIProvider['id'], { tokens: number; cost: number; requests: number }>
  
  // Configuration
  updateConfiguration: (config: Partial<AIConfiguration>) => void
  getConfiguration: () => AIConfiguration
  
  // Utilities
  exportConversation: (conversationId?: string) => any
  importConversation: (data: any) => void
  getConversationStats: () => {
    messageCount: number
    providerDistribution: Record<string, number>
    averageResponseTime: number
    totalCost: number
  }
}

/**
 * Universal AI Chat Hook
 * Provides unified interface for all AI providers with intelligent routing and optimization
 */
export function useAIChat(options: UseAIChatOptions = {}): UseAIChatReturn {
  const {
    preferredProvider = 'copilot',
    fallbackProviders = ['agui', 'mcp', 'a2a'],
    autoSwitching = true,
    configuration = {},
    enableMultiProvider = true,
    enableToolCalls = true,
    enableStreaming = true,
    enableConversationHistory = true,
    enableCostTracking = true,
    costOptimization = true,
    performanceOptimization = true,
    onMessage,
    onProviderSwitch,
    onToolCall,
    onError,
    onCostUpdate,
  } = options

  // Clerk user context
  const { user } = useUser()
  
  // Initialize individual provider hooks
  const copilot = useCopilot({
    enableStreaming,
    enableToolCalls,
    onMessage: (msg) => handleProviderMessage('copilot', msg),
    onError: (error) => handleProviderError('copilot', error),
  })
  
  const mcp = useMCP({
    enableAutoReconnect: true,
    onMessage: (serverId, msg) => handleProviderMessage('mcp', msg),
    onServerError: (serverId, error) => handleProviderError('mcp', error),
  })
  
  const agui = useAGUI({
    enableStreaming,
    enableToolCalls,
    onMessage: (msg) => handleProviderMessage('agui', msg),
    onError: (error) => handleProviderError('agui', error),
  })
  
  const a2a = useA2A({
    onMessageReceived: (msg) => handleProviderMessage('a2a', msg),
    onError: (error) => handleProviderError('a2a', error),
  })

  // State
  const [providers, setProviders] = useState<AIProvider[]>([])
  const [activeProvider, setActiveProvider] = useState<AIProvider | null>(null)
  const [messages, setMessages] = useState<AIMessage[]>([])
  const [conversations, setConversations] = useState<AIConversation[]>([])
  const [currentConversation, setCurrentConversation] = useState<AIConversation | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [config, setConfig] = useState<AIConfiguration>({
    defaultProvider: preferredProvider,
    fallbackProviders,
    autoSwitching,
    costOptimization,
    maxTokens: 2000,
    temperature: 0.7,
    streaming: enableStreaming,
    tools: [],
    safety: {
      contentFiltering: true,
      rateLimiting: true,
      maxRequestsPerMinute: 60,
    },
    ...configuration,
  })
  const [providerUsage, setProviderUsage] = useState<Record<AIProvider['id'], { tokens: number; cost: number; requests: number }>>({})

  // Refs
  const responseTimeRef = useRef<Record<string, number>>({})
  const providerHealthRef = useRef<Record<string, number>>({})

  // Initialize providers
  useEffect(() => {
    const initialProviders: AIProvider[] = [
      {
        id: 'copilot',
        name: 'CopilotKit',
        description: 'Advanced AI with task automation and custom actions',
        capabilities: ['chat', 'tasks', 'automation', 'analysis'],
        available: true,
        status: copilot.error ? 'error' : 'connected',
      },
      {
        id: 'mcp',
        name: 'Model Context Protocol',
        description: 'Tool-enabled AI with external resource access',
        capabilities: ['tools', 'resources', 'file_access', 'database'],
        available: mcp.connectedServers.length > 0,
        status: mcp.connectedServers.length > 0 ? 'connected' : 'disconnected',
      },
      {
        id: 'agui',
        name: 'AG-UI Protocol',
        description: 'Streaming AI with rich interactions and attachments',
        capabilities: ['streaming', 'attachments', 'rich_content', 'tools'],
        available: agui.isConnected,
        status: agui.isConnected ? 'connected' : 'disconnected',
      },
      {
        id: 'a2a',
        name: 'Agent-to-Agent',
        description: 'Distributed AI network with multi-agent coordination',
        capabilities: ['coordination', 'distributed', 'task_distribution'],
        available: a2a.isConnected,
        status: a2a.isConnected ? 'connected' : 'disconnected',
      },
    ]

    setProviders(initialProviders)
    
    // Set initial active provider
    const preferred = initialProviders.find(p => p.id === preferredProvider && p.available)
    const fallback = initialProviders.find(p => fallbackProviders.includes(p.id) && p.available)
    setActiveProvider(preferred || fallback || initialProviders[0])
  }, [
    preferredProvider,
    fallbackProviders,
    copilot.error,
    mcp.connectedServers.length,
    agui.isConnected,
    a2a.isConnected,
  ])

  // Handle provider messages
  const handleProviderMessage = useCallback((providerId: AIProvider['id'], message: any) => {
    const aiMessage: AIMessage = {
      id: `${providerId}-${Date.now()}`,
      provider: providerId,
      role: message.role || 'assistant',
      content: message.content || message.payload?.content || JSON.stringify(message),
      timestamp: new Date(message.timestamp || Date.now()),
      metadata: message.metadata || {},
      toolCalls: message.toolCalls,
      tokens: message.tokens,
      cost: message.cost,
    }

    setMessages(prev => [...prev, aiMessage])
    
    // Update current conversation
    if (currentConversation) {
      setConversations(prev => prev.map(conv =>
        conv.id === currentConversation.id
          ? { ...conv, messages: [...conv.messages, aiMessage], lastActivity: new Date() }
          : conv
      ))
    }

    // Track usage
    if (aiMessage.tokens || aiMessage.cost) {
      setProviderUsage(prev => ({
        ...prev,
        [providerId]: {
          tokens: (prev[providerId]?.tokens || 0) + (aiMessage.tokens || 0),
          cost: (prev[providerId]?.cost || 0) + (aiMessage.cost || 0),
          requests: (prev[providerId]?.requests || 0) + 1,
        },
      }))
    }

    onMessage?.(aiMessage)
  }, [currentConversation, onMessage])

  // Handle provider errors
  const handleProviderError = useCallback((providerId: AIProvider['id'], error: any) => {
    setProviders(prev => prev.map(p =>
      p.id === providerId ? { ...p, status: 'error' } : p
    ))

    // Update provider health score
    providerHealthRef.current[providerId] = (providerHealthRef.current[providerId] || 0) - 10

    onError?.(error, providerId)

    // Auto-switch if enabled and current provider failed
    if (autoSwitching && activeProvider?.id === providerId) {
      const nextProvider = selectBestProvider({ availability: true })
      if (nextProvider && nextProvider.id !== providerId) {
        switchProvider(nextProvider.id)
      }
    }
  }, [activeProvider, autoSwitching, onError])

  // Switch provider
  const switchProvider = useCallback(async (providerId: AIProvider['id']): Promise<void> => {
    const provider = providers.find(p => p.id === providerId)
    if (!provider || !provider.available) {
      throw new Error(`Provider ${providerId} not available`)
    }

    const oldProvider = activeProvider?.id
    setActiveProvider(provider)

    if (oldProvider && oldProvider !== providerId) {
      onProviderSwitch?.(oldProvider, providerId)
      toast.success(`Switched to ${provider.name}`)
    }
  }, [providers, activeProvider, onProviderSwitch])

  // Select best provider based on criteria
  const selectBestProvider = useCallback((criteria: {
    capability?: string
    cost?: boolean
    speed?: boolean
    availability?: boolean
  }): AIProvider | null => {
    let candidates = providers.filter(p => p.available)

    // Filter by capability
    if (criteria.capability) {
      candidates = candidates.filter(p => p.capabilities.includes(criteria.capability!))
    }

    if (candidates.length === 0) return null

    // Score providers based on criteria
    const scored = candidates.map(provider => {
      let score = 0
      const usage = providerUsage[provider.id]
      const health = providerHealthRef.current[provider.id] || 100

      // Health score (0-100)
      score += health

      // Cost optimization
      if (criteria.cost && usage) {
        const avgCost = usage.cost / (usage.requests || 1)
        score += Math.max(0, 100 - avgCost * 1000) // Lower cost = higher score
      }

      // Speed optimization
      if (criteria.speed) {
        const avgResponseTime = responseTimeRef.current[provider.id] || 1000
        score += Math.max(0, 100 - avgResponseTime / 100) // Faster = higher score
      }

      // Availability bonus
      if (criteria.availability && provider.status === 'connected') {
        score += 50
      }

      return { provider, score }
    })

    // Return highest scoring provider
    scored.sort((a, b) => b.score - a.score)
    return scored[0]?.provider || null
  }, [providers, providerUsage])

  // Send message with intelligent routing
  const sendMessage = useCallback(async (
    content: string,
    options: {
      provider?: AIProvider['id']
      attachments?: File[]
      toolCalls?: string[]
      stream?: boolean
    } = {}
  ): Promise<void> => {
    if (!content.trim()) return

    setIsLoading(true)
    setError(null)

    // Determine which provider to use
    let targetProvider = activeProvider
    if (options.provider) {
      targetProvider = providers.find(p => p.id === options.provider) || activeProvider
    } else if (costOptimization || performanceOptimization) {
      const criteria = {
        cost: costOptimization,
        speed: performanceOptimization,
        availability: true,
      }
      const bestProvider = selectBestProvider(criteria)
      if (bestProvider && bestProvider !== activeProvider) {
        targetProvider = bestProvider
        await switchProvider(bestProvider.id)
      }
    }

    if (!targetProvider) {
      setError('No AI provider available')
      setIsLoading(false)
      return
    }

    const startTime = Date.now()

    try {
      // Route to appropriate provider
      switch (targetProvider.id) {
        case 'copilot':
          await copilot.sendMessage(content, { stream: options.stream })
          break
          
        case 'mcp':
          // For MCP, we might need to use a specific server
          const servers = mcp.connectedServers
          if (servers.length > 0) {
            await mcp.sendMessage(servers[0].id, {
              jsonrpc: '2.0',
              method: 'chat',
              params: { message: content },
            })
          }
          break
          
        case 'agui':
          await agui.sendMessage(content, options.attachments)
          break
          
        case 'a2a':
          // Broadcast to network or send to specific agent
          if (a2a.onlineAgents.length > 0) {
            await a2a.sendMessage(a2a.onlineAgents[0].id, {
              type: 'chat_message',
              content,
            })
          }
          break
          
        default:
          throw new Error(`Provider ${targetProvider.id} not implemented`)
      }

      // Track response time
      const responseTime = Date.now() - startTime
      responseTimeRef.current[targetProvider.id] = responseTime

      // Update provider health
      providerHealthRef.current[targetProvider.id] = Math.min(100, 
        (providerHealthRef.current[targetProvider.id] || 100) + 5
      )

    } catch (error: any) {
      handleProviderError(targetProvider.id, error)
      setError(error.message || 'Failed to send message')
    } finally {
      setIsLoading(false)
    }
  }, [
    activeProvider,
    providers,
    costOptimization,
    performanceOptimization,
    selectBestProvider,
    switchProvider,
    copilot,
    mcp,
    agui,
    a2a,
    handleProviderError,
  ])

  // Start new conversation
  const startConversation = useCallback((
    title: string = 'New Conversation',
    providers: AIProvider['id'][] = [activeProvider?.id || 'copilot']
  ): AIConversation => {
    const conversation: AIConversation = {
      id: `conv-${Date.now()}`,
      title,
      messages: [],
      providers,
      context: {
        userId: user?.id,
        startedAt: new Date().toISOString(),
      },
      startedAt: new Date(),
      lastActivity: new Date(),
      metadata: {},
    }

    setConversations(prev => [...prev, conversation])
    setCurrentConversation(conversation)
    setMessages([])

    return conversation
  }, [activeProvider, user])

  // Switch conversation
  const switchConversation = useCallback((conversationId: string) => {
    const conversation = conversations.find(c => c.id === conversationId)
    if (conversation) {
      setCurrentConversation(conversation)
      setMessages(conversation.messages)
    }
  }, [conversations])

  // Clear current conversation
  const clearConversation = useCallback(() => {
    if (currentConversation) {
      setConversations(prev => prev.map(conv =>
        conv.id === currentConversation.id
          ? { ...conv, messages: [] }
          : conv
      ))
      setMessages([])
    }
  }, [currentConversation])

  // Delete conversation
  const deleteConversation = useCallback((conversationId: string) => {
    setConversations(prev => prev.filter(c => c.id !== conversationId))
    if (currentConversation?.id === conversationId) {
      setCurrentConversation(null)
      setMessages([])
    }
  }, [currentConversation])

  // Call tool
  const callTool = useCallback(async (
    toolName: string,
    args: any,
    provider?: AIProvider['id']
  ): Promise<any> => {
    const targetProvider = provider || activeProvider?.id || 'copilot'

    try {
      switch (targetProvider) {
        case 'copilot':
          return await copilot.executeAction(toolName, args)
          
        case 'mcp':
          const server = mcp.connectedServers[0]
          if (server) {
            return await mcp.callTool(server.id, toolName, args)
          }
          throw new Error('No MCP server available')
          
        case 'agui':
          return await agui.callTool(toolName, args)
          
        case 'a2a':
          // Find agent with the required capability
          const capableAgents = a2a.findAgentsByCapability(toolName)
          if (capableAgents.length > 0) {
            return await a2a.sendMessage(capableAgents[0].id, {
              type: 'tool_call',
              tool: toolName,
              arguments: args,
            })
          }
          throw new Error(`No agent found with capability: ${toolName}`)
          
        default:
          throw new Error(`Tool calls not supported for provider: ${targetProvider}`)
      }
    } catch (error: any) {
      handleProviderError(targetProvider, error)
      throw error
    }
  }, [activeProvider, copilot, mcp, agui, a2a, handleProviderError])

  // Update configuration
  const updateConfiguration = useCallback((newConfig: Partial<AIConfiguration>) => {
    setConfig(prev => ({ ...prev, ...newConfig }))
  }, [])

  // Get configuration
  const getConfiguration = useCallback(() => config, [config])

  // Export conversation
  const exportConversation = useCallback((conversationId?: string) => {
    const conversation = conversationId 
      ? conversations.find(c => c.id === conversationId)
      : currentConversation

    if (!conversation) return null

    return {
      ...conversation,
      exportedAt: new Date().toISOString(),
      providerUsage: Object.fromEntries(
        conversation.providers.map(p => [p, providerUsage[p] || {}])
      ),
    }
  }, [conversations, currentConversation, providerUsage])

  // Import conversation
  const importConversation = useCallback((data: any) => {
    if (data && data.id) {
      const conversation: AIConversation = {
        ...data,
        startedAt: new Date(data.startedAt),
        lastActivity: new Date(data.lastActivity),
        messages: data.messages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        })),
      }
      
      setConversations(prev => [...prev, conversation])
    }
  }, [])

  // Get conversation stats
  const getConversationStats = useCallback(() => {
    const messageCount = messages.length
    const providerDistribution: Record<string, number> = {}
    let totalResponseTime = 0
    let responseCount = 0
    let totalCost = 0

    messages.forEach(msg => {
      providerDistribution[msg.provider] = (providerDistribution[msg.provider] || 0) + 1
      if (msg.cost) totalCost += msg.cost
    })

    Object.values(responseTimeRef.current).forEach(time => {
      totalResponseTime += time
      responseCount++
    })

    return {
      messageCount,
      providerDistribution,
      averageResponseTime: responseCount > 0 ? totalResponseTime / responseCount : 0,
      totalCost,
    }
  }, [messages])

  // Auto-start conversation on mount
  useEffect(() => {
    if (enableConversationHistory && conversations.length === 0) {
      startConversation()
    }
  }, [enableConversationHistory, conversations.length, startConversation])

  // Computed values
  const availableProviders = providers.filter(p => p.available)
  const totalTokens = Object.values(providerUsage).reduce((sum, usage) => sum + usage.tokens, 0)
  const totalCost = Object.values(providerUsage).reduce((sum, usage) => sum + usage.cost, 0)
  const availableTools = [
    ...copilot.getAvailableActions(),
    ...mcp.listTools().map(t => t.name),
    ...agui.availableTools,
    // A2A tools would be dynamic based on network capabilities
  ]

  // Update cost tracking
  useEffect(() => {
    if (enableCostTracking && totalCost > 0) {
      onCostUpdate?.(totalCost, totalTokens)
    }
  }, [enableCostTracking, totalCost, totalTokens, onCostUpdate])

  return {
    // Providers
    providers,
    activeProvider,
    availableProviders,
    
    // Conversation
    messages,
    conversations,
    currentConversation,
    
    // Actions
    sendMessage,
    
    // Provider management
    switchProvider,
    selectBestProvider,
    
    // Conversation management
    startConversation,
    switchConversation,
    clearConversation,
    deleteConversation,
    
    // Tools and capabilities
    availableTools,
    callTool,
    
    // State
    isLoading: isLoading || copilot.isLoading || agui.isLoading,
    isStreaming: isStreaming || copilot.isStreaming || agui.isStreaming,
    error,
    
    // Metrics
    totalTokens,
    totalCost,
    providerUsage,
    
    // Configuration
    updateConfiguration,
    getConfiguration,
    
    // Utilities
    exportConversation,
    importConversation,
    getConversationStats,
  }
}

/**
 * Specialized hook for task-focused AI chat
 */
export function useAIChatTasks() {
  return useAIChat({
    preferredProvider: 'copilot',
    fallbackProviders: ['agui', 'mcp'],
    configuration: {
      tools: ['createTask', 'analyzeData', 'triggerWorkflow'],
      maxTokens: 1000,
      temperature: 0.3,
    },
  })
}

/**
 * Specialized hook for creative AI chat
 */
export function useAIChatCreative() {
  return useAIChat({
    preferredProvider: 'agui',
    fallbackProviders: ['copilot'],
    configuration: {
      temperature: 0.9,
      maxTokens: 2000,
      streaming: true,
    },
  })
}

/**
 * Specialized hook for analytical AI chat
 */
export function useAIChatAnalytics() {
  return useAIChat({
    preferredProvider: 'mcp',
    fallbackProviders: ['copilot', 'agui'],
    configuration: {
      tools: ['analyzeData', 'generateReport', 'query'],
      temperature: 0.1,
      maxTokens: 1500,
    },
  })
}