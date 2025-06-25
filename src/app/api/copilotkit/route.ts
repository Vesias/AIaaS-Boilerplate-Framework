/**
 * CopilotKit Runtime API Endpoint
 * Handles CopilotKit requests and provides AI chat functionality
 */

import { 
  CopilotRuntime, 
  OpenAIAdapter,
  copilotRuntimeNextJSAppRouterEndpoint 
} from '@copilotkit/runtime'
import { auth } from '@clerk/nextjs/server'
import { createDatabaseService } from '@/lib/database'
import { NextRequest } from 'next/server'

// Initialize OpenAI adapter
const openaiAdapter = new OpenAIAdapter({
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4o-mini', // Use cost-effective model
})

// CopilotKit runtime configuration
const runtime = new CopilotRuntime({
  adapter: openaiAdapter,
  
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