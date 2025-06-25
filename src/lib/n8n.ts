/**
 * Enhanced n8n Integration
 * Advanced workflow management with templates, monitoring, and batch processing
 */

import { EventEmitter } from 'events'
import { createDatabaseService } from './database'

interface N8nWebhookPayload {
  event?: string
  [key: string]: any
}

interface N8nResponse {
  success?: boolean
  workflowId?: string
  executionId?: string
  data?: any
  error?: string
}

// Enhanced types for n8n integration
export interface N8nWorkflowTemplate {
  id: string
  name: string
  description: string
  category: string
  tags: string[]
  nodes: N8nNode[]
  connections: N8nConnection[]
  variables: N8nVariable[]
  metadata: {
    author: string
    version: string
    createdAt: Date
    updatedAt: Date
  }
}

export interface N8nNode {
  id: string
  name: string
  type: string
  parameters: Record<string, any>
  position: [number, number]
  credentials?: Record<string, string>
}

export interface N8nConnection {
  from: {
    nodeId: string
    outputIndex: number
  }
  to: {
    nodeId: string
    inputIndex: number
  }
}

export interface N8nVariable {
  name: string
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  description: string
  defaultValue?: any
  required: boolean
}

export interface N8nExecution {
  id: string
  workflowId: string
  status: 'new' | 'running' | 'success' | 'error' | 'waiting' | 'canceled'
  startedAt: Date
  finishedAt?: Date
  data: any
  error?: string
  metadata: Record<string, any>
}

export interface N8nWorkflowConfig {
  id: string
  name: string
  active: boolean
  nodes: N8nNode[]
  connections: N8nConnection[]
  settings: Record<string, any>
  staticData?: Record<string, any>
  tags?: string[]
}

export interface N8nClient {
  instanceUrl: string
  apiKey: string
  timeout: number
  retryConfig: {
    maxRetries: number
    retryDelay: number
  }
}

export async function triggerN8nWorkflow(payload: N8nWebhookPayload): Promise<N8nResponse> {
  if (!process.env.N8N_WEBHOOK_URL) {
    throw new Error('N8N_WEBHOOK_URL is not configured')
  }

  try {
    const response = await fetch(process.env.N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.N8N_API_KEY && {
          'Authorization': `Bearer ${process.env.N8N_API_KEY}`
        })
      },
      body: JSON.stringify({
        ...payload,
        timestamp: new Date().toISOString(),
        source: 'nextjs-app'
      }),
    })

    if (!response.ok) {
      throw new Error(`n8n webhook failed: ${response.status} ${response.statusText}`)
    }

    // Some webhooks might not return JSON
    const contentType = response.headers.get('content-type')
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json()
      return data
    } else {
      const text = await response.text()
      return { success: true, data: text }
    }
  } catch (error: any) {
    console.error('Error triggering n8n workflow:', error)
    throw new Error(`Failed to trigger n8n workflow: ${error.message}`)
  }
}

export async function getN8nWorkflows() {
  if (!process.env.N8N_INSTANCE_URL || !process.env.N8N_API_KEY) {
    throw new Error('n8n API configuration missing (N8N_INSTANCE_URL or N8N_API_KEY)')
  }

  try {
    const response = await fetch(`${process.env.N8N_INSTANCE_URL}/api/v1/workflows`, {
      headers: {
        'X-N8N-API-KEY': process.env.N8N_API_KEY,
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch workflows: ${response.status} ${response.statusText}`)
    }

    return response.json()
  } catch (error: any) {
    console.error('Error fetching n8n workflows:', error)
    throw error
  }
}

export async function executeN8nWorkflow(workflowId: string, data?: any) {
  if (!process.env.N8N_INSTANCE_URL || !process.env.N8N_API_KEY) {
    throw new Error('n8n API configuration missing')
  }

  try {
    const response = await fetch(
      `${process.env.N8N_INSTANCE_URL}/api/v1/workflows/${workflowId}/execute`,
      {
        method: 'POST',
        headers: {
          'X-N8N-API-KEY': process.env.N8N_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: data || {} }),
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to execute workflow: ${response.status} ${response.statusText}`)
    }

    return response.json()
  } catch (error: any) {
    console.error('Error executing n8n workflow:', error)
    throw error
  }
}

// Predefined workflow triggers for common events
export const N8nWorkflows = {
  USER_SIGNUP: (userId: string, email: string) => triggerN8nWorkflow({
    event: 'user.signup',
    userId,
    email,
    platform: 'web'
  }),

  ORDER_CREATED: (orderId: string, userId: string, amount: number) => triggerN8nWorkflow({
    event: 'order.created',
    orderId,
    userId,
    amount,
    currency: 'EUR'
  }),

  PAYMENT_SUCCESSFUL: (paymentId: string, amount: number, userId: string) => triggerN8nWorkflow({
    event: 'payment.successful',
    paymentId,
    amount,
    userId,
    provider: 'stripe'
  }),

  USER_ACTIVITY: (userId: string, action: string, metadata?: any) => triggerN8nWorkflow({
    event: 'user.activity',
    userId,
    action,
    metadata,
    timestamp: new Date().toISOString()
  }),

  SEND_NOTIFICATION: (userId: string, type: string, message: string, channels?: string[]) => triggerN8nWorkflow({
    event: 'notification.send',
    userId,
    type,
    message,
    channels: channels || ['email']
  })
}

/**
 * Enhanced N8N Client
 * Advanced workflow management with templates and monitoring
 */
export class EnhancedN8nClient extends EventEmitter {
  private client: N8nClient
  private db: Awaited<ReturnType<typeof createDatabaseService>>
  private templates: Map<string, N8nWorkflowTemplate> = new Map()
  private executions: Map<string, N8nExecution> = new Map()

  constructor(
    client: N8nClient,
    db: Awaited<ReturnType<typeof createDatabaseService>>
  ) {
    super()
    this.client = client
    this.db = db
    this.initializeTemplates()
  }

  /**
   * Create workflow from template
   */
  async createWorkflowFromTemplate(
    templateId: string,
    variables: Record<string, any> = {},
    customName?: string
  ): Promise<string> {
    const template = this.templates.get(templateId)
    if (!template) {
      throw new Error(`Template ${templateId} not found`)
    }

    // Replace variables in template
    const processedNodes = this.processTemplateVariables(template.nodes, variables)
    
    const workflowConfig: N8nWorkflowConfig = {
      id: this.generateWorkflowId(),
      name: customName || `${template.name} - ${new Date().toISOString()}`,
      active: false,
      nodes: processedNodes,
      connections: template.connections,
      settings: {},
      tags: [...template.tags, 'generated-from-template'],
    }

    // Create workflow via API
    const workflowId = await this.createWorkflow(workflowConfig)
    
    this.emit('workflowCreatedFromTemplate', {
      templateId,
      workflowId,
      variables,
    })

    return workflowId
  }

  /**
   * Create workflow via n8n API
   */
  async createWorkflow(config: N8nWorkflowConfig): Promise<string> {
    const response = await this.makeApiRequest('POST', '/workflows', {
      name: config.name,
      active: config.active,
      nodes: config.nodes,
      connections: config.connections,
      settings: config.settings,
      staticData: config.staticData,
      tags: config.tags,
    })

    return response.id
  }

  /**
   * Execute workflow with monitoring
   */
  async executeWorkflowWithMonitoring(
    workflowId: string,
    data: any = {},
    waitForCompletion: boolean = true
  ): Promise<N8nExecution> {
    const execution: N8nExecution = {
      id: this.generateExecutionId(),
      workflowId,
      status: 'new',
      startedAt: new Date(),
      data,
      metadata: {
        waitForCompletion,
        triggeredBy: 'enhanced-client',
      },
    }

    this.executions.set(execution.id, execution)

    try {
      // Start execution
      const response = await this.makeApiRequest('POST', `/workflows/${workflowId}/execute`, {
        data,
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
  private async waitForExecution(execution: N8nExecution): Promise<void> {
    const maxWaitTime = 300000 // 5 minutes
    const pollInterval = 2000   // 2 seconds
    const startTime = Date.now()

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const status = await this.getExecutionStatus(execution.id)
        execution.status = status.status
        
        if (status.status === 'success' || status.status === 'error') {
          execution.finishedAt = new Date()
          execution.data = status.data
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
   * Batch execute workflows
   */
  async batchExecuteWorkflows(
    requests: Array<{ workflowId: string; data: any }>,
    concurrency: number = 3
  ): Promise<N8nExecution[]> {
    const results: N8nExecution[] = []
    const executing: Promise<N8nExecution>[] = []

    for (const request of requests) {
      // Wait if we've reached concurrency limit
      if (executing.length >= concurrency) {
        const completed = await Promise.race(executing)
        results.push(completed)
        executing.splice(executing.findIndex(p => p === Promise.resolve(completed)), 1)
      }

      // Start new execution
      const execution = this.executeWorkflowWithMonitoring(
        request.workflowId,
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
      failed: results.filter(r => r.status === 'error').length,
    })

    return results
  }

  /**
   * Get workflow analytics
   */
  async getWorkflowAnalytics(workflowId: string, days: number = 30): Promise<any> {
    const executions = await this.makeApiRequest('GET', `/executions`, {
      workflowId,
      limit: 1000,
    })

    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    const recentExecutions = executions.data.filter(
      (exec: any) => new Date(exec.startedAt) >= cutoffDate
    )

    const analytics = {
      totalExecutions: recentExecutions.length,
      successfulExecutions: recentExecutions.filter((e: any) => e.finished && !e.stoppedAt).length,
      failedExecutions: recentExecutions.filter((e: any) => e.stoppedAt).length,
      averageExecutionTime: 0,
      executionsByDay: {} as Record<string, number>,
      commonErrors: {} as Record<string, number>,
    }

    // Calculate average execution time
    const completedExecutions = recentExecutions.filter((e: any) => e.finished)
    if (completedExecutions.length > 0) {
      const totalTime = completedExecutions.reduce((sum: number, exec: any) => {
        const start = new Date(exec.startedAt).getTime()
        const end = new Date(exec.stoppedAt || exec.finishedAt).getTime()
        return sum + (end - start)
      }, 0)
      analytics.averageExecutionTime = totalTime / completedExecutions.length
    }

    // Group by day
    recentExecutions.forEach((exec: any) => {
      const day = new Date(exec.startedAt).toISOString().split('T')[0]
      analytics.executionsByDay[day] = (analytics.executionsByDay[day] || 0) + 1
    })

    // Common errors
    recentExecutions
      .filter((e: any) => e.stoppedAt)
      .forEach((exec: any) => {
        const error = exec.data?.resultData?.error?.message || 'Unknown error'
        analytics.commonErrors[error] = (analytics.commonErrors[error] || 0) + 1
      })

    return analytics
  }

  /**
   * Process template variables
   */
  private processTemplateVariables(
    nodes: N8nNode[],
    variables: Record<string, any>
  ): N8nNode[] {
    return nodes.map(node => ({
      ...node,
      parameters: this.replaceVariablesInObject(node.parameters, variables),
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
   * Make API request to n8n
   */
  private async makeApiRequest(
    method: string,
    endpoint: string,
    data?: any
  ): Promise<any> {
    const url = `${this.client.instanceUrl}/api/v1${endpoint}`
    const headers: Record<string, string> = {
      'X-N8N-API-KEY': this.client.apiKey,
      'Content-Type': 'application/json',
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
      throw new Error(`n8n API error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * Initialize built-in templates
   */
  private initializeTemplates(): void {
    // Email notification template
    this.templates.set('email-notification', {
      id: 'email-notification',
      name: 'Email Notification',
      description: 'Send email notifications to users',
      category: 'communication',
      tags: ['email', 'notification'],
      nodes: [
        {
          id: 'webhook',
          name: 'Webhook',
          type: 'n8n-nodes-base.webhook',
          parameters: {
            httpMethod: 'POST',
            path: 'email-notification',
          },
          position: [250, 300],
        },
        {
          id: 'email',
          name: 'Send Email',
          type: 'n8n-nodes-base.emailSend',
          parameters: {
            fromEmail: '{{fromEmail}}',
            toEmail: '{{toEmail}}',
            subject: '{{subject}}',
            text: '{{message}}',
          },
          position: [450, 300],
        },
      ],
      connections: [
        {
          from: { nodeId: 'webhook', outputIndex: 0 },
          to: { nodeId: 'email', inputIndex: 0 },
        },
      ],
      variables: [
        {
          name: 'fromEmail',
          type: 'string',
          description: 'Sender email address',
          required: true,
        },
        {
          name: 'toEmail',
          type: 'string',
          description: 'Recipient email address',
          required: true,
        },
        {
          name: 'subject',
          type: 'string',
          description: 'Email subject',
          required: true,
        },
        {
          name: 'message',
          type: 'string',
          description: 'Email message content',
          required: true,
        },
      ],
      metadata: {
        author: 'Roomicor',
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    })

    // Slack notification template
    this.templates.set('slack-notification', {
      id: 'slack-notification',
      name: 'Slack Notification',
      description: 'Send notifications to Slack channels',
      category: 'communication',
      tags: ['slack', 'notification'],
      nodes: [
        {
          id: 'webhook',
          name: 'Webhook',
          type: 'n8n-nodes-base.webhook',
          parameters: {
            httpMethod: 'POST',
            path: 'slack-notification',
          },
          position: [250, 300],
        },
        {
          id: 'slack',
          name: 'Send to Slack',
          type: 'n8n-nodes-base.slack',
          parameters: {
            operation: 'postMessage',
            channel: '{{channel}}',
            text: '{{message}}',
            username: '{{botName}}',
          },
          position: [450, 300],
        },
      ],
      connections: [
        {
          from: { nodeId: 'webhook', outputIndex: 0 },
          to: { nodeId: 'slack', inputIndex: 0 },
        },
      ],
      variables: [
        {
          name: 'channel',
          type: 'string',
          description: 'Slack channel ID or name',
          required: true,
        },
        {
          name: 'message',
          type: 'string',
          description: 'Message content',
          required: true,
        },
        {
          name: 'botName',
          type: 'string',
          description: 'Bot username',
          defaultValue: 'Roomicor Bot',
          required: false,
        },
      ],
      metadata: {
        author: 'Roomicor',
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    })

    // Data processing template
    this.templates.set('data-processing', {
      id: 'data-processing',
      name: 'Data Processing Pipeline',
      description: 'Process and transform data with validation',
      category: 'data',
      tags: ['data', 'processing', 'validation'],
      nodes: [
        {
          id: 'webhook',
          name: 'Webhook',
          type: 'n8n-nodes-base.webhook',
          parameters: {
            httpMethod: 'POST',
            path: 'data-processing',
          },
          position: [250, 300],
        },
        {
          id: 'validate',
          name: 'Validate Data',
          type: 'n8n-nodes-base.function',
          parameters: {
            functionCode: `
              const data = items[0].json;
              const requiredFields = {{requiredFields}};
              
              for (const field of requiredFields) {
                if (!data[field]) {
                  throw new Error(\`Missing required field: \${field}\`);
                }
              }
              
              return items;
            `,
          },
          position: [450, 300],
        },
        {
          id: 'transform',
          name: 'Transform Data',
          type: 'n8n-nodes-base.set',
          parameters: {
            values: {
              processedAt: new Date().toISOString(),
              status: 'processed',
            },
          },
          position: [650, 300],
        },
      ],
      connections: [
        {
          from: { nodeId: 'webhook', outputIndex: 0 },
          to: { nodeId: 'validate', inputIndex: 0 },
        },
        {
          from: { nodeId: 'validate', outputIndex: 0 },
          to: { nodeId: 'transform', inputIndex: 0 },
        },
      ],
      variables: [
        {
          name: 'requiredFields',
          type: 'array',
          description: 'List of required field names',
          defaultValue: ['id', 'name'],
          required: true,
        },
      ],
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
  private generateWorkflowId(): string {
    return `workflow_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  private generateExecutionId(): string {
    return `execution_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  /**
   * Public methods
   */
  getTemplates(): N8nWorkflowTemplate[] {
    return Array.from(this.templates.values())
  }

  getTemplate(templateId: string): N8nWorkflowTemplate | undefined {
    return this.templates.get(templateId)
  }

  addTemplate(template: N8nWorkflowTemplate): void {
    this.templates.set(template.id, template)
    this.emit('templateAdded', template.id)
  }

  getExecutions(): N8nExecution[] {
    return Array.from(this.executions.values())
  }

  getExecution(executionId: string): N8nExecution | undefined {
    return this.executions.get(executionId)
  }
}

/**
 * Factory function to create enhanced n8n client
 */
export async function createEnhancedN8nClient(client: N8nClient): Promise<EnhancedN8nClient> {
  const db = await createDatabaseService()
  return new EnhancedN8nClient(client, db)
}

/**
 * Default n8n client configuration
 */
export const defaultN8nClient: N8nClient = {
  instanceUrl: process.env.N8N_INSTANCE_URL || 'http://localhost:5678',
  apiKey: process.env.N8N_API_KEY || '',
  timeout: 30000,
  retryConfig: {
    maxRetries: 3,
    retryDelay: 1000,
  },
}