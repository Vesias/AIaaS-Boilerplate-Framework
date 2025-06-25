'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, Calculator, FileText, MessageSquare, Refresh, Copy, Check } from 'lucide-react'
import { toast } from 'sonner'
import { createLocalMCPClient, quickToolCall, quickResourceRead, quickPromptGet, MCPClient } from '@/lib/mcp-client'

interface Tool {
  name: string
  description: string
  inputSchema: any
}

interface Resource {
  uri: string
  name: string
  description: string
  mimeType: string
}

interface Prompt {
  name: string
  description: string
  arguments: Array<{
    name: string
    description: string
    required: boolean
  }>
}

export default function MCPDemo() {
  const [client, setClient] = useState<MCPClient | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [tools, setTools] = useState<Tool[]>([])
  const [resources, setResources] = useState<Resource[]>([])
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [results, setResults] = useState<string>('')
  const [copied, setCopied] = useState(false)

  // Tool execution state
  const [selectedTool, setSelectedTool] = useState<string>('')
  const [toolArgs, setToolArgs] = useState<Record<string, any>>({})

  // Resource state
  const [selectedResource, setSelectedResource] = useState<string>('')

  // Prompt state
  const [selectedPrompt, setSelectedPrompt] = useState<string>('')
  const [promptArgs, setPromptArgs] = useState<Record<string, any>>({})

  // Connect to MCP server
  const connectToMCP = async () => {
    setIsLoading(true)
    try {
      const mcpClient = await createLocalMCPClient()
      setClient(mcpClient)
      setIsConnected(true)
      
      // Load available tools, resources, and prompts
      await loadMCPCapabilities(mcpClient)
      
      toast.success('Connected to MCP server')
    } catch (error: any) {
      console.error('Failed to connect to MCP server:', error)
      toast.error(`Failed to connect: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Load MCP capabilities
  const loadMCPCapabilities = async (mcpClient: MCPClient) => {
    try {
      const [toolsList, resourcesList, promptsList] = await Promise.all([
        mcpClient.listTools(),
        mcpClient.listResources(),
        mcpClient.listPrompts(),
      ])
      
      setTools(toolsList)
      setResources(resourcesList)
      setPrompts(promptsList)
    } catch (error: any) {
      console.error('Failed to load MCP capabilities:', error)
      toast.error(`Failed to load capabilities: ${error.message}`)
    }
  }

  // Disconnect from MCP server
  const disconnectFromMCP = async () => {
    if (client) {
      await client.disconnect()
      setClient(null)
      setIsConnected(false)
      setTools([])
      setResources([])
      setPrompts([])
      toast.success('Disconnected from MCP server')
    }
  }

  // Execute a tool
  const executeTool = async () => {
    if (!client || !selectedTool) return
    
    setIsLoading(true)
    try {
      const result = await client.callTool(selectedTool, toolArgs)
      
      if (result.isError) {
        toast.error('Tool execution failed')
      } else {
        toast.success('Tool executed successfully')
      }
      
      const resultText = result.content.map(c => c.text).join('\n')
      setResults(resultText)
    } catch (error: any) {
      toast.error(`Tool execution failed: ${error.message}`)
      setResults(`Error: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Read a resource
  const readResource = async () => {
    if (!client || !selectedResource) return
    
    setIsLoading(true)
    try {
      const contents = await client.readResource(selectedResource)
      
      const resultText = contents.map((c: any) => 
        `Resource: ${c.uri}\nMIME Type: ${c.mimeType}\n\n${c.text}`
      ).join('\n\n---\n\n')
      
      setResults(resultText)
      toast.success('Resource loaded successfully')
    } catch (error: any) {
      toast.error(`Failed to read resource: ${error.message}`)
      setResults(`Error: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Get a prompt
  const getPrompt = async () => {
    if (!client || !selectedPrompt) return
    
    setIsLoading(true)
    try {
      const prompt = await client.getPrompt(selectedPrompt, promptArgs)
      
      const resultText = `Prompt: ${prompt.description}\n\n` +
        prompt.messages.map((m: any) => 
          `Role: ${m.role}\n${m.content.text}`
        ).join('\n\n---\n\n')
      
      setResults(resultText)
      toast.success('Prompt generated successfully')
    } catch (error: any) {
      toast.error(`Failed to get prompt: ${error.message}`)
      setResults(`Error: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Copy results to clipboard
  const copyResults = async () => {
    if (results) {
      await navigator.clipboard.writeText(results)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast.success('Results copied to clipboard')
    }
  }

  // Clear results
  const clearResults = () => {
    setResults('')
  }

  // Update tool arguments
  const updateToolArg = (key: string, value: any) => {
    setToolArgs(prev => ({ ...prev, [key]: value }))
  }

  // Update prompt arguments
  const updatePromptArg = (key: string, value: any) => {
    setPromptArgs(prev => ({ ...prev, [key]: value }))
  }

  // Get selected tool schema
  const getSelectedToolSchema = () => {
    return tools.find(t => t.name === selectedTool)?.inputSchema?.properties || {}
  }

  // Get selected prompt arguments
  const getSelectedPromptArgs = () => {
    return prompts.find(p => p.name === selectedPrompt)?.arguments || []
  }

  // Auto-connect on mount
  useEffect(() => {
    connectToMCP()
    
    return () => {
      if (client) {
        client.disconnect().catch(console.warn)
      }
    }
  }, [])

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Model Context Protocol (MCP) Demo</h1>
        <p className="text-muted-foreground mb-4">
          Test MCP tools, resources, and prompts from your Next.js application
        </p>
        
        <div className="flex items-center justify-center gap-4">
          <Badge variant={isConnected ? "default" : "secondary"}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </Badge>
          
          {isConnected ? (
            <Button onClick={disconnectFromMCP} variant="outline" size="sm">
              Disconnect
            </Button>
          ) : (
            <Button onClick={connectToMCP} disabled={isLoading} size="sm">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Connect
            </Button>
          )}
          
          {isConnected && (
            <Button 
              onClick={() => loadMCPCapabilities(client!)} 
              disabled={isLoading} 
              variant="outline" 
              size="sm"
            >
              <Refresh className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="tools" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="tools" className="flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Tools ({tools.length})
          </TabsTrigger>
          <TabsTrigger value="resources" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Resources ({resources.length})
          </TabsTrigger>
          <TabsTrigger value="prompts" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Prompts ({prompts.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tools" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Execute MCP Tools</CardTitle>
              <CardDescription>
                Select and execute tools provided by the MCP server
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="tool-select">Select Tool</Label>
                <Select value={selectedTool} onValueChange={setSelectedTool}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a tool to execute" />
                  </SelectTrigger>
                  <SelectContent>
                    {tools.map(tool => (
                      <SelectItem key={tool.name} value={tool.name}>
                        {tool.name} - {tool.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedTool && (
                <div className="space-y-4 border rounded-lg p-4">
                  <h4 className="font-semibold">Tool Arguments</h4>
                  {Object.entries(getSelectedToolSchema()).map(([key, schema]: [string, any]) => (
                    <div key={key}>
                      <Label htmlFor={`tool-arg-${key}`}>
                        {key} {schema.description && `- ${schema.description}`}
                      </Label>
                      {schema.enum ? (
                        <Select 
                          value={toolArgs[key] || ''} 
                          onValueChange={(value) => updateToolArg(key, value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={`Select ${key}`} />
                          </SelectTrigger>
                          <SelectContent>
                            {schema.enum.map((option: string) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          id={`tool-arg-${key}`}
                          type={schema.type === 'number' ? 'number' : 'text'}
                          value={toolArgs[key] || ''}
                          onChange={(e) => updateToolArg(key, 
                            schema.type === 'number' ? parseFloat(e.target.value) : e.target.value
                          )}
                          placeholder={`Enter ${key}`}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button 
                onClick={executeTool} 
                disabled={!isConnected || !selectedTool || isLoading}
                className="w-full"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Execute Tool
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="resources" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Read MCP Resources</CardTitle>
              <CardDescription>
                Access resources provided by the MCP server
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="resource-select">Select Resource</Label>
                <Select value={selectedResource} onValueChange={setSelectedResource}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a resource to read" />
                  </SelectTrigger>
                  <SelectContent>
                    {resources.map(resource => (
                      <SelectItem key={resource.uri} value={resource.uri}>
                        {resource.name} - {resource.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {selectedResource && (
                <div className="text-sm text-muted-foreground">
                  <p><strong>URI:</strong> {selectedResource}</p>
                  <p><strong>MIME Type:</strong> {resources.find(r => r.uri === selectedResource)?.mimeType}</p>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button 
                onClick={readResource} 
                disabled={!isConnected || !selectedResource || isLoading}
                className="w-full"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Read Resource
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="prompts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Generate MCP Prompts</CardTitle>
              <CardDescription>
                Generate prompts using the MCP server's prompt templates
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="prompt-select">Select Prompt</Label>
                <Select value={selectedPrompt} onValueChange={setSelectedPrompt}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a prompt to generate" />
                  </SelectTrigger>
                  <SelectContent>
                    {prompts.map(prompt => (
                      <SelectItem key={prompt.name} value={prompt.name}>
                        {prompt.name} - {prompt.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedPrompt && (
                <div className="space-y-4 border rounded-lg p-4">
                  <h4 className="font-semibold">Prompt Arguments</h4>
                  {getSelectedPromptArgs().map(arg => (
                    <div key={arg.name}>
                      <Label htmlFor={`prompt-arg-${arg.name}`}>
                        {arg.name} {arg.required && '*'} - {arg.description}
                      </Label>
                      <Textarea
                        id={`prompt-arg-${arg.name}`}
                        value={promptArgs[arg.name] || ''}
                        onChange={(e) => updatePromptArg(arg.name, e.target.value)}
                        placeholder={`Enter ${arg.name}`}
                        rows={3}
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button 
                onClick={getPrompt} 
                disabled={!isConnected || !selectedPrompt || isLoading}
                className="w-full"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Generate Prompt
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Results Section */}
      {results && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Results
              <div className="flex gap-2">
                <Button
                  onClick={copyResults}
                  variant="outline"
                  size="sm"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button
                  onClick={clearResults}
                  variant="outline"
                  size="sm"
                >
                  Clear
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded-lg overflow-auto text-sm whitespace-pre-wrap">
              {results}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Connection Info */}
      <Card>
        <CardHeader>
          <CardTitle>MCP Server Information</CardTitle>
          <CardDescription>
            Current MCP server configuration and status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Server URL</Label>
              <p className="text-sm text-muted-foreground">
                {process.env.NEXT_PUBLIC_APP_URL ? 
                  `${process.env.NEXT_PUBLIC_APP_URL}/api/mcp/sse` : 
                  'http://localhost:3000/api/mcp/sse'
                }
              </p>
            </div>
            <div>
              <Label>Authentication</Label>
              <p className="text-sm text-muted-foreground">
                {process.env.MCP_AUTH_TOKEN ? 'Enabled' : 'Disabled'}
              </p>
            </div>
            <div>
              <Label>Available Tools</Label>
              <p className="text-sm text-muted-foreground">{tools.length}</p>
            </div>
            <div>
              <Label>Available Resources</Label>
              <p className="text-sm text-muted-foreground">{resources.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}