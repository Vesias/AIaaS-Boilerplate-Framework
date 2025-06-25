/**
 * CopilotKit Configuration and Client Setup
 * Provides AI chat assistance integrated with the AIaaS platform
 */

import { CopilotRuntimeClient } from '@copilotkit/react-core'

// CopilotKit configuration
export const copilotConfig = {
  // Public API key for client-side operations
  publicApiKey: process.env.NEXT_PUBLIC_COPILOTKIT_PUBLIC_API_KEY,
  
  // Backend URL for CopilotKit runtime
  url: process.env.NEXT_PUBLIC_COPILOTKIT_RUNTIME_URL || '/api/copilotkit',
  
  // Chat configuration
  chatConfig: {
    // Model settings
    model: 'gpt-4o-mini', // Use more cost-effective model
    temperature: 0.7,
    maxTokens: 1000,
    
    // UI customization
    instructions: `You are an AI assistant for an AIaaS automation platform. You help users with:
    
    **Core Features:**
    - Setting up automation workflows with n8n and Make.com
    - Managing subscriptions and billing
    - Configuring AI integrations (MCP, AG-UI)
    - Understanding product features and pricing
    - Troubleshooting technical issues
    
    **Available Data:**
    - User profile and subscription status
    - Workflow configurations and execution history
    - Task management and progress tracking
    - Invoice and payment history
    
    **Personality:**
    - Professional but friendly
    - Technical but accessible
    - Proactive in suggesting improvements
    - Always provide actionable guidance
    
    **Limitations:**
    - Cannot access external systems directly
    - Cannot modify user data without explicit confirmation
    - Cannot perform billing operations directly
    - Cannot access sensitive authentication data
    
    Always ask for clarification when requests are ambiguous and provide step-by-step guidance when explaining complex processes.`,
    
    // Welcome message
    initialMessages: [
      {
        id: 'welcome',
        role: 'assistant' as const,
        content: "Hi! I'm your AI assistant for this automation platform. I can help you set up workflows, manage your subscription, configure integrations, and answer any questions about our features. What can I help you with today?"
      }
    ]
  }
}

// Create CopilotKit runtime client
export function createCopilotClient() {
  return new CopilotRuntimeClient({
    url: copilotConfig.url,
    publicApiKey: copilotConfig.publicApiKey,
  })
}

// Available CopilotKit actions for the platform
export const copilotActions = [
  {
    name: 'get_user_subscription',
    description: 'Get current user subscription status and details',
    parameters: [],
    handler: async () => {
      // This will be implemented to fetch user subscription data
      return { action: 'get_user_subscription', status: 'placeholder' }
    }
  },
  {
    name: 'get_user_workflows',
    description: 'Get user workflows and their execution status',
    parameters: [],
    handler: async () => {
      // This will be implemented to fetch user workflows
      return { action: 'get_user_workflows', data: 'placeholder' }
    }
  },
  {
    name: 'create_workflow',
    description: 'Help user create a new automation workflow',
    parameters: [
      {
        name: 'workflow_type',
        type: 'string',
        description: 'Type of workflow (n8n or make)',
        required: true
      },
      {
        name: 'workflow_name',
        type: 'string', 
        description: 'Name for the workflow',
        required: true
      },
      {
        name: 'description',
        type: 'string',
        description: 'Description of what the workflow should do',
        required: true
      }
    ],
    handler: async (params: any) => {
      // This will be implemented to create workflows
      return { 
        action: 'create_workflow', 
        params,
        status: 'This feature will be implemented to create actual workflows'
      }
    }
  },
  {
    name: 'get_pricing_info',
    description: 'Get information about pricing plans and features',
    parameters: [],
    handler: async () => {
      return {
        action: 'get_pricing_info',
        plans: [
          {
            name: 'Basic',
            price: '€9.99/month',
            features: ['Up to 10 workflows', 'Basic AI integration', 'Email support']
          },
          {
            name: 'Pro', 
            price: '€29.99/month',
            features: ['Unlimited workflows', 'Advanced AI integration', 'Priority support', 'API access']
          },
          {
            name: 'Enterprise',
            price: '€99.99/month',
            features: ['Everything in Pro', 'White-label solution', 'Dedicated support', 'Custom development']
          }
        ]
      }
    }
  },
  {
    name: 'help_with_integration',
    description: 'Provide help with setting up integrations (n8n, Make.com, AI services)',
    parameters: [
      {
        name: 'integration_type',
        type: 'string',
        description: 'Which integration needs help (n8n, make, mcp, agui, stripe)',
        required: true
      }
    ],
    handler: async (params: any) => {
      const { integration_type } = params
      
      const integrationGuides = {
        n8n: {
          title: 'n8n Integration Setup',
          steps: [
            'Go to your n8n instance settings',
            'Create a new webhook URL',
            'Copy the webhook URL to your workflow configuration',
            'Test the connection with a sample workflow'
          ],
          documentation: '/docs/integrations/n8n'
        },
        make: {
          title: 'Make.com Integration Setup', 
          steps: [
            'Log into your Make.com account',
            'Create a new scenario',
            'Add a webhook trigger module',
            'Configure the webhook URL in your account settings'
          ],
          documentation: '/docs/integrations/make'
        },
        mcp: {
          title: 'Model Context Protocol (MCP) Setup',
          steps: [
            'Configure your MCP server endpoint',
            'Set up authentication tokens',
            'Test the connection with a sample context',
            'Add your custom tools and resources'
          ],
          documentation: '/docs/integrations/mcp'
        },
        agui: {
          title: 'AG-UI Protocol Setup',
          steps: [
            'Get your AG-UI API key',
            'Configure the agent backend URL',
            'Set up your agent capabilities',
            'Test with the demo interface'
          ],
          documentation: '/docs/integrations/agui'
        },
        stripe: {
          title: 'Stripe Payment Setup',
          steps: [
            'Get your Stripe API keys from the dashboard',
            'Configure webhook endpoints',
            'Set up your product pricing',
            'Test with sandbox transactions'
          ],
          documentation: '/docs/integrations/stripe'
        }
      }
      
      return {
        action: 'help_with_integration',
        integration: integration_type,
        guide: integrationGuides[integration_type as keyof typeof integrationGuides] || {
          title: 'Integration Help',
          message: 'Integration guide not found. Please check our documentation or contact support.'
        }
      }
    }
  }
]

// CopilotKit readable state for context
export const copilotReadableState = {
  userProfile: 'User profile information and subscription status',
  workflows: 'User workflows and execution history', 
  tasks: 'User tasks and progress tracking',
  integrations: 'Connected integrations and their status',
  invoices: 'Billing history and invoice information'
}