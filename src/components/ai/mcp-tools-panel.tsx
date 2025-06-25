'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Wrench, 
  Play, 
  Settings, 
  Search,
  Plus,
  Download,
  Upload,
  Code,
  Database,
  Globe,
  FileText,
  Calculator,
  Calendar,
  Mail,
  MessageSquare,
  Image,
  BarChart3,
  Zap,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface MCPTool {
  id: string
  name: string
  description: string
  category: 'data' | 'communication' | 'computation' | 'integration' | 'utility'
  icon: any
  status: 'available' | 'running' | 'error' | 'disabled'
  parameters: MCPParameter[]
  outputs: string[]
  version: string
  lastUsed?: string
  usageCount: number
}

interface MCPParameter {
  name: string
  type: 'string' | 'number' | 'boolean' | 'file' | 'select'
  required: boolean
  description: string
  options?: string[]
  defaultValue?: any
}

interface MCPToolsPanelProps {
  tools?: MCPTool[]
  onExecuteTool?: (toolId: string, parameters: Record<string, any>) => Promise<any>
  className?: string
}

const DEFAULT_TOOLS: MCPTool[] = [
  {
    id: 'web-scraper',
    name: 'Web Scraper',
    description: 'Extract data from web pages',
    category: 'data',
    icon: Globe,
    status: 'available',
    parameters: [
      { name: 'url', type: 'string', required: true, description: 'Target URL to scrape' },
      { name: 'selector', type: 'string', required: false, description: 'CSS selector for specific elements' }
    ],
    outputs: ['html', 'text', 'links'],
    version: '1.2.0',
    usageCount: 45
  },
  {
    id: 'database-query',
    name: 'Database Query',
    description: 'Execute SQL queries on connected databases',
    category: 'data',
    icon: Database,
    status: 'available',
    parameters: [
      { name: 'query', type: 'string', required: true, description: 'SQL query to execute' },
      { name: 'database', type: 'select', required: true, description: 'Target database', options: ['users', 'analytics', 'logs'] }
    ],
    outputs: ['results', 'count', 'metadata'],
    version: '2.1.0',
    usageCount: 123
  },
  {
    id: 'email-sender',
    name: 'Email Sender',
    description: 'Send emails via configured SMTP',
    category: 'communication',
    icon: Mail,
    status: 'available',
    parameters: [
      { name: 'to', type: 'string', required: true, description: 'Recipient email address' },
      { name: 'subject', type: 'string', required: true, description: 'Email subject' },
      { name: 'body', type: 'string', required: true, description: 'Email body content' }
    ],
    outputs: ['messageId', 'status'],
    version: '1.0.3',
    usageCount: 67
  },
  {
    id: 'code-executor',
    name: 'Code Executor',
    description: 'Execute Python/JavaScript code safely',
    category: 'computation',
    icon: Code,
    status: 'available',
    parameters: [
      { name: 'code', type: 'string', required: true, description: 'Code to execute' },
      { name: 'language', type: 'select', required: true, description: 'Programming language', options: ['python', 'javascript', 'bash'] }
    ],
    outputs: ['result', 'stdout', 'stderr'],
    version: '3.0.1',
    usageCount: 89
  },
  {
    id: 'image-processor',
    name: 'Image Processor',
    description: 'Process and manipulate images',
    category: 'utility',
    icon: Image,
    status: 'available',
    parameters: [
      { name: 'image', type: 'file', required: true, description: 'Input image file' },
      { name: 'operation', type: 'select', required: true, description: 'Processing operation', options: ['resize', 'crop', 'filter', 'compress'] },
      { name: 'params', type: 'string', required: false, description: 'Operation parameters (JSON)' }
    ],
    outputs: ['processedImage', 'metadata'],
    version: '1.5.2',
    usageCount: 34
  }
]

export default function MCPToolsPanel({
  tools = DEFAULT_TOOLS,
  onExecuteTool,
  className
}: MCPToolsPanelProps) {
  const [selectedTool, setSelectedTool] = useState<MCPTool | null>(null)
  const [toolParameters, setToolParameters] = useState<Record<string, any>>({})
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [executionResults, setExecutionResults] = useState<Record<string, any>>({})
  const [isExecuting, setIsExecuting] = useState(false)

  const filteredTools = tools.filter(tool => {
    const matchesSearch = tool.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         tool.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = categoryFilter === 'all' || tool.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  const categories = Array.from(new Set(tools.map(tool => tool.category)))

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'available': return CheckCircle
      case 'running': return Clock
      case 'error': return XCircle
      case 'disabled': return XCircle
      default: return CheckCircle
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'text-green-600'
      case 'running': return 'text-blue-600'
      case 'error': return 'text-red-600'
      case 'disabled': return 'text-gray-600'
      default: return 'text-green-600'
    }
  }

  const handleParameterChange = (paramName: string, value: any) => {
    setToolParameters(prev => ({
      ...prev,
      [paramName]: value
    }))
  }

  const executeTool = async () => {
    if (!selectedTool) return

    setIsExecuting(true)
    try {
      const result = onExecuteTool 
        ? await onExecuteTool(selectedTool.id, toolParameters)
        : await simulateToolExecution(selectedTool, toolParameters)
      
      setExecutionResults(prev => ({
        ...prev,
        [selectedTool.id]: result
      }))
    } catch (error) {
      setExecutionResults(prev => ({
        ...prev,
        [selectedTool.id]: { error: 'Execution failed' }
      }))
    } finally {
      setIsExecuting(false)
    }
  }

  const simulateToolExecution = async (tool: MCPTool, params: Record<string, any>) => {
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    const mockResults = {
      'web-scraper': { title: 'Sample Page', links: 15, text: 'Extracted content...' },
      'database-query': { rows: 42, columns: ['id', 'name', 'email'], executionTime: '150ms' },
      'email-sender': { messageId: 'msg_123456', status: 'sent', timestamp: new Date().toISOString() },
      'code-executor': { result: 'Hello, World!', stdout: 'Execution completed', stderr: '' },
      'image-processor': { width: 800, height: 600, size: '245KB', format: 'JPEG' }
    }

    return mockResults[tool.id as keyof typeof mockResults] || { status: 'completed' }
  }

  const ToolCard = ({ tool }: { tool: MCPTool }) => {
    const StatusIcon = getStatusIcon(tool.status)
    const Icon = tool.icon

    return (
      <Card 
        className={cn(
          "cursor-pointer transition-all hover:shadow-md",
          selectedTool?.id === tool.id && "ring-2 ring-blue-500"
        )}
        onClick={() => setSelectedTool(tool)}
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Icon className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-sm">{tool.name}</CardTitle>
            </div>
            <StatusIcon className={cn("h-4 w-4", getStatusColor(tool.status))} />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">{tool.description}</p>
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-xs">
              {tool.category}
            </Badge>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>v{tool.version}</span>
              <span>•</span>
              <span>{tool.usageCount} uses</span>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">MCP Tools</h2>
          <p className="text-muted-foreground">Model Context Protocol tools and integrations</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Upload className="h-4 w-4 mr-2" />
            Import Tool
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Create Tool
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Tools List */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filters */}
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search tools..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border rounded-md text-sm"
            >
              <option value="all">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category}>
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Tools Grid */}
          <div className="grid md:grid-cols-2 gap-4">
            {filteredTools.map(tool => (
              <ToolCard key={tool.id} tool={tool} />
            ))}
          </div>
        </div>

        {/* Tool Details */}
        <div className="space-y-4">
          {selectedTool ? (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <selectedTool.icon className="h-5 w-5 text-blue-600" />
                  <CardTitle className="text-base">{selectedTool.name}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{selectedTool.description}</p>

                <Tabs defaultValue="parameters">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="parameters">Parameters</TabsTrigger>
                    <TabsTrigger value="results">Results</TabsTrigger>
                  </TabsList>

                  <TabsContent value="parameters" className="space-y-3 mt-4">
                    {selectedTool.parameters.map(param => (
                      <div key={param.name} className="space-y-1">
                        <label className="text-sm font-medium">
                          {param.name}
                          {param.required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        {param.type === 'select' ? (
                          <select
                            value={toolParameters[param.name] || ''}
                            onChange={(e) => handleParameterChange(param.name, e.target.value)}
                            className="w-full px-3 py-2 border rounded-md text-sm"
                          >
                            <option value="">Select...</option>
                            {param.options?.map(option => (
                              <option key={option} value={option}>{option}</option>
                            ))}
                          </select>
                        ) : param.type === 'file' ? (
                          <Input
                            type="file"
                            onChange={(e) => handleParameterChange(param.name, e.target.files?.[0])}
                            className="text-sm"
                          />
                        ) : (
                          <Input
                            type={param.type === 'number' ? 'number' : 'text'}
                            value={toolParameters[param.name] || ''}
                            onChange={(e) => handleParameterChange(param.name, e.target.value)}
                            placeholder={param.description}
                            className="text-sm"
                          />
                        )}
                        <p className="text-xs text-muted-foreground">{param.description}</p>
                      </div>
                    ))}

                    <Button 
                      onClick={executeTool} 
                      disabled={isExecuting}
                      className="w-full"
                    >
                      {isExecuting ? (
                        <>
                          <Clock className="h-4 w-4 mr-2 animate-spin" />
                          Executing...
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-2" />
                          Execute Tool
                        </>
                      )}
                    </Button>
                  </TabsContent>

                  <TabsContent value="results" className="mt-4">
                    {executionResults[selectedTool.id] ? (
                      <div className="space-y-3">
                        <div className="p-3 bg-muted rounded-lg">
                          <h4 className="font-medium text-sm mb-2">Execution Result</h4>
                          <pre className="text-xs overflow-auto">
                            {JSON.stringify(executionResults[selectedTool.id], null, 2)}
                          </pre>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">
                            <Download className="h-4 w-4 mr-2" />
                            Export
                          </Button>
                          <Button variant="outline" size="sm">
                            <FileText className="h-4 w-4 mr-2" />
                            Copy
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No results yet</p>
                        <p className="text-xs">Execute the tool to see results here</p>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <Wrench className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Select a tool to view details and parameters
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}