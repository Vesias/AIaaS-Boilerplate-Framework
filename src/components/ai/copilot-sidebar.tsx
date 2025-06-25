'use client'

import { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { 
  Send, 
  Bot, 
  User, 
  Minimize2, 
  Maximize2, 
  MoreHorizontal,
  Copy,
  Trash2,
  RefreshCw,
  Settings,
  MessageSquare,
  Zap,
  Lightbulb,
  Code,
  FileText,
  Database,
  TrendingUp
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Message {
  id: string
  type: 'user' | 'assistant'
  content: string
  timestamp: Date
  actions?: MessageAction[]
  context?: {
    type: 'task' | 'workflow' | 'invoice' | 'general'
    data?: any
  }
}

interface MessageAction {
  id: string
  label: string
  icon: any
  action: () => void
}

interface QuickAction {
  id: string
  label: string
  icon: any
  prompt: string
  category: 'tasks' | 'workflows' | 'invoices' | 'analytics'
}

interface CopilotSidebarProps {
  isMinimized?: boolean
  onToggleMinimized?: () => void
  onSendMessage?: (message: string, context?: any) => Promise<string>
  quickActions?: QuickAction[]
  className?: string
  showQuickActions?: boolean
  contextData?: any
}

const DEFAULT_QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'create-task',
    label: 'Create Task',
    icon: FileText,
    prompt: 'Help me create a new task',
    category: 'tasks'
  },
  {
    id: 'analyze-performance',
    label: 'Analyze Performance',
    icon: TrendingUp,
    prompt: 'Analyze my current performance metrics',
    category: 'analytics'
  },
  {
    id: 'workflow-optimization',
    label: 'Optimize Workflow',
    icon: Zap,
    prompt: 'Suggest workflow optimizations',
    category: 'workflows'
  },
  {
    id: 'invoice-insights',
    label: 'Invoice Insights',
    icon: Database,
    prompt: 'Provide insights on my invoicing patterns',
    category: 'invoices'
  }
]

export default function CopilotSidebar({
  isMinimized = false,
  onToggleMinimized,
  onSendMessage,
  quickActions = DEFAULT_QUICK_ACTIONS,
  className,
  showQuickActions = true,
  contextData
}: CopilotSidebarProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'assistant',
      content: 'Hello! I\'m your AI assistant. How can I help you today?',
      timestamp: new Date()
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = async (messageContent?: string) => {
    const content = messageContent || input.trim()
    if (!content) return

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = onSendMessage 
        ? await onSendMessage(content, contextData)
        : await simulateAIResponse(content)

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: response,
        timestamp: new Date(),
        actions: generateMessageActions(response)
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const simulateAIResponse = async (message: string): Promise<string> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000))

    if (message.toLowerCase().includes('task')) {
      return 'I can help you create and manage tasks. Would you like me to create a new task or analyze your existing ones?'
    } else if (message.toLowerCase().includes('workflow')) {
      return 'I can assist with workflow optimization and automation. What specific workflow would you like to improve?'
    } else if (message.toLowerCase().includes('invoice')) {
      return 'I can help with invoice management, analytics, and automation. What invoice-related task can I help you with?'
    } else if (message.toLowerCase().includes('performance') || message.toLowerCase().includes('analytics')) {
      return 'Based on your current data, I notice some patterns that might interest you. Would you like me to provide detailed analytics or specific recommendations?'
    } else {
      return 'I understand you\'re looking for assistance. Could you be more specific about what you\'d like help with? I can assist with tasks, workflows, invoices, and analytics.'
    }
  }

  const generateMessageActions = (content: string): MessageAction[] => {
    const actions: MessageAction[] = []

    if (content.includes('task')) {
      actions.push({
        id: 'create-task',
        label: 'Create Task',
        icon: FileText,
        action: () => console.log('Create task action')
      })
    }

    if (content.includes('workflow')) {
      actions.push({
        id: 'view-workflows',
        label: 'View Workflows',
        icon: Zap,
        action: () => console.log('View workflows action')
      })
    }

    actions.push({
      id: 'copy-response',
      label: 'Copy',
      icon: Copy,
      action: () => navigator.clipboard.writeText(content)
    })

    return actions
  }

  const handleQuickAction = (action: QuickAction) => {
    handleSendMessage(action.prompt)
  }

  const clearChat = () => {
    setMessages([
      {
        id: '1',
        type: 'assistant',
        content: 'Hello! I\'m your AI assistant. How can I help you today?',
        timestamp: new Date()
      }
    ])
  }

  if (isMinimized) {
    return (
      <Card className={cn("w-16 h-16 fixed bottom-4 right-4 cursor-pointer", className)}>
        <CardContent 
          className="p-0 h-full flex items-center justify-center"
          onClick={onToggleMinimized}
        >
          <Bot className="h-6 w-6 text-blue-600" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn("w-80 h-96 flex flex-col", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-sm">AI Assistant</CardTitle>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={clearChat}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm">
              <Settings className="h-4 w-4" />
            </Button>
            {onToggleMinimized && (
              <Button variant="ghost" size="sm" onClick={onToggleMinimized}>
                <Minimize2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0">
        {/* Messages */}
        <ScrollArea className="flex-1 px-4">
          <div className="space-y-4">
            {messages.map((message) => (
              <div key={message.id} className="space-y-2">
                <div className={cn(
                  "flex gap-3",
                  message.type === 'user' ? 'justify-end' : 'justify-start'
                )}>
                  {message.type === 'assistant' && (
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>
                        <Bot className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                  
                  <div className={cn(
                    "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                    message.type === 'user' 
                      ? 'bg-blue-600 text-white ml-auto' 
                      : 'bg-muted'
                  )}>
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    
                    {message.actions && message.actions.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {message.actions.map((action) => {
                          const Icon = action.icon
                          return (
                            <Button
                              key={action.id}
                              variant="ghost"
                              size="sm"
                              onClick={action.action}
                              className="h-6 px-2 text-xs"
                            >
                              <Icon className="h-3 w-3 mr-1" />
                              {action.label}
                            </Button>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {message.type === 'user' && (
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
                
                <div className={cn(
                  "text-xs text-muted-foreground",
                  message.type === 'user' ? 'text-right' : 'text-left'
                )}>
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>
                    <Bot className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="bg-muted rounded-lg px-3 py-2">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Quick Actions */}
        {showQuickActions && (
          <>
            <Separator />
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-yellow-500" />
                <span className="text-sm font-medium">Quick Actions</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {quickActions.slice(0, 4).map((action) => {
                  const Icon = action.icon
                  return (
                    <Button
                      key={action.id}
                      variant="outline"
                      size="sm"
                      onClick={() => handleQuickAction(action)}
                      className="h-auto p-2 flex flex-col items-center gap-1"
                    >
                      <Icon className="h-4 w-4" />
                      <span className="text-xs text-center leading-tight">
                        {action.label}
                      </span>
                    </Button>
                  )
                })}
              </div>
            </div>
            <Separator />
          </>
        )}

        {/* Input */}
        <div className="p-4">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me anything..."
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSendMessage()
                }
              }}
              disabled={isLoading}
              className="flex-1"
            />
            <Button 
              onClick={() => handleSendMessage()} 
              disabled={!input.trim() || isLoading}
              size="sm"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </CardContent>
    </Card>
  )
}