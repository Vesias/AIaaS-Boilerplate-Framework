'use client'

import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { toast } from 'sonner'

// Types for global AI state management
export interface AIState {
  // Global settings
  isEnabled: boolean
  defaultProvider: 'copilot' | 'mcp' | 'agui' | 'a2a' | 'openai' | 'anthropic'
  preferredModel: string
  temperature: number
  maxTokens: number
  
  // Provider status
  providers: {
    copilot: { enabled: boolean; connected: boolean; error?: string }
    mcp: { enabled: boolean; connected: boolean; servers: number; error?: string }
    agui: { enabled: boolean; connected: boolean; sessionId?: string; error?: string }
    a2a: { enabled: boolean; connected: boolean; agents: number; error?: string }
  }
  
  // Global features
  features: {
    streaming: boolean
    toolCalls: boolean
    attachments: boolean
    multiProvider: boolean
    costOptimization: boolean
    autoFallback: boolean
    contextPersistence: boolean
  }
  
  // Usage tracking
  usage: {
    totalTokens: number
    totalCost: number
    requestCount: number
    errorCount: number
    providerUsage: Record<string, { tokens: number; cost: number; requests: number }>
  }
  
  // Session management
  sessions: {
    current?: string
    active: string[]
    history: Array<{
      id: string
      provider: string
      startTime: Date
      endTime?: Date
      messageCount: number
      tokenUsage: number
    }>
  }
  
  // Configuration
  config: {
    apiKeys: Record<string, string>
    endpoints: Record<string, string>
    timeouts: Record<string, number>
    retryLimits: Record<string, number>
    rateLimits: Record<string, { requests: number; window: number }>
  }
  
  // User preferences
  preferences: {
    theme: 'light' | 'dark' | 'auto'
    language: string
    notifications: boolean
    analytics: boolean
    dataSharing: boolean
  }
}

export interface AIAction {
  type: 'SET_ENABLED' | 'SET_PROVIDER' | 'UPDATE_PROVIDER_STATUS' | 'UPDATE_FEATURES' | 
       'UPDATE_USAGE' | 'ADD_SESSION' | 'END_SESSION' | 'UPDATE_CONFIG' | 'UPDATE_PREFERENCES' |
       'RESET_STATE' | 'IMPORT_STATE'
  payload: any
}

export interface AIContextValue {
  state: AIState
  dispatch: React.Dispatch<AIAction>
  
  // Actions
  enableAI: () => void
  disableAI: () => void
  setDefaultProvider: (provider: AIState['defaultProvider']) => void
  updateProviderStatus: (provider: string, status: Partial<AIState['providers'][keyof AIState['providers']]>) => void
  updateFeatures: (features: Partial<AIState['features']>) => void
  trackUsage: (provider: string, tokens: number, cost: number) => void
  startSession: (provider: string) => string
  endSession: (sessionId: string) => void
  updateConfig: (config: Partial<AIState['config']>) => void
  updatePreferences: (preferences: Partial<AIState['preferences']>) => void
  
  // Utilities
  getProviderStatus: (provider: string) => AIState['providers'][keyof AIState['providers']] | null
  getTotalCost: () => number
  getTotalTokens: () => number
  getActiveProviders: () => string[]
  exportState: () => AIState
  importState: (state: Partial<AIState>) => void
  resetState: () => void
}

// Initial state
const initialState: AIState = {
  isEnabled: true,
  defaultProvider: 'copilot',
  preferredModel: 'gpt-4',
  temperature: 0.7,
  maxTokens: 2000,
  
  providers: {
    copilot: { enabled: true, connected: false },
    mcp: { enabled: true, connected: false, servers: 0 },
    agui: { enabled: true, connected: false },
    a2a: { enabled: true, connected: false, agents: 0 },
  },
  
  features: {
    streaming: true,
    toolCalls: true,
    attachments: true,
    multiProvider: true,
    costOptimization: true,
    autoFallback: true,
    contextPersistence: true,
  },
  
  usage: {
    totalTokens: 0,
    totalCost: 0,
    requestCount: 0,
    errorCount: 0,
    providerUsage: {},
  },
  
  sessions: {
    active: [],
    history: [],
  },
  
  config: {
    apiKeys: {},
    endpoints: {
      copilot: '/api/copilotkit',
      mcp: '/api/mcp',
      agui: '/api/agui/stream',
      a2a: '/api/a2a',
      openai: 'https://api.openai.com/v1',
      anthropic: 'https://api.anthropic.com/v1',
    },
    timeouts: {
      copilot: 30000,
      mcp: 15000,
      agui: 45000,
      a2a: 20000,
    },
    retryLimits: {
      copilot: 3,
      mcp: 2,
      agui: 3,
      a2a: 2,
    },
    rateLimits: {
      copilot: { requests: 60, window: 60000 },
      mcp: { requests: 100, window: 60000 },
      agui: { requests: 30, window: 60000 },
      a2a: { requests: 50, window: 60000 },
    },
  },
  
  preferences: {
    theme: 'auto',
    language: 'en',
    notifications: true,
    analytics: true,
    dataSharing: false,
  },
}

// Reducer
function aiReducer(state: AIState, action: AIAction): AIState {
  switch (action.type) {
    case 'SET_ENABLED':
      return { ...state, isEnabled: action.payload }
    
    case 'SET_PROVIDER':
      return { ...state, defaultProvider: action.payload }
    
    case 'UPDATE_PROVIDER_STATUS':
      return {
        ...state,
        providers: {
          ...state.providers,
          [action.payload.provider]: {
            ...state.providers[action.payload.provider as keyof typeof state.providers],
            ...action.payload.status,
          },
        },
      }
    
    case 'UPDATE_FEATURES':
      return {
        ...state,
        features: { ...state.features, ...action.payload },
      }
    
    case 'UPDATE_USAGE':
      const { provider, tokens, cost } = action.payload
      return {
        ...state,
        usage: {
          totalTokens: state.usage.totalTokens + tokens,
          totalCost: state.usage.totalCost + cost,
          requestCount: state.usage.requestCount + 1,
          errorCount: state.usage.errorCount,
          providerUsage: {
            ...state.usage.providerUsage,
            [provider]: {
              tokens: (state.usage.providerUsage[provider]?.tokens || 0) + tokens,
              cost: (state.usage.providerUsage[provider]?.cost || 0) + cost,
              requests: (state.usage.providerUsage[provider]?.requests || 0) + 1,
            },
          },
        },
      }
    
    case 'ADD_SESSION':
      return {
        ...state,
        sessions: {
          ...state.sessions,
          current: action.payload.id,
          active: [...state.sessions.active, action.payload.id],
          history: [...state.sessions.history, action.payload],
        },
      }
    
    case 'END_SESSION':
      return {
        ...state,
        sessions: {
          ...state.sessions,
          current: state.sessions.current === action.payload ? undefined : state.sessions.current,
          active: state.sessions.active.filter(id => id !== action.payload),
          history: state.sessions.history.map(session =>
            session.id === action.payload
              ? { ...session, endTime: new Date() }
              : session
          ),
        },
      }
    
    case 'UPDATE_CONFIG':
      return {
        ...state,
        config: { ...state.config, ...action.payload },
      }
    
    case 'UPDATE_PREFERENCES':
      return {
        ...state,
        preferences: { ...state.preferences, ...action.payload },
      }
    
    case 'RESET_STATE':
      return { ...initialState }
    
    case 'IMPORT_STATE':
      return { ...state, ...action.payload }
    
    default:
      return state
  }
}

// Context
const AIContext = createContext<AIContextValue | undefined>(undefined)

// Provider component
interface AIProviderProps {
  children: React.ReactNode
  initialConfig?: Partial<AIState>
}

export function AIProvider({ children, initialConfig }: AIProviderProps) {
  const { user } = useUser()
  const [state, dispatch] = useReducer(aiReducer, {
    ...initialState,
    ...initialConfig,
  })

  // Load user preferences from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedState = localStorage.getItem('roomicor-ai-state')
        if (savedState) {
          const parsed = JSON.parse(savedState)
          dispatch({ type: 'IMPORT_STATE', payload: parsed })
        }
      } catch (error) {
        console.error('Failed to load AI state from localStorage:', error)
      }
    }
  }, [])

  // Save state to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('roomicor-ai-state', JSON.stringify({
          preferences: state.preferences,
          features: state.features,
          config: state.config,
          defaultProvider: state.defaultProvider,
        }))
      } catch (error) {
        console.error('Failed to save AI state to localStorage:', error)
      }
    }
  }, [state.preferences, state.features, state.config, state.defaultProvider])

  // Actions
  const enableAI = useCallback(() => {
    dispatch({ type: 'SET_ENABLED', payload: true })
    toast.success('AI features enabled')
  }, [])

  const disableAI = useCallback(() => {
    dispatch({ type: 'SET_ENABLED', payload: false })
    toast.info('AI features disabled')
  }, [])

  const setDefaultProvider = useCallback((provider: AIState['defaultProvider']) => {
    dispatch({ type: 'SET_PROVIDER', payload: provider })
    toast.success(`Default AI provider set to ${provider}`)
  }, [])

  const updateProviderStatus = useCallback((
    provider: string,
    status: Partial<AIState['providers'][keyof AIState['providers']]>
  ) => {
    dispatch({ 
      type: 'UPDATE_PROVIDER_STATUS', 
      payload: { provider, status } 
    })
    
    if (status.connected === true) {
      toast.success(`${provider} connected`)
    } else if (status.connected === false) {
      toast.error(`${provider} disconnected`)
    }
    
    if (status.error) {
      toast.error(`${provider}: ${status.error}`)
    }
  }, [])

  const updateFeatures = useCallback((features: Partial<AIState['features']>) => {
    dispatch({ type: 'UPDATE_FEATURES', payload: features })
  }, [])

  const trackUsage = useCallback((provider: string, tokens: number, cost: number) => {
    dispatch({ 
      type: 'UPDATE_USAGE', 
      payload: { provider, tokens, cost } 
    })
  }, [])

  const startSession = useCallback((provider: string): string => {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const session = {
      id: sessionId,
      provider,
      startTime: new Date(),
      messageCount: 0,
      tokenUsage: 0,
    }
    
    dispatch({ type: 'ADD_SESSION', payload: session })
    return sessionId
  }, [])

  const endSession = useCallback((sessionId: string) => {
    dispatch({ type: 'END_SESSION', payload: sessionId })
  }, [])

  const updateConfig = useCallback((config: Partial<AIState['config']>) => {
    dispatch({ type: 'UPDATE_CONFIG', payload: config })
  }, [])

  const updatePreferences = useCallback((preferences: Partial<AIState['preferences']>) => {
    dispatch({ type: 'UPDATE_PREFERENCES', payload: preferences })
  }, [])

  // Utilities
  const getProviderStatus = useCallback((provider: string) => {
    return state.providers[provider as keyof typeof state.providers] || null
  }, [state.providers])

  const getTotalCost = useCallback(() => {
    return state.usage.totalCost
  }, [state.usage.totalCost])

  const getTotalTokens = useCallback(() => {
    return state.usage.totalTokens
  }, [state.usage.totalTokens])

  const getActiveProviders = useCallback(() => {
    return Object.entries(state.providers)
      .filter(([, status]) => status.enabled && status.connected)
      .map(([name]) => name)
  }, [state.providers])

  const exportState = useCallback(() => {
    return state
  }, [state])

  const importState = useCallback((newState: Partial<AIState>) => {
    dispatch({ type: 'IMPORT_STATE', payload: newState })
    toast.success('AI state imported successfully')
  }, [])

  const resetState = useCallback(() => {
    dispatch({ type: 'RESET_STATE', payload: null })
    toast.info('AI state reset to defaults')
  }, [])

  // Auto-disable AI if user is not authenticated
  useEffect(() => {
    if (!user && state.isEnabled) {
      dispatch({ type: 'SET_ENABLED', payload: false })
    }
  }, [user, state.isEnabled])

  // Cost monitoring and alerts
  useEffect(() => {
    const totalCost = state.usage.totalCost
    const costThresholds = [10, 25, 50, 100] // Dollar amounts
    
    costThresholds.forEach(threshold => {
      if (totalCost >= threshold && totalCost < threshold + 0.1) {
        toast.warning(`AI usage cost has reached $${threshold}`)
      }
    })
  }, [state.usage.totalCost])

  // Error tracking
  useEffect(() => {
    const errorRate = state.usage.errorCount / Math.max(state.usage.requestCount, 1)
    if (errorRate > 0.1 && state.usage.requestCount > 10) {
      toast.error(`High AI error rate detected: ${(errorRate * 100).toFixed(1)}%`)
    }
  }, [state.usage.errorCount, state.usage.requestCount])

  const contextValue: AIContextValue = {
    state,
    dispatch,
    
    // Actions
    enableAI,
    disableAI,
    setDefaultProvider,
    updateProviderStatus,
    updateFeatures,
    trackUsage,
    startSession,
    endSession,
    updateConfig,
    updatePreferences,
    
    // Utilities
    getProviderStatus,
    getTotalCost,
    getTotalTokens,
    getActiveProviders,
    exportState,
    importState,
    resetState,
  }

  return (
    <AIContext.Provider value={contextValue}>
      {children}
    </AIContext.Provider>
  )
}

// Hook to use AI context
export function useAI(): AIContextValue {
  const context = useContext(AIContext)
  if (context === undefined) {
    throw new Error('useAI must be used within an AIProvider')
  }
  return context
}

// HOC for components that need AI context
export function withAI<P extends object>(Component: React.ComponentType<P>) {
  return function AIWrappedComponent(props: P) {
    return (
      <AIProvider>
        <Component {...props} />
      </AIProvider>
    )
  }
}

// Custom hooks for specific AI state slices
export function useAIProviders() {
  const { state, updateProviderStatus } = useAI()
  return {
    providers: state.providers,
    updateProviderStatus,
    activeProviders: Object.entries(state.providers)
      .filter(([, status]) => status.enabled && status.connected)
      .map(([name]) => name),
  }
}

export function useAIUsage() {
  const { state, trackUsage } = useAI()
  return {
    usage: state.usage,
    trackUsage,
    totalCost: state.usage.totalCost,
    totalTokens: state.usage.totalTokens,
    providerBreakdown: state.usage.providerUsage,
  }
}

export function useAIFeatures() {
  const { state, updateFeatures } = useAI()
  return {
    features: state.features,
    updateFeatures,
    isStreamingEnabled: state.features.streaming,
    areToolCallsEnabled: state.features.toolCalls,
    isMultiProviderEnabled: state.features.multiProvider,
  }
}

export function useAIPreferences() {
  const { state, updatePreferences } = useAI()
  return {
    preferences: state.preferences,
    updatePreferences,
    theme: state.preferences.theme,
    language: state.preferences.language,
    notificationsEnabled: state.preferences.notifications,
  }
}

export function useAISessions() {
  const { state, startSession, endSession } = useAI()
  return {
    sessions: state.sessions,
    startSession,
    endSession,
    currentSession: state.sessions.current,
    activeSessions: state.sessions.active,
    sessionHistory: state.sessions.history,
  }
}

// Performance monitoring hook
export function useAIPerformance() {
  const { state } = useAI()
  
  const getProviderPerformance = useCallback((provider: string) => {
    const usage = state.usage.providerUsage[provider]
    if (!usage) return null
    
    return {
      averageCostPerRequest: usage.cost / usage.requests,
      averageTokensPerRequest: usage.tokens / usage.requests,
      totalRequests: usage.requests,
      totalCost: usage.cost,
      totalTokens: usage.tokens,
    }
  }, [state.usage.providerUsage])
  
  const getBestPerformingProvider = useCallback((criteria: 'cost' | 'speed' | 'reliability') => {
    const providers = Object.entries(state.usage.providerUsage)
    if (providers.length === 0) return null
    
    let best = providers[0]
    
    providers.forEach(([provider, usage]) => {
      const [bestProvider, bestUsage] = best
      
      switch (criteria) {
        case 'cost':
          if (usage.cost / usage.requests < bestUsage.cost / bestUsage.requests) {
            best = [provider, usage]
          }
          break
        case 'speed':
          // This would need response time tracking
          break
        case 'reliability':
          // This would need error rate tracking
          break
      }
    })
    
    return best[0]
  }, [state.usage.providerUsage])
  
  return {
    getProviderPerformance,
    getBestPerformingProvider,
    totalRequests: state.usage.requestCount,
    errorRate: state.usage.errorCount / Math.max(state.usage.requestCount, 1),
  }
}