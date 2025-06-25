'use client'

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { useUser } from '@clerk/nextjs'
import { useAI } from './ai-provider'
import { toast } from 'sonner'

// Types for AG-UI Provider
export interface AGUISession {
  id: string
  userId?: string
  status: 'initializing' | 'active' | 'paused' | 'completed' | 'error'
  startTime: Date
  lastActivity: Date
  metadata: Record<string, any>
  configuration: AGUIConfiguration
  stats: {
    messageCount: number
    toolCallCount: number
    tokensUsed: number
    cost: number
  }
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
  streaming?: boolean
  tokens?: number
  cost?: number
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
  provider?: string
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
  ui: {
    theme: 'light' | 'dark' | 'auto'
    showToolCalls: boolean
    showMetadata: boolean
    enableMarkdown: boolean
    enableCodeHighlighting: boolean
  }
}

export interface AGUICapability {
  name: string
  description: string
  enabled: boolean
  configuration?: Record<string, any>
}

export interface AGUIState {
  isInitialized: boolean
  sessions: AGUISession[]
  currentSession: AGUISession | null
  messages: AGUIMessage[]
  toolCalls: AGUIToolCall[]
  isConnected: boolean
  isLoading: boolean
  isStreaming: boolean
  streamContent: string
  error: string | null
  configuration: AGUIConfiguration
  availableModels: string[]
  availableTools: string[]
}

export interface AGUIContextValue {
  state: AGUIState
  
  // Session management
  createSession: (config?: Partial<AGUIConfiguration>) => Promise<AGUISession>
  switchSession: (sessionId: string) => void
  endSession: (sessionId?: string) => Promise<void>
  pauseSession: (sessionId?: string) => Promise<void>
  resumeSession: (sessionId?: string) => Promise<void>
  
  // Messaging
  sendMessage: (content: string, options?: {
    attachments?: File[]
    stream?: boolean
    tools?: string[]
  }) => Promise<void>
  sendStreamMessage: (content: string, onChunk?: (chunk: string) => void) => Promise<void>
  
  // Tool operations
  callTool: (name: string, args: Record<string, any>) => Promise<any>
  registerTool: (tool: any) => void
  unregisterTool: (toolName: string) => void
  
  // Configuration
  updateConfiguration: (config: Partial<AGUIConfiguration>) => Promise<void>
  updateSessionConfiguration: (sessionId: string, config: Partial<AGUIConfiguration>) => void
  
  // UI Controls
  clearMessages: () => void
  retryLastMessage: () => Promise<void>
  cancelCurrentOperation: () => void
  
  // Utilities
  exportSession: (sessionId?: string) => any
  importSession: (sessionData: any) => Promise<void>
  getSessionStats: (sessionId?: string) => any
  searchMessages: (query: string, sessionId?: string) => AGUIMessage[]
}

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
  streaming: true,
  safety: {
    contentFiltering: true,
    rateLimiting: true,
    maxRequestsPerMinute: 60,
  },
  ui: {
    theme: 'auto',
    showToolCalls: true,
    showMetadata: false,
    enableMarkdown: true,
    enableCodeHighlighting: true,
  },
}

// Context
const AGUIContext = createContext<AGUIContextValue | undefined>(undefined)

// Provider component
interface AGUIProviderProps {
  children: React.ReactNode
  configuration?: Partial<AGUIConfiguration>
  autoInitialize?: boolean
  endpoint?: string
}

export function AGUIProvider({ 
  children, 
  configuration = {},
  autoInitialize = true,
  endpoint = '/api/agui/stream'
}: AGUIProviderProps) {
  const { user } = useUser()
  const { updateProviderStatus, trackUsage, state: aiState } = useAI()
  
  // State
  const [state, setState] = useState<AGUIState>({
    isInitialized: false,
    sessions: [],
    currentSession: null,
    messages: [],
    toolCalls: [],
    isConnected: false,
    isLoading: false,
    isStreaming: false,
    streamContent: '',
    error: null,
    configuration: {
      ...defaultConfiguration,
      ...configuration,
    },
    availableModels: ['gpt-4o', 'gpt-4', 'gpt-3.5-turbo', 'claude-3-opus', 'claude-3-sonnet'],
    availableTools: [
      'web_search', 'calculator', 'file_manager', 'database_query', 
      'email_sender', 'image_generator', 'code_executor', 'pdf_reader'
    ],
  })

  // Refs for streaming and cancellation
  const streamRef = useRef<ReadableStreamDefaultReader | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const retryQueueRef = useRef<Array<() => Promise<void>>>([])

  // Initialize AG-UI
  const initialize = useCallback(async () => {
    if (state.isInitialized) return

    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      // Test connection to AG-UI endpoint
      const response = await fetch(`${endpoint}/health`, {
        method: 'GET',
      })

      if (!response.ok) {
        throw new Error(`AG-UI service not available: ${response.statusText}`)
      }

      const healthData = await response.json()

      setState(prev => ({
        ...prev,
        isInitialized: true,
        isConnected: true,
        isLoading: false,
        availableModels: healthData.availableModels || prev.availableModels,
        availableTools: healthData.availableTools || prev.availableTools,
      }))

      updateProviderStatus('agui', {
        enabled: true,
        connected: true,
        sessionId: undefined,
      })

      toast.success('AG-UI initialized successfully')

    } catch (error: any) {
      const errorMessage = error.message || 'Failed to initialize AG-UI'
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }))

      updateProviderStatus('agui', {
        enabled: true,
        connected: false,
        error: errorMessage,
      })

      toast.error(`AG-UI: ${errorMessage}`)
    }
  }, [state.isInitialized, endpoint, updateProviderStatus])

  // Create new session
  const createSession = useCallback(async (config: Partial<AGUIConfiguration> = {}): Promise<AGUISession> => {
    if (!state.isConnected) {
      await initialize()
    }

    try {
      const sessionConfig = {
        ...state.configuration,
        ...config,
      }

      const response = await fetch(`${endpoint}/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user?.id,
          configuration: sessionConfig,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create AG-UI session')
      }

      const sessionData = await response.json()
      const session: AGUISession = {
        id: sessionData.id,
        userId: user?.id,
        status: 'active',
        startTime: new Date(),
        lastActivity: new Date(),
        metadata: sessionData.metadata || {},
        configuration: sessionConfig,
        stats: {
          messageCount: 0,
          toolCallCount: 0,
          tokensUsed: 0,
          cost: 0,
        },
      }

      setState(prev => ({
        ...prev,
        sessions: [...prev.sessions, session],
        currentSession: session,
        messages: [],
        toolCalls: [],
        streamContent: '',
        error: null,
      }))

      updateProviderStatus('agui', {
        enabled: true,
        connected: true,
        sessionId: session.id,
      })

      toast.success('New AG-UI session created')
      return session

    } catch (error: any) {
      toast.error(`Failed to create session: ${error.message}`)
      throw error
    }
  }, [state.isConnected, state.configuration, endpoint, user, initialize, updateProviderStatus])

  // Switch session
  const switchSession = useCallback((sessionId: string) => {
    const session = state.sessions.find(s => s.id === sessionId)
    if (!session) {
      toast.error('Session not found')
      return
    }

    setState(prev => ({
      ...prev,
      currentSession: session,
      messages: [], // Would load from session storage
      toolCalls: [],
      streamContent: '',
    }))

    updateProviderStatus('agui', {
      sessionId,
    })
  }, [state.sessions, updateProviderStatus])

  // End session
  const endSession = useCallback(async (sessionId?: string): Promise<void> => {
    const targetSessionId = sessionId || state.currentSession?.id
    if (!targetSessionId) return

    try {
      await fetch(`${endpoint}/session/${targetSessionId}`, {
        method: 'DELETE',
      })

      setState(prev => ({
        ...prev,
        sessions: prev.sessions.filter(s => s.id !== targetSessionId),
        currentSession: prev.currentSession?.id === targetSessionId ? null : prev.currentSession,
        messages: prev.currentSession?.id === targetSessionId ? [] : prev.messages,
        toolCalls: prev.currentSession?.id === targetSessionId ? [] : prev.toolCalls,
      }))

      toast.success('Session ended')

    } catch (error: any) {
      toast.error(`Failed to end session: ${error.message}`)
    }
  }, [state.currentSession, endpoint])

  // Pause session
  const pauseSession = useCallback(async (sessionId?: string): Promise<void> => {
    const targetSessionId = sessionId || state.currentSession?.id
    if (!targetSessionId) return

    try {
      await fetch(`${endpoint}/session/${targetSessionId}/pause`, {
        method: 'POST',
      })

      setState(prev => ({
        ...prev,
        sessions: prev.sessions.map(s =>
          s.id === targetSessionId ? { ...s, status: 'paused' } : s
        ),
        currentSession: prev.currentSession?.id === targetSessionId 
          ? { ...prev.currentSession, status: 'paused' } 
          : prev.currentSession,
      }))

    } catch (error: any) {
      toast.error(`Failed to pause session: ${error.message}`)
    }
  }, [state.currentSession, endpoint])

  // Resume session
  const resumeSession = useCallback(async (sessionId?: string): Promise<void> => {
    const targetSessionId = sessionId || state.currentSession?.id
    if (!targetSessionId) return

    try {
      await fetch(`${endpoint}/session/${targetSessionId}/resume`, {
        method: 'POST',
      })

      setState(prev => ({
        ...prev,
        sessions: prev.sessions.map(s =>
          s.id === targetSessionId ? { ...s, status: 'active' } : s
        ),
        currentSession: prev.currentSession?.id === targetSessionId 
          ? { ...prev.currentSession, status: 'active' } 
          : prev.currentSession,
      }))

    } catch (error: any) {
      toast.error(`Failed to resume session: ${error.message}`)
    }
  }, [state.currentSession, endpoint])

  // Send message
  const sendMessage = useCallback(async (
    content: string,
    options: {
      attachments?: File[]
      stream?: boolean
      tools?: string[]
    } = {}
  ): Promise<void> => {
    if (!state.currentSession || !content.trim()) return

    const userMessage: AGUIMessage = {
      id: `user-${Date.now()}`,
      sessionId: state.currentSession.id,
      type: 'user',
      content: content.trim(),
      timestamp: new Date(),
      attachments: options.attachments ? await processAttachments(options.attachments) : undefined,
    }

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      isLoading: true,
      error: null,
      streamContent: '',
    }))

    // Create abort controller
    abortControllerRef.current = new AbortController()

    try {
      const formData = new FormData()
      formData.append('message', content)
      formData.append('sessionId', state.currentSession.id)
      formData.append('stream', String(options.stream ?? state.configuration.streaming))
      
      if (options.tools) {
        formData.append('tools', JSON.stringify(options.tools))
      }
      
      if (options.attachments) {
        options.attachments.forEach((file, index) => {
          formData.append(`attachment_${index}`, file)
        })
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        throw new Error(`Request failed: ${response.statusText}`)
      }

      if (options.stream ?? state.configuration.streaming) {
        await handleStreamingResponse(response.body!)
      } else {
        const result = await response.json()
        handleDirectResponse(result)
      }

    } catch (error: any) {
      if (error.name === 'AbortError') {
        return // Request was cancelled
      }
      
      const errorMessage = error.message || 'Failed to send message'
      setState(prev => ({ ...prev, error: errorMessage }))
      toast.error(errorMessage)
    } finally {
      setState(prev => ({ ...prev, isLoading: false }))
      abortControllerRef.current = null
    }
  }, [state.currentSession, state.configuration.streaming, endpoint])

  // Handle streaming response
  const handleStreamingResponse = useCallback(async (body: ReadableStream): Promise<void> => {
    setState(prev => ({ ...prev, isStreaming: true }))
    streamRef.current = body.getReader()
    
    const decoder = new TextDecoder()
    let accumulatedContent = ''

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
                sessionId: state.currentSession!.id,
                type: 'assistant',
                content: accumulatedContent,
                timestamp: new Date(),
                streaming: false,
              }
              
              setState(prev => ({
                ...prev,
                messages: [...prev.messages, assistantMessage],
                streamContent: '',
              }))
              
              updateSessionStats(assistantMessage)
              return
            }

            try {
              const parsed = JSON.parse(data)
              
              if (parsed.type === 'content') {
                accumulatedContent += parsed.content
                setState(prev => ({ ...prev, streamContent: accumulatedContent }))
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
        setState(prev => ({ ...prev, error: error.message }))
      }
    } finally {
      setState(prev => ({ ...prev, isStreaming: false }))
      streamRef.current = null
    }
  }, [state.currentSession])

  // Handle direct response
  const handleDirectResponse = useCallback((result: any) => {
    if (result.message) {
      const assistantMessage: AGUIMessage = {
        id: `assistant-${Date.now()}`,
        sessionId: state.currentSession!.id,
        type: 'assistant',
        content: result.message,
        timestamp: new Date(),
        toolCalls: result.toolCalls,
        tokens: result.tokens,
        cost: result.cost,
      }
      
      setState(prev => ({
        ...prev,
        messages: [...prev.messages, assistantMessage],
      }))
      
      updateSessionStats(assistantMessage)
    }

    if (result.toolCalls) {
      result.toolCalls.forEach(handleToolCall)
    }
  }, [state.currentSession])

  // Handle tool call
  const handleToolCall = useCallback((toolCall: AGUIToolCall) => {
    setState(prev => ({
      ...prev,
      toolCalls: prev.toolCalls.some(tc => tc.id === toolCall.id)
        ? prev.toolCalls.map(tc => tc.id === toolCall.id ? { ...tc, ...toolCall } : tc)
        : [...prev.toolCalls, toolCall],
    }))
  }, [])

  // Update session stats
  const updateSessionStats = useCallback((message: AGUIMessage) => {
    if (!state.currentSession) return

    setState(prev => ({
      ...prev,
      sessions: prev.sessions.map(s =>
        s.id === state.currentSession!.id
          ? {
              ...s,
              stats: {
                ...s.stats,
                messageCount: s.stats.messageCount + 1,
                tokensUsed: s.stats.tokensUsed + (message.tokens || 0),
                cost: s.stats.cost + (message.cost || 0),
              },
              lastActivity: new Date(),
            }
          : s
      ),
      currentSession: {
        ...prev.currentSession!,
        stats: {
          ...prev.currentSession!.stats,
          messageCount: prev.currentSession!.stats.messageCount + 1,
          tokensUsed: prev.currentSession!.stats.tokensUsed + (message.tokens || 0),
          cost: prev.currentSession!.stats.cost + (message.cost || 0),
        },
        lastActivity: new Date(),
      },
    }))

    // Track usage globally
    if (message.tokens || message.cost) {
      trackUsage('agui', message.tokens || 0, message.cost || 0)
    }
  }, [state.currentSession, trackUsage])

  // Process attachments
  const processAttachments = useCallback(async (files: File[]): Promise<AGUIAttachment[]> => {
    return Promise.all(files.map(async (file, index) => ({
      id: `attachment-${Date.now()}-${index}`,
      type: file.type.startsWith('image/') ? 'image' as const : 'file' as const,
      name: file.name,
      url: URL.createObjectURL(file),
      size: file.size,
      mimeType: file.type,
      metadata: {
        lastModified: file.lastModified,
      },
    })))
  }, [])

  // Send stream message with callback
  const sendStreamMessage = useCallback(async (
    content: string,
    onChunk?: (chunk: string) => void
  ): Promise<void> => {
    return sendMessage(content, {
      stream: true,
    })
  }, [sendMessage])

  // Call tool directly
  const callTool = useCallback(async (name: string, args: Record<string, any>): Promise<any> => {
    if (!state.currentSession) {
      throw new Error('No active session')
    }

    try {
      const response = await fetch(`${endpoint}/tools`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: state.currentSession.id,
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
  }, [state.currentSession, endpoint])

  // Register tool
  const registerTool = useCallback((tool: any) => {
    setState(prev => ({
      ...prev,
      availableTools: [...prev.availableTools, tool.name],
    }))
  }, [])

  // Unregister tool
  const unregisterTool = useCallback((toolName: string) => {
    setState(prev => ({
      ...prev,
      availableTools: prev.availableTools.filter(t => t !== toolName),
    }))
  }, [])

  // Update configuration
  const updateConfiguration = useCallback(async (config: Partial<AGUIConfiguration>): Promise<void> => {
    setState(prev => ({
      ...prev,
      configuration: { ...prev.configuration, ...config },
    }))

    if (state.currentSession) {
      try {
        await fetch(`${endpoint}/session/${state.currentSession.id}/config`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(config),
        })
      } catch (error: any) {
        toast.error(`Failed to update session config: ${error.message}`)
      }
    }
  }, [state.currentSession, endpoint])

  // Update session configuration
  const updateSessionConfiguration = useCallback((sessionId: string, config: Partial<AGUIConfiguration>) => {
    setState(prev => ({
      ...prev,
      sessions: prev.sessions.map(s =>
        s.id === sessionId 
          ? { ...s, configuration: { ...s.configuration, ...config } }
          : s
      ),
    }))
  }, [])

  // Clear messages
  const clearMessages = useCallback(() => {
    setState(prev => ({
      ...prev,
      messages: [],
      toolCalls: [],
      streamContent: '',
      error: null,
    }))
  }, [])

  // Retry last message
  const retryLastMessage = useCallback(async (): Promise<void> => {
    const lastUserMessage = state.messages
      .filter(m => m.type === 'user')
      .pop()
    
    if (lastUserMessage) {
      await sendMessage(lastUserMessage.content)
    }
  }, [state.messages, sendMessage])

  // Cancel current operation
  const cancelCurrentOperation = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    if (streamRef.current) {
      streamRef.current.cancel()
    }
    setState(prev => ({
      ...prev,
      isLoading: false,
      isStreaming: false,
    }))
  }, [])

  // Export session
  const exportSession = useCallback((sessionId?: string) => {
    const targetSession = sessionId 
      ? state.sessions.find(s => s.id === sessionId)
      : state.currentSession

    if (!targetSession) return null

    return {
      session: targetSession,
      messages: state.messages,
      toolCalls: state.toolCalls,
      timestamp: new Date().toISOString(),
    }
  }, [state.sessions, state.currentSession, state.messages, state.toolCalls])

  // Import session
  const importSession = useCallback(async (sessionData: any): Promise<void> => {
    if (sessionData.session) {
      setState(prev => ({
        ...prev,
        sessions: [...prev.sessions, sessionData.session],
        currentSession: sessionData.session,
        messages: sessionData.messages || [],
        toolCalls: sessionData.toolCalls || [],
      }))
    }
  }, [])

  // Get session stats
  const getSessionStats = useCallback((sessionId?: string) => {
    const targetSession = sessionId 
      ? state.sessions.find(s => s.id === sessionId)
      : state.currentSession

    return targetSession?.stats || {
      messageCount: 0,
      toolCallCount: 0,
      tokensUsed: 0,
      cost: 0,
    }
  }, [state.sessions, state.currentSession])

  // Search messages
  const searchMessages = useCallback((query: string, sessionId?: string): AGUIMessage[] => {
    const messages = sessionId 
      ? [] // Would need to load from session storage
      : state.messages

    return messages.filter(message =>
      message.content.toLowerCase().includes(query.toLowerCase()) ||
      message.metadata?.tags?.some((tag: string) => tag.toLowerCase().includes(query.toLowerCase()))
    )
  }, [state.messages])

  // Auto-initialize
  useEffect(() => {
    if (autoInitialize && user && aiState.isEnabled && !state.isInitialized) {
      initialize()
    }
  }, [autoInitialize, user, aiState.isEnabled, state.isInitialized, initialize])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.cancel()
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  const contextValue: AGUIContextValue = {
    state,
    
    // Session management
    createSession,
    switchSession,
    endSession,
    pauseSession,
    resumeSession,
    
    // Messaging
    sendMessage,
    sendStreamMessage,
    
    // Tool operations
    callTool,
    registerTool,
    unregisterTool,
    
    // Configuration
    updateConfiguration,
    updateSessionConfiguration,
    
    // UI Controls
    clearMessages,
    retryLastMessage,
    cancelCurrentOperation,
    
    // Utilities
    exportSession,
    importSession,
    getSessionStats,
    searchMessages,
  }

  return (
    <AGUIContext.Provider value={contextValue}>
      {children}
    </AGUIContext.Provider>
  )
}

// Hook to use AG-UI context
export function useAGUIProvider(): AGUIContextValue {
  const context = useContext(AGUIContext)
  if (context === undefined) {
    throw new Error('useAGUIProvider must be used within an AGUIProvider')
  }
  return context
}

// Custom hooks for specific AG-UI features
export function useAGUISessions() {
  const { state, createSession, switchSession, endSession } = useAGUIProvider()
  
  return {
    sessions: state.sessions,
    currentSession: state.currentSession,
    createSession,
    switchSession,
    endSession,
    hasActiveSession: !!state.currentSession,
  }
}

export function useAGUIMessages() {
  const { state, sendMessage, clearMessages, retryLastMessage } = useAGUIProvider()
  
  return {
    messages: state.messages,
    isLoading: state.isLoading,
    isStreaming: state.isStreaming,
    streamContent: state.streamContent,
    sendMessage,
    clearMessages,
    retryLastMessage,
  }
}

export function useAGUITools() {
  const { state, callTool, registerTool, unregisterTool } = useAGUIProvider()
  
  return {
    availableTools: state.availableTools,
    toolCalls: state.toolCalls,
    callTool,
    registerTool,
    unregisterTool,
  }
}

export function useAGUIConfiguration() {
  const { state, updateConfiguration } = useAGUIProvider()
  
  return {
    configuration: state.configuration,
    updateConfiguration,
    availableModels: state.availableModels,
  }
}