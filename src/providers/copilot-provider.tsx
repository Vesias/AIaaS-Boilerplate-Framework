'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { CopilotKit } from '@copilotkit/react-core'
import { CopilotSidebar } from '@copilotkit/react-ui'
import { useUser } from '@clerk/nextjs'
import { useAI } from './ai-provider'
import { toast } from 'sonner'

// Types for CopilotKit context
export interface CopilotState {
  isInitialized: boolean
  isConnected: boolean
  isLoading: boolean
  error: string | null
  sessionId: string | null
  capabilities: string[]
  availableActions: string[]
  configuration: {
    model: string
    temperature: number
    maxTokens: number
    streaming: boolean
    publicApiKey?: string
    endpoint: string
  }
}

export interface CopilotContextValue {
  state: CopilotState
  
  // Actions
  initialize: () => Promise<void>
  disconnect: () => Promise<void>
  updateConfiguration: (config: Partial<CopilotState['configuration']>) => void
  
  // UI Components
  renderSidebar: (props?: any) => React.ReactNode
  renderChat: (props?: any) => React.ReactNode
  
  // Advanced features
  executeAction: (actionName: string, parameters: Record<string, any>) => Promise<any>
  getActionSchema: (actionName: string) => any
  registerCustomAction: (action: any) => void
  
  // Session management
  startNewSession: () => void
  exportSession: () => any
  importSession: (sessionData: any) => void
}

// Default configuration
const defaultConfiguration: CopilotState['configuration'] = {
  model: 'gpt-4',
  temperature: 0.7,
  maxTokens: 2000,
  streaming: true,
  endpoint: '/api/copilotkit',
}

// Context
const CopilotContext = createContext<CopilotContextValue | undefined>(undefined)

// Provider component
interface CopilotProviderProps {
  children: React.ReactNode
  configuration?: Partial<CopilotState['configuration']>
  autoInitialize?: boolean
  showSidebar?: boolean
  runtimeUrl?: string
}

export function CopilotProvider({ 
  children, 
  configuration = {},
  autoInitialize = true,
  showSidebar = false,
  runtimeUrl = '/api/copilotkit'
}: CopilotProviderProps) {
  const { user } = useUser()
  const { updateProviderStatus, trackUsage, state: aiState } = useAI()
  
  // State
  const [state, setState] = useState<CopilotState>({
    isInitialized: false,
    isConnected: false,
    isLoading: false,
    error: null,
    sessionId: null,
    capabilities: [
      'task_management',
      'invoice_generation',
      'workflow_automation',
      'data_analysis',
      'smart_recommendations'
    ],
    availableActions: [
      'createTask',
      'generateInvoice',
      'analyzeData',
      'triggerWorkflow',
      'getRecommendations'
    ],
    configuration: {
      ...defaultConfiguration,
      ...configuration,
    },
  })

  // Initialize CopilotKit
  const initialize = async (): Promise<void> => {
    if (state.isInitialized || state.isLoading) return

    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      // Check if user is authenticated
      if (!user) {
        throw new Error('User must be authenticated to use CopilotKit')
      }

      // Test connection to runtime
      const response = await fetch(runtimeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{
            role: 'system',
            content: 'Connection test'
          }]
        }),
      })

      if (!response.ok) {
        throw new Error(`CopilotKit runtime not available: ${response.statusText}`)
      }

      // Generate session ID
      const sessionId = `copilot-${user.id}-${Date.now()}`

      setState(prev => ({
        ...prev,
        isInitialized: true,
        isConnected: true,
        isLoading: false,
        sessionId,
      }))

      // Update global AI state
      updateProviderStatus('copilot', {
        enabled: true,
        connected: true,
        error: undefined,
      })

      toast.success('CopilotKit initialized successfully')

    } catch (error: any) {
      const errorMessage = error.message || 'Failed to initialize CopilotKit'
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }))

      updateProviderStatus('copilot', {
        enabled: true,
        connected: false,
        error: errorMessage,
      })

      toast.error(`CopilotKit: ${errorMessage}`)
      throw error
    }
  }

  // Disconnect CopilotKit
  const disconnect = async (): Promise<void> => {
    setState(prev => ({
      ...prev,
      isInitialized: false,
      isConnected: false,
      sessionId: null,
      error: null,
    }))

    updateProviderStatus('copilot', {
      enabled: false,
      connected: false,
    })

    toast.info('CopilotKit disconnected')
  }

  // Update configuration
  const updateConfiguration = (config: Partial<CopilotState['configuration']>) => {
    setState(prev => ({
      ...prev,
      configuration: {
        ...prev.configuration,
        ...config,
      },
    }))
  }

  // Execute action
  const executeAction = async (actionName: string, parameters: Record<string, any>): Promise<any> => {
    if (!state.isConnected) {
      throw new Error('CopilotKit not connected')
    }

    if (!state.availableActions.includes(actionName)) {
      throw new Error(`Action ${actionName} not available`)
    }

    try {
      const response = await fetch('/api/copilotkit/actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: actionName,
          parameters,
          sessionId: state.sessionId,
          userId: user?.id,
        }),
      })

      if (!response.ok) {
        throw new Error(`Action execution failed: ${response.statusText}`)
      }

      const result = await response.json()
      
      // Track usage
      const estimatedTokens = Math.ceil((JSON.stringify(parameters).length + JSON.stringify(result).length) / 4)
      const estimatedCost = estimatedTokens * 0.00002 // Rough GPT-4 pricing
      trackUsage('copilot', estimatedTokens, estimatedCost)

      return result

    } catch (error: any) {
      toast.error(`CopilotKit action failed: ${error.message}`)
      throw error
    }
  }

  // Get action schema
  const getActionSchema = (actionName: string): any => {
    const schemas: Record<string, any> = {
      createTask: {
        name: 'createTask',
        description: 'Create a new task for the user',
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Task title' },
            content: { type: 'string', description: 'Task description' },
            priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
            dueDate: { type: 'string', format: 'date-time' },
          },
          required: ['title'],
        },
      },
      generateInvoice: {
        name: 'generateInvoice',
        description: 'Generate and send an invoice',
        parameters: {
          type: 'object',
          properties: {
            customerEmail: { type: 'string', format: 'email' },
            customerName: { type: 'string' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  description: { type: 'string' },
                  quantity: { type: 'number' },
                  price: { type: 'number' },
                },
              },
            },
            currency: { type: 'string', default: 'EUR' },
          },
          required: ['customerEmail', 'customerName', 'items'],
        },
      },
      analyzeData: {
        name: 'analyzeData',
        description: 'Analyze user data and provide insights',
        parameters: {
          type: 'object',
          properties: {
            dataType: { type: 'string', enum: ['tasks', 'invoices', 'workflows'] },
            timeRange: { type: 'string', enum: ['day', 'week', 'month', 'year'] },
          },
          required: ['dataType'],
        },
      },
      triggerWorkflow: {
        name: 'triggerWorkflow',
        description: 'Trigger an automation workflow',
        parameters: {
          type: 'object',
          properties: {
            platform: { type: 'string', enum: ['n8n', 'make'] },
            workflowId: { type: 'string' },
            data: { type: 'object' },
          },
          required: ['platform'],
        },
      },
      getRecommendations: {
        name: 'getRecommendations',
        description: 'Get AI-powered recommendations',
        parameters: {
          type: 'object',
          properties: {
            category: { type: 'string', enum: ['productivity', 'automation', 'optimization'] },
            context: { type: 'object' },
          },
        },
      },
    }

    return schemas[actionName] || null
  }

  // Register custom action
  const registerCustomAction = (action: any) => {
    setState(prev => ({
      ...prev,
      availableActions: [...prev.availableActions, action.name],
    }))
  }

  // Session management
  const startNewSession = () => {
    const newSessionId = `copilot-${user?.id}-${Date.now()}`
    setState(prev => ({
      ...prev,
      sessionId: newSessionId,
    }))
  }

  const exportSession = () => {
    return {
      sessionId: state.sessionId,
      configuration: state.configuration,
      timestamp: new Date().toISOString(),
      userId: user?.id,
    }
  }

  const importSession = (sessionData: any) => {
    setState(prev => ({
      ...prev,
      sessionId: sessionData.sessionId,
      configuration: {
        ...prev.configuration,
        ...sessionData.configuration,
      },
    }))
  }

  // Render UI components
  const renderSidebar = (props: any = {}) => {
    if (!state.isConnected) return null

    return (
      <CopilotSidebar
        {...props}
        instructions="You are an AI assistant for Roomicor. Help users manage tasks, generate invoices, and automate workflows."
        defaultOpen={showSidebar}
        clickOutsideToClose
      />
    )
  }

  const renderChat = (props: any = {}) => {
    if (!state.isConnected) return null

    // This would render a custom chat interface
    return (
      <div className="copilot-chat" {...props}>
        {/* Custom chat implementation */}
      </div>
    )
  }

  // Auto-initialize on mount
  useEffect(() => {
    if (autoInitialize && user && aiState.isEnabled && !state.isInitialized) {
      initialize().catch(console.error)
    }
  }, [autoInitialize, user, aiState.isEnabled, state.isInitialized])

  // Handle user authentication changes
  useEffect(() => {
    if (!user && state.isConnected) {
      disconnect().catch(console.error)
    }
  }, [user, state.isConnected])

  // Context value
  const contextValue: CopilotContextValue = {
    state,
    
    // Actions
    initialize,
    disconnect,
    updateConfiguration,
    
    // UI Components
    renderSidebar,
    renderChat,
    
    // Advanced features
    executeAction,
    getActionSchema,
    registerCustomAction,
    
    // Session management
    startNewSession,
    exportSession,
    importSession,
  }

  // Wrap children with CopilotKit if connected
  const wrappedChildren = state.isConnected ? (
    <CopilotKit 
      runtimeUrl={runtimeUrl}
      agent="roomicor-assistant"
      publicApiKey={state.configuration.publicApiKey}
    >
      {children}
      {showSidebar && renderSidebar()}
    </CopilotKit>
  ) : (
    children
  )

  return (
    <CopilotContext.Provider value={contextValue}>
      {wrappedChildren}
    </CopilotContext.Provider>
  )
}

// Hook to use CopilotKit context
export function useCopilotProvider(): CopilotContextValue {
  const context = useContext(CopilotContext)
  if (context === undefined) {
    throw new Error('useCopilotProvider must be used within a CopilotProvider')
  }
  return context
}

// HOC for components that need CopilotKit
export function withCopilot<P extends object>(Component: React.ComponentType<P>) {
  return function CopilotWrappedComponent(props: P) {
    return (
      <CopilotProvider>
        <Component {...props} />
      </CopilotProvider>
    )
  }
}

// Custom hooks for specific CopilotKit features
export function useCopilotActions() {
  const { state, executeAction, getActionSchema, registerCustomAction } = useCopilotProvider()
  
  return {
    availableActions: state.availableActions,
    executeAction,
    getActionSchema,
    registerCustomAction,
    
    // Convenience methods for common actions
    createTask: (params: any) => executeAction('createTask', params),
    generateInvoice: (params: any) => executeAction('generateInvoice', params),
    analyzeData: (params: any) => executeAction('analyzeData', params),
    triggerWorkflow: (params: any) => executeAction('triggerWorkflow', params),
    getRecommendations: (params: any) => executeAction('getRecommendations', params),
  }
}

export function useCopilotSession() {
  const { state, startNewSession, exportSession, importSession } = useCopilotProvider()
  
  return {
    sessionId: state.sessionId,
    startNewSession,
    exportSession,
    importSession,
    isActive: !!state.sessionId,
  }
}

export function useCopilotConfiguration() {
  const { state, updateConfiguration } = useCopilotProvider()
  
  return {
    configuration: state.configuration,
    updateConfiguration,
    
    // Convenience setters
    setModel: (model: string) => updateConfiguration({ model }),
    setTemperature: (temperature: number) => updateConfiguration({ temperature }),
    setMaxTokens: (maxTokens: number) => updateConfiguration({ maxTokens }),
    toggleStreaming: () => updateConfiguration({ streaming: !state.configuration.streaming }),
  }
}

export function useCopilotStatus() {
  const { state, initialize, disconnect } = useCopilotProvider()
  
  return {
    isInitialized: state.isInitialized,
    isConnected: state.isConnected,
    isLoading: state.isLoading,
    error: state.error,
    capabilities: state.capabilities,
    
    // Control methods
    initialize,
    disconnect,
    
    // Status helpers
    isReady: state.isInitialized && state.isConnected && !state.error,
    hasError: !!state.error,
  }
}

// Enhanced CopilotKit wrapper component with error boundaries
interface CopilotWrapperProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  onError?: (error: Error) => void
}

export function CopilotWrapper({ children, fallback, onError }: CopilotWrapperProps) {
  const [hasError, setHasError] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const handleError = (error: Error) => {
      setHasError(true)
      setError(error)
      onError?.(error)
      toast.error(`CopilotKit Error: ${error.message}`)
    }

    // Global error handler for CopilotKit
    window.addEventListener('unhandledrejection', (event) => {
      if (event.reason?.message?.includes('copilot')) {
        handleError(event.reason)
      }
    })

    return () => {
      window.removeEventListener('unhandledrejection', handleError)
    }
  }, [onError])

  if (hasError) {
    return (
      fallback || (
        <div className="copilot-error-fallback p-4 border border-red-200 rounded-lg bg-red-50">
          <h3 className="text-red-800 font-semibold">CopilotKit Error</h3>
          <p className="text-red-600 text-sm mt-1">
            {error?.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={() => {
              setHasError(false)
              setError(null)
            }}
            className="mt-2 px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      )
    )
  }

  return <>{children}</>
}