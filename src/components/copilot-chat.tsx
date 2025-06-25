'use client'

import { CopilotKit } from '@copilotkit/react-core'
import { CopilotPopup } from '@copilotkit/react-ui'
import { useState } from 'react'
import { Button } from './ui/button'
import { MessageCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CopilotChatProps {
  className?: string
  variant?: 'popup' | 'sidebar' | 'inline'
  triggerLabel?: string
}

export function CopilotChat({ 
  className,
  variant = 'popup',
  triggerLabel = 'AI Assistant'
}: CopilotChatProps) {
  const [isOpen, setIsOpen] = useState(false)

  const copilotConfig = {
    runtimeUrl: '/api/copilotkit',
    instructions: `You are an AI assistant for an AIaaS automation platform. Help users with:
    
    **Your Capabilities:**
    - Get user subscription and billing information
    - View and manage workflows and automations
    - Create and track tasks
    - Provide pricing and feature information
    - Guide users through integrations (n8n, Make.com, AI services)
    - Answer questions about platform features
    
    **Personality & Approach:**
    - Be friendly, helpful, and professional
    - Provide clear, actionable guidance
    - Offer step-by-step instructions when needed
    - Ask clarifying questions when requests are unclear
    - Suggest relevant features and improvements
    - Be proactive in helping users succeed
    
    **Data Access:**
    You have access to real user data including their subscription status, workflows, tasks, and billing history. Use this context to provide personalized assistance.
    
    **Limitations:**
    - Cannot modify user data without explicit confirmation
    - Cannot perform billing operations directly (guide to appropriate pages)
    - Cannot access external systems directly
    - Cannot modify subscription settings (direct to customer portal)
    
    Always prioritize user success and provide value in every interaction.`,
    
    initialMessages: [
      {
        role: 'assistant' as const,
        content: `Hi! I'm your AI assistant for this automation platform. 🤖

I can help you with:
• Managing your workflows and automations
• Understanding your subscription and billing
• Creating and tracking tasks
• Setting up integrations
• Answering questions about features

What would you like to work on today?`
      }
    ]
  }

  if (variant === 'popup') {
    return (
      <CopilotKit runtimeUrl={copilotConfig.runtimeUrl}>
        <CopilotPopup
          instructions={copilotConfig.instructions}
          labels={{
            title: 'AI Assistant',
            initial: copilotConfig.initialMessages[0].content,
          }}
          className={cn(className)}
        />
      </CopilotKit>
    )
  }

  if (variant === 'sidebar') {
    return (
      <div className={cn('fixed right-0 top-0 h-full w-96 bg-white dark:bg-gray-900 shadow-lg border-l z-50', className)}>
        <CopilotKit runtimeUrl={copilotConfig.runtimeUrl}>
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-lg">AI Assistant</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 p-4">
              {/* CopilotTextarea or custom chat interface would go here */}
              <div className="text-center text-gray-500 mt-8">
                Chat interface will be implemented here
              </div>
            </div>
          </div>
        </CopilotKit>
      </div>
    )
  }

  // Inline variant
  return (
    <div className={cn('w-full h-96 border rounded-lg', className)}>
      <CopilotKit runtimeUrl={copilotConfig.runtimeUrl}>
        <div className="flex flex-col h-full">
          <div className="p-4 border-b bg-gray-50 dark:bg-gray-800">
            <h3 className="font-semibold">AI Assistant</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Ask me anything about your automation platform
            </p>
          </div>
          <div className="flex-1 p-4">
            {/* CopilotTextarea or custom chat interface would go here */}
            <div className="text-center text-gray-500 mt-8">
              Chat interface will be implemented here
            </div>
          </div>
        </div>
      </CopilotKit>
    </div>
  )
}

// Floating action button for easy access
export function CopilotFAB({ className }: { className?: string }) {
  return (
    <div className={cn('fixed bottom-4 right-4 z-50', className)}>
      <CopilotKit runtimeUrl="/api/copilotkit">
        <CopilotPopup
          instructions={`You are an AI assistant for an AIaaS automation platform. Help users with their workflows, subscriptions, tasks, and integrations. Be friendly, helpful, and provide actionable guidance.`}
          labels={{
            title: 'AI Assistant',
            initial: 'Hi! How can I help you with your automation platform today?',
          }}
        />
      </CopilotKit>
    </div>
  )
}

// Custom trigger button for the popup
export function CopilotTrigger({ 
  className,
  children 
}: { 
  className?: string
  children?: React.ReactNode 
}) {
  return (
    <Button 
      className={cn('gap-2', className)}
      onClick={() => {
        // This would trigger the CopilotPopup
        // Implementation depends on CopilotKit's API
      }}
    >
      <MessageCircle className="h-4 w-4" />
      {children || 'AI Assistant'}
    </Button>
  )
}

// Provider component to wrap the entire app
export function CopilotProvider({ 
  children 
}: { 
  children: React.ReactNode 
}) {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit">
      {children}
    </CopilotKit>
  )
}