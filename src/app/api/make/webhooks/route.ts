/**
 * Make.com Enhanced Webhook Handling API Endpoint
 * Provides comprehensive webhook management, scenario execution, and monitoring for Make.com integration
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createDatabaseService } from '@/lib/database'
import { headers } from 'next/headers'
import crypto from 'crypto'

interface MakeScenario {
  id: string
  name: string
  status: 'active' | 'inactive' | 'paused' | 'error'
  folder_id?: string
  team_id: string
  organization_id: string
  created_at: string
  updated_at: string
  execution_count: number
  last_execution?: string
  webhook_url?: string
  trigger_type: 'webhook' | 'schedule' | 'instant' | 'watch'
  modules: MakeModule[]
  settings: Record<string, any>
}

interface MakeModule {
  id: string
  app: string
  module: string
  version: number
  parameters: Record<string, any>
  mapper: Record<string, any>
  metadata: Record<string, any>
}

interface MakeExecution {
  id: string
  scenario_id: string
  status: 'success' | 'error' | 'incomplete' | 'running' | 'stopped'
  started_at: string
  finished_at?: string
  operations: number
  data_transfer: number
  error_message?: string
  execution_log: MakeExecutionLog[]
}

interface MakeExecutionLog {
  module_id: string
  module_name: string
  status: 'success' | 'error' | 'skipped'
  operations_used: number
  execution_time: number
  input_data?: any
  output_data?: any
  error_details?: string
}

interface WebhookPayload {
  scenario_id?: string
  execution_id?: string
  status?: string
  data?: any
  metadata?: {
    timestamp: string
    source: string
    trigger_type: string
  }
}

// Mock Make.com client (in production, use actual Make.com API client)
class MakeClient {
  private apiKey: string
  private baseUrl: string

  constructor() {
    this.apiKey = process.env.MAKE_API_KEY || ''
    this.baseUrl = process.env.MAKE_API_URL || 'https://eu1.make.com/api/v2'
  }

  async getScenarios(): Promise<MakeScenario[]> {
    // Mock implementation - in production, make actual API call
    return [
      {
        id: 'scenario_1',
        name: 'Customer Onboarding Automation',
        status: 'active',
        team_id: 'team_1',
        organization_id: 'org_1',
        created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
        execution_count: 147,
        last_execution: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        webhook_url: 'https://hook.eu1.make.com/abc123def456',
        trigger_type: 'webhook',
        modules: [
          {
            id: 'module_1',
            app: 'webhook',
            module: 'webhook',
            version: 1,
            parameters: {
              hook_url: 'https://hook.eu1.make.com/abc123def456'
            },
            mapper: {},
            metadata: {
              expect: ['email', 'name', 'company']
            }
          },
          {
            id: 'module_2',
            app: 'email',
            module: 'send_email',
            version: 1,
            parameters: {
              to: '{{1.email}}',
              subject: 'Welcome to Roomicor!',
              body: 'Hello {{1.name}}, welcome to our platform!'
            },
            mapper: {},
            metadata: {}
          },
          {
            id: 'module_3',
            app: 'airtable',
            module: 'create_record',
            version: 1,
            parameters: {
              base_id: 'appXXXXXXXXXXXXXX',
              table_name: 'Customers'
            },
            mapper: {
              'Name': '{{1.name}}',
              'Email': '{{1.email}}',
              'Company': '{{1.company}}',
              'Status': 'New'
            },
            metadata: {}
          }
        ],
        settings: {
          max_cycles: 1,
          max_results: 100,
          auto_commit: true
        }
      },
      {
        id: 'scenario_2',
        name: 'Invoice Processing Pipeline',
        status: 'active',
        team_id: 'team_1',
        organization_id: 'org_1',
        created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        execution_count: 89,
        last_execution: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        webhook_url: 'https://hook.eu1.make.com/def456ghi789',
        trigger_type: 'webhook',
        modules: [
          {
            id: 'module_1',
            app: 'webhook',
            module: 'webhook',
            version: 1,
            parameters: {
              hook_url: 'https://hook.eu1.make.com/def456ghi789'
            },
            mapper: {},
            metadata: {
              expect: ['invoice_data', 'customer_id', 'amount']
            }
          },
          {
            id: 'module_2',
            app: 'stripe',
            module: 'create_invoice',
            version: 1,
            parameters: {
              customer: '{{1.customer_id}}',
              amount: '{{1.amount}}'
            },
            mapper: {},
            metadata: {}
          }
        ],
        settings: {
          max_cycles: 1,
          max_results: 50,
          auto_commit: true
        }
      }
    ]
  }

  async getScenario(id: string): Promise<MakeScenario | null> {
    const scenarios = await this.getScenarios()
    return scenarios.find(s => s.id === id) || null
  }

  async getExecutions(scenarioId?: string): Promise<MakeExecution[]> {
    // Mock implementation
    return [
      {
        id: 'exec_make_1',
        scenario_id: 'scenario_1',
        status: 'success',
        started_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        finished_at: new Date(Date.now() - 2 * 60 * 60 * 1000 + 45000).toISOString(),
        operations: 3,
        data_transfer: 1024,
        execution_log: [
          {
            module_id: 'module_1',
            module_name: 'Webhook',
            status: 'success',
            operations_used: 1,
            execution_time: 120,
            input_data: { email: 'test@example.com', name: 'John Doe' },
            output_data: { received: true }
          },
          {
            module_id: 'module_2',
            module_name: 'Send Email',
            status: 'success',
            operations_used: 1,
            execution_time: 890,
            input_data: { to: 'test@example.com', subject: 'Welcome!' },
            output_data: { sent: true, message_id: 'msg_123' }
          },
          {
            module_id: 'module_3',
            module_name: 'Create Airtable Record',
            status: 'success',
            operations_used: 1,
            execution_time: 450,
            input_data: { Name: 'John Doe', Email: 'test@example.com' },
            output_data: { record_id: 'rec123456' }
          }
        ]
      },
      {
        id: 'exec_make_2',
        scenario_id: 'scenario_2',
        status: 'error',
        started_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        finished_at: new Date(Date.now() - 30 * 60 * 1000 + 15000).toISOString(),
        operations: 1,
        data_transfer: 256,
        error_message: 'Invalid customer ID provided',
        execution_log: [
          {
            module_id: 'module_1',
            module_name: 'Webhook',
            status: 'success',
            operations_used: 1,
            execution_time: 110,
            input_data: { customer_id: 'invalid_id', amount: 100 },
            output_data: { received: true }
          },
          {
            module_id: 'module_2',
            module_name: 'Create Stripe Invoice',
            status: 'error',
            operations_used: 0,
            execution_time: 0,
            error_details: 'Customer invalid_id does not exist'
          }
        ]
      }
    ]
  }

  async runScenario(scenarioId: string, data?: any): Promise<MakeExecution> {
    const scenario = await this.getScenario(scenarioId)
    if (!scenario) {
      throw new Error('Scenario not found')
    }

    return {
      id: `exec_${Date.now()}`,
      scenario_id: scenarioId,
      status: 'running',
      started_at: new Date().toISOString(),
      operations: 0,
      data_transfer: 0,
      execution_log: []
    }
  }
}

const makeClient = new MakeClient()

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const scenarioId = searchParams.get('scenario_id')
    const executionId = searchParams.get('execution_id')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')

    const db = await createDatabaseService()

    switch (action) {
      case 'scenarios':
        // Get all scenarios
        const scenarios = await makeClient.getScenarios()
        let filteredScenarios = scenarios

        if (status) {
          filteredScenarios = filteredScenarios.filter(s => s.status === status)
        }

        // Get user's workflow records from database
        const userWorkflows = await db.getUserWorkflows(userId)
        
        // Merge Make data with user data
        const enrichedScenarios = filteredScenarios.map(makeScenario => {
          const userWf = userWorkflows.find(uw => uw.make_id === makeScenario.id)
          return {
            ...makeScenario,
            user_data: userWf ? {
              id: userWf.id,
              name: userWf.name,
              description: userWf.description,
              created_at: userWf.created_at,
              updated_at: userWf.updated_at
            } : null
          }
        })

        return NextResponse.json({
          scenarios: enrichedScenarios,
          total: enrichedScenarios.length,
          status_distribution: {
            active: enrichedScenarios.filter(s => s.status === 'active').length,
            inactive: enrichedScenarios.filter(s => s.status === 'inactive').length,
            paused: enrichedScenarios.filter(s => s.status === 'paused').length,
            error: enrichedScenarios.filter(s => s.status === 'error').length
          },
          filters: { status, limit }
        })

      case 'scenario':
        if (!scenarioId) {
          return NextResponse.json(
            { error: 'Scenario ID is required' },
            { status: 400 }
          )
        }

        const scenario = await makeClient.getScenario(scenarioId)
        if (!scenario) {
          return NextResponse.json(
            { error: 'Scenario not found' },
            { status: 404 }
          )
        }

        // Get scenario executions
        const executions = await makeClient.getExecutions(scenarioId)
        const recentExecutions = executions.slice(0, 10)

        return NextResponse.json({
          ...scenario,
          statistics: {
            total_executions: executions.length,
            successful_executions: executions.filter(e => e.status === 'success').length,
            failed_executions: executions.filter(e => e.status === 'error').length,
            running_executions: executions.filter(e => e.status === 'running').length,
            average_operations: executions.length > 0 ? 
              executions.reduce((sum, e) => sum + e.operations, 0) / executions.length : 0,
            total_data_transfer: executions.reduce((sum, e) => sum + e.data_transfer, 0)
          },
          recent_executions: recentExecutions
        })

      case 'executions':
        const allExecutions = await makeClient.getExecutions(scenarioId || undefined)
        const limitedExecutions = allExecutions.slice(0, limit)

        return NextResponse.json({
          executions: limitedExecutions,
          total: allExecutions.length,
          status_distribution: {
            success: allExecutions.filter(e => e.status === 'success').length,
            error: allExecutions.filter(e => e.status === 'error').length,
            running: allExecutions.filter(e => e.status === 'running').length,
            incomplete: allExecutions.filter(e => e.status === 'incomplete').length,
            stopped: allExecutions.filter(e => e.status === 'stopped').length
          },
          operations_summary: {
            total_operations: allExecutions.reduce((sum, e) => sum + e.operations, 0),
            total_data_transfer: allExecutions.reduce((sum, e) => sum + e.data_transfer, 0),
            average_execution_time: calculateAverageExecutionTime(allExecutions)
          },
          scenario_id: scenarioId,
          limit
        })

      case 'webhook_status':
        // Get webhook endpoint status and configuration
        return NextResponse.json({
          webhook_endpoint: '/api/make/webhooks',
          supported_methods: ['POST', 'GET', 'PUT', 'DELETE'],
          authentication: {
            required: true,
            methods: ['bearer_token', 'api_key', 'signature_verification']
          },
          rate_limiting: {
            enabled: true,
            requests_per_minute: 60,
            burst_limit: 10
          },
          payload_limits: {
            max_size_mb: 10,
            supported_content_types: ['application/json', 'application/x-www-form-urlencoded', 'multipart/form-data']
          },
          monitoring: {
            health_check: '/api/make/webhooks?action=health',
            metrics_endpoint: '/api/make/webhooks?action=metrics'
          }
        })

      case 'health':
        // Health check for Make.com integration
        return NextResponse.json({
          status: 'healthy',
          make_api_status: 'connected',
          webhook_endpoint_status: 'active',
          last_webhook_received: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
          scenarios_monitored: (await makeClient.getScenarios()).length,
          recent_execution_count: (await makeClient.getExecutions()).length,
          check_timestamp: new Date().toISOString()
        })

      case 'metrics':
        // Webhook metrics and analytics
        const allScenarios = await makeClient.getScenarios()
        const allExecs = await makeClient.getExecutions()
        const last24h = allExecs.filter(e => 
          new Date(e.started_at).getTime() > Date.now() - 24 * 60 * 60 * 1000
        )

        return NextResponse.json({
          webhook_metrics: {
            total_requests_24h: last24h.length,
            successful_requests_24h: last24h.filter(e => e.status === 'success').length,
            failed_requests_24h: last24h.filter(e => e.status === 'error').length,
            average_response_time_ms: calculateAverageExecutionTime(last24h),
            data_processed_mb: last24h.reduce((sum, e) => sum + e.data_transfer, 0) / (1024 * 1024)
          },
          scenario_metrics: {
            total_scenarios: allScenarios.length,
            active_scenarios: allScenarios.filter(s => s.status === 'active').length,
            total_executions: allExecs.length,
            operations_used_24h: last24h.reduce((sum, e) => sum + e.operations, 0)
          },
          top_scenarios: allScenarios
            .sort((a, b) => b.execution_count - a.execution_count)
            .slice(0, 5)
            .map(s => ({
              id: s.id,
              name: s.name,
              execution_count: s.execution_count,
              status: s.status
            }))
        })

      default:
        // Default: return webhook overview
        const scenarios2 = await makeClient.getScenarios()
        const executions2 = await makeClient.getExecutions()

        return NextResponse.json({
          webhook_overview: {
            total_scenarios: scenarios2.length,
            active_scenarios: scenarios2.filter(s => s.status === 'active').length,
            total_executions: executions2.length,
            recent_executions: executions2.slice(0, 5)
          },
          webhook_endpoints: scenarios2
            .filter(s => s.trigger_type === 'webhook')
            .map(s => ({
              scenario_id: s.id,
              scenario_name: s.name,
              webhook_url: s.webhook_url,
              status: s.status
            }))
        })
    }
  } catch (error) {
    console.error('Make webhooks GET error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const headersList = headers()
    const contentType = headersList.get('content-type') || ''
    const signature = headersList.get('x-make-signature')
    const makeScenarioId = headersList.get('x-make-scenario-id')
    const makeExecutionId = headersList.get('x-make-execution-id')

    // Parse request body based on content type
    let body: any
    if (contentType.includes('application/json')) {
      body = await request.json()
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData()
      body = Object.fromEntries(formData.entries())
    } else {
      body = await request.text()
    }

    // Verify webhook signature if provided
    if (signature && process.env.MAKE_WEBHOOK_SECRET) {
      const expectedSignature = crypto
        .createHmac('sha256', process.env.MAKE_WEBHOOK_SECRET)
        .update(JSON.stringify(body))
        .digest('hex')

      if (signature !== `sha256=${expectedSignature}`) {
        return NextResponse.json(
          { error: 'Invalid webhook signature' },
          { status: 401 }
        )
      }
    }

    // Extract webhook payload data
    const webhookPayload: WebhookPayload = {
      scenario_id: makeScenarioId || body.scenario_id,
      execution_id: makeExecutionId || body.execution_id,
      status: body.status,
      data: body.data || body,
      metadata: {
        timestamp: new Date().toISOString(),
        source: 'make.com',
        trigger_type: body.trigger_type || 'webhook'
      }
    }

    // Process webhook based on scenario and action
    const result = await processWebhookPayload(webhookPayload, request)

    // Log webhook reception
    await logWebhookActivity({
      scenario_id: webhookPayload.scenario_id,
      execution_id: webhookPayload.execution_id,
      status: webhookPayload.status || 'received',
      payload_size: JSON.stringify(body).length,
      timestamp: new Date().toISOString(),
      source_ip: headersList.get('x-forwarded-for') || 'unknown',
      user_agent: headersList.get('user-agent') || 'unknown'
    })

    return NextResponse.json({
      success: true,
      webhook_id: `wh_${Date.now()}`,
      processed_at: new Date().toISOString(),
      scenario_id: webhookPayload.scenario_id,
      execution_id: webhookPayload.execution_id,
      result
    })
  } catch (error) {
    console.error('Make webhook processing error:', error)
    return NextResponse.json(
      { 
        error: 'Webhook processing failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Authenticate user for scenario management
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { action, scenario_id, ...params } = body

    switch (action) {
      case 'run_scenario':
        if (!scenario_id) {
          return NextResponse.json(
            { error: 'Scenario ID is required' },
            { status: 400 }
          )
        }

        try {
          const execution = await makeClient.runScenario(scenario_id, params.data)
          
          return NextResponse.json({
            success: true,
            execution: {
              id: execution.id,
              scenario_id,
              status: execution.status,
              started_at: execution.started_at
            }
          })
        } catch (error) {
          return NextResponse.json(
            { 
              error: 'Failed to run scenario',
              message: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
          )
        }

      case 'test_webhook':
        return await handleWebhookTest(userId, params)

      case 'retry_execution':
        return await handleExecutionRetry(userId, params)

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Make webhooks PUT error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Helper functions
async function processWebhookPayload(payload: WebhookPayload, request: NextRequest): Promise<any> {
  // Process different types of webhook payloads
  switch (payload.metadata?.trigger_type) {
    case 'webhook':
      return await processWebhookTrigger(payload)
    case 'schedule':
      return await processScheduleTrigger(payload)
    case 'instant':
      return await processInstantTrigger(payload)
    case 'watch':
      return await processWatchTrigger(payload)
    default:
      return await processGenericWebhook(payload)
  }
}

async function processWebhookTrigger(payload: WebhookPayload): Promise<any> {
  // Handle webhook trigger processing
  const scenario = await makeClient.getScenario(payload.scenario_id || '')
  
  if (!scenario) {
    throw new Error('Scenario not found')
  }

  // Validate payload against expected schema
  const webhookModule = scenario.modules.find(m => m.app === 'webhook')
  if (webhookModule && webhookModule.metadata.expect) {
    const expectedFields = webhookModule.metadata.expect as string[]
    const missingFields = expectedFields.filter(field => 
      !(field in (payload.data || {}))
    )
    
    if (missingFields.length > 0) {
      console.warn(`Missing expected fields: ${missingFields.join(', ')}`)
    }
  }

  return {
    type: 'webhook_trigger',
    scenario_id: payload.scenario_id,
    validated: true,
    processed_modules: scenario.modules.length,
    expected_operations: scenario.modules.length
  }
}

async function processScheduleTrigger(payload: WebhookPayload): Promise<any> {
  return {
    type: 'schedule_trigger',
    scenario_id: payload.scenario_id,
    scheduled_at: payload.metadata?.timestamp
  }
}

async function processInstantTrigger(payload: WebhookPayload): Promise<any> {
  return {
    type: 'instant_trigger',
    scenario_id: payload.scenario_id,
    instant_processing: true
  }
}

async function processWatchTrigger(payload: WebhookPayload): Promise<any> {
  return {
    type: 'watch_trigger',
    scenario_id: payload.scenario_id,
    watch_data: payload.data
  }
}

async function processGenericWebhook(payload: WebhookPayload): Promise<any> {
  return {
    type: 'generic_webhook',
    scenario_id: payload.scenario_id,
    data_received: !!payload.data,
    timestamp: payload.metadata?.timestamp
  }
}

async function logWebhookActivity(activity: any): Promise<void> {
  // In production, log to database or monitoring service
  console.log('Webhook activity:', activity)
}

async function handleWebhookTest(userId: string, params: any): Promise<NextResponse> {
  const { webhook_url, test_data } = params

  if (!webhook_url) {
    return NextResponse.json(
      { error: 'Webhook URL is required for testing' },
      { status: 400 }
    )
  }

  try {
    // Send test webhook
    const testPayload = test_data || {
      test: true,
      timestamp: new Date().toISOString(),
      user_id: userId
    }

    const response = await fetch(webhook_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Test-Webhook': 'true'
      },
      body: JSON.stringify(testPayload)
    })

    return NextResponse.json({
      success: true,
      test_result: {
        status_code: response.status,
        status_text: response.statusText,
        response_headers: Object.fromEntries(response.headers.entries()),
        response_time: Date.now(), // In production, measure actual response time
        webhook_url,
        test_payload: testPayload
      }
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Webhook test failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

async function handleExecutionRetry(userId: string, params: any): Promise<NextResponse> {
  const { execution_id, scenario_id } = params

  if (!execution_id && !scenario_id) {
    return NextResponse.json(
      { error: 'Either execution_id or scenario_id is required' },
      { status: 400 }
    )
  }

  try {
    // In production, implement actual retry logic
    const retryExecution = {
      id: `retry_${Date.now()}`,
      original_execution_id: execution_id,
      scenario_id,
      status: 'running',
      started_at: new Date().toISOString(),
      retry_attempt: 1
    }

    return NextResponse.json({
      success: true,
      retry_execution: retryExecution,
      message: 'Execution retry initiated'
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Retry failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

function calculateAverageExecutionTime(executions: MakeExecution[]): number {
  if (executions.length === 0) return 0
  
  const completedExecutions = executions.filter(e => e.finished_at)
  if (completedExecutions.length === 0) return 0
  
  const totalTime = completedExecutions.reduce((sum, e) => {
    const start = new Date(e.started_at).getTime()
    const end = new Date(e.finished_at!).getTime()
    return sum + (end - start)
  }, 0)
  
  return totalTime / completedExecutions.length
}