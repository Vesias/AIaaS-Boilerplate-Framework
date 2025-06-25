/**
 * Enhanced CopilotKit Runtime API Endpoint
 * Provides comprehensive AI chat functionality with intelligent routing and advanced features
 */

import { 
  CopilotRuntime, 
  OpenAIAdapter,
  copilotRuntimeNextJSAppRouterEndpoint 
} from '@copilotkit/runtime'
import { auth } from '@clerk/nextjs/server'
import { createDatabaseService } from '@/lib/database'
import { createInvoiceService } from '@/lib/invoice'
import { triggerN8nWorkflow } from '@/lib/n8n'
import { triggerMakeScenario } from '@/lib/make'
import { aiRouter } from '@/lib/ai-router'
import { usageTracker } from '@/lib/token-counter'
import { NextRequest } from 'next/server'

// Initialize intelligent AI adapter with routing
class IntelligentAIAdapter {
  async processRequest(messages: any[]): Promise<any> {
    try {
      // Use AI router for optimal model selection
      const lastMessage = messages[messages.length - 1]
      const response = await aiRouter.route({
        input: lastMessage.content,
        operation: 'chat',
        context: {
          priority: 'normal',
          budget: 0.05, // 5 cents max per request
        },
      })

      return {
        choices: [{
          message: {
            role: 'assistant',
            content: response.data,
          },
        }],
        usage: {
          prompt_tokens: response.metadata.tokens.input,
          completion_tokens: response.metadata.tokens.output,
          total_tokens: response.metadata.tokens.total,
        },
        model: response.metadata.modelId,
      }
    } catch (error) {
      console.error('AI routing failed, falling back to OpenAI:', error)
      
      // Fallback to direct OpenAI
      const openaiAdapter = new OpenAIAdapter({
        apiKey: process.env.OPENAI_API_KEY!,
        model: 'gpt-4o-mini',
      })
      
      return openaiAdapter.processRequest(messages)
    }
  }
}

const intelligentAdapter = new IntelligentAIAdapter()

// CopilotKit runtime configuration
const runtime = new CopilotRuntime({
  adapter: intelligentAdapter as any,
  
  // Define available actions that the AI can perform
  actions: [
    {
      name: 'getUserSubscription',
      description: 'Get current user subscription status and details',
      parameters: [],
      handler: async () => {
        try {
          const { userId } = await auth()
          if (!userId) return { error: 'User not authenticated' }
          
          const db = await createDatabaseService()
          const subscription = await db.getActiveSubscription(userId)
          
          return {
            hasActiveSubscription: !!subscription,
            subscription: subscription ? {
              status: subscription.status,
              priceId: subscription.stripe_price_id,
              currentPeriodEnd: subscription.current_period_end,
              cancelAtPeriodEnd: subscription.cancel_at_period_end
            } : null
          }
        } catch (error) {
          return { error: 'Failed to fetch subscription' }
        }
      }
    },
    
    {
      name: 'getUserWorkflows',
      description: 'Get user workflows and their execution status',
      parameters: [],
      handler: async () => {
        try {
          const { userId } = await auth()
          if (!userId) return { error: 'User not authenticated' }
          
          const db = await createDatabaseService()
          const workflows = await db.getUserWorkflows(userId)
          
          return {
            workflows: workflows.map(w => ({
              id: w.id,
              name: w.name,
              description: w.description,
              active: w.active,
              type: w.n8n_id ? 'n8n' : w.make_id ? 'make' : 'unknown',
              triggerType: w.trigger_type
            }))
          }
        } catch (error) {
          return { error: 'Failed to fetch workflows' }
        }
      }
    },
    
    {
      name: 'getUserTasks',
      description: 'Get user tasks and their completion status',
      parameters: [],
      handler: async () => {
        try {
          const { userId } = await auth()
          if (!userId) return { error: 'User not authenticated' }
          
          const db = await createDatabaseService()
          const tasks = await db.getUserTasks(userId)
          
          return {
            tasks: tasks.map(t => ({
              id: t.id,
              title: t.title,
              completed: t.completed,
              priority: t.priority,
              dueDate: t.due_date
            }))
          }
        } catch (error) {
          return { error: 'Failed to fetch tasks' }
        }
      }
    },
    
    {
      name: 'createTask',
      description: 'Create a new task for the user',
      parameters: [
        {
          name: 'title',
          type: 'string',
          description: 'Task title',
          required: true
        },
        {
          name: 'content',
          type: 'string', 
          description: 'Task description or content',
          required: false
        },
        {
          name: 'priority',
          type: 'string',
          description: 'Task priority (low, medium, high, urgent)',
          required: false
        },
        {
          name: 'dueDate',
          type: 'string',
          description: 'Due date in ISO format',
          required: false
        }
      ],
      handler: async (params: any) => {
        try {
          const { userId } = await auth()
          if (!userId) return { error: 'User not authenticated' }
          
          const { title, content, priority = 'medium', dueDate } = params
          
          const db = await createDatabaseService()
          const task = await db.createTask({
            user_id: userId,
            title,
            content: content || null,
            completed: false,
            priority: priority as 'low' | 'medium' | 'high' | 'urgent',
            due_date: dueDate ? new Date(dueDate).toISOString() : null
          })
          
          if (task) {
            return {
              success: true,
              task: {
                id: task.id,
                title: task.title,
                content: task.content,
                priority: task.priority,
                dueDate: task.due_date
              }
            }
          } else {
            return { error: 'Failed to create task' }
          }
        } catch (error) {
          return { error: 'Failed to create task' }
        }
      }
    },
    
    {
      name: 'getUserInvoices',
      description: 'Get user billing history and invoices',
      parameters: [
        {
          name: 'limit',
          type: 'number',
          description: 'Number of invoices to retrieve (default: 10)',
          required: false
        }
      ],
      handler: async (params: any) => {
        try {
          const { userId } = await auth()
          if (!userId) return { error: 'User not authenticated' }
          
          const { limit = 10 } = params
          
          const db = await createDatabaseService()
          const invoices = await db.getUserInvoices(userId, limit)
          
          return {
            invoices: invoices.map(i => ({
              id: i.id,
              invoiceNumber: i.invoice_number,
              amountPaid: i.amount_paid / 100, // Convert cents to euros
              currency: i.currency,
              status: i.status,
              createdAt: i.created_at,
              hostedInvoiceUrl: i.hosted_invoice_url
            }))
          }
        } catch (error) {
          return { error: 'Failed to fetch invoices' }
        }
      }
    },
    
    {
      name: 'generateInvoice',
      description: 'Generate and send a professional invoice to a customer',
      parameters: [
        {
          name: 'customerEmail',
          type: 'string',
          description: 'Customer email address',
          required: true
        },
        {
          name: 'customerName',
          type: 'string',
          description: 'Customer name',
          required: true
        },
        {
          name: 'items',
          type: 'array',
          description: 'Invoice items with description, quantity, and price',
          required: true
        },
        {
          name: 'currency',
          type: 'string',
          description: 'Currency code (default: EUR)',
          required: false
        },
        {
          name: 'dueDate',
          type: 'string',
          description: 'Due date in ISO format',
          required: false
        }
      ],
      handler: async (params: any) => {
        try {
          const { userId } = await auth()
          if (!userId) return { error: 'User not authenticated' }
          
          const { customerEmail, customerName, items, currency = 'EUR', dueDate } = params
          
          const invoiceService = await createInvoiceService()
          const invoiceData = {
            invoiceNumber: `INV-${Date.now()}`,
            userId,
            customerInfo: {
              name: customerName,
              email: customerEmail,
            },
            companyInfo: {
              name: 'Roomicor',
              address: {
                line1: 'Muster Straße 123',
                city: 'Berlin',
                postal_code: '10115',
                country: 'Germany',
              },
              email: 'billing@roomicor.com',
            },
            items,
            subtotal: items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0),
            tax: { rate: 19, amount: 0 },
            total: 0,
            currency,
            dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            issueDate: new Date(),
            status: 'sent' as const,
          }
          
          // Calculate tax and total
          invoiceData.tax.amount = invoiceData.subtotal * 0.19
          invoiceData.total = invoiceData.subtotal + invoiceData.tax.amount
          
          const result = await invoiceService.generateInvoice(invoiceData)
          
          if (result.success) {
            return {
              success: true,
              message: `Invoice ${invoiceData.invoiceNumber} generated and sent to ${customerEmail}`,
              invoiceId: result.invoiceId,
              invoiceNumber: invoiceData.invoiceNumber,
              total: invoiceData.total,
              currency: invoiceData.currency,
            }
          } else {
            return { error: result.error || 'Failed to generate invoice' }
          }
        } catch (error) {
          return { error: 'Failed to generate invoice' }
        }
      }
    },
    
    {
      name: 'triggerWorkflow',
      description: 'Trigger an automation workflow (n8n or Make.com)',
      parameters: [
        {
          name: 'platform',
          type: 'string',
          description: 'Automation platform (n8n or make)',
          required: true
        },
        {
          name: 'workflowId',
          type: 'string',
          description: 'Workflow ID or name',
          required: false
        },
        {
          name: 'data',
          type: 'object',
          description: 'Data to send to the workflow',
          required: false
        }
      ],
      handler: async (params: any) => {
        try {
          const { userId } = await auth()
          if (!userId) return { error: 'User not authenticated' }
          
          const { platform, workflowId, data = {} } = params
          
          const payload = {
            ...data,
            triggeredBy: 'copilot',
            userId,
            timestamp: new Date().toISOString(),
          }
          
          let result
          if (platform === 'n8n') {
            result = await triggerN8nWorkflow(payload)
          } else if (platform === 'make') {
            result = await triggerMakeScenario(payload)
          } else {
            return { error: `Unsupported automation platform: ${platform}` }
          }
          
          return {
            success: true,
            message: `${platform} workflow triggered successfully`,
            result,
            platform,
            workflowId,
          }
        } catch (error) {
          return { error: `Failed to trigger ${params.platform} workflow` }
        }
      }
    },
    
    {
      name: 'analyzeUserData',
      description: 'Analyze user data and provide insights and recommendations',
      parameters: [
        {
          name: 'dataType',
          type: 'string',
          description: 'Type of data to analyze (tasks, invoices, workflows, all)',
          required: true
        },
        {
          name: 'timeRange',
          type: 'string',
          description: 'Time range for analysis (day, week, month, year)',
          required: false
        }
      ],
      handler: async (params: any) => {
        try {
          const { userId } = await auth()
          if (!userId) return { error: 'User not authenticated' }
          
          const { dataType, timeRange = 'month' } = params
          const db = await createDatabaseService()
          
          let analysis: any = {}
          
          if (dataType === 'tasks' || dataType === 'all') {
            const tasks = await db.getUserTasks(userId)
            const completed = tasks.filter(t => t.completed).length
            const overdue = tasks.filter(t => 
              !t.completed && t.due_date && new Date(t.due_date) < new Date()
            ).length
            
            analysis.tasks = {
              total: tasks.length,
              completed,
              pending: tasks.length - completed,
              overdue,
              completionRate: tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0,
              insights: [
                `You have ${tasks.length} total tasks`,
                `${completed} tasks completed (${Math.round((completed / tasks.length) * 100)}% completion rate)`,
                overdue > 0 ? `${overdue} tasks are overdue and need attention` : 'No overdue tasks',
              ],
              recommendations: overdue > 0 
                ? ['Focus on completing overdue tasks first', 'Consider setting more realistic due dates']
                : ['Great job staying on top of your tasks!', 'Consider adding more challenging goals']
            }
          }
          
          if (dataType === 'workflows' || dataType === 'all') {
            const workflows = await db.getUserWorkflows(userId)
            const active = workflows.filter(w => w.active).length
            
            analysis.workflows = {
              total: workflows.length,
              active,
              inactive: workflows.length - active,
              platforms: {
                n8n: workflows.filter(w => w.n8n_id).length,
                make: workflows.filter(w => w.make_id).length,
              },
              insights: [
                `You have ${workflows.length} total workflows`,
                `${active} workflows are currently active`,
                workflows.length === 0 ? 'No workflows set up yet' : 'Good automation coverage',
              ],
              recommendations: workflows.length === 0
                ? ['Set up your first workflow to automate repetitive tasks', 'Start with simple email notifications']
                : active < workflows.length / 2
                ? ['Consider activating more workflows to increase automation', 'Review inactive workflows for optimization']
                : ['Excellent workflow automation setup!', 'Monitor performance and optimize as needed']
            }
          }
          
          return {
            success: true,
            dataType,
            timeRange,
            analysis,
            summary: `Analysis complete for ${dataType} data over the last ${timeRange}`,
          }
        } catch (error) {
          return { error: 'Failed to analyze user data' }
        }
      }
    },
    
    {
      name: 'getRecommendations',
      description: 'Get AI-powered recommendations based on user activity and context',
      parameters: [
        {
          name: 'category',
          type: 'string',
          description: 'Recommendation category (productivity, automation, optimization, all)',
          required: false
        }
      ],
      handler: async (params: any) => {
        try {
          const { userId } = await auth()
          if (!userId) return { error: 'User not authenticated' }
          
          const { category = 'all' } = params
          const db = await createDatabaseService()
          
          const [tasks, workflows, subscription] = await Promise.all([
            db.getUserTasks(userId),
            db.getUserWorkflows(userId),
            db.getActiveSubscription(userId),
          ])
          
          const recommendations = []
          
          // Productivity recommendations
          if (category === 'productivity' || category === 'all') {
            const overdueTasks = tasks.filter(t => 
              !t.completed && t.due_date && new Date(t.due_date) < new Date()
            )
            
            if (overdueTasks.length > 0) {
              recommendations.push({
                type: 'productivity',
                priority: 'high',
                title: 'Address Overdue Tasks',
                description: `You have ${overdueTasks.length} overdue tasks that need attention.`,
                action: 'Review and reschedule overdue tasks to get back on track.',
                impact: 'high',
              })
            }
            
            const completionRate = tasks.length > 0 ? (tasks.filter(t => t.completed).length / tasks.length) : 0
            if (completionRate < 0.7 && tasks.length > 5) {
              recommendations.push({
                type: 'productivity',
                priority: 'medium',
                title: 'Improve Task Completion Rate',
                description: `Your task completion rate is ${Math.round(completionRate * 100)}%.`,
                action: 'Break down large tasks into smaller, manageable pieces.',
                impact: 'medium',
              })
            }
          }
          
          // Automation recommendations
          if (category === 'automation' || category === 'all') {
            if (workflows.length === 0) {
              recommendations.push({
                type: 'automation',
                priority: 'medium',
                title: 'Set Up Your First Workflow',
                description: 'Automate repetitive tasks to save time and increase efficiency.',
                action: 'Create a workflow for task notifications or email reminders.',
                impact: 'high',
              })
            } else {
              const inactiveWorkflows = workflows.filter(w => !w.active)
              if (inactiveWorkflows.length > 0) {
                recommendations.push({
                  type: 'automation',
                  priority: 'low',
                  title: 'Activate Inactive Workflows',
                  description: `You have ${inactiveWorkflows.length} inactive workflows.`,
                  action: 'Review and activate workflows that could benefit your productivity.',
                  impact: 'medium',
                })
              }
            }
          }
          
          // Subscription recommendations
          if (!subscription) {
            recommendations.push({
              type: 'optimization',
              priority: 'medium',
              title: 'Upgrade for More Features',
              description: 'Unlock advanced features with a subscription.',
              action: 'Consider upgrading to Pro for unlimited workflows and advanced AI.',
              impact: 'high',
            })
          }
          
          return {
            success: true,
            category,
            recommendations,
            summary: `Found ${recommendations.length} recommendations to improve your productivity.`,
          }
        } catch (error) {
          return { error: 'Failed to generate recommendations' }
        }
      }
    },
    
    {
      name: 'getPricingInfo',
      description: 'Get information about available pricing plans',
      parameters: [],
      handler: async () => {
        return {
          plans: [
            {
              name: 'Basic',
              price: 9.99,
              currency: 'EUR',
              interval: 'month',
              features: [
                'Up to 10 workflows',
                'Basic AI integration', 
                'Email support',
                'Dashboard access',
                'Basic analytics'
              ]
            },
            {
              name: 'Pro',
              price: 29.99,
              currency: 'EUR', 
              interval: 'month',
              popular: true,
              features: [
                'Unlimited workflows',
                'Advanced AI integration',
                'Priority support',
                'Advanced analytics',
                'Custom integrations',
                'API access',
                'Team collaboration'
              ]
            },
            {
              name: 'Enterprise',
              price: 99.99,
              currency: 'EUR',
              interval: 'month',
              features: [
                'Everything in Pro',
                'White-label solution',
                'Dedicated support',
                'Custom development',
                'SLA guarantee',
                'On-premise deployment',
                'Advanced security'
              ]
            }
          ],
          benefits: [
            '14-day free trial',
            'Cancel anytime',
            '24/7 Support',
            'EU VAT included'
          ]
        }
      }
    }
  ],
  
  // Define readable state that provides context to the AI
  state: async () => {
    try {
      const { userId } = await auth()
      if (!userId) return {}
      
      const db = await createDatabaseService()
      const [profile, subscription, workflows, tasks] = await Promise.all([
        db.getProfile(userId),
        db.getActiveSubscription(userId), 
        db.getUserWorkflows(userId),
        db.getUserTasks(userId)
      ])
      
      return {
        user: {
          id: userId,
          hasProfile: !!profile,
          email: profile?.email,
          name: profile ? `${profile.first_name} ${profile.last_name}`.trim() : null
        },
        subscription: subscription ? {
          status: subscription.status,
          plan: subscription.stripe_price_id,
          isActive: subscription.status === 'active'
        } : null,
        workflows: {
          total: workflows.length,
          active: workflows.filter(w => w.active).length,
          types: {
            n8n: workflows.filter(w => w.n8n_id).length,
            make: workflows.filter(w => w.make_id).length
          }
        },
        tasks: {
          total: tasks.length,
          completed: tasks.filter(t => t.completed).length,
          pending: tasks.filter(t => !t.completed).length,
          overdue: tasks.filter(t => 
            !t.completed && 
            t.due_date && 
            new Date(t.due_date) < new Date()
          ).length
        }
      }
    } catch (error) {
      console.error('Error getting CopilotKit state:', error)
      return {}
    }
  }
})

// Export the Next.js App Router endpoint
export const { GET, POST } = copilotRuntimeNextJSAppRouterEndpoint({
  runtime,
  path: '/api/copilotkit'
})

// Add request middleware for authentication context
export async function handler(req: NextRequest) {
  // The authentication is handled within individual actions
  // This ensures proper user context for all CopilotKit operations
  return { GET, POST }
}