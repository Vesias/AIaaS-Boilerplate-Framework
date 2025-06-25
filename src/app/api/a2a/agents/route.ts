/**
 * A2A (Agent-to-Agent) Management API Endpoint
 * Handles autonomous agent coordination, communication, and task delegation
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createDatabaseService } from '@/lib/database'
import OpenAI from 'openai'

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

interface Agent {
  id: string
  name: string
  type: 'workflow' | 'task' | 'analysis' | 'communication' | 'monitoring'
  capabilities: string[]
  status: 'active' | 'idle' | 'busy' | 'offline'
  current_task?: string
  created_at: string
  updated_at: string
}

interface AgentTask {
  id: string
  agent_id: string
  description: string
  status: 'queued' | 'in_progress' | 'completed' | 'failed' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  input_data?: any
  output_data?: any
  error_message?: string
  assigned_at: string
  completed_at?: string
}

interface AgentCommunication {
  id: string
  from_agent: string
  to_agent: string
  message_type: 'task_delegation' | 'status_update' | 'data_request' | 'notification'
  content: any
  timestamp: string
}

// Mock agent registry (in production, this would be in the database)
const AGENT_REGISTRY: Agent[] = [
  {
    id: 'workflow-optimizer',
    name: 'Workflow Optimization Agent',
    type: 'workflow',
    capabilities: ['workflow_analysis', 'optimization_suggestions', 'performance_monitoring'],
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'task-manager',
    name: 'Task Management Agent',
    type: 'task',
    capabilities: ['task_prioritization', 'deadline_tracking', 'resource_allocation'],
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'data-analyst',
    name: 'Data Analysis Agent',
    type: 'analysis',
    capabilities: ['data_processing', 'trend_analysis', 'reporting'],
    status: 'idle',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'communication-hub',
    name: 'Communication Coordination Agent',
    type: 'communication',
    capabilities: ['message_routing', 'notification_management', 'user_interaction'],
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'system-monitor',
    name: 'System Monitoring Agent',
    type: 'monitoring',
    capabilities: ['health_checking', 'performance_monitoring', 'error_detection'],
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
]

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
    const agentId = searchParams.get('agent_id')
    const type = searchParams.get('type')
    const status = searchParams.get('status')

    switch (action) {
      case 'list':
        // List all available agents
        let filteredAgents = AGENT_REGISTRY
        
        if (type) {
          filteredAgents = filteredAgents.filter(agent => agent.type === type)
        }
        
        if (status) {
          filteredAgents = filteredAgents.filter(agent => agent.status === status)
        }

        return NextResponse.json({
          agents: filteredAgents,
          total: filteredAgents.length,
          filters: { type, status },
          available_types: ['workflow', 'task', 'analysis', 'communication', 'monitoring'],
          available_statuses: ['active', 'idle', 'busy', 'offline']
        })

      case 'status':
        // Get specific agent status
        if (!agentId) {
          return NextResponse.json(
            { error: 'Agent ID is required for status check' },
            { status: 400 }
          )
        }

        const agent = AGENT_REGISTRY.find(a => a.id === agentId)
        if (!agent) {
          return NextResponse.json(
            { error: 'Agent not found' },
            { status: 404 }
          )
        }

        // Get agent's current tasks and recent activity
        const db = await createDatabaseService()
        const agentTasks = await getAgentTasks(userId, agentId)
        
        return NextResponse.json({
          agent,
          current_tasks: agentTasks.filter(t => t.status === 'in_progress'),
          queued_tasks: agentTasks.filter(t => t.status === 'queued'),
          completed_today: agentTasks.filter(t => 
            t.status === 'completed' && 
            new Date(t.completed_at!).toDateString() === new Date().toDateString()
          ).length,
          last_activity: agent.updated_at
        })

      case 'capabilities':
        // Get system-wide agent capabilities
        const capabilities = AGENT_REGISTRY.reduce((acc, agent) => {
          agent.capabilities.forEach(cap => {
            if (!acc[cap]) {
              acc[cap] = []
            }
            acc[cap].push({
              agent_id: agent.id,
              agent_name: agent.name,
              status: agent.status
            })
          })
          return acc
        }, {} as Record<string, Array<{agent_id: string, agent_name: string, status: string}>>)

        return NextResponse.json({
          capabilities,
          total_capabilities: Object.keys(capabilities).length,
          active_agents: AGENT_REGISTRY.filter(a => a.status === 'active').length
        })

      default:
        // Default: return system overview
        const activeAgents = AGENT_REGISTRY.filter(a => a.status === 'active')
        const idleAgents = AGENT_REGISTRY.filter(a => a.status === 'idle')
        const busyAgents = AGENT_REGISTRY.filter(a => a.status === 'busy')

        return NextResponse.json({
          system_status: 'operational',
          total_agents: AGENT_REGISTRY.length,
          agent_distribution: {
            active: activeAgents.length,
            idle: idleAgents.length,
            busy: busyAgents.length,
            offline: AGENT_REGISTRY.filter(a => a.status === 'offline').length
          },
          agents: AGENT_REGISTRY,
          last_updated: new Date().toISOString()
        })
    }
  } catch (error) {
    console.error('A2A agents GET error:', error)
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

    switch (action) {
      case 'delegate_task':
        return await handleTaskDelegation(userId, params)
        
      case 'send_message':
        return await handleAgentCommunication(userId, params)
        
      case 'coordinate_workflow':
        return await handleWorkflowCoordination(userId, params)
        
      case 'analyze_performance':
        return await handlePerformanceAnalysis(userId, params)
        
      case 'request_capability':
        return await handleCapabilityRequest(userId, params)
        
      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('A2A agents POST error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

async function handleTaskDelegation(userId: string, params: any) {
  const { agent_id, task_description, priority = 'medium', input_data } = params

  if (!agent_id || !task_description) {
    return NextResponse.json(
      { error: 'Agent ID and task description are required' },
      { status: 400 }
    )
  }

  const agent = AGENT_REGISTRY.find(a => a.id === agent_id)
  if (!agent) {
    return NextResponse.json(
      { error: 'Agent not found' },
      { status: 404 }
    )
  }

  if (agent.status === 'offline') {
    return NextResponse.json(
      { error: 'Agent is offline and cannot accept tasks' },
      { status: 409 }
    )
  }

  // Create agent task record
  const db = await createDatabaseService()
  const agentTask = await db.createAIContext({
    user_id: userId,
    name: `Agent Task: ${task_description}`,
    type: 'a2a',
    context_data: {
      agent_id,
      task_description,
      priority,
      input_data,
      status: 'queued',
      assigned_at: new Date().toISOString()
    }
  })

  if (!agentTask) {
    return NextResponse.json(
      { error: 'Failed to create agent task' },
      { status: 500 }
    )
  }

  // Update agent status if it was idle
  if (agent.status === 'idle') {
    agent.status = 'busy'
    agent.current_task = task_description
    agent.updated_at = new Date().toISOString()
  }

  return NextResponse.json({
    success: true,
    task: {
      id: agentTask.id,
      agent_id,
      agent_name: agent.name,
      description: task_description,
      priority,
      status: 'queued',
      assigned_at: agentTask.created_at
    },
    agent_status: agent.status,
    estimated_completion: new Date(Date.now() + (priority === 'urgent' ? 5 : priority === 'high' ? 15 : 30) * 60000).toISOString()
  })
}

async function handleAgentCommunication(userId: string, params: any) {
  const { from_agent, to_agent, message_type, content } = params

  if (!from_agent || !to_agent || !message_type || !content) {
    return NextResponse.json(
      { error: 'from_agent, to_agent, message_type, and content are required' },
      { status: 400 }
    )
  }

  const fromAgent = AGENT_REGISTRY.find(a => a.id === from_agent)
  const toAgent = AGENT_REGISTRY.find(a => a.id === to_agent)

  if (!fromAgent || !toAgent) {
    return NextResponse.json(
      { error: 'One or both agents not found' },
      { status: 404 }
    )
  }

  // Store communication record
  const db = await createDatabaseService()
  const communication = await db.createAIContext({
    user_id: userId,
    name: `Agent Communication: ${from_agent} -> ${to_agent}`,
    type: 'a2a',
    context_data: {
      from_agent,
      to_agent,
      message_type,
      content,
      timestamp: new Date().toISOString()
    }
  })

  // Process the message based on type
  let response: any = null
  switch (message_type) {
    case 'task_delegation':
      response = await processTaskDelegation(content)
      break
    case 'status_update':
      response = await processStatusUpdate(content)
      break
    case 'data_request':
      response = await processDataRequest(userId, content)
      break
    case 'notification':
      response = await processNotification(content)
      break
  }

  return NextResponse.json({
    success: true,
    communication_id: communication?.id,
    from_agent: fromAgent.name,
    to_agent: toAgent.name,
    message_type,
    processed_at: new Date().toISOString(),
    response
  })
}

async function handleWorkflowCoordination(userId: string, params: any) {
  const { workflow_id, coordination_type = 'optimize', agents = [] } = params

  const db = await createDatabaseService()
  const workflows = await db.getUserWorkflows(userId)
  const workflow = workflows.find(w => w.id === workflow_id)

  if (!workflow) {
    return NextResponse.json(
      { error: 'Workflow not found' },
      { status: 404 }
    )
  }

  // Assign relevant agents based on workflow type
  const relevantAgents = AGENT_REGISTRY.filter(agent => {
    switch (coordination_type) {
      case 'optimize':
        return agent.type === 'workflow' || agent.type === 'analysis'
      case 'monitor':
        return agent.type === 'monitoring' || agent.type === 'workflow'
      case 'execute':
        return agent.type === 'task' || agent.type === 'workflow'
      default:
        return agent.status === 'active'
    }
  })

  // Create coordination plan
  const coordinationPlan = {
    workflow_id,
    coordination_type,
    assigned_agents: relevantAgents.map(a => ({
      id: a.id,
      name: a.name,
      role: getAgentRole(a.type, coordination_type),
      capabilities: a.capabilities
    })),
    execution_order: determineExecutionOrder(relevantAgents, coordination_type),
    estimated_duration: calculateEstimatedDuration(workflow, coordination_type),
    created_at: new Date().toISOString()
  }

  // Store coordination record
  const coordination = await db.createAIContext({
    user_id: userId,
    name: `Workflow Coordination: ${workflow.name}`,
    type: 'a2a',
    context_data: coordinationPlan
  })

  return NextResponse.json({
    success: true,
    coordination_id: coordination?.id,
    workflow: {
      id: workflow.id,
      name: workflow.name,
      type: workflow.n8n_id ? 'n8n' : workflow.make_id ? 'make' : 'custom'
    },
    plan: coordinationPlan
  })
}

async function handlePerformanceAnalysis(userId: string, params: any) {
  const { timeframe = '24h', metrics = ['task_completion', 'response_time', 'error_rate'] } = params

  const db = await createDatabaseService()
  
  // Get user's AI contexts for analysis
  const contexts = await db.getUserAIContexts(userId, 'a2a')
  const now = new Date()
  const timeframeMs = timeframe === '24h' ? 24 * 60 * 60 * 1000 : 
                     timeframe === '7d' ? 7 * 24 * 60 * 60 * 1000 : 
                     30 * 24 * 60 * 60 * 1000

  const relevantContexts = contexts.filter(c => 
    new Date(c.created_at).getTime() > now.getTime() - timeframeMs
  )

  // Analyze performance metrics
  const analysis = {
    timeframe,
    period: {
      start: new Date(now.getTime() - timeframeMs).toISOString(),
      end: now.toISOString()
    },
    total_activities: relevantContexts.length,
    agent_performance: AGENT_REGISTRY.map(agent => {
      const agentActivities = relevantContexts.filter(c => 
        c.context_data.agent_id === agent.id ||
        c.context_data.from_agent === agent.id ||
        c.context_data.to_agent === agent.id
      )

      return {
        agent_id: agent.id,
        agent_name: agent.name,
        status: agent.status,
        activities: agentActivities.length,
        task_completion_rate: calculateTaskCompletionRate(agentActivities),
        average_response_time: calculateAverageResponseTime(agentActivities),
        error_rate: calculateErrorRate(agentActivities),
        efficiency_score: calculateEfficiencyScore(agentActivities)
      }
    }),
    system_metrics: {
      overall_efficiency: calculateOverallEfficiency(relevantContexts),
      communication_volume: relevantContexts.filter(c => c.context_data.message_type).length,
      task_delegation_success: calculateTaskDelegationSuccess(relevantContexts),
      coordination_effectiveness: calculateCoordinationEffectiveness(relevantContexts)
    },
    recommendations: generatePerformanceRecommendations(relevantContexts)
  }

  return NextResponse.json({
    success: true,
    analysis,
    generated_at: new Date().toISOString()
  })
}

async function handleCapabilityRequest(userId: string, params: any) {
  const { required_capability, task_context, priority = 'medium' } = params

  if (!required_capability) {
    return NextResponse.json(
      { error: 'Required capability must be specified' },
      { status: 400 }
    )
  }

  // Find agents with the required capability
  const capableAgents = AGENT_REGISTRY.filter(agent => 
    agent.capabilities.includes(required_capability) && 
    agent.status !== 'offline'
  )

  if (capableAgents.length === 0) {
    return NextResponse.json({
      success: false,
      error: 'No agents available with the required capability',
      required_capability,
      alternative_suggestions: suggestAlternativeCapabilities(required_capability)
    })
  }

  // Select best agent based on current load and capability match
  const bestAgent = selectBestAgent(capableAgents, required_capability, priority)

  return NextResponse.json({
    success: true,
    required_capability,
    selected_agent: {
      id: bestAgent.id,
      name: bestAgent.name,
      status: bestAgent.status,
      capabilities: bestAgent.capabilities,
      current_load: getCurrentLoad(bestAgent.id),
      estimated_availability: getEstimatedAvailability(bestAgent.id)
    },
    alternatives: capableAgents
      .filter(a => a.id !== bestAgent.id)
      .map(a => ({
        id: a.id,
        name: a.name,
        status: a.status,
        current_load: getCurrentLoad(a.id)
      }))
  })
}

// Helper functions
async function getAgentTasks(userId: string, agentId: string): Promise<AgentTask[]> {
  // Mock implementation - in production, fetch from database
  return []
}

async function processTaskDelegation(content: any): Promise<any> {
  return { processed: true, task_accepted: true }
}

async function processStatusUpdate(content: any): Promise<any> {
  return { processed: true, status_acknowledged: true }
}

async function processDataRequest(userId: string, content: any): Promise<any> {
  return { processed: true, data_provided: true }
}

async function processNotification(content: any): Promise<any> {
  return { processed: true, notification_sent: true }
}

function getAgentRole(agentType: string, coordinationType: string): string {
  const roles: Record<string, Record<string, string>> = {
    optimize: {
      workflow: 'optimizer',
      analysis: 'analyzer',
      task: 'coordinator',
      monitoring: 'observer'
    },
    monitor: {
      monitoring: 'primary_monitor',
      workflow: 'secondary_monitor',
      task: 'status_reporter'
    },
    execute: {
      task: 'executor',
      workflow: 'orchestrator',
      monitoring: 'supervisor'
    }
  }
  
  return roles[coordinationType]?.[agentType] || 'participant'
}

function determineExecutionOrder(agents: Agent[], coordinationType: string): string[] {
  // Simple ordering based on agent type and coordination type
  const priority: Record<string, number> = {
    monitoring: 1,
    workflow: 2,
    task: 3,
    analysis: 4,
    communication: 5
  }
  
  return agents
    .sort((a, b) => (priority[a.type] || 999) - (priority[b.type] || 999))
    .map(a => a.id)
}

function calculateEstimatedDuration(workflow: any, coordinationType: string): number {
  // Base duration in minutes
  const baseDuration = 15
  const complexityMultiplier = workflow.actions?.length || 1
  const typeMultiplier = coordinationType === 'optimize' ? 2 : coordinationType === 'monitor' ? 0.5 : 1
  
  return baseDuration * complexityMultiplier * typeMultiplier
}

function calculateTaskCompletionRate(activities: any[]): number {
  if (activities.length === 0) return 0
  const completed = activities.filter(a => a.context_data.status === 'completed').length
  return (completed / activities.length) * 100
}

function calculateAverageResponseTime(activities: any[]): number {
  // Mock calculation - in production, calculate based on actual timestamps
  return Math.random() * 5000 + 1000 // 1-6 seconds
}

function calculateErrorRate(activities: any[]): number {
  if (activities.length === 0) return 0
  const errors = activities.filter(a => a.context_data.status === 'failed').length
  return (errors / activities.length) * 100
}

function calculateEfficiencyScore(activities: any[]): number {
  const completionRate = calculateTaskCompletionRate(activities)
  const errorRate = calculateErrorRate(activities)
  return Math.max(0, completionRate - errorRate)
}

function calculateOverallEfficiency(contexts: any[]): number {
  if (contexts.length === 0) return 0
  const totalTasks = contexts.filter(c => c.context_data.task_description).length
  const completedTasks = contexts.filter(c => c.context_data.status === 'completed').length
  return totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0
}

function calculateTaskDelegationSuccess(contexts: any[]): number {
  const delegations = contexts.filter(c => c.context_data.message_type === 'task_delegation')
  if (delegations.length === 0) return 0
  const successful = delegations.filter(c => c.context_data.response?.task_accepted).length
  return (successful / delegations.length) * 100
}

function calculateCoordinationEffectiveness(contexts: any[]): number {
  const coordinations = contexts.filter(c => c.context_data.coordination_type)
  return coordinations.length > 0 ? 85 + Math.random() * 15 : 0 // Mock calculation
}

function generatePerformanceRecommendations(contexts: any[]): string[] {
  const recommendations = []
  
  if (contexts.length < 10) {
    recommendations.push('Increase agent utilization by delegating more tasks')
  }
  
  const errorRate = contexts.filter(c => c.context_data.status === 'failed').length / contexts.length
  if (errorRate > 0.1) {
    recommendations.push('Review and improve error handling in agent communications')
  }
  
  const communications = contexts.filter(c => c.context_data.message_type).length
  if (communications / contexts.length > 0.5) {
    recommendations.push('Consider optimizing agent communication patterns to reduce overhead')
  }
  
  return recommendations
}

function suggestAlternativeCapabilities(capability: string): string[] {
  const alternatives: Record<string, string[]> = {
    workflow_analysis: ['performance_monitoring', 'optimization_suggestions'],
    task_prioritization: ['resource_allocation', 'deadline_tracking'],
    data_processing: ['trend_analysis', 'reporting'],
    // Add more mappings as needed
  }
  
  return alternatives[capability] || []
}

function selectBestAgent(agents: Agent[], capability: string, priority: string): Agent {
  // Simple selection based on status and capability match
  const activeAgents = agents.filter(a => a.status === 'active')
  if (activeAgents.length > 0) return activeAgents[0]
  
  const idleAgents = agents.filter(a => a.status === 'idle')
  if (idleAgents.length > 0) return idleAgents[0]
  
  return agents[0]
}

function getCurrentLoad(agentId: string): number {
  // Mock implementation - return random load percentage
  return Math.floor(Math.random() * 100)
}

function getEstimatedAvailability(agentId: string): string {
  // Mock implementation - return estimated availability
  const minutes = Math.floor(Math.random() * 30) + 5
  return `${minutes} minutes`
}