'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useUser } from '@clerk/nextjs'
import { toast } from 'sonner'

// Types for AG-UI protocol
export interface AGUISession {
  id: string
  userId?: string
  status: 'initializing' | 'active' | 'paused' | 'completed' | 'error'
  startTime: Date
  lastActivity: Date
  metadata: Record<string, any>
  tools: string[]
  capabilities: string[]
  model: string
  temperature: number
  maxTokens: number
}

export interface AGUIMessage {
  id: string
  sessionId: string
  type: 'user' | 'assistant' | 'system' | 'tool' | 'error'
  content: string
  timestamp: Date
  metadata?: Record<string, any>
  toolCalls?: AGUIToolCall[]
  attachments?: AGUIAttachment[]
}

export interface AGUIToolCall {
  id: string
  name: string
  arguments: Record<string, any>
  result?: any
  status: 'pending' | 'running' | 'completed' | 'failed'
  startTime: Date
  endTime?: Date
  error?: string
}

export interface AGUIAttachment {
  id: string
  type: 'image' | 'document' | 'audio' | 'video' | 'file'
  name: string
  url: string
  size: number
  mimeType: string
  metadata?: Record<string, any>
}

export interface AGUICapability {
  name: string
  description: string
  enabled: boolean
  configuration?: Record<string, any>
}

export interface AGUIConfiguration {
  model: string
  temperature: number
  maxTokens: number
  systemPrompt?: string
  tools: string[]
  capabilities: AGUICapability[]
  streaming: boolean
  safety: {
    contentFiltering: boolean
    rateLimiting: boolean
    maxRequestsPerMinute: number
  }
}

export interface UseAGUIOptions {
  // Session configuration
  sessionId?: string
  autoStart?: boolean
  configuration?: Partial<AGUIConfiguration>
  
  // Connection options
  endpoint?: string
  timeout?: number
  retryAttempts?: number
  
  // Features
  enableStreaming?: boolean
  enableToolCalls?: boolean
  enableAttachments?: boolean
  enableHistory?: boolean
  
  // Callbacks
  onSessionStart?: (session: AGUISession) => void
  onSessionEnd?: (sessionId: string) => void
  onMessage?: (message: AGUIMessage) => void
  onToolCall?: (toolCall: AGUIToolCall) => void
  onError?: (error: any) => void
  onStreamChunk?: (chunk: string) => void
}

export interface UseAGUIReturn {
  // Session management
  session: AGUISession | null
  isActive: boolean
  isConnected: boolean
  
  // Message handling
  messages: AGUIMessage[]
  sendMessage: (content: string, attachments?: File[]) => Promise<void>
  clearMessages: () => void
  
  // Tool operations
  availableTools: string[]
  toolCalls: AGUIToolCall[]
  callTool: (name: string, args: Record<string, any>) => Promise<any>
  
  // Session control
  startSession: (config?: Partial<AGUIConfiguration>) => Promise<void>
  pauseSession: () => Promise<void>
  resumeSession: () => Promise<void>
  endSession: () => Promise<void>
  
  // Configuration
  updateConfiguration: (config: Partial<AGUIConfiguration>) => Promise<void>
  getConfiguration: () => AGUIConfiguration | null
  
  // Streaming
  isStreaming: boolean
  streamResponse: string
  
  // State
  isLoading: boolean
  error: string | null
  
  // Utilities
  exportSession: () => any
  importSession: (data: any) => Promise<void>
  getSessionStats: () => {
    messageCount: number
    toolCallCount: number
    duration: number
    tokensUsed: number
  }
}

/**
 * AG-UI Protocol Hook
 * Provides advanced AI agent interface with streaming, tools, and rich interactions
 */
export function useAGUI(options: UseAGUIOptions = {}): UseAGUIReturn {
  const {
    sessionId: initialSessionId,
    autoStart = true,
    configuration = {},
    endpoint = '/api/agui/stream',
    timeout = 30000,
    retryAttempts = 3,
    enableStreaming = true,
    enableToolCalls = true,
    enableAttachments = true,
    enableHistory = true,
    onSessionStart,
    onSessionEnd,
    onMessage,
    onToolCall,
    onError,
    onStreamChunk,
  } = options

  // Clerk user context
  const { user } = useUser()
  
  // State
  const [session, setSession] = useState<AGUISession | null>(null)
  const [messages, setMessages] = useState<AGUIMessage[]>([])
  const [toolCalls, setToolCalls] = useState<AGUIToolCall[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamResponse, setStreamResponse] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [configuration, setConfiguration] = useState<AGUIConfiguration | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  
  // Refs
  const streamRef = useRef<ReadableStreamDefaultReader | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Default configuration
  const defaultConfiguration: AGUIConfiguration = {
    model: 'gpt-4o',
    temperature: 0.7,
    maxTokens: 2000,
    systemPrompt: 'You are an AI assistant for Roomicor. Help users with tasks, automation, and business operations.',
    tools: ['web_search', 'calculator', 'file_manager', 'database_query', 'email_sender'],
    capabilities: [
      { name: 'web_access', description: 'Access web resources', enabled: true },
      { name: 'file_operations', description: 'Read and write files', enabled: true },
      { name: 'email_integration', description: 'Send emails', enabled: true },
      { name: 'database_access', description: 'Query databases', enabled: true },
      { name: 'automation_tools', description: 'Trigger workflows', enabled: true },
    ],
    streaming: enableStreaming,
    safety: {
      contentFiltering: true,
      rateLimiting: true,
      maxRequestsPerMinute: 60,
    },
  }

  // Initialize session
  const startSession = useCallback(async (config?: Partial<AGUIConfiguration>): Promise<void> => {
    if (session?.status === 'active') {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const sessionConfig = {
        ...defaultConfiguration,
        ...configuration,
        ...config,
      }

      const response = await fetch('/api/agui/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user?.id,
          sessionId: initialSessionId,
          configuration: sessionConfig,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to start AG-UI session')
      }

      const newSession: AGUISession = await response.json()
      
      setSession(newSession)
      setConfiguration(sessionConfig)
      setIsConnected(true)
      
      onSessionStart?.(newSession)
      toast.success('AI Assistant session started')

    } catch (error: any) {
      const errorMessage = error.message || 'Failed to start session'
      setError(errorMessage)
      onError?.(error)
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [session, user, initialSessionId, configuration, defaultConfiguration, onSessionStart, onError])

  // End session
  const endSession = useCallback(async (): Promise<void> => {
    if (!session) return

    try {
      // Clean up streaming
      if (streamRef.current) {
        await streamRef.current.cancel()
        streamRef.current = null
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }

      // End session on server
      await fetch(`/api/agui/session/${session.id}`, {
        method: 'DELETE',
      })

      onSessionEnd?.(session.id)
      setSession(null)
      setConfiguration(null)
      setIsConnected(false)
      
      toast.success('AI Assistant session ended')

    } catch (error: any) {
      console.error('Error ending session:', error)
    }
  }, [session, onSessionEnd])

  // Pause session
  const pauseSession = useCallback(async (): Promise<void> => {
    if (!session || session.status !== 'active') return

    try {
      await fetch(`/api/agui/session/${session.id}/pause`, {
        method: 'POST',
      })

      setSession(prev => prev ? { ...prev, status: 'paused' } : null)
      
    } catch (error: any) {
      console.error('Error pausing session:', error)
    }
  }, [session])

  // Resume session
  const resumeSession = useCallback(async (): Promise<void> => {
    if (!session || session.status !== 'paused') return

    try {
      await fetch(`/api/agui/session/${session.id}/resume`, {
        method: 'POST',
      })

      setSession(prev => prev ? { ...prev, status: 'active' } : null)
      
    } catch (error: any) {
      console.error('Error resuming session:', error)
    }
  }, [session])

  // Send message
  const sendMessage = useCallback(async (content: string, attachments?: File[]): Promise<void> => {
    if (!session || !content.trim()) return

    const userMessage: AGUIMessage = {
      id: `user-${Date.now()}`,
      sessionId: session.id,
      type: 'user',
      content: content.trim(),
      timestamp: new Date(),
      attachments: attachments ? await Promise.all(
        attachments.map(async (file, index) => ({
          id: `attachment-${Date.now()}-${index}`,
          type: file.type.startsWith('image/') ? 'image' as const : 'file' as const,
          name: file.name,
          url: URL.createObjectURL(file),
          size: file.size,
          mimeType: file.type,
        }))
      ) : undefined,
    }

    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)
    setError(null)
    setStreamResponse('')

    // Create abort controller for this request
    abortControllerRef.current = new AbortController()

    try {
      const formData = new FormData()
      formData.append('message', content)
      formData.append('sessionId', session.id)
      
      if (attachments) {
        attachments.forEach((file, index) => {
          formData.append(`attachment_${index}`, file)
        })
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      if (enableStreaming && response.body) {
        await handleStreamingResponse(response.body)
      } else {
        const result = await response.json()
        handleDirectResponse(result)
      }

      onMessage?.(userMessage)

    } catch (error: any) {
      if (error.name === 'AbortError') {
        return // Request was cancelled
      }
      
      const errorMessage = error.message || 'Failed to send message'
      setError(errorMessage)
      onError?.(error)
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
      abortControllerRef.current = null
    }
  }, [session, endpoint, enableStreaming, onMessage, onError])

  // Handle streaming response
  const handleStreamingResponse = useCallback(async (body: ReadableStream): Promise<void> => {
    setIsStreaming(true)
    streamRef.current = body.getReader()
    
    const decoder = new TextDecoder()
    let accumulatedResponse = ''

    try {
      while (true) {
        const { done, value } = await streamRef.current.read()
        
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            
            if (data === '[DONE]') {
              // Stream finished
              const assistantMessage: AGUIMessage = {
                id: `assistant-${Date.now()}`,
                sessionId: session!.id,
                type: 'assistant',
                content: accumulatedResponse,
                timestamp: new Date(),
              }
              
              setMessages(prev => [...prev, assistantMessage])
              onMessage?.(assistantMessage)
              setStreamResponse('')
              return
            }

            try {
              const parsed = JSON.parse(data)
              
              if (parsed.type === 'content') {
                accumulatedResponse += parsed.content
                setStreamResponse(accumulatedResponse)
                onStreamChunk?.(parsed.content)
              } else if (parsed.type === 'tool_call') {
                handleToolCall(parsed.tool_call)
              } else if (parsed.type === 'error') {
                throw new Error(parsed.error)
              }
            } catch (parseError) {
              console.warn('Failed to parse streaming data:', parseError)
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Streaming error:', error)
        setError(error.message)
      }
    } finally {
      setIsStreaming(false)
      streamRef.current = null
    }
  }, [session, onMessage, onStreamChunk])

  // Handle direct response
  const handleDirectResponse = useCallback((result: any) => {
    if (result.message) {
      const assistantMessage: AGUIMessage = {
        id: `assistant-${Date.now()}`,
        sessionId: session!.id,
        type: 'assistant',
        content: result.message,
        timestamp: new Date(),
        toolCalls: result.toolCalls,
      }
      
      setMessages(prev => [...prev, assistantMessage])
      onMessage?.(assistantMessage)
    }

    if (result.toolCalls) {
      result.toolCalls.forEach((toolCall: AGUIToolCall) => {
        handleToolCall(toolCall)
      })
    }
  }, [session, onMessage])

  // Handle tool call
  const handleToolCall = useCallback((toolCall: AGUIToolCall) => {
    setToolCalls(prev => {
      const existingIndex = prev.findIndex(tc => tc.id === toolCall.id)
      if (existingIndex >= 0) {
        const updated = [...prev]
        updated[existingIndex] = { ...updated[existingIndex], ...toolCall }
        return updated
      }
      return [...prev, toolCall]
    })
    
    onToolCall?.(toolCall)
  }, [onToolCall])

  // Call tool directly
  const callTool = useCallback(async (name: string, args: Record<string, any>): Promise<any> => {
    if (!session || !enableToolCalls) {
      throw new Error('Tool calls not available')
    }

    try {
      const response = await fetch('/api/agui/tools', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: session.id,
          toolName: name,
          arguments: args,
        }),
      })

      if (!response.ok) {
        throw new Error(`Tool call failed: ${response.statusText}`)
      }

      const result = await response.json()
      return result.result
      
    } catch (error: any) {
      toast.error(`Tool call failed: ${error.message}`)
      throw error
    }
  }, [session, enableToolCalls])

  // Clear messages
  const clearMessages = useCallback(() => {
    setMessages([])
    setToolCalls([])
    setStreamResponse('')
    setError(null)
  }, [])

  // Update configuration
  const updateConfiguration = useCallback(async (config: Partial<AGUIConfiguration>): Promise<void> => {
    if (!session) return

    try {
      const response = await fetch(`/api/agui/session/${session.id}/config`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      })

      if (!response.ok) {
        throw new Error('Failed to update configuration')
      }

      const updatedConfig = await response.json()
      setConfiguration(updatedConfig)
      
    } catch (error: any) {
      toast.error(`Configuration update failed: ${error.message}`)
    }
  }, [session])

  // Get configuration
  const getConfiguration = useCallback((): AGUIConfiguration | null => {
    return configuration
  }, [configuration])

  // Export session
  const exportSession = useCallback(() => {
    if (!session) return null

    return {
      session,
      messages,
      toolCalls,
      configuration,
      timestamp: new Date().toISOString(),
    }
  }, [session, messages, toolCalls, configuration])

  // Import session
  const importSession = useCallback(async (data: any): Promise<void> => {
    if (data.session) {
      setSession(data.session)
    }
    if (data.messages) {
      setMessages(data.messages)
    }
    if (data.toolCalls) {
      setToolCalls(data.toolCalls)
    }
    if (data.configuration) {
      setConfiguration(data.configuration)
    }
  }, [])

  // Get session stats
  const getSessionStats = useCallback(() => {
    if (!session) {
      return {
        messageCount: 0,
        toolCallCount: 0,
        duration: 0,
        tokensUsed: 0,
      }
    }

    const duration = Date.now() - session.startTime.getTime()
    const tokensUsed = messages.reduce((total, msg) => {
      return total + Math.ceil(msg.content.length / 4) // Rough token estimation
    }, 0)

    return {
      messageCount: messages.length,
      toolCallCount: toolCalls.length,
      duration,
      tokensUsed,
    }
  }, [session, messages, toolCalls])

  // Auto-start session
  useEffect(() => {
    if (autoStart && user && !session) {
      startSession().catch(console.error)
    }
  }, [autoStart, user, session, startSession])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.cancel().catch(console.error)
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [])

  // Computed values
  const isActive = session?.status === 'active'
  const availableTools = configuration?.tools || []

  return {
    // Session management
    session,
    isActive,
    isConnected,
    
    // Message handling
    messages,
    sendMessage,
    clearMessages,
    
    // Tool operations
    availableTools,
    toolCalls,
    callTool,
    
    // Session control
    startSession,
    pauseSession,
    resumeSession,
    endSession,
    
    // Configuration
    updateConfiguration,
    getConfiguration,
    
    // Streaming
    isStreaming,
    streamResponse,
    
    // State
    isLoading,
    error,
    
    // Utilities
    exportSession,
    importSession,
    getSessionStats,
  }
}

/**
 * Specialized hook for document processing with AG-UI
 */
export function useAGUIDocuments() {
  const agui = useAGUI({
    configuration: {
      tools: ['document_analyzer', 'pdf_reader', 'text_extractor', 'summarizer'],
      capabilities: [
        { name: 'document_processing', description: 'Process documents', enabled: true },
        { name: 'text_analysis', description: 'Analyze text content', enabled: true },
      ],
    },
  })

  const processDocument = useCallback(async (file: File): Promise<any> => {
    return agui.callTool('document_analyzer', { file })
  }, [agui])

  const summarizeText = useCallback(async (text: string): Promise<string> => {
    const result = await agui.callTool('summarizer', { text })
    return result.summary
  }, [agui])

  return {
    ...agui,
    processDocument,
    summarizeText,
  }
}

/**
 * Specialized hook for data analysis with AG-UI
 */
export function useAGUIAnalytics() {
  const agui = useAGUI({
    configuration: {
      tools: ['data_analyzer', 'chart_generator', 'statistics_calculator', 'report_generator'],
      capabilities: [
        { name: 'data_analysis', description: 'Analyze data sets', enabled: true },
        { name: 'visualization', description: 'Create charts and graphs', enabled: true },
      ],
    },
  })

  const analyzeData = useCallback(async (data: any[]): Promise<any> => {
    return agui.callTool('data_analyzer', { data })
  }, [agui])

  const generateChart = useCallback(async (data: any[], chartType: string): Promise<any> => {
    return agui.callTool('chart_generator', { data, chartType })
  }, [agui])

  const generateReport = useCallback(async (data: any[], template?: string): Promise<string> => {
    const result = await agui.callTool('report_generator', { data, template })
    return result.report
  }, [agui])

  return {
    ...agui,
    analyzeData,
    generateChart,
    generateReport,
  }
}