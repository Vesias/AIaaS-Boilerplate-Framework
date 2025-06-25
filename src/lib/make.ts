/**
 * Enhanced Make.com Integration
 * Advanced scenario management with templates, monitoring, and batch processing
 */

import { EventEmitter } from 'events'
import { createDatabaseService } from './database'

interface MakeScenarioPayload {
  event?: string
  timestamp?: string
  source?: string
  [key: string]: any
}

interface MakeScenarioResponse {
  success: boolean
  scenarioId?: string
  executionId?: string
  data?: any
  error?: string
}

// Enhanced types for Make.com integration
export interface MakeScenarioTemplate {
  id: string
  name: string
  description: string
  category: string
  tags: string[]
  modules: MakeModule[]
  connections: MakeConnection[]
  variables: MakeVariable[]
  settings: {
    sequential: boolean
    maxResults?: number
    timeout?: number
  }
  metadata: {
    author: string
    version: string
    createdAt: Date
    updatedAt: Date
  }
}

export interface MakeModule {
  id: string
  name: string
  type: string
  app: string
  operation: string
  parameters: Record<string, any>
  mapping?: Record<string, string>
  filter?: MakeFilter
  position: { x: number; y: number }
}

export interface MakeConnection {
  from: {
    moduleId: string
    outputPort: string
  }
  to: {
    moduleId: string
    inputPort: string
  }
}

export interface MakeVariable {
  name: string
  type: 'text' | 'number' | 'boolean' | 'date' | 'array' | 'object'
  description: string
  defaultValue?: any
  required: boolean
  validation?: {
    pattern?: string
    min?: number
    max?: number
  }
}

export interface MakeFilter {
  condition: string
  operator: 'equal' | 'notEqual' | 'greater' | 'less' | 'contains' | 'notContains'
  value: any
}

export interface MakeExecution {
  id: string
  scenarioId: string
  status: 'pending' | 'running' | 'success' | 'warning' | 'error' | 'incomplete'
  startedAt: Date
  finishedAt?: Date
  operationsConsumed: number
  dataTransferred: number
  modules: MakeModuleExecution[]
  error?: string
  metadata: Record<string, any>
}

export interface MakeModuleExecution {
  moduleId: string
  status: 'success' | 'warning' | 'error' | 'skipped'
  input: any
  output: any
  error?: string
  executionTime: number
}

export interface MakeClient {
  baseUrl: string
  apiKey: string
  organizationId: string
  teamId?: string
  timeout: number
  rateLimit: {
    requestsPerMinute: number
    burstLimit: number
  }
}

export interface MakeWebhook {
  id: string
  name: string
  url: string
  scenarioId: string
  active: boolean
  settings: {
    queue: boolean
    responseType: 'json' | 'text' | 'binary'
    customHeaders?: Record<string, string>
  }
  metadata: Record<string, any>
}

export async function triggerMakeScenario(
  payload: MakeScenarioPayload
): Promise<MakeScenarioResponse> {
  if (!process.env.MAKE_WEBHOOK_URL) {
    throw new Error('MAKE_WEBHOOK_URL is not configured')
  }

  try {
    const response = await fetch(process.env.MAKE_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.MAKE_WEBHOOK_TOKEN && {
          'X-Webhook-Token': process.env.MAKE_WEBHOOK_TOKEN
        })
      },
      body: JSON.stringify({
        ...payload,
        timestamp: new Date().toISOString(),
        source: 'nextjs-app'
      }),
    })

    if (!response.ok) {
      throw new Error(`Make.com webhook failed: ${response.status} ${response.statusText}`)
    }

    // Handle different response formats from Make.com
    const contentType = response.headers.get('content-type')
    let data: any

    if (contentType && contentType.includes('application/json')) {
      data = await response.json()
    } else {
      const text = await response.text()
      data = { response: text }
    }
    
    return {
      success: true,
      executionId: data.executionId || data.execution_id,
      scenarioId: data.scenarioId || data.scenario_id,
      data: data
    }
  } catch (error: any) {
    console.error('Error triggering Make.com scenario:', error)
    throw new Error(`Failed to trigger Make.com scenario: ${error.message}`)
  }
}

export async function triggerMakeScenarioWithRetry(
  payload: MakeScenarioPayload,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<MakeScenarioResponse> {
  let lastError: Error

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await triggerMakeScenario(payload)
    } catch (error: any) {
      lastError = error
      console.warn(`Make.com scenario trigger attempt ${attempt} failed:`, error.message)
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delayMs * attempt))
      }
    }
  }

  throw lastError!
}

// Predefined Make.com scenario triggers for common events
export const MakeScenarios = {
  FORM_SUBMISSION: (formType: string, formData: any) => triggerMakeScenario({
    event: 'form.submitted',
    formType,
    data: formData,
    submittedAt: new Date().toISOString()
  }),

  USER_REGISTRATION: (userId: string, email: string, userData?: any) => triggerMakeScenario({
    event: 'user.registered',
    userId,
    email,
    userData,
    platform: 'web'
  }),

  ORDER_CREATED: (orderId: string, orderData: any) => triggerMakeScenario({
    event: 'order.created',
    orderId,
    orderData,
    currency: 'EUR'
  }),

  PAYMENT_COMPLETED: (paymentId: string, amount: number, userId: string) => triggerMakeScenario({
    event: 'payment.completed',
    paymentId,
    amount,
    userId,
    provider: 'stripe'
  }),

  EMAIL_CAMPAIGN: (campaignType: string, recipients: string[], content: any) => triggerMakeScenario({
    event: 'email.campaign',
    campaignType,
    recipients,
    content,
    scheduledAt: new Date().toISOString()
  }),

  DATA_EXPORT: (exportType: string, filters?: any) => triggerMakeScenario({
    event: 'data.export',
    exportType,
    filters,
    requestedAt: new Date().toISOString()
  }),

  USER_ACTIVITY: (userId: string, activity: string, metadata?: any) => triggerMakeScenario({
    event: 'user.activity',
    userId,
    activity,
    metadata,
    timestamp: new Date().toISOString()
  }),

  SUPPORT_TICKET: (ticketData: any) => triggerMakeScenario({
    event: 'support.ticket.created',
    ticket: ticketData,
    priority: ticketData.priority || 'normal',
    createdAt: new Date().toISOString()
  }),

  INVENTORY_UPDATE: (productId: string, quantity: number, action: 'increase' | 'decrease') => triggerMakeScenario({
    event: 'inventory.updated',
    productId,
    quantity,
    action,
    updatedAt: new Date().toISOString()
  }),

  NOTIFICATION_SEND: (userId: string, type: string, message: string, channels?: string[]) => triggerMakeScenario({
    event: 'notification.send',
    userId,
    type,
    message,
    channels: channels || ['email'],
    priority: 'normal'
  })
}

// Utility function to validate Make.com webhook response
export function validateMakeResponse(response: any): boolean {
  return (
    response &&
    typeof response === 'object' &&
    (response.success === true || response.status === 'success')
  )
}

// Function to format data for Make.com consumption
export function formatForMake(data: any): any {
  // Make.com often expects flat structures
  // This utility can help flatten nested objects if needed
  
  if (Array.isArray(data)) {
    return data.map(item => formatForMake(item))
  }
  
  if (data && typeof data === 'object') {
    const formatted: any = {}
    
    for (const [key, value] of Object.entries(data)) {
      // Convert dates to ISO strings
      if (value instanceof Date) {
        formatted[key] = value.toISOString()
      }
      // Convert undefined to null (Make.com handles null better)
      else if (value === undefined) {
        formatted[key] = null
      }
      // Keep other values as-is
      else {
        formatted[key] = value
      }
    }
    
    return formatted
  }
  
  return data
}

/**
 * Enhanced Make.com Client
 * Advanced scenario management with templates and monitoring
 */
export class EnhancedMakeClient extends EventEmitter {
  private client: MakeClient
  private db: Awaited<ReturnType<typeof createDatabaseService>>
  private templates: Map<string, MakeScenarioTemplate> = new Map()
  private executions: Map<string, MakeExecution> = new Map()
  private rateLimiter: { requests: number; resetTime: Date } = {
    requests: 0,
    resetTime: new Date()
  }

  constructor(
    client: MakeClient,
    db: Awaited<ReturnType<typeof createDatabaseService>>
  ) {
    super()
    this.client = client
    this.db = db
    this.initializeTemplates()
  }

  /**
   * Create scenario from template
   */
  async createScenarioFromTemplate(
    templateId: string,
    variables: Record<string, any> = {},
    customName?: string
  ): Promise<string> {
    const template = this.templates.get(templateId)
    if (!template) {
      throw new Error(`Template ${templateId} not found`)
    }

    // Validate required variables
    this.validateTemplateVariables(template, variables)

    // Process template with variables
    const processedModules = this.processTemplateVariables(template.modules, variables)
    
    const scenarioConfig = {
      name: customName || `${template.name} - ${new Date().toISOString()}`,
      modules: processedModules,
      connections: template.connections,
      settings: template.settings,
      scheduling: {
        type: 'immediately'
      }
    }

    // Create scenario via API
    const scenarioId = await this.createScenario(scenarioConfig)
    
    this.emit('scenarioCreatedFromTemplate', {
      templateId,
      scenarioId,
      variables,
    })

    return scenarioId
  }

  /**
   * Create scenario via Make.com API
   */
  async createScenario(config: any): Promise<string> {
    const response = await this.makeApiRequest('POST', '/scenarios', config)
    return response.scenario.id
  }

  /**
   * Execute scenario with monitoring
   */
  async executeScenarioWithMonitoring(
    scenarioId: string,
    data: any = {},
    waitForCompletion: boolean = true
  ): Promise<MakeExecution> {
    const execution: MakeExecution = {
      id: this.generateExecutionId(),
      scenarioId,
      status: 'pending',
      startedAt: new Date(),
      operationsConsumed: 0,
      dataTransferred: 0,
      modules: [],
      metadata: {
        waitForCompletion,
        triggeredBy: 'enhanced-client',
        inputData: data,
      },
    }

    this.executions.set(execution.id, execution)

    try {
      // Trigger scenario execution
      const response = await this.makeApiRequest('POST', `/scenarios/${scenarioId}/run`, {
        data,
        maxResults: 1,
      })

      execution.id = response.executionId || execution.id
      execution.status = 'running'
      
      this.emit('executionStarted', execution)

      if (waitForCompletion) {
        // Poll for completion
        await this.waitForExecution(execution)
      }

      return execution
    } catch (error: any) {
      execution.status = 'error'
      execution.error = error.message
      execution.finishedAt = new Date()
      
      this.emit('executionFailed', execution)
      throw error
    }
  }

  /**
   * Wait for execution completion
   */
  private async waitForExecution(execution: MakeExecution): Promise<void> {
    const maxWaitTime = 600000 // 10 minutes
    const pollInterval = 3000   // 3 seconds
    const startTime = Date.now()

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const status = await this.getExecutionStatus(execution.id)
        execution.status = status.status
        execution.operationsConsumed = status.operationsConsumed || 0
        execution.dataTransferred = status.dataTransferred || 0
        execution.modules = status.modules || []
        
        if (['success', 'warning', 'error', 'incomplete'].includes(status.status)) {
          execution.finishedAt = new Date()
          execution.error = status.error
          
          this.emit('executionCompleted', execution)
          return
        }

        await new Promise(resolve => setTimeout(resolve, pollInterval))
      } catch (error: any) {
        console.warn('Error polling execution status:', error)
        await new Promise(resolve => setTimeout(resolve, pollInterval))
      }
    }

    // Timeout reached
    execution.status = 'error'
    execution.error = 'Execution timeout'
    execution.finishedAt = new Date()
    
    this.emit('executionTimeout', execution)
  }

  /**
   * Get execution status
   */
  async getExecutionStatus(executionId: string): Promise<any> {
    return this.makeApiRequest('GET', `/executions/${executionId}`)
  }

  /**
   * Batch execute scenarios
   */
  async batchExecuteScenarios(
    requests: Array<{ scenarioId: string; data: any }>,
    concurrency: number = 2
  ): Promise<MakeExecution[]> {
    const results: MakeExecution[] = []
    const executing: Promise<MakeExecution>[] = []

    for (const request of requests) {
      // Wait if we've reached concurrency limit
      if (executing.length >= concurrency) {
        const completed = await Promise.race(executing)
        results.push(completed)
        executing.splice(executing.findIndex(p => p === Promise.resolve(completed)), 1)
      }

      // Start new execution
      const execution = this.executeScenarioWithMonitoring(
        request.scenarioId,
        request.data,
        false
      )
      executing.push(execution)
    }

    // Wait for remaining executions
    const remaining = await Promise.all(executing)
    results.push(...remaining)

    this.emit('batchExecutionCompleted', {
      total: requests.length,
      successful: results.filter(r => r.status === 'success').length,
      failed: results.filter(r => ['error', 'incomplete'].includes(r.status)).length,
    })

    return results
  }

  /**
   * Get scenario analytics
   */
  async getScenarioAnalytics(scenarioId: string, days: number = 30): Promise<any> {
    const executions = await this.makeApiRequest('GET', `/scenarios/${scenarioId}/executions`, {
      limit: 1000,
    })

    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    const recentExecutions = executions.executions.filter(
      (exec: any) => new Date(exec.createdAt) >= cutoffDate
    )

    const analytics = {
      totalExecutions: recentExecutions.length,
      successfulExecutions: recentExecutions.filter((e: any) => e.status === 'success').length,
      failedExecutions: recentExecutions.filter((e: any) => e.status === 'error').length,
      warningExecutions: recentExecutions.filter((e: any) => e.status === 'warning').length,
      averageExecutionTime: 0,
      totalOperationsConsumed: 0,
      totalDataTransferred: 0,
      executionsByDay: {} as Record<string, number>,
      operationsByModule: {} as Record<string, number>,
      commonErrors: {} as Record<string, number>,
    }

    // Calculate averages and totals
    if (recentExecutions.length > 0) {
      const completedExecutions = recentExecutions.filter((e: any) => e.finishedAt)
      
      if (completedExecutions.length > 0) {
        const totalTime = completedExecutions.reduce((sum: number, exec: any) => {
          const start = new Date(exec.createdAt).getTime()
          const end = new Date(exec.finishedAt).getTime()
          return sum + (end - start)
        }, 0)
        analytics.averageExecutionTime = totalTime / completedExecutions.length
      }

      analytics.totalOperationsConsumed = recentExecutions.reduce(
        (sum: number, exec: any) => sum + (exec.operationsConsumed || 0), 0
      )
      
      analytics.totalDataTransferred = recentExecutions.reduce(
        (sum: number, exec: any) => sum + (exec.dataTransferred || 0), 0
      )
    }

    // Group by day
    recentExecutions.forEach((exec: any) => {
      const day = new Date(exec.createdAt).toISOString().split('T')[0]
      analytics.executionsByDay[day] = (analytics.executionsByDay[day] || 0) + 1
    })

    // Operations by module
    recentExecutions.forEach((exec: any) => {
      if (exec.modules) {
        exec.modules.forEach((module: any) => {
          const moduleName = module.name || module.type
          analytics.operationsByModule[moduleName] = (analytics.operationsByModule[moduleName] || 0) + 1
        })
      }
    })

    // Common errors
    recentExecutions
      .filter((e: any) => e.status === 'error' && e.error)
      .forEach((exec: any) => {
        const error = exec.error.message || exec.error
        analytics.commonErrors[error] = (analytics.commonErrors[error] || 0) + 1
      })

    return analytics
  }

  /**
   * Manage webhooks
   */
  async createWebhook(
    scenarioId: string,
    name: string,
    settings: Partial<MakeWebhook['settings']> = {}
  ): Promise<MakeWebhook> {
    const webhookConfig = {
      name,
      scenarioId,
      settings: {
        queue: false,
        responseType: 'json',
        ...settings,
      },
    }

    const response = await this.makeApiRequest('POST', `/scenarios/${scenarioId}/webhooks`, webhookConfig)
    
    const webhook: MakeWebhook = {
      id: response.webhook.id,
      name: response.webhook.name,
      url: response.webhook.url,
      scenarioId,
      active: true,
      settings: response.webhook.settings,
      metadata: {
        createdAt: new Date(),
      },
    }

    this.emit('webhookCreated', webhook)
    return webhook
  }

  /**
   * List webhooks for scenario
   */
  async listWebhooks(scenarioId: string): Promise<MakeWebhook[]> {
    const response = await this.makeApiRequest('GET', `/scenarios/${scenarioId}/webhooks`)
    return response.webhooks.map((webhook: any) => ({
      id: webhook.id,
      name: webhook.name,
      url: webhook.url,
      scenarioId,
      active: webhook.active,
      settings: webhook.settings,
      metadata: webhook.metadata || {},
    }))
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(scenarioId: string, webhookId: string): Promise<void> {
    await this.makeApiRequest('DELETE', `/scenarios/${scenarioId}/webhooks/${webhookId}`)
    this.emit('webhookDeleted', { scenarioId, webhookId })
  }

  /**
   * Validate template variables
   */
  private validateTemplateVariables(
    template: MakeScenarioTemplate,
    variables: Record<string, any>
  ): void {
    const missingRequired = template.variables
      .filter(variable => variable.required)
      .filter(variable => !(variable.name in variables))
      .map(variable => variable.name)

    if (missingRequired.length > 0) {
      throw new Error(`Missing required variables: ${missingRequired.join(', ')}`)
    }

    // Validate variable types and constraints
    for (const variable of template.variables) {
      const value = variables[variable.name]
      if (value !== undefined) {
        this.validateVariableValue(variable, value)
      }
    }
  }

  /**
   * Validate variable value
   */
  private validateVariableValue(variable: MakeVariable, value: any): void {
    // Type validation
    switch (variable.type) {
      case 'number':
        if (typeof value !== 'number') {
          throw new Error(`Variable ${variable.name} must be a number`)
        }
        if (variable.validation?.min !== undefined && value < variable.validation.min) {
          throw new Error(`Variable ${variable.name} must be >= ${variable.validation.min}`)
        }
        if (variable.validation?.max !== undefined && value > variable.validation.max) {
          throw new Error(`Variable ${variable.name} must be <= ${variable.validation.max}`)
        }
        break

      case 'text':
        if (typeof value !== 'string') {
          throw new Error(`Variable ${variable.name} must be a string`)
        }
        if (variable.validation?.pattern) {
          const regex = new RegExp(variable.validation.pattern)
          if (!regex.test(value)) {
            throw new Error(`Variable ${variable.name} does not match required pattern`)
          }
        }
        break

      case 'boolean':
        if (typeof value !== 'boolean') {
          throw new Error(`Variable ${variable.name} must be a boolean`)
        }
        break

      case 'array':
        if (!Array.isArray(value)) {
          throw new Error(`Variable ${variable.name} must be an array`)
        }
        break

      case 'object':
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          throw new Error(`Variable ${variable.name} must be an object`)
        }
        break
    }
  }

  /**
   * Process template variables
   */
  private processTemplateVariables(
    modules: MakeModule[],
    variables: Record<string, any>
  ): MakeModule[] {
    return modules.map(module => ({
      ...module,
      parameters: this.replaceVariablesInObject(module.parameters, variables),
      mapping: module.mapping ? this.replaceVariablesInObject(module.mapping, variables) : undefined,
    }))
  }

  /**
   * Replace variables in object recursively
   */
  private replaceVariablesInObject(obj: any, variables: Record<string, any>): any {
    if (typeof obj === 'string') {
      return obj.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
        return variables[varName] !== undefined ? variables[varName] : match
      })
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.replaceVariablesInObject(item, variables))
    }

    if (obj && typeof obj === 'object') {
      const result: any = {}
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.replaceVariablesInObject(value, variables)
      }
      return result
    }

    return obj
  }

  /**
   * Make API request to Make.com
   */
  private async makeApiRequest(
    method: string,
    endpoint: string,
    data?: any
  ): Promise<any> {
    // Rate limiting
    await this.checkRateLimit()

    const url = `${this.client.baseUrl}/api/v2${endpoint}`
    const headers: Record<string, string> = {
      'Authorization': `Token ${this.client.apiKey}`,
      'Content-Type': 'application/json',
    }

    if (this.client.organizationId) {
      headers['X-Imt-Organization-Id'] = this.client.organizationId
    }

    if (this.client.teamId) {
      headers['X-Imt-Team-Id'] = this.client.teamId
    }

    const options: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(this.client.timeout),
    }

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.body = JSON.stringify(data)
    }

    const response = await fetch(url, options)
    
    if (!response.ok) {
      throw new Error(`Make.com API error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * Check rate limits
   */
  private async checkRateLimit(): Promise<void> {
    const now = new Date()
    
    if (now > this.rateLimiter.resetTime) {
      // Reset rate limiter
      this.rateLimiter = {
        requests: 1,
        resetTime: new Date(now.getTime() + 60000), // 1 minute
      }
      return
    }

    if (this.rateLimiter.requests >= this.client.rateLimit.requestsPerMinute) {
      const waitTime = this.rateLimiter.resetTime.getTime() - now.getTime()
      throw new Error(`Rate limit exceeded. Wait ${waitTime}ms`)
    }

    this.rateLimiter.requests++
  }

  /**
   * Initialize built-in templates
   */
  private initializeTemplates(): void {
    // Email automation template
    this.templates.set('email-automation', {
      id: 'email-automation',
      name: 'Email Automation',
      description: 'Automated email sending with personalization',
      category: 'communication',
      tags: ['email', 'automation', 'marketing'],
      modules: [
        {
          id: 'webhook',
          name: 'Webhook',
          type: 'trigger',
          app: 'webhook',
          operation: 'trigger',
          parameters: {
            name: 'Email Trigger',
          },
          position: { x: 0, y: 0 },
        },
        {
          id: 'email',
          name: 'Send Email',
          type: 'action',
          app: 'email',
          operation: 'send',
          parameters: {
            to: '{{recipientEmail}}',
            subject: '{{subject}}',
            content: '{{message}}',
            fromName: '{{senderName}}',
          },
          position: { x: 300, y: 0 },
        },
      ],
      connections: [
        {
          from: { moduleId: 'webhook', outputPort: 'data' },
          to: { moduleId: 'email', inputPort: 'trigger' },
        },
      ],
      variables: [
        {
          name: 'recipientEmail',
          type: 'text',
          description: 'Email address of the recipient',
          required: true,
          validation: {
            pattern: '^[\\w\\.-]+@[\\w\\.-]+\\.[a-zA-Z]{2,}$',
          },
        },
        {
          name: 'subject',
          type: 'text',
          description: 'Email subject line',
          required: true,
        },
        {
          name: 'message',
          type: 'text',
          description: 'Email message content',
          required: true,
        },
        {
          name: 'senderName',
          type: 'text',
          description: 'Name of the sender',
          defaultValue: 'Roomicor',
          required: false,
        },
      ],
      settings: {
        sequential: true,
        maxResults: 1,
        timeout: 300,
      },
      metadata: {
        author: 'Roomicor',
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    })

    // CRM integration template
    this.templates.set('crm-integration', {
      id: 'crm-integration',
      name: 'CRM Integration',
      description: 'Sync data with CRM systems',
      category: 'integration',
      tags: ['crm', 'sync', 'data'],
      modules: [
        {
          id: 'webhook',
          name: 'Data Webhook',
          type: 'trigger',
          app: 'webhook',
          operation: 'trigger',
          parameters: {},
          position: { x: 0, y: 0 },
        },
        {
          id: 'filter',
          name: 'Data Filter',
          type: 'filter',
          app: 'filter',
          operation: 'filter',
          parameters: {
            condition: 'exists',
            field: 'email',
          },
          position: { x: 200, y: 0 },
        },
        {
          id: 'crm',
          name: 'Create CRM Contact',
          type: 'action',
          app: '{{crmApp}}',
          operation: 'createContact',
          parameters: {
            firstName: '{{firstName}}',
            lastName: '{{lastName}}',
            email: '{{email}}',
            company: '{{company}}',
          },
          position: { x: 400, y: 0 },
        },
      ],
      connections: [
        {
          from: { moduleId: 'webhook', outputPort: 'data' },
          to: { moduleId: 'filter', inputPort: 'data' },
        },
        {
          from: { moduleId: 'filter', outputPort: 'data' },
          to: { moduleId: 'crm', inputPort: 'data' },
        },
      ],
      variables: [
        {
          name: 'crmApp',
          type: 'text',
          description: 'CRM application to use (hubspot, salesforce, etc.)',
          required: true,
        },
        {
          name: 'firstName',
          type: 'text',
          description: 'Contact first name',
          required: true,
        },
        {
          name: 'lastName',
          type: 'text',
          description: 'Contact last name',
          required: true,
        },
        {
          name: 'email',
          type: 'text',
          description: 'Contact email address',
          required: true,
        },
        {
          name: 'company',
          type: 'text',
          description: 'Contact company',
          required: false,
        },
      ],
      settings: {
        sequential: true,
        maxResults: 1,
      },
      metadata: {
        author: 'Roomicor',
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    })
  }

  /**
   * Utility methods
   */
  private generateExecutionId(): string {
    return `make_exec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  /**
   * Public methods
   */
  getTemplates(): MakeScenarioTemplate[] {
    return Array.from(this.templates.values())
  }

  getTemplate(templateId: string): MakeScenarioTemplate | undefined {
    return this.templates.get(templateId)
  }

  addTemplate(template: MakeScenarioTemplate): void {
    this.templates.set(template.id, template)
    this.emit('templateAdded', template.id)
  }

  getExecutions(): MakeExecution[] {
    return Array.from(this.executions.values())
  }

  getExecution(executionId: string): MakeExecution | undefined {
    return this.executions.get(executionId)
  }

  async getOrganizationUsage(): Promise<any> {
    return this.makeApiRequest('GET', '/organizations/usage')
  }

  async listScenarios(): Promise<any> {
    return this.makeApiRequest('GET', '/scenarios')
  }

  async getScenario(scenarioId: string): Promise<any> {
    return this.makeApiRequest('GET', `/scenarios/${scenarioId}`)
  }

  async activateScenario(scenarioId: string): Promise<void> {
    await this.makeApiRequest('POST', `/scenarios/${scenarioId}/start`)
    this.emit('scenarioActivated', scenarioId)
  }

  async deactivateScenario(scenarioId: string): Promise<void> {
    await this.makeApiRequest('POST', `/scenarios/${scenarioId}/stop`)
    this.emit('scenarioDeactivated', scenarioId)
  }
}

/**
 * Factory function to create enhanced Make.com client
 */
export async function createEnhancedMakeClient(client: MakeClient): Promise<EnhancedMakeClient> {
  const db = await createDatabaseService()
  return new EnhancedMakeClient(client, db)
}

/**
 * Default Make.com client configuration
 */
export const defaultMakeClient: MakeClient = {
  baseUrl: 'https://eu1.make.com',
  apiKey: process.env.MAKE_API_KEY || '',
  organizationId: process.env.MAKE_ORGANIZATION_ID || '',
  teamId: process.env.MAKE_TEAM_ID,
  timeout: 30000,
  rateLimit: {
    requestsPerMinute: 100,
    burstLimit: 10,
  },
}