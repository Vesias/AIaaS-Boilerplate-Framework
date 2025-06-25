'use client'

import { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Send, 
  Bot, 
  User, 
  Zap, 
  Brain,
  MessageSquare,
  FileText,
  Image,
  Code,
  Mic,
  Play,
  Pause,
  Download,
  Upload,
  Settings,
  RotateCcw,
  Sparkles,
  Activity
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface AGUIMessage {
  id: string
  type: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  metadata?: {
    model?: string
    processingTime?: number
    tokens?: number
    confidence?: number
    attachments?: AGUIAttachment[]
    actions?: AGUIAction[]
  }
}

interface AGUIAttachment {
  id: string
  type: 'image' | 'file' | 'code' | 'data'
  name: string
  url?: string
  content?: string
  size?: number
}

interface AGUIAction {
  id: string
  label: string
  type: 'execute' | 'download' | 'copy' | 'share'
  icon: any
  handler: () => void
}

interface AGUIAgent {
  id: string
  name: string
  model: string
  capabilities: string[]
  status: 'active' | 'inactive' | 'processing'
  avatar?: string
}

interface AGUIChatProps {
  agents?: AGUIAgent[]
  onSendMessage?: (message: string, agent: string) => Promise<AGUIMessage>
  className?: string
  showAgentSelector?: boolean
  enableFileUpload?: boolean
  enableVoiceInput?: boolean
  maxTokens?: number
}

const DEFAULT_AGENTS: AGUIAgent[] = [
  {
    id: 'gpt-4',
    name: 'GPT-4 Turbo',
    model: 'gpt-4-turbo',
    capabilities: ['text', 'code', 'analysis', 'reasoning'],
    status: 'active'
  },
  {
    id: 'claude-3',
    name: 'Claude 3 Sonnet',
    model: 'claude-3-sonnet',
    capabilities: ['text', 'analysis', 'writing', 'coding'],
    status: 'active'
  },
  {
    id: 'gemini-pro',
    name: 'Gemini Pro',
    model: 'gemini-pro',
    capabilities: ['text', 'multimodal', 'reasoning'],
    status: 'active'
  }
]

export default function AGUIChat({
  agents = DEFAULT_AGENTS,
  onSendMessage,
  className,
  showAgentSelector = true,
  enableFileUpload = true,
  enableVoiceInput = true,
  maxTokens = 4000
}: AGUIChatProps) {
  const [messages, setMessages] = useState<AGUIMessage[]>([
    {
      id: '1',
      type: 'system',
      content: 'AG-UI Protocol initialized. Multi-agent AI system ready.',
      timestamp: new Date()
    }
  ])
  const [input, setInput] = useState('')
  const [selectedAgent, setSelectedAgent] = useState(agents[0]?.id || '')
  const [isLoading, setIsLoading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [tokenUsage, setTokenUsage] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const simulateAGUIResponse = async (message: string, agentId: string): Promise<AGUIMessage> => {
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    const agent = agents.find(a => a.id === agentId)
    const responses = {
      'gpt-4': `[GPT-4] I understand your request: "${message}". I can help you with advanced reasoning, code generation, and complex problem-solving. What specific task would you like me to assist with?`,
      'claude-3': `[Claude 3] Thank you for your message: "${message}". I excel at analysis, writing, and thoughtful conversation. How can I help you achieve your goals today?`,
      'gemini-pro': `[Gemini Pro] Processing: "${message}". I can handle multimodal tasks and provide comprehensive assistance. What would you like to explore?`
    }

    const actions: AGUIAction[] = [
      {
        id: 'copy',
        label: 'Copy',
        type: 'copy',
        icon: FileText,
        handler: () => navigator.clipboard.writeText(responses[agentId as keyof typeof responses] || '')
      }
    ]

    if (message.toLowerCase().includes('code')) {
      actions.push({
        id: 'execute',
        label: 'Execute',
        type: 'execute',
        icon: Play,
        handler: () => console.log('Execute code')
      })
    }

    return {
      id: Date.now().toString(),
      type: 'assistant',
      content: responses[agentId as keyof typeof responses] || 'I can help you with that task.',
      timestamp: new Date(),
      metadata: {
        model: agent?.model || agentId,
        processingTime: Math.random() * 2000 + 500,
        tokens: Math.floor(Math.random() * 100) + 20,
        confidence: Math.random() * 30 + 70,
        actions
      }
    }
  }

  const handleSendMessage = async () => {
    if (!input.trim() || !selectedAgent) return

    const userMessage: AGUIMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: input,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = onSendMessage 
        ? await onSendMessage(input, selectedAgent)
        : await simulateAGUIResponse(input, selectedAgent)

      setMessages(prev => [...prev, response])
      setTokenUsage(prev => prev + (response.metadata?.tokens || 0))
    } catch (error) {
      const errorMessage: AGUIMessage = {
        id: (Date.now() + 1).toString(),
        type: 'system',
        content: 'Error: Failed to get response from agent.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const attachment: AGUIAttachment = {
        id: Date.now().toString(),
        type: file.type.startsWith('image/') ? 'image' : 'file',
        name: file.name,
        size: file.size
      }

      const userMessage: AGUIMessage = {
        id: Date.now().toString(),
        type: 'user',
        content: `Uploaded file: ${file.name}`,
        timestamp: new Date(),
        metadata: {
          attachments: [attachment]
        }
      }

      setMessages(prev => [...prev, userMessage])
    }
  }

  const toggleRecording = () => {
    setIsRecording(!isRecording)
    // Voice recording logic would go here
  }

  const clearChat = () => {
    setMessages([
      {
        id: '1',
        type: 'system',
        content: 'AG-UI Protocol initialized. Multi-agent AI system ready.',
        timestamp: new Date()
      }
    ])
    setTokenUsage(0)
  }

  const getAgentStatus = (agentId: string) => {
    const agent = agents.find(a => a.id === agentId)
    return agent?.status || 'inactive'
  }

  const getAgentStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'processing': return 'bg-blue-100 text-blue-800'
      case 'inactive': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <Card className={cn("h-96 flex flex-col", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            <CardTitle className="text-sm">AG-UI Protocol</CardTitle>
            <Badge variant="outline" className="text-xs">Multi-Agent</Badge>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={clearChat}>
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Token Usage */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span>Token Usage</span>
            <span>{tokenUsage} / {maxTokens}</span>
          </div>
          <Progress value={(tokenUsage / maxTokens) * 100} className="h-1" />
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0">
        <Tabs defaultValue="chat" className="flex-1 flex flex-col">
          <TabsList className="mx-4 grid w-auto grid-cols-2">
            <TabsTrigger value="chat">Chat</TabsTrigger>
            <TabsTrigger value="agents">Agents</TabsTrigger>
          </TabsList>

          <TabsContent value="chat" className="flex-1 flex flex-col mt-0">
            {/* Messages */}
            <ScrollArea className="flex-1 px-4">
              <div className="space-y-4 py-4">
                {messages.map((message) => (
                  <div key={message.id} className="space-y-2">
                    <div className={cn(
                      "flex gap-3",
                      message.type === 'user' ? 'justify-end' : 'justify-start'
                    )}>
                      {message.type !== 'user' && (
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className={cn(
                            message.type === 'system' ? 'bg-purple-100' : 'bg-blue-100'
                          )}>
                            {message.type === 'system' ? (
                              <Zap className="h-4 w-4 text-purple-600" />
                            ) : (
                              <Brain className="h-4 w-4 text-blue-600" />
                            )}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      
                      <div className={cn(
                        "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                        message.type === 'user' 
                          ? 'bg-blue-600 text-white ml-auto' 
                          : message.type === 'system'
                          ? 'bg-purple-100 text-purple-900'
                          : 'bg-muted'
                      )}>
                        <p className="whitespace-pre-wrap">{message.content}</p>
                        
                        {/* Metadata */}
                        {message.metadata && (
                          <div className="mt-2 space-y-2">
                            {message.metadata.model && (
                              <div className="flex items-center gap-2 text-xs opacity-70">
                                <Badge variant="outline" className="text-xs">
                                  {message.metadata.model}
                                </Badge>
                                {message.metadata.processingTime && (
                                  <span>{message.metadata.processingTime.toFixed(0)}ms</span>
                                )}
                                {message.metadata.confidence && (
                                  <span>{message.metadata.confidence.toFixed(0)}% confident</span>
                                )}
                              </div>
                            )}
                            
                            {/* Actions */}
                            {message.metadata.actions && (
                              <div className="flex flex-wrap gap-1">
                                {message.metadata.actions.map((action) => {
                                  const Icon = action.icon
                                  return (
                                    <Button
                                      key={action.id}
                                      variant="ghost"
                                      size="sm"
                                      onClick={action.handler}
                                      className="h-6 px-2 text-xs"
                                    >
                                      <Icon className="h-3 w-3 mr-1" />
                                      {action.label}
                                    </Button>
                                  )
                                })}
                              </div>
                            )}

                            {/* Attachments */}
                            {message.metadata.attachments && (
                              <div className="space-y-1">
                                {message.metadata.attachments.map((attachment) => (
                                  <div key={attachment.id} className="flex items-center gap-2 text-xs">
                                    {attachment.type === 'image' ? (
                                      <Image className="h-3 w-3" />
                                    ) : (
                                      <FileText className="h-3 w-3" />
                                    )}
                                    <span>{attachment.name}</span>
                                    {attachment.size && (
                                      <span className="opacity-70">
                                        ({(attachment.size / 1024).toFixed(1)}KB)
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
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
                  </div>
                ))}
                
                {isLoading && (
                  <div className="flex gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-blue-100">
                        <Activity className="h-4 w-4 text-blue-600 animate-pulse" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="bg-muted rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                          <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {agents.find(a => a.id === selectedAgent)?.name} is thinking...
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Agent Selector */}
            {showAgentSelector && (
              <div className="px-4 py-2 border-t">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Agent:</span>
                  <select 
                    value={selectedAgent}
                    onChange={(e) => setSelectedAgent(e.target.value)}
                    className="text-xs border rounded px-2 py-1"
                  >
                    {agents.map(agent => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name}
                      </option>
                    ))}
                  </select>
                  <Badge className={getAgentStatusColor(getAgentStatus(selectedAgent))}>
                    {getAgentStatus(selectedAgent)}
                  </Badge>
                </div>
              </div>
            )}

            {/* Input */}
            <div className="p-4 border-t">
              <div className="flex gap-2">
                <div className="flex gap-1">
                  {enableFileUpload && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-4 w-4" />
                    </Button>
                  )}
                  {enableVoiceInput && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={toggleRecording}
                      className={cn(isRecording && "text-red-500")}
                    >
                      <Mic className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Message AG-UI..."
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleSendMessage()
                    }
                  }}
                  disabled={isLoading}
                  className="flex-1"
                />
                
                <Button 
                  onClick={handleSendMessage} 
                  disabled={!input.trim() || isLoading}
                  size="sm"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileUpload}
                className="hidden"
                accept="*/*"
              />
            </div>
          </TabsContent>

          <TabsContent value="agents" className="px-4 py-4">
            <div className="space-y-3">
              {agents.map(agent => (
                <div 
                  key={agent.id} 
                  className={cn(
                    "p-3 border rounded-lg cursor-pointer transition-colors",
                    selectedAgent === agent.id ? "border-blue-500 bg-blue-50" : "hover:bg-muted"
                  )}
                  onClick={() => setSelectedAgent(agent.id)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-sm">{agent.name}</h4>
                    <Badge className={getAgentStatusColor(agent.status)}>
                      {agent.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{agent.model}</p>
                  <div className="flex flex-wrap gap-1">
                    {agent.capabilities.map(capability => (
                      <Badge key={capability} variant="outline" className="text-xs">
                        {capability}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}