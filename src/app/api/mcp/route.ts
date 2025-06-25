/**
 * MCP (Model Context Protocol) Main API Endpoint
 * Provides a simplified interface to the MCP server functionality
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createDatabaseService } from '@/lib/database'

interface MCPToolCall {
  tool: string
  arguments: Record<string, any>
}

interface MCPResourceRead {
  resource: string
}

interface MCPPromptGenerate {
  prompt: string
  arguments: Record<string, any>
}

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

    // Return MCP server information and available capabilities
    return NextResponse.json({
      server: 'roomicor-mcp-server',
      version: '1.0.0',
      status: 'active',
      capabilities: {
        tools: [
          'calculate',
          'get_user_info',
          'format_text',
          'generate_uuid',
          'validate_email',
          'get_timestamp',
          'get_workflows',
          'get_tasks',
          'create_task',
          'get_subscription_status'
        ],
        resources: [
          'app-config',
          'user-stats',
          'api-docs',
          'system-status',
          'user-data',
          'workflow-data',
          'task-data'
        ],
        prompts: [
          'code_review',
          'api_design',
          'database_schema',
          'workflow_optimization',
          'task_prioritization'
        ]
      },
      endpoints: {
        tools: '/api/mcp/tools',
        resources: '/api/mcp/resources',
        prompts: '/api/mcp/prompts',
        transport: '/api/mcp/[...transport]'
      },
      authentication: {
        required: true,
        type: 'bearer_token',
        description: 'Use Authorization: Bearer <token> header'
      }
    })
  } catch (error) {
    console.error('MCP server info error:', error)
    return NextResponse.json(
      { error: 'Failed to get MCP server information' },
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

    switch (action) {
      case 'call_tool':
        return await handleToolCall(userId, params as MCPToolCall)
      
      case 'read_resource':
        return await handleResourceRead(userId, params as MCPResourceRead)
        
      case 'generate_prompt':
        return await handlePromptGenerate(userId, params as MCPPromptGenerate)
        
      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('MCP API error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

async function handleToolCall(userId: string, params: MCPToolCall) {
  const { tool, arguments: args } = params
  const db = await createDatabaseService()

  try {
    switch (tool) {
      case 'get_workflows': {
        const workflows = await db.getUserWorkflows(userId)
        return NextResponse.json({
          tool,
          result: {
            total: workflows.length,
            active: workflows.filter(w => w.active).length,
            workflows: workflows.map(w => ({
              id: w.id,
              name: w.name,
              description: w.description,
              active: w.active,
              type: w.n8n_id ? 'n8n' : w.make_id ? 'make' : 'custom',
              created: w.created_at
            }))
          }
        })
      }

      case 'get_tasks': {
        const tasks = await db.getUserTasks(userId)
        const now = new Date()
        
        return NextResponse.json({
          tool,
          result: {
            total: tasks.length,
            completed: tasks.filter(t => t.completed).length,
            pending: tasks.filter(t => !t.completed).length,
            overdue: tasks.filter(t => 
              !t.completed && 
              t.due_date && 
              new Date(t.due_date) < now
            ).length,
            tasks: tasks.map(t => ({
              id: t.id,
              title: t.title,
              content: t.content,
              completed: t.completed,
              priority: t.priority,
              due_date: t.due_date,
              created: t.created_at
            }))
          }
        })
      }

      case 'create_task': {
        const { title, content, priority = 'medium', due_date } = args
        
        if (!title) {
          return NextResponse.json(
            { error: 'Task title is required' },
            { status: 400 }
          )
        }

        const task = await db.createTask({
          user_id: userId,
          title,
          content: content || null,
          completed: false,
          priority: priority as 'low' | 'medium' | 'high' | 'urgent',
          due_date: due_date ? new Date(due_date).toISOString() : null
        })

        if (!task) {
          return NextResponse.json(
            { error: 'Failed to create task' },
            { status: 500 }
          )
        }

        return NextResponse.json({
          tool,
          result: {
            success: true,
            task: {
              id: task.id,
              title: task.title,
              content: task.content,
              priority: task.priority,
              due_date: task.due_date,
              created: task.created_at
            }
          }
        })
      }

      case 'get_subscription_status': {
        const [profile, subscription] = await Promise.all([
          db.getProfile(userId),
          db.getActiveSubscription(userId)
        ])

        return NextResponse.json({
          tool,
          result: {
            user: {
              id: userId,
              email: profile?.email,
              has_profile: !!profile
            },
            subscription: subscription ? {
              status: subscription.status,
              price_id: subscription.stripe_price_id,
              current_period_end: subscription.current_period_end,
              cancel_at_period_end: subscription.cancel_at_period_end,
              active: subscription.status === 'active'
            } : null
          }
        })
      }

      default:
        // Forward to the main MCP server for standard tools
        return NextResponse.json({
          error: `Tool '${tool}' should be called via /api/mcp/[...transport] endpoint`,
          suggestion: `Use the MCP transport endpoint for standard tools like calculate, format_text, etc.`
        }, { status: 400 })
    }
  } catch (error) {
    console.error(`Tool call error (${tool}):`, error)
    return NextResponse.json(
      { 
        tool,
        error: error instanceof Error ? error.message : 'Tool execution failed'
      },
      { status: 500 }
    )
  }
}

async function handleResourceRead(userId: string, params: MCPResourceRead) {
  const { resource } = params
  const db = await createDatabaseService()

  try {
    switch (resource) {
      case 'user-data': {
        const [profile, subscription, workflows, tasks] = await Promise.all([
          db.getProfile(userId),
          db.getActiveSubscription(userId),
          db.getUserWorkflows(userId),
          db.getUserTasks(userId)
        ])

        return NextResponse.json({
          resource,
          content: {
            profile: profile ? {
              id: profile.id,
              email: profile.email,
              name: `${profile.first_name} ${profile.last_name}`.trim(),
              created: profile.created_at
            } : null,
            subscription: subscription ? {
              status: subscription.status,
              active: subscription.status === 'active',
              plan: subscription.stripe_price_id,
              period_end: subscription.current_period_end
            } : null,
            statistics: {
              workflows: {
                total: workflows.length,
                active: workflows.filter(w => w.active).length
              },
              tasks: {
                total: tasks.length,
                completed: tasks.filter(t => t.completed).length,
                pending: tasks.filter(t => !t.completed).length
              }
            }
          }
        })
      }

      case 'workflow-data': {
        const workflows = await db.getUserWorkflows(userId)
        
        return NextResponse.json({
          resource,
          content: {
            workflows: workflows.map(w => ({
              id: w.id,
              name: w.name,
              description: w.description,
              active: w.active,
              type: w.n8n_id ? 'n8n' : w.make_id ? 'make' : 'custom',
              trigger_type: w.trigger_type,
              actions: w.actions,
              created: w.created_at,
              updated: w.updated_at
            })),
            summary: {
              total: workflows.length,
              active: workflows.filter(w => w.active).length,
              by_type: {
                n8n: workflows.filter(w => w.n8n_id).length,
                make: workflows.filter(w => w.make_id).length,
                custom: workflows.filter(w => !w.n8n_id && !w.make_id).length
              }
            }
          }
        })
      }

      case 'task-data': {
        const tasks = await db.getUserTasks(userId)
        const now = new Date()
        
        return NextResponse.json({
          resource,
          content: {
            tasks: tasks.map(t => ({
              id: t.id,
              title: t.title,
              content: t.content,
              completed: t.completed,
              priority: t.priority,
              due_date: t.due_date,
              overdue: !t.completed && t.due_date && new Date(t.due_date) < now,
              created: t.created_at,
              updated: t.updated_at
            })),
            summary: {
              total: tasks.length,
              completed: tasks.filter(t => t.completed).length,
              pending: tasks.filter(t => !t.completed).length,
              overdue: tasks.filter(t => 
                !t.completed && 
                t.due_date && 
                new Date(t.due_date) < now
              ).length,
              by_priority: {
                urgent: tasks.filter(t => t.priority === 'urgent').length,
                high: tasks.filter(t => t.priority === 'high').length,
                medium: tasks.filter(t => t.priority === 'medium').length,
                low: tasks.filter(t => t.priority === 'low').length
              }
            }
          }
        })
      }

      default:
        return NextResponse.json(
          { error: `Resource '${resource}' not found or should be accessed via transport endpoint` },
          { status: 404 }
        )
    }
  } catch (error) {
    console.error(`Resource read error (${resource}):`, error)
    return NextResponse.json(
      { 
        resource,
        error: error instanceof Error ? error.message : 'Resource read failed'
      },
      { status: 500 }
    )
  }
}

async function handlePromptGenerate(userId: string, params: MCPPromptGenerate) {
  const { prompt, arguments: args } = params

  try {
    switch (prompt) {
      case 'workflow_optimization': {
        const { workflow_type = 'general', current_tools = [] } = args
        
        return NextResponse.json({
          prompt,
          content: {
            system_prompt: `You are a workflow optimization expert for the Roomicor platform. Help users optimize their ${workflow_type} workflows.`,
            user_prompt: `Please analyze my current workflow setup and suggest optimizations:

Current Tools: ${Array.isArray(current_tools) ? current_tools.join(', ') : current_tools}
Workflow Type: ${workflow_type}

Please provide:
1. Analysis of current workflow efficiency
2. Suggested improvements and optimizations
3. Alternative tools or approaches
4. Performance enhancement recommendations
5. Cost optimization suggestions
6. Security considerations`,
            metadata: {
              workflow_type,
              current_tools,
              user_id: userId,
              generated_at: new Date().toISOString()
            }
          }
        })
      }

      case 'task_prioritization': {
        const { tasks = [], criteria = 'urgency' } = args
        
        return NextResponse.json({
          prompt,
          content: {
            system_prompt: `You are a task prioritization expert. Help users organize and prioritize their tasks effectively.`,
            user_prompt: `Please help me prioritize these tasks based on ${criteria}:

Tasks: ${JSON.stringify(tasks, null, 2)}

Please provide:
1. Prioritized task list with reasoning
2. Suggested time allocation
3. Dependencies identification
4. Risk assessment
5. Deadline management recommendations
6. Productivity tips`,
            metadata: {
              criteria,
              task_count: Array.isArray(tasks) ? tasks.length : 0,
              user_id: userId,
              generated_at: new Date().toISOString()
            }
          }
        })
      }

      default:
        return NextResponse.json(
          { error: `Prompt '${prompt}' should be generated via /api/mcp/[...transport] endpoint` },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error(`Prompt generation error (${prompt}):`, error)
    return NextResponse.json(
      { 
        prompt,
        error: error instanceof Error ? error.message : 'Prompt generation failed'
      },
      { status: 500 }
    )
  }
}