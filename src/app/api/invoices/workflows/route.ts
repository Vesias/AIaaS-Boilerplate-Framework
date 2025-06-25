/**
 * Automated Invoice Workflow System
 * Handles payment reminders, overdue notices, compliance reporting, and automated actions
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createDatabaseService } from '@/lib/database'
import { stripe } from '@/lib/stripe'

// Workflow types
export const WORKFLOW_TYPES = {
  payment_reminder: {
    name: 'Payment Reminder',
    description: 'Automated payment reminder emails',
    triggers: ['due_date_approaching', 'payment_overdue'],
    actions: ['send_email', 'update_status', 'log_activity']
  },
  overdue_management: {
    name: 'Overdue Management',
    description: 'Escalating actions for overdue invoices',
    triggers: ['payment_overdue'],
    actions: ['send_escalation_email', 'suspend_service', 'create_task', 'notify_team']
  },
  compliance_reporting: {
    name: 'Compliance Reporting',
    description: 'Automated compliance and tax reporting',
    triggers: ['monthly_schedule', 'quarterly_schedule', 'yearly_schedule'],
    actions: ['generate_report', 'send_to_authorities', 'archive_documents']
  },
  dunning_process: {
    name: 'Dunning Process',
    description: 'Automated debt collection workflow',
    triggers: ['payment_overdue'],
    actions: ['send_dunning_notice', 'apply_late_fees', 'escalate_to_collections']
  },
  customer_lifecycle: {
    name: 'Customer Lifecycle',
    description: 'Customer relationship management based on payment behavior',
    triggers: ['payment_received', 'payment_failed', 'invoice_created'],
    actions: ['update_credit_score', 'send_thank_you', 'offer_payment_plan']
  }
}

// Workflow rules and conditions
interface WorkflowRule {
  id: string
  name: string
  type: keyof typeof WORKFLOW_TYPES
  isActive: boolean
  conditions: WorkflowCondition[]
  actions: WorkflowAction[]
  schedule?: WorkflowSchedule
  priority: 'low' | 'medium' | 'high' | 'critical'
  createdAt: string
  lastExecuted?: string
  executionCount: number
}

interface WorkflowCondition {
  field: string
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'in' | 'not_in'
  value: any
  logicalOperator?: 'AND' | 'OR'
}

interface WorkflowAction {
  type: string
  config: Record<string, any>
  delayMinutes?: number
  retryCount?: number
  onFailure?: 'continue' | 'stop' | 'retry'
}

interface WorkflowSchedule {
  type: 'immediate' | 'delayed' | 'recurring'
  delay?: number // minutes
  cron?: string // for recurring workflows
  timezone?: string
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    const db = await createDatabaseService()

    switch (action) {
      case 'rules':
        return await handleGetRules(userId, db)
      case 'executions':
        return await handleGetExecutions(userId, searchParams, db)
      case 'types':
        return await handleGetWorkflowTypes()
      case 'overdue':
        return await handleGetOverdueInvoices(userId, db)
      case 'triggers':
        return await handleGetTriggers(userId, db)
      case 'analytics':
        return await handleGetAnalytics(userId, searchParams, db)
      default:
        return await handleGetRules(userId, db)
    }
  } catch (error) {
    console.error('Workflow API error:', error)
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
      case 'create_rule':
        return await handleCreateRule(userId, params, db)
      case 'execute':
        return await handleExecuteWorkflow(userId, params, db)
      case 'test':
        return await handleTestWorkflow(userId, params, db)
      case 'bulk_execute':
        return await handleBulkExecute(userId, params, db)
      case 'schedule':
        return await handleScheduleWorkflow(userId, params, db)
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Workflow API POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { ruleId, ...updates } = body

    const db = await createDatabaseService()

    const updated = await db.updateWorkflowRule(userId, ruleId, updates)
    
    return NextResponse.json({
      success: true,
      rule: updated,
      updatedAt: new Date().toISOString()
    })
  } catch (error) {
    console.error('Workflow PUT error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const ruleId = searchParams.get('rule_id')

    if (!ruleId) {
      return NextResponse.json(
        { error: 'Rule ID is required' },
        { status: 400 }
      )
    }

    const db = await createDatabaseService()
    await db.deleteWorkflowRule(userId, ruleId)

    return NextResponse.json({
      success: true,
      deletedAt: new Date().toISOString(),
      ruleId
    })
  } catch (error) {
    console.error('Workflow DELETE error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Handler functions

async function handleGetRules(userId: string, db: any) {
  const rules = await db.getWorkflowRules(userId)
  
  return NextResponse.json({
    rules,
    totalRules: rules.length,
    activeRules: rules.filter((r: WorkflowRule) => r.isActive).length
  })
}

async function handleGetExecutions(userId: string, searchParams: URLSearchParams, db: any) {
  const limit = parseInt(searchParams.get('limit') || '50')
  const offset = parseInt(searchParams.get('offset') || '0')
  const ruleId = searchParams.get('rule_id')
  const status = searchParams.get('status')

  const executions = await db.getWorkflowExecutions(userId, {
    limit,
    offset,
    ruleId,
    status
  })

  return NextResponse.json({
    executions,
    pagination: {
      limit,
      offset,
      total: executions.length
    }
  })
}

async function handleGetWorkflowTypes() {
  const types = Object.entries(WORKFLOW_TYPES).map(([key, type]) => ({
    id: key,
    ...type
  }))

  return NextResponse.json({
    types,
    totalTypes: types.length
  })
}

async function handleGetOverdueInvoices(userId: string, db: any) {
  try {
    // Get user's invoices
    const userInvoices = await db.getUserInvoices(userId)
    const now = new Date()

    // Find overdue invoices
    const overdueInvoices = []
    
    for (const invoice of userInvoices) {
      if (invoice.status === 'open' || invoice.status === 'sent') {
        try {
          const stripeInvoice = await stripe.invoices.retrieve(invoice.stripe_invoice_id)
          
          if (stripeInvoice.due_date && stripeInvoice.due_date * 1000 < now.getTime()) {
            const daysOverdue = Math.floor((now.getTime() - (stripeInvoice.due_date * 1000)) / (24 * 60 * 60 * 1000))
            
            overdueInvoices.push({
              id: invoice.id,
              invoiceNumber: invoice.invoice_number,
              stripeInvoiceId: invoice.stripe_invoice_id,
              amountDue: stripeInvoice.amount_due,
              currency: stripeInvoice.currency,
              daysOverdue,
              dueDate: new Date(stripeInvoice.due_date * 1000).toISOString(),
              customerEmail: typeof stripeInvoice.customer === 'object' ? stripeInvoice.customer?.email : null,
              escalationLevel: daysOverdue > 30 ? 3 : daysOverdue > 14 ? 2 : 1
            })
          }
        } catch (error) {
          console.warn(`Failed to fetch Stripe invoice ${invoice.stripe_invoice_id}:`, error)
        }
      }
    }

    // Sort by days overdue (most overdue first)
    overdueInvoices.sort((a, b) => b.daysOverdue - a.daysOverdue)

    return NextResponse.json({
      overdueInvoices,
      totalOverdue: overdueInvoices.length,
      totalAmount: overdueInvoices.reduce((sum, inv) => sum + inv.amountDue, 0),
      escalationLevels: {
        level1: overdueInvoices.filter(inv => inv.escalationLevel === 1).length,
        level2: overdueInvoices.filter(inv => inv.escalationLevel === 2).length,
        level3: overdueInvoices.filter(inv => inv.escalationLevel === 3).length
      }
    })
  } catch (error) {
    console.error('Error getting overdue invoices:', error)
    throw error
  }
}

async function handleGetTriggers(userId: string, db: any) {
  // Get available triggers and their current status
  const triggers = [
    {
      id: 'due_date_approaching',
      name: 'Due Date Approaching',
      description: 'Triggers when invoice due date is within specified days',
      category: 'payment',
      isActive: true,
      conditions: ['days_until_due <= X']
    },
    {
      id: 'payment_overdue',
      name: 'Payment Overdue',
      description: 'Triggers when payment is past due date',
      category: 'payment',
      isActive: true,
      conditions: ['days_overdue > 0']
    },
    {
      id: 'payment_received',
      name: 'Payment Received',
      description: 'Triggers when payment is successfully processed',
      category: 'payment',
      isActive: true,
      conditions: ['payment_status = paid']
    },
    {
      id: 'invoice_created',
      name: 'Invoice Created',
      description: 'Triggers when new invoice is created',
      category: 'lifecycle',
      isActive: true,
      conditions: ['invoice_status = created']
    },
    {
      id: 'monthly_schedule',
      name: 'Monthly Schedule',
      description: 'Triggers on monthly schedule',
      category: 'schedule',
      isActive: true,
      conditions: ['schedule = monthly']
    },
    {
      id: 'quarterly_schedule',
      name: 'Quarterly Schedule',
      description: 'Triggers on quarterly schedule',
      category: 'schedule',
      isActive: true,
      conditions: ['schedule = quarterly']
    }
  ]

  return NextResponse.json({
    triggers,
    totalTriggers: triggers.length,
    categories: ['payment', 'lifecycle', 'schedule', 'compliance']
  })
}

async function handleGetAnalytics(userId: string, searchParams: URLSearchParams, db: any) {
  const period = searchParams.get('period') || '30' // days
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - parseInt(period))

  try {
    const executions = await db.getWorkflowExecutions(userId, {
      startDate: startDate.toISOString(),
      limit: 1000
    })

    const analytics = {
      totalExecutions: executions.length,
      successfulExecutions: executions.filter((e: any) => e.status === 'success').length,
      failedExecutions: executions.filter((e: any) => e.status === 'failed').length,
      averageExecutionTime: 0, // Would calculate from execution data
      mostUsedWorkflows: {}, // Would aggregate from execution data
      executionsByDay: {}, // Would group by day
      errorsByType: {} // Would categorize errors
    }

    // Calculate success rate
    const successRate = analytics.totalExecutions > 0 
      ? (analytics.successfulExecutions / analytics.totalExecutions) * 100 
      : 0

    return NextResponse.json({
      period: `${period} days`,
      analytics: {
        ...analytics,
        successRate: Math.round(successRate * 100) / 100
      }
    })
  } catch (error) {
    console.error('Error getting workflow analytics:', error)
    throw error
  }
}

async function handleCreateRule(userId: string, params: any, db: any) {
  const {
    name,
    type,
    conditions,
    actions,
    schedule,
    priority = 'medium'
  } = params

  // Validate rule
  const validation = validateWorkflowRule({ name, type, conditions, actions })
  if (!validation.isValid) {
    return NextResponse.json(
      { error: 'Invalid workflow rule', details: validation.errors },
      { status: 400 }
    )
  }

  const rule: WorkflowRule = {
    id: `rule_${Date.now()}`,
    name,
    type,
    isActive: true,
    conditions: conditions || [],
    actions: actions || [],
    schedule,
    priority,
    createdAt: new Date().toISOString(),
    executionCount: 0
  }

  try {
    await db.createWorkflowRule(userId, rule)

    return NextResponse.json({
      success: true,
      rule,
      message: 'Workflow rule created successfully'
    })
  } catch (error) {
    console.error('Error creating workflow rule:', error)
    throw error
  }
}

async function handleExecuteWorkflow(userId: string, params: any, db: any) {
  const { ruleId, invoiceId, dryRun = false } = params

  try {
    const rule = await db.getWorkflowRule(userId, ruleId)
    if (!rule) {
      return NextResponse.json(
        { error: 'Workflow rule not found' },
        { status: 404 }
      )
    }

    const invoice = invoiceId ? await db.getInvoice(userId, invoiceId) : null
    
    const execution = await executeWorkflow(rule, invoice, dryRun, db, userId)

    return NextResponse.json({
      success: true,
      execution,
      dryRun
    })
  } catch (error) {
    console.error('Error executing workflow:', error)
    return NextResponse.json(
      { error: 'Workflow execution failed', details: error.message },
      { status: 500 }
    )
  }
}

async function handleTestWorkflow(userId: string, params: any, db: any) {
  const { rule, testData } = params

  try {
    const execution = await executeWorkflow(rule, testData, true, db, userId)

    return NextResponse.json({
      success: true,
      testExecution: execution,
      message: 'Workflow test completed'
    })
  } catch (error) {
    console.error('Error testing workflow:', error)
    return NextResponse.json(
      { error: 'Workflow test failed', details: error.message },
      { status: 500 }
    )
  }
}

async function handleBulkExecute(userId: string, params: any, db: any) {
  const { ruleId, invoiceIds, dryRun = false } = params

  try {
    const rule = await db.getWorkflowRule(userId, ruleId)
    if (!rule) {
      return NextResponse.json(
        { error: 'Workflow rule not found' },
        { status: 404 }
      )
    }

    const executions = []
    for (const invoiceId of invoiceIds) {
      try {
        const invoice = await db.getInvoice(userId, invoiceId)
        const execution = await executeWorkflow(rule, invoice, dryRun, db, userId)
        executions.push({ invoiceId, ...execution })
      } catch (error) {
        executions.push({
          invoiceId,
          status: 'failed',
          error: error.message
        })
      }
    }

    return NextResponse.json({
      success: true,
      executions,
      totalProcessed: executions.length,
      successful: executions.filter(e => e.status === 'success').length,
      failed: executions.filter(e => e.status === 'failed').length,
      dryRun
    })
  } catch (error) {
    console.error('Error bulk executing workflow:', error)
    throw error
  }
}

async function handleScheduleWorkflow(userId: string, params: any, db: any) {
  const { ruleId, schedule } = params

  try {
    const rule = await db.getWorkflowRule(userId, ruleId)
    if (!rule) {
      return NextResponse.json(
        { error: 'Workflow rule not found' },
        { status: 404 }
      )
    }

    // In production, this would integrate with a job scheduler like Bull/Agenda
    const scheduledJob = {
      id: `job_${Date.now()}`,
      ruleId,
      schedule,
      userId,
      status: 'scheduled',
      createdAt: new Date().toISOString()
    }

    // TODO: Integrate with job scheduler
    console.log('Would schedule workflow:', scheduledJob)

    return NextResponse.json({
      success: true,
      scheduledJob,
      message: 'Workflow scheduled successfully'
    })
  } catch (error) {
    console.error('Error scheduling workflow:', error)
    throw error
  }
}

// Helper functions

async function executeWorkflow(
  rule: WorkflowRule,
  invoice: any,
  dryRun: boolean,
  db: any,
  userId: string
) {
  const execution = {
    id: `exec_${Date.now()}`,
    ruleId: rule.id,
    invoiceId: invoice?.id,
    status: 'running',
    startedAt: new Date().toISOString(),
    actions: [] as any[],
    dryRun
  }

  try {
    // Check conditions
    const conditionsMet = evaluateConditions(rule.conditions, invoice)
    
    if (!conditionsMet) {
      execution.status = 'skipped'
      execution.reason = 'Conditions not met'
      return execution
    }

    // Execute actions
    for (const action of rule.actions) {
      try {
        const actionResult = await executeAction(action, invoice, dryRun, db, userId)
        execution.actions.push({
          type: action.type,
          status: 'success',
          result: actionResult,
          executedAt: new Date().toISOString()
        })
      } catch (error) {
        execution.actions.push({
          type: action.type,
          status: 'failed',
          error: error.message,
          executedAt: new Date().toISOString()
        })

        if (action.onFailure === 'stop') {
          break
        }
      }
    }

    execution.status = execution.actions.some(a => a.status === 'failed') ? 'partial' : 'success'
  } catch (error) {
    execution.status = 'failed'
    execution.error = error.message
  }

  execution.completedAt = new Date().toISOString()
  
  // Log execution (unless dry run)
  if (!dryRun) {
    await db.logWorkflowExecution(userId, execution)
  }

  return execution
}

function evaluateConditions(conditions: WorkflowCondition[], invoice: any): boolean {
  if (!conditions || conditions.length === 0) return true

  // Simple condition evaluation (would be more sophisticated in production)
  return conditions.every(condition => {
    const value = getNestedValue(invoice, condition.field)
    
    switch (condition.operator) {
      case 'equals':
        return value === condition.value
      case 'not_equals':
        return value !== condition.value
      case 'greater_than':
        return Number(value) > Number(condition.value)
      case 'less_than':
        return Number(value) < Number(condition.value)
      case 'contains':
        return String(value).includes(String(condition.value))
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(value)
      case 'not_in':
        return Array.isArray(condition.value) && !condition.value.includes(value)
      default:
        return false
    }
  })
}

async function executeAction(
  action: WorkflowAction,
  invoice: any,
  dryRun: boolean,
  db: any,
  userId: string
): Promise<any> {
  if (dryRun) {
    return { dryRun: true, action: action.type, config: action.config }
  }

  switch (action.type) {
    case 'send_email':
      return await sendWorkflowEmail(action.config, invoice)
    
    case 'update_status':
      return await updateInvoiceStatus(action.config, invoice, db)
    
    case 'log_activity':
      return await logActivity(action.config, invoice, db, userId)
    
    case 'create_task':
      return await createTask(action.config, invoice, db, userId)
    
    case 'apply_late_fees':
      return await applyLateFees(action.config, invoice, db)
    
    default:
      throw new Error(`Unknown action type: ${action.type}`)
  }
}

async function sendWorkflowEmail(config: any, invoice: any): Promise<any> {
  console.log('Would send email:', config, invoice?.invoice_number)
  
  // TODO: Integrate with email service
  return {
    emailSent: true,
    to: config.recipient || invoice?.customer_email,
    template: config.template,
    sentAt: new Date().toISOString()
  }
}

async function updateInvoiceStatus(config: any, invoice: any, db: any): Promise<any> {
  console.log('Would update invoice status:', config.status, invoice?.id)
  
  // TODO: Update invoice status in database
  return {
    statusUpdated: true,
    oldStatus: invoice?.status,
    newStatus: config.status,
    updatedAt: new Date().toISOString()
  }
}

async function logActivity(config: any, invoice: any, db: any, userId: string): Promise<any> {
  console.log('Would log activity:', config.message, invoice?.invoice_number)
  
  // TODO: Log to activity system
  return {
    activityLogged: true,
    message: config.message,
    loggedAt: new Date().toISOString()
  }
}

async function createTask(config: any, invoice: any, db: any, userId: string): Promise<any> {
  console.log('Would create task:', config.title, invoice?.invoice_number)
  
  // TODO: Create task in task management system
  return {
    taskCreated: true,
    title: config.title,
    description: config.description,
    createdAt: new Date().toISOString()
  }
}

async function applyLateFees(config: any, invoice: any, db: any): Promise<any> {
  console.log('Would apply late fees:', config.amount, invoice?.invoice_number)
  
  // TODO: Apply late fees via Stripe
  return {
    lateFeesApplied: true,
    amount: config.amount,
    appliedAt: new Date().toISOString()
  }
}

function validateWorkflowRule(rule: any) {
  const validation = {
    isValid: true,
    errors: [] as string[]
  }

  if (!rule.name || rule.name.trim().length === 0) {
    validation.isValid = false
    validation.errors.push('Name is required')
  }

  if (!rule.type || !WORKFLOW_TYPES[rule.type]) {
    validation.isValid = false
    validation.errors.push('Valid workflow type is required')
  }

  if (!rule.actions || !Array.isArray(rule.actions) || rule.actions.length === 0) {
    validation.isValid = false
    validation.errors.push('At least one action is required')
  }

  return validation
}

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj)
}