'use client'

import { useState, useEffect } from 'react'
import { useAgent, useAgentTools } from '@/hooks/use-agent'
import { AgentChat, SimpleAgentChat, CompactAgentChat } from '@/components/agent-chat'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
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
  Globe
} from 'lucide-react'
import { toast } from 'sonner'
import { defaultAgent, calculatorAgent, weatherAgent } from '@/lib/agent-backend'
import { quickAgentMessage, quickToolCall } from '@/lib/ag-ui-client'

interface AgentBackend {
  name: string
  url: string
  capabilities: string[]
  status: 'stopped' | 'starting' | 'running' | 'error'
}

export default function AGUIDemo() {
  const [selectedBackend, setSelectedBackend] = useState<string>('default')
  const [backends] = useState<Record<string, AgentBackend>>({
    default: {
      name: 'Roomicor Assistant',
      url: 'http://localhost:8000/agent',
      capabilities: ['chat', 'calculations', 'weather', 'search'],
      status: 'stopped'
    },
    calculator: {
      name: 'Calculator Agent',
      url: 'http://localhost:8001/agent',
      capabilities: ['mathematical-operations', 'equation-solving'],
      status: 'stopped'
    },
    weather: {
      name: 'Weather Agent',
      url: 'http://localhost:8002/agent',
      capabilities: ['current-weather', 'weather-forecasts'],
      status: 'stopped'
    }
  })

  // Main agent connection for chat
  const {
    connected,
    connecting,
    messages,
    toolCalls,
    pendingToolCalls,
    isProcessing,
    sendMessage,
    connect,
    disconnect,
    clearMessages,
    lastError,
    clearError,
    sessionId,
  } = useAgent({
    url: backends[selectedBackend]?.url,
    transport: 'sse',
    autoConnect: false,
    onConnect: () => {
      toast.success(`Connected to ${backends[selectedBackend]?.name}`)
    },
    onDisconnect: () => {
      toast.info(`Disconnected from ${backends[selectedBackend]?.name}`)
    },
    onError: (error) => {
      toast.error(`Agent error: ${error.message}`)
    }
  })

  // Tools-only agent for quick tool testing
  const toolAgent = useAgentTools({
    url: backends[selectedBackend]?.url,
    transport: 'sse',
    autoConnect: false,
  })

  // Tool testing state
  const [selectedTool, setSelectedTool] = useState<string>('calculator')
  const [toolParams, setToolParams] = useState<string>('{"operation": "add", "a": 5, "b": 3}')
  const [toolResult, setToolResult] = useState<string>('')
  const [toolLoading, setToolLoading] = useState(false)

  // Quick message testing
  const [quickMessage, setQuickMessage] = useState<string>('Hello, how can you help me?')
  const [quickResult, setQuickResult] = useState<string>('')
  const [quickLoading, setQuickLoading] = useState(false)

  // Backend management
  const handleBackendChange = async (backendId: string) => {
    if (connected) {
      await disconnect()
    }
    setSelectedBackend(backendId)
    clearMessages()
    clearError()
  }

  const handleConnect = async () => {
    try {
      await connect()
    } catch (error: any) {
      toast.error(`Failed to connect: ${error.message}`)
    }
  }

  const handleDisconnect = async () => {
    try {
      await disconnect()
    } catch (error: any) {
      toast.error(`Failed to disconnect: ${error.message}`)
    }
  }

  // Tool testing
  const testTool = async () => {
    if (!selectedTool || !toolParams) return

    setToolLoading(true)
    setToolResult('')

    try {
      const params = JSON.parse(toolParams)
      const result = await quickToolCall(selectedTool, params, {
        url: backends[selectedBackend]?.url
      })
      
      setToolResult(JSON.stringify(result, null, 2))
      toast.success('Tool executed successfully')
    } catch (error: any) {
      setToolResult(`Error: ${error.message}`)
      toast.error(`Tool execution failed: ${error.message}`)
    } finally {
      setToolLoading(false)
    }
  }

  // Quick message testing
  const testQuickMessage = async () => {
    if (!quickMessage) return

    setQuickLoading(true)
    setQuickResult('')

    try {
      const responses = await quickAgentMessage(quickMessage, {
        url: backends[selectedBackend]?.url
      })
      
      const result = responses.map(msg => `[${msg.type}] ${msg.content}`).join('\n\n')
      setQuickResult(result)
      toast.success('Quick message sent successfully')
    } catch (error: any) {
      setQuickResult(`Error: ${error.message}`)
      toast.error(`Quick message failed: ${error.message}`)
    } finally {
      setQuickLoading(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">AG-UI Protocol Demo</h1>
        <p className="text-muted-foreground">
          Test Agent-User Interaction Protocol with real-time communication
        </p>
      </div>

      {/* Backend Selection and Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Agent Backend Configuration
          </CardTitle>
          <CardDescription>
            Select and configure the agent backend for testing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="backend-select">Select Backend</Label>
              <Select value={selectedBackend} onValueChange={handleBackendChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(backends).map(([id, backend]) => (
                    <SelectItem key={id} value={id}>
                      {backend.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Connection Status</Label>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant={connected ? "default" : "secondary"}>
                  {connecting ? 'Connecting...' : connected ? 'Connected' : 'Disconnected'}
                </Badge>
                
                {isProcessing && (
                  <Badge variant="outline">
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    Processing
                  </Badge>
                )}
              </div>
            </div>
            
            <div>
              <Label>Actions</Label>
              <div className="flex gap-2 mt-2">
                {connected ? (
                  <Button onClick={handleDisconnect} variant="outline" size="sm">
                    <Square className="h-4 w-4 mr-1" />
                    Disconnect
                  </Button>
                ) : (
                  <Button onClick={handleConnect} disabled={connecting} size="sm">
                    {connecting ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <Play className="h-4 w-4 mr-1" />
                    )}
                    Connect
                  </Button>
                )}
                
                <Button onClick={() => window.location.reload()} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Backend Info */}
          <div className="bg-muted p-4 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <strong>URL:</strong> {backends[selectedBackend]?.url}
              </div>
              <div>
                <strong>Capabilities:</strong> {backends[selectedBackend]?.capabilities.join(', ')}
              </div>
              <div>
                <strong>Session ID:</strong> {sessionId ? sessionId.slice(-8) : 'None'}
              </div>
            </div>
          </div>

          {/* Error Display */}
          {lastError && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">{lastError}</span>
                <Button onClick={clearError} variant="ghost" size="sm" className="ml-auto">
                  ×
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="chat" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="chat" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Interactive Chat
          </TabsTrigger>
          <TabsTrigger value="tools" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Tool Testing
          </TabsTrigger>
          <TabsTrigger value="quick" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Quick Tests
          </TabsTrigger>
          <TabsTrigger value="status" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Status & Logs
          </TabsTrigger>
        </TabsList>

        {/* Interactive Chat Tab */}
        <TabsContent value="chat" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Full Featured Chat</CardTitle>
                  <CardDescription>
                    Complete chat interface with all AG-UI features
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <AgentChat
                    url={backends[selectedBackend]?.url}
                    transport="sse"
                    showHeader={false}
                    showStatus={false}
                    maxHeight="500px"
                  />
                </CardContent>
              </Card>
            </div>
            
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Simple Chat</CardTitle>
                  <CardDescription>
                    Minimal chat interface
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <CompactAgentChat />
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Tool Testing Tab */}
        <TabsContent value="tools" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Code className="h-5 w-5" />
                  Tool Execution
                </CardTitle>
                <CardDescription>
                  Test individual tools with custom parameters
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="tool-select">Tool Name</Label>
                  <Select value={selectedTool} onValueChange={setSelectedTool}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="calculator">Calculator</SelectItem>
                      <SelectItem value="weather">Weather</SelectItem>
                      <SelectItem value="search">Search</SelectItem>
                      <SelectItem value="timestamp">Timestamp</SelectItem>
                      <SelectItem value="uuid">UUID Generator</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="tool-params">Parameters (JSON)</Label>
                  <textarea
                    id="tool-params"
                    value={toolParams}
                    onChange={(e) => setToolParams(e.target.value)}
                    className="w-full h-24 p-2 border rounded-md font-mono text-sm"
                    placeholder='{"param1": "value1", "param2": "value2"}'
                  />
                </div>
                
                <Button
                  onClick={testTool}
                  disabled={toolLoading || !selectedTool}
                  className="w-full"
                >
                  {toolLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Zap className="h-4 w-4 mr-2" />
                  )}
                  Execute Tool
                </Button>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Tool Result</CardTitle>
                <CardDescription>
                  Output from tool execution
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64 w-full border rounded-md p-4">
                  <pre className="text-sm whitespace-pre-wrap">
                    {toolResult || 'No result yet. Execute a tool to see output.'}
                  </pre>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Quick Tests Tab */}
        <TabsContent value="quick" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  Quick Message Test
                </CardTitle>
                <CardDescription>
                  Send a single message and get response
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="quick-message">Message</Label>
                  <Input
                    id="quick-message"
                    value={quickMessage}
                    onChange={(e) => setQuickMessage(e.target.value)}
                    placeholder="Type your message..."
                  />
                </div>
                
                <Button
                  onClick={testQuickMessage}
                  disabled={quickLoading || !quickMessage}
                  className="w-full"
                >
                  {quickLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Send Quick Message
                </Button>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Quick Response</CardTitle>
                <CardDescription>
                  Response from agent
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-32 w-full border rounded-md p-4">
                  <pre className="text-sm whitespace-pre-wrap">
                    {quickResult || 'No response yet. Send a message to see output.'}
                  </pre>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Status & Logs Tab */}
        <TabsContent value="status" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Connection Stats
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label>Messages Sent</Label>
                    <div className="text-2xl font-bold">
                      {messages.filter(m => m.type === 'user').length}
                    </div>
                  </div>
                  <div>
                    <Label>Messages Received</Label>
                    <div className="text-2xl font-bold">
                      {messages.filter(m => m.type === 'agent').length}
                    </div>
                  </div>
                  <div>
                    <Label>Tool Calls</Label>
                    <div className="text-2xl font-bold">{toolCalls.length}</div>
                  </div>
                  <div>
                    <Label>Pending Tools</Label>
                    <div className="text-2xl font-bold">{pendingToolCalls.length}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-48">
                  <div className="space-y-2">
                    {messages.slice(-5).map((message, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm">
                        <Badge variant="outline" className="text-xs">
                          {message.type}
                        </Badge>
                        <span className="text-muted-foreground">
                          {message.timestamp.toLocaleTimeString()}
                        </span>
                        <span className="truncate">
                          {message.content.substring(0, 50)}...
                        </span>
                      </div>
                    ))}
                    
                    {messages.length === 0 && (
                      <div className="text-center text-muted-foreground py-4">
                        No activity yet
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
          
          {/* API Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                API Endpoints
              </CardTitle>
              <CardDescription>
                Available AG-UI endpoints for this application
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <Label>Webhook Endpoint</Label>
                  <p className="text-muted-foreground">
                    {process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/ag-ui/webhook
                  </p>
                </div>
                <div>
                  <Label>Current Agent URL</Label>
                  <p className="text-muted-foreground">
                    {backends[selectedBackend]?.url}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}