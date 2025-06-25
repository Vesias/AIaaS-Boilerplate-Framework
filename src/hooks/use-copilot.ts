'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useCopilotContext, useCopilotAction } from '@copilotkit/react-core'
import { useUser } from '@clerk/nextjs'
import { toast } from 'sonner'

// Types for CopilotKit integration
export interface CopilotMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  metadata?: Record<string, any>
}

export interface CopilotAction {
  name: string
  description: string
  parameters: Record<string, any>
  handler: (args: any) => Promise<any>
}

export interface UseCopilotOptions {
  // Configuration
  model?: string
  temperature?: number
  maxTokens?: number
  
  // Features
  enableAutoActions?: boolean
  enableStreaming?: boolean
  enableHistory?: boolean
  enableContext?: boolean
  
  // Callbacks
  onMessage?: (message: CopilotMessage) => void
  onAction?: (action: string, args: any, result: any) => void
  onError?: (error: any) => void
  onTokensUsed?: (tokens: number, cost: number) => void
  
  // Context
  systemPrompt?: string
  context?: Record<string, any>
  instructions?: string[]
}

export interface UseCopilotReturn {
  // State
  messages: CopilotMessage[]
  isLoading: boolean
  isStreaming: boolean
  error: string | null
  
  // Actions
  sendMessage: (content: string, options?: { stream?: boolean }) => Promise<void>
  clearMessages: () => void
  retry: () => Promise<void>
  interrupt: () => void
  
  // Context
  setContext: (context: Record<string, any>) => void
  addInstruction: (instruction: string) => void
  removeInstruction: (instruction: string) => void
  
  // Usage
  tokensUsed: number
  estimatedCost: number
  
  // Advanced
  executeAction: (actionName: string, args: any) => Promise<any>
  getAvailableActions: () => string[]
  
  // Session
  sessionId: string
  exportSession: () => any
  importSession: (session: any) => void
}

/**
 * Enhanced CopilotKit Hook
 * Provides intelligent AI assistance with task automation, data analysis, and workflow management
 */
export function useCopilot(options: UseCopilotOptions = {}): UseCopilotReturn {
  const {
    model = 'gpt-4',
    temperature = 0.7,
    maxTokens = 1000,
    enableAutoActions = true,
    enableStreaming = true,
    enableHistory = true,
    enableContext = true,
    onMessage,
    onAction,
    onError,
    onTokensUsed,
    systemPrompt,
    context: initialContext = {},
    instructions = [],
  } = options

  // Clerk user context
  const { user } = useUser()
  
  // CopilotKit context
  const copilotContext = useCopilotContext()
  
  // State
  const [messages, setMessages] = useState<CopilotMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [context, setContext] = useState<Record<string, any>>(initialContext)
  const [userInstructions, setUserInstructions] = useState<string[]>(instructions)
  const [tokensUsed, setTokensUsed] = useState(0)
  const [estimatedCost, setEstimatedCost] = useState(0)
  const [sessionId] = useState(() => `copilot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
  
  // Refs
  const lastMessageRef = useRef<string>('')
  const abortControllerRef = useRef<AbortController | null>(null)

  // Task management actions
  useCopilotAction({
    name: 'createTask',
    description: 'Create a new task for the user',
    parameters: [
      {
        name: 'title',
        type: 'string',
        description: 'Task title',
        required: true,
      },
      {
        name: 'content',
        type: 'string',
        description: 'Task description',
      },
      {
        name: 'priority',
        type: 'string',
        description: 'Task priority (low, medium, high, urgent)',
      },
      {
        name: 'dueDate',
        type: 'string',
        description: 'Due date in ISO format',
      },
    ],
    handler: async ({ title, content, priority, dueDate }) => {
      if (!user) {
        throw new Error('User must be logged in to create tasks')
      }

      try {
        const response = await fetch('/api/tasks', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title,
            content: content || '',
            priority: priority || 'medium',
            due_date: dueDate,
            user_id: user.id,
          }),
        })

        if (!response.ok) {
          throw new Error('Failed to create task')
        }

        const task = await response.json()
        
        toast.success(`Task "${title}" created successfully`)
        onAction?.('createTask', { title, content, priority, dueDate }, task)
        
        return {
          success: true,
          message: `Task "${title}" has been created successfully`,
          taskId: task.id,
        }
      } catch (error: any) {
        const errorMessage = error.message || 'Failed to create task'
        toast.error(errorMessage)
        throw new Error(errorMessage)
      }
    },
  })

  // Invoice generation action
  useCopilotAction({
    name: 'generateInvoice',
    description: 'Generate and send an invoice to a customer',
    parameters: [
      {
        name: 'customerEmail',
        type: 'string',
        description: 'Customer email address',
        required: true,
      },
      {
        name: 'customerName',
        type: 'string',
        description: 'Customer name',
        required: true,
      },
      {
        name: 'items',
        type: 'array',
        description: 'Invoice items with description, quantity, price',
        required: true,
      },
      {
        name: 'currency',
        type: 'string',
        description: 'Currency code (default: EUR)',
      },
    ],
    handler: async ({ customerEmail, customerName, items, currency = 'EUR' }) => {
      if (!user) {
        throw new Error('User must be logged in to generate invoices')
      }

      try {
        const response = await fetch('/api/invoices', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            customerEmail,
            customerName,
            items,
            currency,
            userId: user.id,
          }),
        })

        if (!response.ok) {
          throw new Error('Failed to generate invoice')
        }

        const result = await response.json()
        
        toast.success(`Invoice generated for ${customerName}`)
        onAction?.('generateInvoice', { customerEmail, customerName, items, currency }, result)
        
        return {
          success: true,
          message: `Invoice has been generated and sent to ${customerEmail}`,
          invoiceId: result.invoiceId,
        }
      } catch (error: any) {
        const errorMessage = error.message || 'Failed to generate invoice'
        toast.error(errorMessage)
        throw new Error(errorMessage)
      }
    },
  })

  // Data analysis action
  useCopilotAction({
    name: 'analyzeData',
    description: 'Analyze user data and provide insights',
    parameters: [
      {
        name: 'dataType',
        type: 'string',
        description: 'Type of data to analyze (tasks, invoices, workflows)',
        required: true,
      },
      {
        name: 'timeRange',
        type: 'string',
        description: 'Time range for analysis (day, week, month, year)',
      },
    ],
    handler: async ({ dataType, timeRange = 'month' }) => {
      if (!user) {
        throw new Error('User must be logged in to analyze data')
      }

      try {
        const response = await fetch(`/api/${dataType}?analyze=true&timeRange=${timeRange}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          throw new Error(`Failed to analyze ${dataType} data`)
        }

        const analysis = await response.json()
        
        onAction?.('analyzeData', { dataType, timeRange }, analysis)
        
        return {
          success: true,
          dataType,
          timeRange,
          ...analysis,
        }
      } catch (error: any) {
        const errorMessage = error.message || 'Failed to analyze data'
        toast.error(errorMessage)
        throw new Error(errorMessage)
      }
    },
  })

  // Workflow automation action
  useCopilotAction({
    name: 'triggerWorkflow',
    description: 'Trigger an automation workflow',
    parameters: [
      {
        name: 'platform',
        type: 'string',
        description: 'Automation platform (n8n, make)',
        required: true,
      },
      {
        name: 'workflowId',
        type: 'string',
        description: 'Workflow ID or name',
      },
      {
        name: 'data',
        type: 'object',
        description: 'Data to send to the workflow',
      },
    ],
    handler: async ({ platform, workflowId, data = {} }) => {
      if (!user) {
        throw new Error('User must be logged in to trigger workflows')
      }

      try {
        const endpoint = platform === 'n8n' ? '/api/n8n/webhook' : '/api/make/webhook'
        
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            workflowId,
            data: {
              ...data,
              userId: user.id,
              triggeredBy: 'copilot',
              timestamp: new Date().toISOString(),
            },
          }),
        })

        if (!response.ok) {
          throw new Error(`Failed to trigger ${platform} workflow`)
        }

        const result = await response.json()
        
        toast.success(`${platform} workflow triggered successfully`)
        onAction?.('triggerWorkflow', { platform, workflowId, data }, result)
        
        return {
          success: true,
          message: `${platform} workflow triggered successfully`,
          result,
        }
      } catch (error: any) {
        const errorMessage = error.message || 'Failed to trigger workflow'
        toast.error(errorMessage)
        throw new Error(errorMessage)
      }
    },
  })

  // Send message function
  const sendMessage = useCallback(async (content: string, options: { stream?: boolean } = {}) => {
    if (!content.trim()) return

    const userMessage: CopilotMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)
    setError(null)
    lastMessageRef.current = content.trim()

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController()

    try {
      // Build context for the AI
      const fullContext = {
        ...context,
        user: {
          id: user?.id,
          email: user?.primaryEmailAddress?.emailAddress,
          name: user?.fullName,
        },
        session: {
          id: sessionId,
          timestamp: new Date().toISOString(),
        },
        instructions: userInstructions,
        features: {
          enableAutoActions,
          enableHistory,
        },
      }

      // Send to CopilotKit
      if (options.stream && enableStreaming) {
        setIsStreaming(true)
        // Handle streaming response
        // Implementation would depend on CopilotKit streaming API
      }

      const assistantMessage: CopilotMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: 'Processing your request...',
        timestamp: new Date(),
      }

      setMessages(prev => [...prev, assistantMessage])
      onMessage?.(userMessage)
      onMessage?.(assistantMessage)

      // Calculate token usage (mock implementation)
      const estimatedTokens = Math.ceil((content.length + assistantMessage.content.length) / 4)
      const cost = estimatedTokens * 0.00002 // Rough GPT-4 pricing
      
      setTokensUsed(prev => prev + estimatedTokens)
      setEstimatedCost(prev => prev + cost)
      onTokensUsed?.(estimatedTokens, cost)

    } catch (error: any) {
      const errorMessage = error.message || 'Failed to send message'
      setError(errorMessage)
      onError?.(error)
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
      setIsStreaming(false)
      abortControllerRef.current = null
    }
  }, [
    context,
    user,
    sessionId,
    userInstructions,
    enableAutoActions,
    enableHistory,
    enableStreaming,
    onMessage,
    onError,
    onTokensUsed,
  ])

  // Clear messages
  const clearMessages = useCallback(() => {
    setMessages([])
    setError(null)
    setTokensUsed(0)
    setEstimatedCost(0)
  }, [])

  // Retry last message
  const retry = useCallback(async () => {
    if (lastMessageRef.current) {
      await sendMessage(lastMessageRef.current)
    }
  }, [sendMessage])

  // Interrupt current operation
  const interrupt = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      setIsLoading(false)
      setIsStreaming(false)
    }
  }, [])

  // Update context
  const updateContext = useCallback((newContext: Record<string, any>) => {
    setContext(prev => ({ ...prev, ...newContext }))
  }, [])

  // Add instruction
  const addInstruction = useCallback((instruction: string) => {
    setUserInstructions(prev => [...prev, instruction])
  }, [])

  // Remove instruction
  const removeInstruction = useCallback((instruction: string) => {
    setUserInstructions(prev => prev.filter(i => i !== instruction))
  }, [])

  // Execute action directly
  const executeAction = useCallback(async (actionName: string, args: any): Promise<any> => {
    // This would integrate with CopilotKit's action system
    // For now, return a placeholder
    throw new Error('Direct action execution not implemented yet')
  }, [])

  // Get available actions
  const getAvailableActions = useCallback((): string[] => {
    return ['createTask', 'generateInvoice', 'analyzeData', 'triggerWorkflow']
  }, [])

  // Export session
  const exportSession = useCallback(() => {
    return {
      sessionId,
      messages,
      context,
      instructions: userInstructions,
      tokensUsed,
      estimatedCost,
      timestamp: new Date().toISOString(),
    }
  }, [sessionId, messages, context, userInstructions, tokensUsed, estimatedCost])

  // Import session
  const importSession = useCallback((session: any) => {
    if (session.messages) setMessages(session.messages)
    if (session.context) setContext(session.context)
    if (session.instructions) setUserInstructions(session.instructions)
    if (session.tokensUsed) setTokensUsed(session.tokensUsed)
    if (session.estimatedCost) setEstimatedCost(session.estimatedCost)
  }, [])

  // Initialize system prompt and context
  useEffect(() => {
    if (systemPrompt || enableContext) {
      const systemContext = {
        systemPrompt: systemPrompt || 'You are an AI assistant for Roomicor, helping users manage tasks, invoices, and workflows.',
        capabilities: [
          'Task management and organization',
          'Invoice generation and tracking',
          'Workflow automation with n8n and Make.com',
          'Data analysis and insights',
          'Smart recommendations',
        ],
        userRole: user?.publicMetadata?.role || 'user',
        timestamp: new Date().toISOString(),
      }
      
      updateContext(systemContext)
    }
  }, [systemPrompt, enableContext, user, updateContext])

  return {
    // State
    messages,
    isLoading,
    isStreaming,
    error,
    
    // Actions
    sendMessage,
    clearMessages,
    retry,
    interrupt,
    
    // Context
    setContext: updateContext,
    addInstruction,
    removeInstruction,
    
    // Usage
    tokensUsed,
    estimatedCost,
    
    // Advanced
    executeAction,
    getAvailableActions,
    
    // Session
    sessionId,
    exportSession,
    importSession,
  }
}

/**
 * Specialized hook for task-focused AI assistance
 */
export function useCopilotTasks(options: Omit<UseCopilotOptions, 'systemPrompt'> = {}) {
  return useCopilot({
    ...options,
    systemPrompt: 'You are a task management assistant. Help users create, organize, and manage their tasks efficiently. Focus on productivity and time management.',
    instructions: [
      'Always ask for clarification if task details are unclear',
      'Suggest due dates and priorities when creating tasks',
      'Provide productivity tips and recommendations',
      'Help break down complex tasks into smaller ones',
    ],
  })
}

/**
 * Specialized hook for invoice and billing assistance
 */
export function useCopilotInvoices(options: Omit<UseCopilotOptions, 'systemPrompt'> = {}) {
  return useCopilot({
    ...options,
    systemPrompt: 'You are an invoice and billing assistant. Help users create professional invoices, track payments, and manage their billing workflows.',
    instructions: [
      'Always validate customer information before creating invoices',
      'Calculate taxes and totals accurately',
      'Suggest payment terms and due dates',
      'Help with follow-up on overdue invoices',
    ],
  })
}

/**
 * Specialized hook for workflow automation assistance
 */
export function useCopilotWorkflows(options: Omit<UseCopilotOptions, 'systemPrompt'> = {}) {
  return useCopilot({
    ...options,
    systemPrompt: 'You are a workflow automation assistant. Help users create and manage automated workflows using n8n and Make.com to streamline their business processes.',
    instructions: [
      'Suggest automation opportunities based on user tasks',
      'Help design efficient workflow structures',
      'Provide best practices for automation',
      'Troubleshoot workflow issues when needed',
    ],
  })
}