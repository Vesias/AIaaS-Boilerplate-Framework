'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { AgentSession, AgentMessage, ToolCall, AgentClientConfig } from '@/lib/ag-ui-client'

export interface UseAgentOptions extends AgentClientConfig {
  onMessage?: (message: AgentMessage) => void
  onToolCall?: (toolCall: ToolCall) => void
  onToolResult?: (toolCall: ToolCall) => void
  onError?: (error: any) => void
  onConnect?: () => void
  onDisconnect?: () => void
  onProcessingStart?: () => void
  onProcessingEnd?: () => void
  autoConnect?: boolean
  persistMessages?: boolean
}

export interface UseAgentReturn {
  // Connection state
  connected: boolean
  connecting: boolean
  
  // Message state
  messages: AgentMessage[]
  
  // Tool state
  toolCalls: ToolCall[]
  pendingToolCalls: ToolCall[]
  
  // Processing state
  isProcessing: boolean
  
  // Actions
  sendMessage: (content: string, metadata?: Record<string, any>) => Promise<void>
  callTool: (toolName: string, params: any) => Promise<string>
  requestCompletion: (prompt: string, options?: any) => Promise<void>
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  clearMessages: () => void
  removeMessage: (id: string) => void
  
  // Session
  session: AgentSession | null
  sessionId: string | null
  
  // Error state
  lastError: string | null
  clearError: () => void
}

export function useAgent(options: UseAgentOptions = {}): UseAgentReturn {
  const {
    onMessage,
    onToolCall,
    onToolResult,
    onError,
    onConnect,
    onDisconnect,
    onProcessingStart,
    onProcessingEnd,
    autoConnect = true,
    persistMessages = true,
    ...clientConfig
  } = options

  // State
  const [session, setSession] = useState<AgentSession | null>(null)
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)

  // Refs for stable callbacks
  const optionsRef = useRef(options)
  optionsRef.current = options

  // Initialize session
  useEffect(() => {
    if (autoConnect) {
      const agentSession = new AgentSession(clientConfig)
      setSession(agentSession)
      setSessionId(agentSession.id)

      // Set up event listeners
      const handleConnect = () => {
        setConnected(true)
        setConnecting(false)
        setLastError(null)
        optionsRef.current.onConnect?.()
      }

      const handleDisconnect = () => {
        setConnected(false)
        setConnecting(false)
        optionsRef.current.onDisconnect?.()
      }

      const handleMessage = (message: AgentMessage) => {
        if (persistMessages) {
          setMessages(prev => [...prev, message])
        }
        optionsRef.current.onMessage?.(message)
      }

      const handleToolCall = (toolCall: ToolCall) => {
        setToolCalls(prev => {
          const existingIndex = prev.findIndex(tc => tc.id === toolCall.id)
          if (existingIndex >= 0) {
            const updated = [...prev]
            updated[existingIndex] = { ...updated[existingIndex], ...toolCall }
            return updated
          }
          return [...prev, toolCall]
        })
        optionsRef.current.onToolCall?.(toolCall)
      }

      const handleToolResult = (toolCall: ToolCall) => {
        setToolCalls(prev => {
          const updated = prev.map(tc => 
            tc.id === toolCall.id ? { ...tc, ...toolCall } : tc
          )
          return updated
        })
        optionsRef.current.onToolResult?.(toolCall)
      }

      const handleError = (error: any) => {
        const errorMessage = typeof error === 'string' ? error : error.message || 'Unknown error'
        setLastError(errorMessage)
        setConnecting(false)
        optionsRef.current.onError?.(error)
      }

      const handleProcessingStart = () => {
        setIsProcessing(true)
        optionsRef.current.onProcessingStart?.()
      }

      const handleProcessingEnd = () => {
        setIsProcessing(false)
        optionsRef.current.onProcessingEnd?.()
      }

      const handleMessagesCleared = () => {
        setMessages([])
      }

      // Register event listeners
      agentSession.on('connected', handleConnect)
      agentSession.on('disconnected', handleDisconnect)
      agentSession.on('message', handleMessage)
      agentSession.on('toolCall', handleToolCall)
      agentSession.on('toolResult', handleToolResult)
      agentSession.on('error', handleError)
      agentSession.on('processingStart', handleProcessingStart)
      agentSession.on('processingEnd', handleProcessingEnd)
      agentSession.on('messagesCleared', handleMessagesCleared)

      // Auto-connect
      setConnecting(true)
      agentSession.connect().catch(handleError)

      // Cleanup function
      return () => {
        agentSession.off('connected', handleConnect)
        agentSession.off('disconnected', handleDisconnect)
        agentSession.off('message', handleMessage)
        agentSession.off('toolCall', handleToolCall)
        agentSession.off('toolResult', handleToolResult)
        agentSession.off('error', handleError)
        agentSession.off('processingStart', handleProcessingStart)
        agentSession.off('processingEnd', handleProcessingEnd)
        agentSession.off('messagesCleared', handleMessagesCleared)
        
        agentSession.disconnect().catch(console.warn)
      }
    }
  }, [autoConnect, persistMessages])

  // Actions
  const sendMessage = useCallback(async (content: string, metadata?: Record<string, any>) => {
    if (!session) {
      throw new Error('Agent session not initialized')
    }
    
    try {
      await session.sendMessage(content, metadata)
      setLastError(null)
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to send message'
      setLastError(errorMessage)
      throw error
    }
  }, [session])

  const callTool = useCallback(async (toolName: string, params: any): Promise<string> => {
    if (!session) {
      throw new Error('Agent session not initialized')
    }
    
    try {
      const toolCallId = await session.callTool(toolName, params)
      setLastError(null)
      return toolCallId
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to call tool'
      setLastError(errorMessage)
      throw error
    }
  }, [session])

  const requestCompletion = useCallback(async (prompt: string, options?: any) => {
    if (!session) {
      throw new Error('Agent session not initialized')
    }
    
    try {
      await session.requestCompletion(prompt, options)
      setLastError(null)
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to request completion'
      setLastError(errorMessage)
      throw error
    }
  }, [session])

  const connect = useCallback(async () => {
    if (!session) {
      throw new Error('Agent session not initialized')
    }
    
    if (connected || connecting) {
      return
    }
    
    try {
      setConnecting(true)
      await session.connect()
      setLastError(null)
    } catch (error: any) {
      setConnecting(false)
      const errorMessage = error.message || 'Failed to connect'
      setLastError(errorMessage)
      throw error
    }
  }, [session, connected, connecting])

  const disconnect = useCallback(async () => {
    if (!session) {
      return
    }
    
    try {
      await session.disconnect()
      setLastError(null)
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to disconnect'
      setLastError(errorMessage)
      console.warn('Error disconnecting:', error)
    }
  }, [session])

  const clearMessages = useCallback(() => {
    if (session) {
      session.clearMessages()
    } else {
      setMessages([])
    }
    setLastError(null)
  }, [session])

  const removeMessage = useCallback((id: string) => {
    if (session) {
      session.removeMessage(id)
    } else {
      setMessages(prev => prev.filter(msg => msg.id !== id))
    }
  }, [session])

  const clearError = useCallback(() => {
    setLastError(null)
  }, [])

  // Computed values
  const pendingToolCalls = toolCalls.filter(tc => 
    tc.status === 'pending' || tc.status === 'running'
  )

  return {
    // Connection state
    connected,
    connecting,
    
    // Message state
    messages,
    
    // Tool state
    toolCalls,
    pendingToolCalls,
    
    // Processing state
    isProcessing,
    
    // Actions
    sendMessage,
    callTool,
    requestCompletion,
    connect,
    disconnect,
    clearMessages,
    removeMessage,
    
    // Session
    session,
    sessionId,
    
    // Error state
    lastError,
    clearError,
  }
}

// Additional hooks for specific use cases

export function useAgentChat(options: UseAgentOptions = {}) {
  const agent = useAgent({
    ...options,
    persistMessages: true,
  })

  const chatMessages = agent.messages.filter(msg => 
    msg.type === 'user' || msg.type === 'agent'
  )

  return {
    ...agent,
    chatMessages,
  }
}

export function useAgentTools(options: UseAgentOptions = {}) {
  const agent = useAgent({
    ...options,
    persistMessages: false,
  })

  const executeTool = useCallback(async (toolName: string, params: any) => {
    const toolCallId = await agent.callTool(toolName, params)
    
    // Return a promise that resolves when the tool completes
    return new Promise<ToolCall>((resolve, reject) => {
      const checkCompletion = () => {
        const toolCall = agent.toolCalls.find(tc => tc.id === toolCallId)
        if (toolCall) {
          if (toolCall.status === 'completed') {
            resolve(toolCall)
          } else if (toolCall.status === 'failed') {
            reject(new Error(toolCall.error || 'Tool execution failed'))
          }
        }
      }

      // Check immediately in case it's already completed
      checkCompletion()

      // Set up polling for completion
      const interval = setInterval(checkCompletion, 100)
      
      // Clean up after 30 seconds
      setTimeout(() => {
        clearInterval(interval)
        reject(new Error('Tool execution timeout'))
      }, 30000)
    })
  }, [agent])

  return {
    ...agent,
    executeTool,
  }
}