/**
 * Enhanced CopilotKit Setup
 * Advanced AI capabilities with multi-provider support, custom actions, and intelligent workflows
 */

import { CopilotRuntime, OpenAIAdapter, copilotRuntimeNextJSAppRouterEndpoint } from '@copilotkit/runtime'
import { CopilotBackend, LangGraphAdapter } from '@copilotkit/backend'
import { createDatabaseService } from './database'
import { createInvoiceService } from './invoice'
import { triggerN8nWorkflow } from './n8n'
import { triggerMakeScenario } from './make'
import { EventEmitter } from 'events'

// Types for enhanced CopilotKit
export interface CopilotConfig {
  providers: {
    openai?: {
      apiKey: string
      model?: string
      temperature?: number
      maxTokens?: number
    }
    anthropic?: {
      apiKey: string
      model?: string
      temperature?: number
      maxTokens?: number
    }
    custom?: {
      endpoint: string
      apiKey?: string
      headers?: Record<string, string>
    }
  }
  actions: CopilotActionConfig[]
  workflows: CopilotWorkflowConfig[]
  features: {
    streaming: boolean
    caching: boolean
    logging: boolean
    analytics: boolean
    rateLimiting: boolean
  }
  security: {
    authentication: boolean
    authorization: boolean
    sanitization: boolean
    auditLogging: boolean
  }
}

export interface CopilotActionConfig {
  name: string
  description: string
  parameters: Array<{
    name: string
    type: string
    description: string
    required?: boolean
    default?: any
  }>
  handler: (args: any, context: CopilotContext) => Promise<any>
  permissions?: string[]
  rateLimit?: {
    requests: number
    windowMs: number
  }
  metadata?: Record<string, any>
}

export interface CopilotWorkflowConfig {
  id: string
  name: string
  description: string
  trigger: {
    type: 'manual' | 'scheduled' | 'event'
    config: any
  }
  steps: CopilotWorkflowStep[]
  metadata?: Record<string, any>
}

export interface CopilotWorkflowStep {
  id: string
  name: string
  type: 'action' | 'condition' | 'loop' | 'parallel'
  config: any
  nextSteps?: string[]
}

export interface CopilotContext {
  userId?: string
  sessionId: string
  conversation: any[]
  state: Record<string, any>
  metadata: Record<string, any>
  permissions: string[]
}

export interface CopilotMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  metadata?: Record<string, any>
}

export interface CopilotSession {
  id: string
  userId?: string
  messages: CopilotMessage[]
  state: Record<string, any>
  startedAt: Date
  lastActivity: Date
  isActive: boolean
  metadata?: Record<string, any>
}

/**
 * Enhanced CopilotKit Service
 * Manages AI interactions, custom actions, and intelligent workflows
 */
export class EnhancedCopilotService extends EventEmitter {
  private config: CopilotConfig
  private db: Awaited<ReturnType<typeof createDatabaseService>>
  private invoiceService: Awaited<ReturnType<typeof createInvoiceService>>
  private runtime: CopilotRuntime | null = null
  private activeSessions: Map<string, CopilotSession> = new Map()
  private actionHandlers: Map<string, CopilotActionConfig> = new Map()
  private workflows: Map<string, CopilotWorkflowConfig> = new Map()

  constructor(
    config: CopilotConfig,
    db: Awaited<ReturnType<typeof createDatabaseService>>,
    invoiceService: Awaited<ReturnType<typeof createInvoiceService>>
  ) {
    super()
    this.config = config
    this.db = db
    this.invoiceService = invoiceService

    this.initializeRuntime()
    this.registerDefaultActions()
    this.registerWorkflows()
  }

  /**
   * Initialize CopilotKit runtime with providers
   */
  private async initializeRuntime(): Promise<void> {
    try {
      // Primary adapter (OpenAI)
      let adapter
      if (this.config.providers.openai) {
        adapter = new OpenAIAdapter({
          apiKey: this.config.providers.openai.apiKey,
          model: this.config.providers.openai.model || 'gpt-4',
        })
      }

      if (!adapter) {
        throw new Error('No valid AI provider configured')
      }

      this.runtime = new CopilotRuntime({
        adapter,
        actions: this.buildCopilotActions(),
      })

      this.emit('runtimeInitialized')
    } catch (error: any) {
      console.error('Failed to initialize CopilotKit runtime:', error)
      this.emit('runtimeError', error)
    }
  }

  /**
   * Build CopilotKit actions from configurations
   */
  private buildCopilotActions(): any[] {
    return Array.from(this.actionHandlers.values()).map(actionConfig => ({
      name: actionConfig.name,
      description: actionConfig.description,
      parameters: actionConfig.parameters.reduce((acc, param) => {
        acc[param.name] = {
          type: param.type,
          description: param.description,
          required: param.required || false,
        }
        return acc
      }, {} as any),
      handler: async (args: any) => {
        const context = this.createExecutionContext(args)
        return actionConfig.handler(args, context)
      },
    }))
  }

  /**
   * Register default actions
   */
  private registerDefaultActions(): void {
    // Task management actions
    this.registerAction({
      name: 'createTask',
      description: 'Create a new task for the user',
      parameters: [
        { name: 'title', type: 'string', description: 'Task title', required: true },
        { name: 'content', type: 'string', description: 'Task description' },
        { name: 'priority', type: 'string', description: 'Task priority (low, medium, high, urgent)' },
        { name: 'dueDate', type: 'string', description: 'Due date in ISO format' },
      ],
      handler: async (args, context) => {
        if (!context.userId) {
          throw new Error('User authentication required')
        }

        const task = await this.db.createTask({
          user_id: context.userId,
          title: args.title,
          content: args.content || '',
          completed: false,
          priority: args.priority || 'medium',
          due_date: args.dueDate,
        })

        if (task) {
          this.emit('taskCreated', { task, context })
          return {
            success: true,
            message: `Task "${args.title}" created successfully`,
            taskId: task.id,
          }
        }

        throw new Error('Failed to create task')
      },
    })

    // Invoice generation action
    this.registerAction({
      name: 'generateInvoice',
      description: 'Generate and send an invoice to a customer',
      parameters: [
        { name: 'customerEmail', type: 'string', description: 'Customer email address', required: true },
        { name: 'customerName', type: 'string', description: 'Customer name', required: true },
        { name: 'items', type: 'array', description: 'Invoice items', required: true },
        { name: 'currency', type: 'string', description: 'Currency code (default: EUR)' },
        { name: 'dueDate', type: 'string', description: 'Due date in ISO format' },
      ],
      handler: async (args, context) => {
        if (!context.userId) {
          throw new Error('User authentication required')
        }

        const invoiceData = {
          invoiceNumber: `INV-${Date.now()}`,
          userId: context.userId,
          customerInfo: {
            name: args.customerName,
            email: args.customerEmail,
          },
          companyInfo: {
            name: process.env.COMPANY_NAME || 'Roomicor',
            address: {
              line1: process.env.COMPANY_ADDRESS_LINE1 || 'Company Address',
              city: process.env.COMPANY_CITY || 'City',
              postal_code: process.env.COMPANY_POSTAL_CODE || '12345',
              country: process.env.COMPANY_COUNTRY || 'Germany',
            },
            email: process.env.COMPANY_EMAIL || 'billing@roomicor.com',
          },
          items: args.items,
          subtotal: args.items.reduce((sum: number, item: any) => sum + item.total, 0),
          tax: {
            rate: 19,
            amount: 0, // Calculated later
          },
          total: 0, // Calculated later
          currency: args.currency || 'EUR',
          dueDate: args.dueDate ? new Date(args.dueDate) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          issueDate: new Date(),
          status: 'sent' as const,
        }

        // Calculate tax and total
        invoiceData.tax.amount = invoiceData.subtotal * 0.19
        invoiceData.total = invoiceData.subtotal + invoiceData.tax.amount

        const result = await this.invoiceService.generateInvoice(invoiceData)

        if (result.success) {
          this.emit('invoiceGenerated', { invoice: result, context })
          return {
            success: true,
            message: `Invoice ${invoiceData.invoiceNumber} generated successfully`,
            invoiceId: result.invoiceId,
          }
        }

        throw new Error(result.error || 'Failed to generate invoice')
      },
    })

    // Workflow automation actions
    this.registerAction({
      name: 'triggerAutomation',
      description: 'Trigger an automation workflow (n8n or Make.com)',
      parameters: [
        { name: 'platform', type: 'string', description: 'Automation platform (n8n or make)', required: true },
        { name: 'workflowId', type: 'string', description: 'Workflow ID' },
        { name: 'data', type: 'object', description: 'Data to send to the workflow' },
      ],
      handler: async (args, context) => {
        const { platform, workflowId, data = {} } = args

        const payload = {
          ...data,
          triggeredBy: 'copilot',
          userId: context.userId,
          sessionId: context.sessionId,
          timestamp: new Date().toISOString(),
        }

        let result
        if (platform === 'n8n') {
          result = await triggerN8nWorkflow(payload)
        } else if (platform === 'make') {
          result = await triggerMakeScenario(payload)
        } else {
          throw new Error(`Unsupported automation platform: ${platform}`)
        }

        this.emit('automationTriggered', { platform, workflowId, result, context })

        return {
          success: true,
          message: `${platform} automation triggered successfully`,
          result,
        }
      },
    })

    // Data analysis action
    this.registerAction({
      name: 'analyzeData',
      description: 'Analyze user data and provide insights',
      parameters: [
        { name: 'dataType', type: 'string', description: 'Type of data to analyze (tasks, invoices, workflows)', required: true },
        { name: 'timeRange', type: 'string', description: 'Time range for analysis (day, week, month, year)' },
        { name: 'filters', type: 'object', description: 'Additional filters for the analysis' },
      ],
      handler: async (args, context) => {
        if (!context.userId) {
          throw new Error('User authentication required')
        }

        const { dataType, timeRange = 'month', filters = {} } = args

        let data, insights

        switch (dataType) {
          case 'tasks':
            data = await this.db.getUserTasks(context.userId)
            insights = this.analyzeTaskData(data, timeRange)
            break

          case 'invoices':
            data = await this.db.getUserInvoices(context.userId)
            insights = this.analyzeInvoiceData(data, timeRange)
            break

          case 'workflows':
            data = await this.db.getUserWorkflows(context.userId)
            insights = this.analyzeWorkflowData(data, timeRange)
            break

          default:
            throw new Error(`Unsupported data type: ${dataType}`)
        }

        this.emit('dataAnalyzed', { dataType, insights, context })

        return {
          success: true,
          dataType,
          timeRange,
          insights,
          summary: insights.summary,
        }
      },
    })

    // Smart recommendations action
    this.registerAction({
      name: 'getRecommendations',
      description: 'Get AI-powered recommendations based on user activity',
      parameters: [
        { name: 'category', type: 'string', description: 'Recommendation category (productivity, automation, optimization)' },
        { name: 'context', type: 'object', description: 'Additional context for recommendations' },
      ],
      handler: async (args, context) => {
        if (!context.userId) {
          throw new Error('User authentication required')
        }

        const recommendations = await this.generateRecommendations(context.userId, args.category, args.context)

        this.emit('recommendationsGenerated', { recommendations, context })

        return {
          success: true,
          category: args.category,
          recommendations,
        }
      },
    })
  }

  /**
   * Register a custom action
   */
  registerAction(actionConfig: CopilotActionConfig): void {
    this.actionHandlers.set(actionConfig.name, actionConfig)
    this.emit('actionRegistered', actionConfig.name)
  }

  /**
   * Register workflows
   */
  private registerWorkflows(): void {
    // Example: Daily task summary workflow
    this.registerWorkflow({
      id: 'daily-task-summary',
      name: 'Daily Task Summary',
      description: 'Generate daily task summary and send notifications',
      trigger: {
        type: 'scheduled',
        config: { cron: '0 18 * * *' }, // 6 PM daily
      },
      steps: [
        {
          id: 'analyze-tasks',
          name: 'Analyze Daily Tasks',
          type: 'action',
          config: {
            action: 'analyzeData',
            parameters: {
              dataType: 'tasks',
              timeRange: 'day',
            },
          },
          nextSteps: ['send-summary'],
        },
        {
          id: 'send-summary',
          name: 'Send Summary',
          type: 'action',
          config: {
            action: 'triggerAutomation',
            parameters: {
              platform: 'n8n',
              data: '{{steps.analyze-tasks.result}}',
            },
          },
        },
      ],
    })
  }

  /**
   * Register a workflow
   */
  registerWorkflow(workflowConfig: CopilotWorkflowConfig): void {
    this.workflows.set(workflowConfig.id, workflowConfig)
    this.emit('workflowRegistered', workflowConfig.id)
  }

  /**
   * Create execution context
   */
  private createExecutionContext(args: any): CopilotContext {
    return {
      userId: args._userId,
      sessionId: args._sessionId || 'default',
      conversation: [],
      state: {},
      metadata: args._metadata || {},
      permissions: args._permissions || [],
    }
  }

  /**
   * Data analysis helpers
   */
  private analyzeTaskData(tasks: any[], timeRange: string): any {
    const now = new Date()
    const startDate = this.getStartDateForRange(now, timeRange)
    
    const filteredTasks = tasks.filter(task => 
      new Date(task.created_at) >= startDate
    )

    const completed = filteredTasks.filter(task => task.completed).length
    const pending = filteredTasks.length - completed
    const overdue = filteredTasks.filter(task => 
      !task.completed && task.due_date && new Date(task.due_date) < now
    ).length

    return {
      summary: `Analyzed ${filteredTasks.length} tasks from the last ${timeRange}`,
      metrics: {
        total: filteredTasks.length,
        completed,
        pending,
        overdue,
        completionRate: filteredTasks.length > 0 ? (completed / filteredTasks.length * 100).toFixed(1) : 0,
      },
      recommendations: this.getTaskRecommendations(filteredTasks),
    }
  }

  private analyzeInvoiceData(invoices: any[], timeRange: string): any {
    const now = new Date()
    const startDate = this.getStartDateForRange(now, timeRange)
    
    const filteredInvoices = invoices.filter(invoice => 
      new Date(invoice.created_at) >= startDate
    )

    const totalAmount = filteredInvoices.reduce((sum, invoice) => sum + invoice.amount_paid, 0)
    const paidInvoices = filteredInvoices.filter(invoice => invoice.status === 'paid').length
    const pendingInvoices = filteredInvoices.filter(invoice => invoice.status !== 'paid').length

    return {
      summary: `Analyzed ${filteredInvoices.length} invoices from the last ${timeRange}`,
      metrics: {
        total: filteredInvoices.length,
        paid: paidInvoices,
        pending: pendingInvoices,
        totalAmount,
        averageAmount: filteredInvoices.length > 0 ? (totalAmount / filteredInvoices.length).toFixed(2) : 0,
      },
      recommendations: this.getInvoiceRecommendations(filteredInvoices),
    }
  }

  private analyzeWorkflowData(workflows: any[], timeRange: string): any {
    const activeWorkflows = workflows.filter(workflow => workflow.active).length
    const inactiveWorkflows = workflows.length - activeWorkflows

    return {
      summary: `You have ${workflows.length} workflows, ${activeWorkflows} active`,
      metrics: {
        total: workflows.length,
        active: activeWorkflows,
        inactive: inactiveWorkflows,
      },
      recommendations: this.getWorkflowRecommendations(workflows),
    }
  }

  /**
   * Generate recommendations
   */
  private async generateRecommendations(
    userId: string,
    category?: string,
    context?: any
  ): Promise<any[]> {
    const recommendations = []

    // Get user data for analysis
    const tasks = await this.db.getUserTasks(userId)
    const workflows = await this.db.getUserWorkflows(userId)

    // Productivity recommendations
    if (!category || category === 'productivity') {
      const overdueTasks = tasks.filter(task => 
        !task.completed && task.due_date && new Date(task.due_date) < new Date()
      )

      if (overdueTasks.length > 0) {
        recommendations.push({
          type: 'productivity',
          title: 'Address Overdue Tasks',
          description: `You have ${overdueTasks.length} overdue tasks. Consider prioritizing them.`,
          action: 'Review and reschedule overdue tasks',
          priority: 'high',
        })
      }
    }

    // Automation recommendations
    if (!category || category === 'automation') {
      if (workflows.length === 0) {
        recommendations.push({
          type: 'automation',
          title: 'Set Up Your First Workflow',
          description: 'Automate repetitive tasks to save time and increase efficiency.',
          action: 'Create a workflow for task notifications or invoice reminders',
          priority: 'medium',
        })
      }
    }

    return recommendations
  }

  /**
   * Helper methods
   */
  private getStartDateForRange(endDate: Date, range: string): Date {
    const date = new Date(endDate)
    switch (range) {
      case 'day':
        date.setDate(date.getDate() - 1)
        break
      case 'week':
        date.setDate(date.getDate() - 7)
        break
      case 'month':
        date.setMonth(date.getMonth() - 1)
        break
      case 'year':
        date.setFullYear(date.getFullYear() - 1)
        break
    }
    return date
  }

  private getTaskRecommendations(tasks: any[]): string[] {
    const recommendations = []
    
    const highPriorityTasks = tasks.filter(task => task.priority === 'high' && !task.completed)
    if (highPriorityTasks.length > 0) {
      recommendations.push(`Focus on ${highPriorityTasks.length} high-priority tasks`)
    }

    const tasksWithoutDueDate = tasks.filter(task => !task.due_date && !task.completed)
    if (tasksWithoutDueDate.length > 0) {
      recommendations.push(`Set due dates for ${tasksWithoutDueDate.length} tasks`)
    }

    return recommendations
  }

  private getInvoiceRecommendations(invoices: any[]): string[] {
    const recommendations = []
    
    const overdueInvoices = invoices.filter(invoice => 
      invoice.status !== 'paid' && new Date(invoice.created_at) < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    )
    
    if (overdueInvoices.length > 0) {
      recommendations.push(`Follow up on ${overdueInvoices.length} overdue invoices`)
    }

    return recommendations
  }

  private getWorkflowRecommendations(workflows: any[]): string[] {
    const recommendations = []
    
    const inactiveWorkflows = workflows.filter(workflow => !workflow.active)
    if (inactiveWorkflows.length > 0) {
      recommendations.push(`Consider activating ${inactiveWorkflows.length} inactive workflows`)
    }

    return recommendations
  }

  /**
   * Get CopilotKit runtime for Next.js integration
   */
  getRuntime(): CopilotRuntime | null {
    return this.runtime
  }

  /**
   * Create Next.js API endpoint handler
   */
  createEndpointHandler() {
    if (!this.runtime) {
      throw new Error('Runtime not initialized')
    }
    
    return copilotRuntimeNextJSAppRouterEndpoint({
      runtime: this.runtime,
      serviceAdapter: this.runtime,
      endpoint: '/api/copilotkit',
    })
  }
}

/**
 * Factory function to create enhanced Copilot service
 */
export async function createEnhancedCopilotService(config: CopilotConfig): Promise<EnhancedCopilotService> {
  const db = await createDatabaseService()
  const invoiceService = await createInvoiceService()
  return new EnhancedCopilotService(config, db, invoiceService)
}

/**
 * Default Copilot configuration
 */
export const defaultCopilotConfig: CopilotConfig = {
  providers: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      model: 'gpt-4',
      temperature: 0.7,
      maxTokens: 1000,
    },
  },
  actions: [],
  workflows: [],
  features: {
    streaming: true,
    caching: true,
    logging: true,
    analytics: true,
    rateLimiting: true,
  },
  security: {
    authentication: true,
    authorization: true,
    sanitization: true,
    auditLogging: true,
  },
}

// Export types
export type {
  CopilotConfig,
  CopilotActionConfig,
  CopilotWorkflowConfig,
  CopilotWorkflowStep,
  CopilotContext,
  CopilotMessage,
  CopilotSession,
}