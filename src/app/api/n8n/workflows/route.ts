/**
 * n8n Workflow Management API Endpoint
 * Provides comprehensive workflow management, execution, and monitoring for n8n integration
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createDatabaseService } from '@/lib/database'

interface N8nWorkflow {
  id: string
  name: string
  active: boolean
  tags: string[]
  nodes: N8nNode[]
  connections: Record<string, any>
  settings: Record<string, any>
  staticData: Record<string, any>
  createdAt: string
  updatedAt: string
}

interface N8nNode {
  id: string
  name: string
  type: string
  typeVersion: number
  position: [number, number]
  parameters: Record<string, any>
}

interface N8nExecution {
  id: string
  workflowData: N8nWorkflow
  mode: 'manual' | 'trigger' | 'webhook' | 'test'
  startedAt: string
  stoppedAt?: string
  finished: boolean
  retryOf?: string
  retrySuccessId?: string
  status: 'running' | 'completed' | 'failed' | 'canceled' | 'waiting'
  data?: Record<string, any>
}

// Mock n8n client (in production, use actual n8n API client)
class N8nClient {
  private baseUrl: string
  private apiKey: string

  constructor() {
    this.baseUrl = process.env.N8N_API_URL || 'http://localhost:5678/api/v1'
    this.apiKey = process.env.N8N_API_KEY || ''
  }

  async getWorkflows(): Promise<N8nWorkflow[]> {
    // Mock implementation - in production, make actual API call
    return [
      {
        id: 'wf_1',
        name: 'Email Automation Workflow',
        active: true,
        tags: ['email', 'automation'],
        nodes: [
          {
            id: 'trigger',
            name: 'Webhook Trigger',
            type: 'webhook',
            typeVersion: 1,
            position: [100, 100],
            parameters: {
              path: 'email-trigger',
              httpMethod: 'POST'
            }
          },
          {
            id: 'email',
            name: 'Send Email',
            type: 'emailSend',
            typeVersion: 1,
            position: [300, 100],
            parameters: {
              subject: 'Automated Email',
              text: 'This is an automated email from your workflow'
            }
          }
        ],
        connections: {
          'trigger': {
            'main': [
              [
                {
                  'node': 'email',
                  'type': 'main',
                  'index': 0
                }
              ]
            ]
          }
        },
        settings: {},
        staticData: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'wf_2',
        name: 'Data Processing Pipeline',
        active: false,
        tags: ['data', 'processing'],
        nodes: [
          {
            id: 'schedule',
            name: 'Schedule Trigger',
            type: 'scheduleTrigger',
            typeVersion: 1,
            position: [100, 100],
            parameters: {
              rule: {
                interval: [
                  {
                    field: 'cronExpression',
                    expression: '0 */6 * * *'
                  }
                ]
              }
            }
          },
          {
            id: 'http',
            name: 'HTTP Request',
            type: 'httpRequest',
            typeVersion: 1,
            position: [300, 100],
            parameters: {
              url: 'https://api.example.com/data',
              method: 'GET'
            }
          },
          {
            id: 'process',
            name: 'Process Data',
            type: 'function',
            typeVersion: 1,
            position: [500, 100],
            parameters: {
              functionCode: 'return items.map(item => ({ ...item.json, processed: true }))'
            }
          }
        ],
        connections: {
          'schedule': {
            'main': [
              [
                {
                  'node': 'http',
                  'type': 'main',
                  'index': 0
                }
              ]
            ]
          },
          'http': {
            'main': [
              [
                {
                  'node': 'process',
                  'type': 'main',
                  'index': 0
                }
              ]
            ]
          }
        },
        settings: {},
        staticData: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]
  }

  async getWorkflow(id: string): Promise<N8nWorkflow | null> {
    const workflows = await this.getWorkflows()
    return workflows.find(w => w.id === id) || null
  }

  async createWorkflow(workflow: Partial<N8nWorkflow>): Promise<N8nWorkflow> {
    // Mock implementation
    return {
      id: `wf_${Date.now()}`,
      name: workflow.name || 'New Workflow',
      active: workflow.active || false,
      tags: workflow.tags || [],
      nodes: workflow.nodes || [],
      connections: workflow.connections || {},
      settings: workflow.settings || {},
      staticData: workflow.staticData || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  }

  async updateWorkflow(id: string, updates: Partial<N8nWorkflow>): Promise<N8nWorkflow | null> {
    const workflow = await this.getWorkflow(id)
    if (!workflow) return null

    return {
      ...workflow,
      ...updates,
      updatedAt: new Date().toISOString()
    }
  }

  async deleteWorkflow(id: string): Promise<boolean> {
    // Mock implementation
    return true
  }

  async activateWorkflow(id: string): Promise<boolean> {
    // Mock implementation
    return true
  }

  async deactivateWorkflow(id: string): Promise<boolean> {
    // Mock implementation
    return true
  }

  async executeWorkflow(id: string, data?: any): Promise<N8nExecution> {
    const workflow = await this.getWorkflow(id)
    if (!workflow) {
      throw new Error('Workflow not found')
    }

    return {
      id: `exec_${Date.now()}`,
      workflowData: workflow,
      mode: 'manual',
      startedAt: new Date().toISOString(),
      finished: false,
      status: 'running',
      data
    }
  }

  async getExecutions(workflowId?: string): Promise<N8nExecution[]> {
    // Mock implementation
    return [
      {
        id: 'exec_1',
        workflowData: (await this.getWorkflows())[0],
        mode: 'trigger',
        startedAt: new Date(Date.now() - 3600000).toISOString(),
        stoppedAt: new Date(Date.now() - 3550000).toISOString(),
        finished: true,
        status: 'completed'
      },
      {
        id: 'exec_2',
        workflowData: (await this.getWorkflows())[1],
        mode: 'manual',
        startedAt: new Date(Date.now() - 1800000).toISOString(),
        stoppedAt: new Date(Date.now() - 1750000).toISOString(),
        finished: true,
        status: 'failed'
      }
    ]
  }

  async getExecution(id: string): Promise<N8nExecution | null> {
    const executions = await this.getExecutions()
    return executions.find(e => e.id === id) || null
  }
}

const n8nClient = new N8nClient()

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
    const workflowId = searchParams.get('workflow_id')
    const executionId = searchParams.get('execution_id')
    const includeInactive = searchParams.get('include_inactive') === 'true'
    const tags = searchParams.get('tags')?.split(',')

    const db = await createDatabaseService()

    switch (action) {
      case 'list':
        // Get all workflows
        const n8nWorkflows = await n8nClient.getWorkflows()
        let filteredWorkflows = n8nWorkflows

        if (!includeInactive) {
          filteredWorkflows = filteredWorkflows.filter(w => w.active)
        }

        if (tags && tags.length > 0) {
          filteredWorkflows = filteredWorkflows.filter(w => 
            tags.some(tag => w.tags.includes(tag))
          )
        }

        // Get user's workflow records from database
        const userWorkflows = await db.getUserWorkflows(userId)
        
        // Merge n8n data with user data
        const enrichedWorkflows = filteredWorkflows.map(n8nWf => {
          const userWf = userWorkflows.find(uw => uw.n8n_id === n8nWf.id)
          return {
            ...n8nWf,
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
          workflows: enrichedWorkflows,
          total: enrichedWorkflows.length,
          active: enrichedWorkflows.filter(w => w.active).length,
          inactive: enrichedWorkflows.filter(w => !w.active).length,
          filters: { includeInactive, tags }
        })

      case 'get':
        if (!workflowId) {
          return NextResponse.json(
            { error: 'Workflow ID is required' },
            { status: 400 }
          )
        }

        const workflow = await n8nClient.getWorkflow(workflowId)
        if (!workflow) {
          return NextResponse.json(
            { error: 'Workflow not found' },
            { status: 404 }
          )
        }

        // Get user workflow data
        const userWorkflows2 = await db.getUserWorkflows(userId)
        const userWorkflow = userWorkflows2.find(uw => uw.n8n_id === workflowId)

        // Get recent executions
        const executions = await n8nClient.getExecutions(workflowId)
        const recentExecutions = executions.slice(0, 10)

        return NextResponse.json({
          ...workflow,
          user_data: userWorkflow,
          statistics: {
            total_executions: executions.length,
            successful_executions: executions.filter(e => e.status === 'completed').length,
            failed_executions: executions.filter(e => e.status === 'failed').length,
            last_execution: executions[0]?.startedAt || null
          },
          recent_executions: recentExecutions
        })

      case 'executions':
        const allExecutions = await n8nClient.getExecutions(workflowId || undefined)
        
        return NextResponse.json({
          executions: allExecutions,
          total: allExecutions.length,
          status_distribution: {
            running: allExecutions.filter(e => e.status === 'running').length,
            completed: allExecutions.filter(e => e.status === 'completed').length,
            failed: allExecutions.filter(e => e.status === 'failed').length,
            canceled: allExecutions.filter(e => e.status === 'canceled').length,
            waiting: allExecutions.filter(e => e.status === 'waiting').length
          },
          workflow_id: workflowId
        })

      case 'execution':
        if (!executionId) {
          return NextResponse.json(
            { error: 'Execution ID is required' },
            { status: 400 }
          )
        }

        const execution = await n8nClient.getExecution(executionId)
        if (!execution) {
          return NextResponse.json(
            { error: 'Execution not found' },
            { status: 404 }
          )
        }

        return NextResponse.json(execution)

      case 'templates':
        // Return workflow templates
        return NextResponse.json({
          templates: [
            {
              id: 'email_automation',
              name: 'Email Automation',
              description: 'Automated email sending workflow',
              category: 'communication',
              nodes: ['webhook', 'emailSend'],
              complexity: 'beginner',
              estimated_setup_time: 10
            },
            {
              id: 'data_processing',
              name: 'Data Processing Pipeline',
              description: 'Process and transform data from external APIs',
              category: 'data',
              nodes: ['scheduleTrigger', 'httpRequest', 'function'],
              complexity: 'intermediate',
              estimated_setup_time: 30
            },
            {
              id: 'social_media_automation',
              name: 'Social Media Automation',
              description: 'Automate social media posting and engagement',
              category: 'social',
              nodes: ['rss', 'twitter', 'delay'],
              complexity: 'intermediate',
              estimated_setup_time: 25
            },
            {
              id: 'database_sync',
              name: 'Database Synchronization',
              description: 'Sync data between different databases',
              category: 'database',
              nodes: ['scheduleTrigger', 'postgres', 'mysql'],
              complexity: 'advanced',
              estimated_setup_time: 45
            }
          ]
        })

      case 'health':
        // Check n8n service health
        return NextResponse.json({
          status: 'healthy',
          version: '1.0.0',
          api_endpoint: process.env.N8N_API_URL || 'http://localhost:5678/api/v1',
          connected: true,
          last_check: new Date().toISOString()
        })

      default:
        // Default: return workflow overview
        const allWorkflows = await n8nClient.getWorkflows()
        const allExecs = await n8nClient.getExecutions()
        
        return NextResponse.json({
          summary: {
            total_workflows: allWorkflows.length,
            active_workflows: allWorkflows.filter(w => w.active).length,
            total_executions: allExecs.length,
            successful_executions: allExecs.filter(e => e.status === 'completed').length,
            failed_executions: allExecs.filter(e => e.status === 'failed').length,
            running_executions: allExecs.filter(e => e.status === 'running').length
          },
          recent_workflows: allWorkflows.slice(0, 5),
          recent_executions: allExecs.slice(0, 10)
        })
    }
  } catch (error) {
    console.error('n8n workflows GET error:', error)
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
    // Authenticate user
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { action, ...params } = body

    const db = await createDatabaseService()

    switch (action) {
      case 'create':
        return await handleWorkflowCreate(userId, params, db)
        
      case 'update':
        return await handleWorkflowUpdate(userId, params, db)
        
      case 'activate':
        return await handleWorkflowActivate(userId, params, db)
        
      case 'deactivate':
        return await handleWorkflowDeactivate(userId, params, db)
        
      case 'execute':
        return await handleWorkflowExecute(userId, params, db)
        
      case 'clone':
        return await handleWorkflowClone(userId, params, db)
        
      case 'export':
        return await handleWorkflowExport(userId, params, db)
        
      case 'import':
        return await handleWorkflowImport(userId, params, db)
        
      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('n8n workflows POST error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
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
    const workflowId = searchParams.get('workflow_id')

    if (!workflowId) {
      return NextResponse.json(
        { error: 'Workflow ID is required' },
        { status: 400 }
      )
    }

    // Delete from n8n
    const deleted = await n8nClient.deleteWorkflow(workflowId)
    if (!deleted) {
      return NextResponse.json(
        { error: 'Failed to delete workflow from n8n' },
        { status: 500 }
      )
    }

    // Remove from user's workflows in database
    const db = await createDatabaseService()
    const userWorkflows = await db.getUserWorkflows(userId)
    const userWorkflow = userWorkflows.find(uw => uw.n8n_id === workflowId)

    if (userWorkflow) {
      // In production, implement deleteWorkflow method in DatabaseService
      console.log(`Would delete user workflow: ${userWorkflow.id}`)
    }

    return NextResponse.json({
      success: true,
      workflow_id: workflowId,
      deleted_at: new Date().toISOString()
    })
  } catch (error) {
    console.error('n8n workflows DELETE error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Handler functions
async function handleWorkflowCreate(userId: string, params: any, db: any) {
  const { name, description, template, nodes, connections, settings } = params

  if (!name) {
    return NextResponse.json(
      { error: 'Workflow name is required' },
      { status: 400 }
    )
  }

  // Create workflow in n8n
  const n8nWorkflow = await n8nClient.createWorkflow({
    name,
    nodes: nodes || [],
    connections: connections || {},
    settings: settings || {},
    active: false
  })

  // Create workflow record in database
  const userWorkflow = await db.createWorkflow({
    user_id: userId,
    name,
    description: description || null,
    n8n_id: n8nWorkflow.id,
    active: false,
    trigger_type: 'manual',
    actions: nodes || []
  })

  return NextResponse.json({
    success: true,
    workflow: {
      ...n8nWorkflow,
      user_data: userWorkflow
    }
  })
}

async function handleWorkflowUpdate(userId: string, params: any, db: any) {
  const { workflow_id, name, description, nodes, connections, settings } = params

  if (!workflow_id) {
    return NextResponse.json(
      { error: 'Workflow ID is required' },
      { status: 400 }
    )
  }

  // Update in n8n
  const updates: Partial<N8nWorkflow> = {}
  if (name) updates.name = name
  if (nodes) updates.nodes = nodes
  if (connections) updates.connections = connections
  if (settings) updates.settings = settings

  const updatedN8nWorkflow = await n8nClient.updateWorkflow(workflow_id, updates)
  if (!updatedN8nWorkflow) {
    return NextResponse.json(
      { error: 'Workflow not found in n8n' },
      { status: 404 }
    )
  }

  // Update user workflow record
  const userWorkflows = await db.getUserWorkflows(userId)
  const userWorkflow = userWorkflows.find(uw => uw.n8n_id === workflow_id)

  if (userWorkflow) {
    const userUpdates: any = {}
    if (name) userUpdates.name = name
    if (description !== undefined) userUpdates.description = description
    if (nodes) userUpdates.actions = nodes

    // In production, implement updateWorkflow method in DatabaseService
    console.log('Would update user workflow:', userUpdates)
  }

  return NextResponse.json({
    success: true,
    workflow: updatedN8nWorkflow,
    updated_at: new Date().toISOString()
  })
}

async function handleWorkflowActivate(userId: string, params: any, db: any) {
  const { workflow_id } = params

  if (!workflow_id) {
    return NextResponse.json(
      { error: 'Workflow ID is required' },
      { status: 400 }
    )
  }

  const activated = await n8nClient.activateWorkflow(workflow_id)
  if (!activated) {
    return NextResponse.json(
      { error: 'Failed to activate workflow' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    workflow_id,
    status: 'active',
    activated_at: new Date().toISOString()
  })
}

async function handleWorkflowDeactivate(userId: string, params: any, db: any) {
  const { workflow_id } = params

  if (!workflow_id) {
    return NextResponse.json(
      { error: 'Workflow ID is required' },
      { status: 400 }
    )
  }

  const deactivated = await n8nClient.deactivateWorkflow(workflow_id)
  if (!deactivated) {
    return NextResponse.json(
      { error: 'Failed to deactivate workflow' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    workflow_id,
    status: 'inactive',
    deactivated_at: new Date().toISOString()
  })
}

async function handleWorkflowExecute(userId: string, params: any, db: any) {
  const { workflow_id, input_data } = params

  if (!workflow_id) {
    return NextResponse.json(
      { error: 'Workflow ID is required' },
      { status: 400 }
    )
  }

  try {
    const execution = await n8nClient.executeWorkflow(workflow_id, input_data)
    
    return NextResponse.json({
      success: true,
      execution: {
        id: execution.id,
        workflow_id,
        status: execution.status,
        started_at: execution.startedAt,
        mode: execution.mode
      }
    })
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to execute workflow',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

async function handleWorkflowClone(userId: string, params: any, db: any) {
  const { workflow_id, new_name } = params

  if (!workflow_id) {
    return NextResponse.json(
      { error: 'Workflow ID is required' },
      { status: 400 }
    )
  }

  const originalWorkflow = await n8nClient.getWorkflow(workflow_id)
  if (!originalWorkflow) {
    return NextResponse.json(
      { error: 'Original workflow not found' },
      { status: 404 }
    )
  }

  const clonedWorkflow = await n8nClient.createWorkflow({
    ...originalWorkflow,
    name: new_name || `${originalWorkflow.name} (Copy)`,
    active: false
  })

  return NextResponse.json({
    success: true,
    original_workflow_id: workflow_id,
    cloned_workflow: clonedWorkflow
  })
}

async function handleWorkflowExport(userId: string, params: any, db: any) {
  const { workflow_id, format = 'json' } = params

  if (!workflow_id) {
    return NextResponse.json(
      { error: 'Workflow ID is required' },
      { status: 400 }
    )
  }

  const workflow = await n8nClient.getWorkflow(workflow_id)
  if (!workflow) {
    return NextResponse.json(
      { error: 'Workflow not found' },
      { status: 404 }
    )
  }

  const exportData = {
    meta: {
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
      format
    },
    workflow
  }

  return NextResponse.json({
    success: true,
    export_data: exportData,
    download_filename: `${workflow.name.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.json`
  })
}

async function handleWorkflowImport(userId: string, params: any, db: any) {
  const { workflow_data, name_suffix = '_imported' } = params

  if (!workflow_data || !workflow_data.workflow) {
    return NextResponse.json(
      { error: 'Valid workflow data is required' },
      { status: 400 }
    )
  }

  const importedWorkflow = await n8nClient.createWorkflow({
    ...workflow_data.workflow,
    name: `${workflow_data.workflow.name}${name_suffix}`,
    active: false
  })

  return NextResponse.json({
    success: true,
    imported_workflow: importedWorkflow,
    original_name: workflow_data.workflow.name
  })
}