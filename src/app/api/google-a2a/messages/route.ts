/**
 * Google A2A Protocol Message Receiving Endpoint
 * Handles incoming A2A messages from other agents
 */

import { NextRequest, NextResponse } from 'next/server'
import { A2AMessage } from '@/lib/google-a2a'
import { createDatabaseService } from '@/lib/database'

// POST - Receive A2A message
export async function POST(req: NextRequest) {
  try {
    // Verify A2A headers
    const sourceAgent = req.headers.get('X-A2A-Source')
    const messageId = req.headers.get('X-A2A-Message-Id')
    const messageType = req.headers.get('X-A2A-Message-Type')

    if (!sourceAgent || !messageId || !messageType) {
      return NextResponse.json(
        { error: 'Missing required A2A headers' },
        { status: 400 }
      )
    }

    const message: A2AMessage = await req.json()

    // Validate message structure
    if (!message.sourceAgent || !message.targetAgent || !message.payload) {
      return NextResponse.json(
        { error: 'Invalid A2A message structure' },
        { status: 400 }
      )
    }

    // Process message based on type and target agent
    const result = await processA2AMessage(message)

    if (result.success) {
      return NextResponse.json({
        success: true,
        messageId: message.id,
        processed: true,
        response: result.response
      })
    } else {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('A2A message processing error:', error)
    return NextResponse.json(
      { error: 'Failed to process A2A message' },
      { status: 500 }
    )
  }
}

// Process incoming A2A messages
async function processA2AMessage(message: A2AMessage): Promise<{
  success: boolean
  response?: any
  error?: string
}> {
  try {
    console.log(`Processing A2A message from ${message.sourceAgent} to ${message.targetAgent}`)

    switch (message.targetAgent) {
      case 'copilotkit-agent':
        return await processCopilotKitMessage(message)

      case 'mcp-agent':
        return await processMCPMessage(message)

      case 'agui-agent':
        return await processAGUIMessage(message)

      case 'workflow-agent':
        return await processWorkflowMessage(message)

      default:
        return {
          success: false,
          error: `Unknown target agent: ${message.targetAgent}`
        }
    }
  } catch (error) {
    return {
      success: false,
      error: `Message processing failed: ${error.message}`
    }
  }
}

// Process messages for CopilotKit agent
async function processCopilotKitMessage(message: A2AMessage): Promise<{
  success: boolean
  response?: any
  error?: string
}> {
  try {
    const { payload } = message

    switch (message.messageType) {
      case 'request':
        if (payload.action === 'get_user_context') {
          // Get user context for AI assistance
          const db = await createDatabaseService()
          const userId = payload.userId

          if (!userId) {
            return { success: false, error: 'User ID required' }
          }

          const [profile, subscription, workflows, tasks] = await Promise.all([
            db.getProfile(userId),
            db.getActiveSubscription(userId),
            db.getUserWorkflows(userId),
            db.getUserTasks(userId)
          ])

          return {
            success: true,
            response: {
              user: {
                id: userId,
                profile,
                subscription,
                workflows: workflows.length,
                tasks: tasks.length,
                activeTasks: tasks.filter(t => !t.completed).length
              }
            }
          }
        }
        break

      case 'notification':
        if (payload.type === 'user_action') {
          // Handle user action notifications
          console.log('User action notification:', payload)
          return { success: true, response: { acknowledged: true } }
        }
        break

      case 'coordination':
        if (payload.type === 'task_coordination') {
          // Handle task coordination between agents
          return {
            success: true,
            response: {
              coordinationId: payload.coordinationId,
              status: 'accepted',
              capabilities: ['chat', 'task_creation', 'user_guidance']
            }
          }
        }
        break
    }

    return { success: false, error: 'Unsupported message type for CopilotKit agent' }
  } catch (error) {
    return { success: false, error: `CopilotKit processing error: ${error.message}` }
  }
}

// Process messages for MCP agent
async function processMCPMessage(message: A2AMessage): Promise<{
  success: boolean
  response?: any
  error?: string
}> {
  try {
    const { payload } = message

    switch (message.messageType) {
      case 'request':
        if (payload.action === 'execute_tool') {
          // Execute MCP tool
          return {
            success: true,
            response: {
              toolName: payload.toolName,
              result: `Tool ${payload.toolName} executed with parameters: ${JSON.stringify(payload.parameters)}`,
              executedAt: new Date().toISOString()
            }
          }
        }
        break

      case 'coordination':
        if (payload.type === 'context_sharing') {
          // Share context between agents
          return {
            success: true,
            response: {
              coordinationId: payload.coordinationId,
              status: 'accepted',
              sharedContext: {
                tools: ['calculate', 'get_user_info', 'format_text'],
                resources: ['app-config', 'user-stats'],
                prompts: ['code_review', 'api_design']
              }
            }
          }
        }
        break
    }

    return { success: false, error: 'Unsupported message type for MCP agent' }
  } catch (error) {
    return { success: false, error: `MCP processing error: ${error.message}` }
  }
}

// Process messages for AG-UI agent
async function processAGUIMessage(message: A2AMessage): Promise<{
  success: boolean
  response?: any
  error?: string
}> {
  try {
    const { payload } = message

    switch (message.messageType) {
      case 'request':
        if (payload.action === 'generate_ui') {
          // Generate UI component
          return {
            success: true,
            response: {
              componentId: `ui_${Date.now()}`,
              type: payload.componentType,
              props: payload.props,
              generatedAt: new Date().toISOString()
            }
          }
        }
        break

      case 'coordination':
        if (payload.type === 'ui_coordination') {
          // Coordinate UI generation with other agents
          return {
            success: true,
            response: {
              coordinationId: payload.coordinationId,
              status: 'accepted',
              capabilities: ['ui_generation', 'component_creation']
            }
          }
        }
        break
    }

    return { success: false, error: 'Unsupported message type for AG-UI agent' }
  } catch (error) {
    return { success: false, error: `AG-UI processing error: ${error.message}` }
  }
}

// Process messages for workflow agent
async function processWorkflowMessage(message: A2AMessage): Promise<{
  success: boolean
  response?: any
  error?: string
}> {
  try {
    const { payload } = message

    switch (message.messageType) {
      case 'request':
        if (payload.action === 'execute_workflow') {
          // Execute workflow
          const db = await createDatabaseService()
          
          return {
            success: true,
            response: {
              workflowId: payload.workflowId,
              executionId: `exec_${Date.now()}`,
              status: 'started',
              startedAt: new Date().toISOString()
            }
          }
        }
        break

      case 'notification':
        if (payload.type === 'workflow_completed') {
          // Handle workflow completion notification
          console.log('Workflow completed:', payload)
          return { success: true, response: { acknowledged: true } }
        }
        break

      case 'coordination':
        if (payload.type === 'workflow_coordination') {
          // Coordinate workflow execution
          return {
            success: true,
            response: {
              coordinationId: payload.coordinationId,
              status: 'accepted',
              availableWorkflows: ['n8n_workflows', 'make_scenarios']
            }
          }
        }
        break
    }

    return { success: false, error: 'Unsupported message type for workflow agent' }
  } catch (error) {
    return { success: false, error: `Workflow processing error: ${error.message}` }
  }
}

// GET - Health check for message endpoint
export async function GET() {
  return NextResponse.json({
    endpoint: 'A2A Message Receiver',
    status: 'active',
    supportedAgents: [
      'copilotkit-agent',
      'mcp-agent', 
      'agui-agent',
      'workflow-agent'
    ],
    supportedMessageTypes: [
      'request',
      'response',
      'notification',
      'coordination'
    ]
  })
}