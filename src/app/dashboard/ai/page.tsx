'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { 
  Bot, 
  MessageSquare, 
  Settings, 
  Activity, 
  Zap, 
  Clock,
  AlertCircle,
  CheckCircle,
  Loader2,
  RefreshCw,
  Play,
  Square,
  Send,
  Code,
  Database,
  Globe,
  Brain,
  Cpu,
  Network,
  Monitor,
  History,
  Trash2,
  Copy,
  Star,
  User,
  Plus,
  Euro
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'

interface AIModel {
  id: string
  name: string
  provider: 'openai' | 'anthropic' | 'google' | 'local'
  type: 'chat' | 'completion' | 'embedding' | 'vision'
  status: 'active' | 'inactive' | 'error'
  maxTokens: number
  cost: number // per 1K tokens
  capabilities: string[]
  lastUsed?: string
}

interface Conversation {
  id: string
  title: string
  modelId: string
  protocol: 'copilotkit' | 'mcp' | 'ag-ui' | 'a2a'
  messageCount: number
  createdAt: string
  lastActivity: string
  isStarred: boolean
  tags: string[]
}

interface AIProtocol {
  id: 'copilotkit' | 'mcp' | 'ag-ui' | 'a2a'
  name: string
  description: string
  status: 'connected' | 'disconnected' | 'error'
  endpoint?: string
  capabilities: string[]
  lastActivity?: string
  activeConversations: number
}

interface SystemMetrics {
  totalTokensUsed: number
  totalCost: number
  activeModels: number
  totalConversations: number
  averageResponseTime: number
  successRate: number
}

export default function AIPage() {
  const { userId } = useAuth()
  const { toast } = useToast()
  const [models, setModels] = useState<AIModel[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [protocols, setProtocols] = useState<AIProtocol[]>([])
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null)
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [showModelForm, setShowModelForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'chat' | 'models' | 'protocols' | 'analytics'>('chat')
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [selectedProtocol, setSelectedProtocol] = useState<string>('')

  // Mock data for demonstration
  useEffect(() => {
    const mockModels: AIModel[] = [
      {
        id: 'gpt-4',
        name: 'GPT-4',
        provider: 'openai',
        type: 'chat',
        status: 'active',
        maxTokens: 8192,
        cost: 0.03,
        capabilities: ['chat', 'code', 'analysis', 'reasoning'],
        lastUsed: '2024-01-14T10:30:00Z'
      },
      {
        id: 'claude-3',
        name: 'Claude 3 Opus',
        provider: 'anthropic',
        type: 'chat',
        status: 'active',
        maxTokens: 200000,
        cost: 0.015,
        capabilities: ['chat', 'analysis', 'code', 'reasoning', 'long-context'],
        lastUsed: '2024-01-14T09:15:00Z'
      },
      {
        id: 'gemini-pro',
        name: 'Gemini Pro',
        provider: 'google',
        type: 'chat',
        status: 'active',
        maxTokens: 32768,
        cost: 0.001,
        capabilities: ['chat', 'multimodal', 'code'],
        lastUsed: '2024-01-13T16:20:00Z'
      },
      {
        id: 'local-llama',
        name: 'Llama 2 7B',
        provider: 'local',
        type: 'chat',
        status: 'inactive',
        maxTokens: 4096,
        cost: 0,
        capabilities: ['chat', 'code'],
        lastUsed: '2024-01-12T14:45:00Z'
      }
    ]

    const mockConversations: Conversation[] = [
      {
        id: 'conv-1',
        title: 'Task Management System Design',
        modelId: 'claude-3',
        protocol: 'copilotkit',
        messageCount: 15,
        createdAt: '2024-01-14T09:00:00Z',
        lastActivity: '2024-01-14T10:30:00Z',
        isStarred: true,
        tags: ['development', 'system-design']
      },
      {
        id: 'conv-2',
        title: 'Workflow Automation Help',
        modelId: 'gpt-4',
        protocol: 'mcp',
        messageCount: 8,
        createdAt: '2024-01-13T14:00:00Z',
        lastActivity: '2024-01-13T15:20:00Z',
        isStarred: false,
        tags: ['automation', 'n8n']
      },
      {
        id: 'conv-3',
        title: 'Database Schema Discussion',
        modelId: 'gpt-4',
        protocol: 'ag-ui',
        messageCount: 22,
        createdAt: '2024-01-12T11:00:00Z',
        lastActivity: '2024-01-12T16:45:00Z',
        isStarred: true,
        tags: ['database', 'postgresql']
      },
      {
        id: 'conv-4',
        title: 'API Integration Planning',
        modelId: 'gemini-pro',
        protocol: 'a2a',
        messageCount: 6,
        createdAt: '2024-01-11T13:30:00Z',
        lastActivity: '2024-01-11T14:15:00Z',
        isStarred: false,
        tags: ['api', 'integration']
      }
    ]

    const mockProtocols: AIProtocol[] = [
      {
        id: 'copilotkit',
        name: 'CopilotKit',
        description: 'AI-powered copilot for interactive applications',
        status: 'connected',
        endpoint: 'http://localhost:3000/api/copilotkit',
        capabilities: ['chat', 'code-completion', 'context-awareness'],
        lastActivity: '2024-01-14T10:30:00Z',
        activeConversations: 3
      },
      {
        id: 'mcp',
        name: 'Model Context Protocol',
        description: 'Universal protocol for connecting AI models',
        status: 'connected',
        endpoint: 'ws://localhost:3001/mcp',
        capabilities: ['multi-model', 'context-sharing', 'tool-calling'],
        lastActivity: '2024-01-14T09:45:00Z',
        activeConversations: 2
      },
      {
        id: 'ag-ui',
        name: 'AG-UI',
        description: 'Advanced GUI framework for AI interactions',
        status: 'connected',
        endpoint: 'http://localhost:8000/agent',
        capabilities: ['visual-interface', 'workflow-automation', 'multi-agent'],
        lastActivity: '2024-01-13T18:20:00Z',
        activeConversations: 1
      },
      {
        id: 'a2a',
        name: 'Agent-to-Agent',
        description: 'Direct communication between AI agents',
        status: 'error',
        endpoint: 'grpc://localhost:50051',
        capabilities: ['agent-communication', 'task-delegation', 'collaboration'],
        lastActivity: '2024-01-12T12:30:00Z',
        activeConversations: 0
      }
    ]

    const mockMetrics: SystemMetrics = {
      totalTokensUsed: 1250000,
      totalCost: 45.67,
      activeModels: 3,
      totalConversations: 24,
      averageResponseTime: 2.3,
      successRate: 98.5
    }

    setModels(mockModels)
    setConversations(mockConversations)
    setProtocols(mockProtocols)
    setMetrics(mockMetrics)
    setLoading(false)
  }, [])

  const handleModelToggle = (modelId: string) => {
    setModels(prev => prev.map(model => 
      model.id === modelId 
        ? { ...model, status: model.status === 'active' ? 'inactive' : 'active' }
        : model
    ))
  }

  const handleProtocolReconnect = (protocolId: string) => {
    setProtocols(prev => prev.map(protocol => 
      protocol.id === protocolId 
        ? { ...protocol, status: 'connected', lastActivity: new Date().toISOString() }
        : protocol
    ))
    
    toast({
      title: "Protocol reconnected",
      description: `${protocolId.toUpperCase()} has been reconnected successfully.`
    })
  }

  const startNewConversation = () => {
    if (!selectedModel || !selectedProtocol) {
      toast({
        title: "Missing configuration",
        description: "Please select both a model and protocol to start a conversation.",
        variant: "destructive"
      })
      return
    }

    const newConversation: Conversation = {
      id: `conv-${Date.now()}`,
      title: 'New Conversation',
      modelId: selectedModel,
      protocol: selectedProtocol as any,
      messageCount: 0,
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      isStarred: false,
      tags: []
    }

    setConversations(prev => [newConversation, ...prev])
    setSelectedConversation(newConversation)
    
    toast({
      title: "Conversation started",
      description: "New AI conversation has been initiated."
    })
  }

  const toggleStarConversation = (id: string) => {
    setConversations(prev => prev.map(conv => 
      conv.id === id ? { ...conv, isStarred: !conv.isStarred } : conv
    ))
  }

  const deleteConversation = (id: string) => {
    setConversations(prev => prev.filter(conv => conv.id !== id))
    if (selectedConversation?.id === id) {
      setSelectedConversation(null)
    }
    toast({
      title: "Conversation deleted",
      description: "The conversation has been removed."
    })
  }

  const getModelStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-500'
      case 'inactive': return 'text-gray-500'
      case 'error': return 'text-red-500'
      default: return 'text-gray-500'
    }
  }

  const getProtocolStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'text-green-500'
      case 'disconnected': return 'text-gray-500'
      case 'error': return 'text-red-500'
      default: return 'text-gray-500'
    }
  }

  const ChatInterface = () => (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-[600px]">
      {/* Conversation List */}
      <Card className="lg:col-span-1">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Conversations</CardTitle>
          <div className="flex gap-2">
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Model" />
              </SelectTrigger>
              <SelectContent>
                {models.filter(m => m.status === 'active').map((model) => (
                  <SelectItem key={model.id} value={model.id}>{model.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedProtocol} onValueChange={setSelectedProtocol}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Protocol" />
              </SelectTrigger>
              <SelectContent>
                {protocols.filter(p => p.status === 'connected').map((protocol) => (
                  <SelectItem key={protocol.id} value={protocol.id}>{protocol.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" onClick={startNewConversation} className="w-full">
            <Plus className="h-3 w-3 mr-1" />
            New Chat
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[450px]">
            <div className="space-y-2 p-3">
              {conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className={`p-2 rounded-lg cursor-pointer hover:bg-muted/50 ${
                    selectedConversation?.id === conversation.id ? 'bg-muted' : ''
                  }`}
                  onClick={() => setSelectedConversation(conversation)}
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium truncate">{conversation.title}</h4>
                    <div className="flex items-center gap-1">
                      {conversation.isStarred && (
                        <Star className="h-3 w-3 text-yellow-500 fill-current" />
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0"
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleStarConversation(conversation.id)
                        }}
                      >
                        <Star className={`h-3 w-3 ${conversation.isStarred ? 'text-yellow-500 fill-current' : 'text-gray-400'}`} />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      {conversation.protocol}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {conversation.messageCount} messages
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(conversation.lastActivity).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Chat Area */}
      <Card className="lg:col-span-3">
        <CardHeader className="pb-3">
          {selectedConversation ? (
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm">{selectedConversation.title}</CardTitle>
                <CardDescription className="text-xs">
                  {models.find(m => m.id === selectedConversation.modelId)?.name} via {selectedConversation.protocol}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleStarConversation(selectedConversation.id)}
                >
                  <Star className={`h-4 w-4 ${selectedConversation.isStarred ? 'text-yellow-500 fill-current' : ''}`} />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => deleteConversation(selectedConversation.id)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <CardTitle className="text-sm">AI Assistant</CardTitle>
              <CardDescription className="text-xs">
                Select a conversation or start a new one
              </CardDescription>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-[400px] flex items-center justify-center text-muted-foreground">
            {selectedConversation ? (
              <div className="text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Chat interface would be implemented here</p>
                <p className="text-sm mt-2">Using {selectedConversation.protocol} protocol</p>
              </div>
            ) : (
              <div className="text-center">
                <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a conversation to start chatting</p>
              </div>
            )}
          </div>
          {selectedConversation && (
            <div className="p-4 border-t">
              <div className="flex gap-2">
                <Input placeholder="Type your message..." className="flex-1" />
                <Button size="sm">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )

  const ModelsManager = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">AI Models</h3>
          <p className="text-sm text-muted-foreground">Manage your AI models and their configurations</p>
        </div>
        <Button onClick={() => setShowModelForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Model
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {models.map((model) => (
          <Card key={model.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">{model.name}</CardTitle>
                <Switch
                  checked={model.status === 'active'}
                  onCheckedChange={() => handleModelToggle(model.id)}
                />
              </div>
              <CardDescription className="text-xs">
                {model.provider} • {model.type}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span>Status:</span>
                  <Badge 
                    variant={model.status === 'active' ? 'default' : 'secondary'}
                    className={getModelStatusColor(model.status)}
                  >
                    {model.status}
                  </Badge>
                </div>
                <div className="flex justify-between text-xs">
                  <span>Max Tokens:</span>
                  <span>{model.maxTokens.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>Cost/1K tokens:</span>
                  <span>${model.cost.toFixed(3)}</span>
                </div>
                {model.lastUsed && (
                  <div className="flex justify-between text-xs">
                    <span>Last Used:</span>
                    <span>{new Date(model.lastUsed).toLocaleDateString()}</span>
                  </div>
                )}
                <div className="flex flex-wrap gap-1 mt-2">
                  {model.capabilities.slice(0, 3).map((capability) => (
                    <Badge key={capability} variant="outline" className="text-xs">
                      {capability}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )

  const ProtocolsManager = () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">AI Protocols</h3>
        <p className="text-sm text-muted-foreground">Monitor and manage AI communication protocols</p>
      </div>

      <div className="grid gap-4">
        {protocols.map((protocol) => (
          <Card key={protocol.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">{protocol.name}</CardTitle>
                  <CardDescription>{protocol.description}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge 
                    variant={protocol.status === 'connected' ? 'default' : 'secondary'}
                    className={getProtocolStatusColor(protocol.status)}
                  >
                    {protocol.status}
                  </Badge>
                  {protocol.status !== 'connected' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleProtocolReconnect(protocol.id)}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <Label className="text-xs">Endpoint</Label>
                  <p className="font-mono text-xs bg-muted p-1 rounded truncate">
                    {protocol.endpoint}
                  </p>
                </div>
                <div>
                  <Label className="text-xs">Active Chats</Label>
                  <p>{protocol.activeConversations}</p>
                </div>
                <div>
                  <Label className="text-xs">Last Activity</Label>
                  <p>{protocol.lastActivity ? new Date(protocol.lastActivity).toLocaleDateString() : 'Never'}</p>
                </div>
                <div>
                  <Label className="text-xs">Capabilities</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {protocol.capabilities.slice(0, 2).map((capability) => (
                      <Badge key={capability} variant="outline" className="text-xs">
                        {capability}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )

  const AIAnalytics = () => (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalTokensUsed.toLocaleString()}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            <Euro className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${metrics?.totalCost.toFixed(2)}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Models</CardTitle>
            <Brain className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.activeModels}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversations</CardTitle>
            <MessageSquare className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalConversations}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.averageResponseTime}s</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.successRate}%</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Model Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {models.map((model) => (
                <div key={model.id} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{model.name}</p>
                    <p className="text-sm text-muted-foreground">{model.provider}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">${(Math.random() * 10).toFixed(2)}</p>
                    <p className="text-sm text-muted-foreground">
                      {Math.floor(Math.random() * 10000).toLocaleString()} tokens
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Protocol Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {protocols.map((protocol) => (
                <div key={protocol.id} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{protocol.name}</p>
                    <p className="text-sm text-muted-foreground">{protocol.status}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{protocol.activeConversations}</p>
                    <p className="text-sm text-muted-foreground">active chats</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">AI Assistant Hub</h2>
          <p className="text-muted-foreground">
            Manage AI models, protocols, and conversations with advanced AI capabilities
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Models</CardTitle>
            <Brain className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{models.filter(m => m.status === 'active').length}</div>
            <p className="text-xs text-muted-foreground">
              {models.length} total models
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Connected Protocols</CardTitle>
            <Network className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{protocols.filter(p => p.status === 'connected').length}</div>
            <p className="text-xs text-muted-foreground">
              {protocols.length} total protocols
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Conversations</CardTitle>
            <MessageSquare className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{conversations.length}</div>
            <p className="text-xs text-muted-foreground">
              {conversations.filter(c => c.isStarred).length} starred
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
            <Monitor className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">Healthy</div>
            <p className="text-xs text-muted-foreground">
              All systems operational
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="chat">Chat</TabsTrigger>
          <TabsTrigger value="models">Models</TabsTrigger>
          <TabsTrigger value="protocols">Protocols</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="chat">
          <ChatInterface />
        </TabsContent>

        <TabsContent value="models">
          <ModelsManager />
        </TabsContent>

        <TabsContent value="protocols">
          <ProtocolsManager />
        </TabsContent>

        <TabsContent value="analytics">
          <AIAnalytics />
        </TabsContent>
      </Tabs>

      {/* Add Model Dialog */}
      <Dialog open={showModelForm} onOpenChange={setShowModelForm}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Add AI Model</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="modelName">Model Name</Label>
                <Input
                  id="modelName"
                  placeholder="Enter model name"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="provider">Provider</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="anthropic">Anthropic</SelectItem>
                    <SelectItem value="google">Google</SelectItem>
                    <SelectItem value="local">Local</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="endpoint">API Endpoint</Label>
              <Input
                id="endpoint"
                placeholder="Enter API endpoint URL"
              />
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="maxTokens">Max Tokens</Label>
                <Input
                  id="maxTokens"
                  type="number"
                  placeholder="8192"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="cost">Cost per 1K tokens</Label>
                <Input
                  id="cost"
                  type="number"
                  step="0.001"
                  placeholder="0.03"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="chat">Chat</SelectItem>
                    <SelectItem value="completion">Completion</SelectItem>
                    <SelectItem value="embedding">Embedding</SelectItem>
                    <SelectItem value="vision">Vision</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowModelForm(false)}>
                Cancel
              </Button>
              <Button onClick={() => setShowModelForm(false)}>
                Add Model
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}