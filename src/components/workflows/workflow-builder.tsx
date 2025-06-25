'use client'

import { useState, useRef, useCallback } from 'react'
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Connection,
  EdgeChange,
  NodeChange,
  ReactFlowProvider,
  Panel,
  MarkerType
} from 'reactflow'
import 'reactflow/dist/style.css'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { 
  Play, 
  Save, 
  Download, 
  Upload, 
  Plus, 
  Settings, 
  Trash2,
  Copy,
  Undo,
  Redo,
  ZoomIn,
  ZoomOut,
  Maximize,
  Share,
  Eye,
  Edit,
  Webhook,
  Database,
  Mail,
  Calendar,
  FileText,
  MessageSquare,
  Globe,
  Zap,
  Clock,
  Filter,
  Code,
  GitBranch,
  AlertTriangle
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Node Types
const nodeTypes = {
  trigger: 'trigger',
  action: 'action',
  condition: 'condition',
  loop: 'loop',
  delay: 'delay',
  webhook: 'webhook'
}

// Available node templates
const nodeTemplates = [
  {
    type: 'trigger',
    label: 'Webhook Trigger',
    icon: Webhook,
    description: 'Start workflow when webhook is called',
    color: 'bg-green-100 border-green-300',
    category: 'triggers'
  },
  {
    type: 'trigger',
    label: 'Schedule Trigger',
    icon: Clock,
    description: 'Start workflow on schedule',
    color: 'bg-blue-100 border-blue-300',
    category: 'triggers'
  },
  {
    type: 'action',
    label: 'Send Email',
    icon: Mail,
    description: 'Send email notification',
    color: 'bg-orange-100 border-orange-300',
    category: 'actions'
  },
  {
    type: 'action',
    label: 'Database Query',
    icon: Database,
    description: 'Execute database query',
    color: 'bg-purple-100 border-purple-300',
    category: 'actions'
  },
  {
    type: 'action',
    label: 'HTTP Request',
    icon: Globe,
    description: 'Make HTTP API call',
    color: 'bg-yellow-100 border-yellow-300',
    category: 'actions'
  },
  {
    type: 'action',
    label: 'Create Task',
    icon: FileText,
    description: 'Create a new task',
    color: 'bg-indigo-100 border-indigo-300',
    category: 'actions'
  },
  {
    type: 'condition',
    label: 'If/Else',
    icon: GitBranch,
    description: 'Conditional branching',
    color: 'bg-red-100 border-red-300',
    category: 'logic'
  },
  {
    type: 'condition',
    label: 'Filter',
    icon: Filter,
    description: 'Filter data based on conditions',
    color: 'bg-teal-100 border-teal-300',
    category: 'logic'
  },
  {
    type: 'delay',
    label: 'Delay',
    icon: Clock,
    description: 'Wait for specified time',
    color: 'bg-gray-100 border-gray-300',
    category: 'utils'
  },
  {
    type: 'loop',
    label: 'Loop',
    icon: MessageSquare,
    description: 'Repeat actions',
    color: 'bg-pink-100 border-pink-300',
    category: 'logic'
  }
]

interface WorkflowNode extends Node {
  data: {
    label: string
    type: string
    config: Record<string, any>
    icon?: any
    description?: string
  }
}

interface WorkflowData {
  id: string
  name: string
  description: string
  nodes: WorkflowNode[]
  edges: Edge[]
  settings: {
    timeout: number
    retryAttempts: number
    errorHandling: 'stop' | 'continue' | 'retry'
    tags: string[]
  }
  version: number
  createdAt: string
  updatedAt: string
}

interface WorkflowBuilderProps {
  workflow?: WorkflowData
  onSave: (workflow: WorkflowData) => void
  onTest: (workflow: WorkflowData) => void
  className?: string
  readOnly?: boolean
}

// Custom Node Component
const CustomNode = ({ data, selected }: { data: any; selected: boolean }) => {
  const Icon = data.icon || Zap
  
  return (
    <div className={cn(
      "px-4 py-2 shadow-md rounded-md border-2 bg-white min-w-[150px]",
      data.color || "bg-white border-gray-300",
      selected && "ring-2 ring-blue-500",
      data.type === 'trigger' && "border-l-4 border-l-green-500",
      data.type === 'action' && "border-l-4 border-l-blue-500",
      data.type === 'condition' && "border-l-4 border-l-yellow-500"
    )}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" />
        <div className="font-medium text-sm">{data.label}</div>
      </div>
      {data.description && (
        <div className="text-xs text-gray-500 mt-1">{data.description}</div>
      )}
      {data.status && (
        <Badge 
          variant={data.status === 'success' ? 'default' : data.status === 'error' ? 'destructive' : 'secondary'}
          className="mt-1 text-xs"
        >
          {data.status}
        </Badge>
      )}
    </div>
  )
}

const customNodeTypes = {
  custom: CustomNode
}

export default function WorkflowBuilder({
  workflow,
  onSave,
  onTest,
  className,
  readOnly = false
}: WorkflowBuilderProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState(workflow?.nodes || [])
  const [edges, setEdges, onEdgesChange] = useEdgesState(workflow?.edges || [])
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null)
  
  const [workflowName, setWorkflowName] = useState(workflow?.name || 'New Workflow')
  const [workflowDescription, setWorkflowDescription] = useState(workflow?.description || '')
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null)
  const [showNodeConfig, setShowNodeConfig] = useState(false)
  const [draggedNodeType, setDraggedNodeType] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [executionHistory, setExecutionHistory] = useState<any[]>([])

  const onConnect = useCallback(
    (params: Connection) => {
      const edge = {
        ...params,
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed }
      }
      setEdges((eds) => addEdge(edge, eds))
    },
    [setEdges]
  )

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()

      if (!reactFlowWrapper.current || !reactFlowInstance || !draggedNodeType) {
        return
      }

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect()
      const position = reactFlowInstance.project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top
      })

      const template = nodeTemplates.find(t => t.label === draggedNodeType)
      if (!template) return

      const newNode: WorkflowNode = {
        id: `${template.type}-${Date.now()}`,
        type: 'custom',
        position,
        data: {
          label: template.label,
          type: template.type,
          icon: template.icon,
          description: template.description,
          color: template.color,
          config: {}
        }
      }

      setNodes((nds) => nds.concat(newNode))
      setDraggedNodeType(null)
    },
    [reactFlowInstance, draggedNodeType, setNodes]
  )

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    if (readOnly) return
    setSelectedNode(node as WorkflowNode)
    setShowNodeConfig(true)
  }, [readOnly])

  const deleteSelectedNode = useCallback(() => {
    if (!selectedNode) return
    
    setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id))
    setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id))
    setSelectedNode(null)
    setShowNodeConfig(false)
  }, [selectedNode, setNodes, setEdges])

  const duplicateSelectedNode = useCallback(() => {
    if (!selectedNode) return
    
    const newNode: WorkflowNode = {
      ...selectedNode,
      id: `${selectedNode.data.type}-${Date.now()}`,
      position: {
        x: selectedNode.position.x + 50,
        y: selectedNode.position.y + 50
      }
    }
    
    setNodes((nds) => nds.concat(newNode))
  }, [selectedNode, setNodes])

  const saveWorkflow = useCallback(() => {
    const workflowData: WorkflowData = {
      id: workflow?.id || `workflow-${Date.now()}`,
      name: workflowName,
      description: workflowDescription,
      nodes,
      edges,
      settings: workflow?.settings || {
        timeout: 300,
        retryAttempts: 3,
        errorHandling: 'retry',
        tags: []
      },
      version: (workflow?.version || 0) + 1,
      createdAt: workflow?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    
    onSave(workflowData)
  }, [workflowName, workflowDescription, nodes, edges, workflow, onSave])

  const testWorkflow = useCallback(async () => {
    if (nodes.length === 0) return
    
    setIsRunning(true)
    
    // Simulate workflow execution
    const execution = {
      id: `exec-${Date.now()}`,
      startTime: new Date().toISOString(),
      status: 'running',
      steps: []
    }
    
    setExecutionHistory(prev => [execution, ...prev])
    
    // Simulate step execution
    for (const node of nodes) {
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Update node status
      setNodes(nds => nds.map(n => 
        n.id === node.id 
          ? { ...n, data: { ...n.data, status: 'success' } }
          : n
      ))
      
      execution.steps.push({
        nodeId: node.id,
        nodeName: node.data.label,
        status: 'success',
        timestamp: new Date().toISOString(),
        duration: Math.random() * 1000
      })
    }
    
    execution.status = 'completed'
    execution.endTime = new Date().toISOString()
    
    setExecutionHistory(prev => 
      prev.map(ex => ex.id === execution.id ? execution : ex)
    )
    
    setIsRunning(false)
    
    // Reset node statuses after a delay
    setTimeout(() => {
      setNodes(nds => nds.map(n => ({
        ...n,
        data: { ...n.data, status: undefined }
      })))
    }, 3000)
  }, [nodes, setNodes])

  const exportWorkflow = useCallback(() => {
    const workflowData = {
      name: workflowName,
      description: workflowDescription,
      nodes,
      edges,
      exportDate: new Date().toISOString()
    }
    
    const blob = new Blob([JSON.stringify(workflowData, null, 2)], {
      type: 'application/json'
    })
    
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${workflowName.replace(/\s+/g, '-').toLowerCase()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [workflowName, workflowDescription, nodes, edges])

  return (
    <div className={cn("h-full flex flex-col", className)}>
      <ReactFlowProvider>
        {/* Header */}
        <div className="p-4 border-b bg-white">
          <div className="flex items-center justify-between mb-4">
            <div className="flex-1 max-w-md space-y-2">
              <Input
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                placeholder="Workflow name"
                className="font-medium text-lg"
                disabled={readOnly}
              />
              <Textarea
                value={workflowDescription}
                onChange={(e) => setWorkflowDescription(e.target.value)}
                placeholder="Workflow description"
                rows={1}
                disabled={readOnly}
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={exportWorkflow}
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={testWorkflow}
                disabled={isRunning || nodes.length === 0}
              >
                {isRunning ? (
                  <div className="animate-spin h-4 w-4 mr-2 border-2 border-gray-300 border-t-blue-600 rounded-full" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Test Run
              </Button>
              {!readOnly && (
                <Button onClick={saveWorkflow}>
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 flex">
          {/* Sidebar */}
          {!readOnly && (
            <div className="w-64 border-r bg-gray-50 p-4">
              <Tabs defaultValue="nodes" className="h-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="nodes">Nodes</TabsTrigger>
                  <TabsTrigger value="history">History</TabsTrigger>
                </TabsList>
                
                <TabsContent value="nodes" className="mt-4 h-full">
                  <ScrollArea className="h-full">
                    <div className="space-y-4">
                      {Object.entries(
                        nodeTemplates.reduce((acc, template) => {
                          if (!acc[template.category]) acc[template.category] = []
                          acc[template.category].push(template)
                          return acc
                        }, {} as Record<string, typeof nodeTemplates>)
                      ).map(([category, templates]) => (
                        <div key={category}>
                          <h4 className="font-medium text-sm mb-2 capitalize">
                            {category}
                          </h4>
                          <div className="space-y-1">
                            {templates.map((template) => {
                              const Icon = template.icon
                              return (
                                <div
                                  key={template.label}
                                  draggable
                                  onDragStart={() => setDraggedNodeType(template.label)}
                                  className={cn(
                                    "p-2 rounded-md border cursor-move hover:shadow-sm transition-shadow",
                                    template.color
                                  )}
                                >
                                  <div className="flex items-center gap-2">
                                    <Icon className="h-4 w-4" />
                                    <span className="text-sm font-medium">
                                      {template.label}
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-600 mt-1">
                                    {template.description}
                                  </p>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>
                
                <TabsContent value="history" className="mt-4">
                  <ScrollArea className="h-full">
                    <div className="space-y-2">
                      {executionHistory.map((execution) => (
                        <Card key={execution.id} className="p-3">
                          <div className="flex items-center justify-between mb-2">
                            <Badge 
                              variant={
                                execution.status === 'completed' ? 'default' :
                                execution.status === 'running' ? 'secondary' :
                                'destructive'
                              }
                            >
                              {execution.status}
                            </Badge>
                            <span className="text-xs text-gray-500">
                              {new Date(execution.startTime).toLocaleTimeString()}
                            </span>
                          </div>
                          <div className="text-xs space-y-1">
                            {execution.steps?.map((step: any, index: number) => (
                              <div key={index} className="flex justify-between">
                                <span>{step.nodeName}</span>
                                <Badge variant="outline" className="text-xs">
                                  {step.status}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </div>
          )}

          {/* Canvas */}
          <div className="flex-1 relative" ref={reactFlowWrapper}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onInit={setReactFlowInstance}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onNodeClick={onNodeClick}
              nodeTypes={customNodeTypes}
              fitView
              className="bg-gray-50"
              deleteKeyCode={readOnly ? null : 'Delete'}
            >
              <Background />
              <Controls />
              <MiniMap />
              
              <Panel position="top-right" className="flex gap-2">
                {selectedNode && !readOnly && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={duplicateSelectedNode}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={deleteSelectedNode}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </Panel>
            </ReactFlow>
          </div>
        </div>

        {/* Node Configuration Dialog */}
        <Dialog open={showNodeConfig} onOpenChange={setShowNodeConfig}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedNode?.data.icon && <selectedNode.data.icon className="h-5 w-5" />}
                Configure {selectedNode?.data.label}
              </DialogTitle>
            </DialogHeader>
            
            {selectedNode && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="node-name">Node Name</Label>
                    <Input
                      id="node-name"
                      value={selectedNode.data.label}
                      onChange={(e) => {
                        setNodes(nds => nds.map(n => 
                          n.id === selectedNode.id 
                            ? { ...n, data: { ...n.data, label: e.target.value } }
                            : n
                        ))
                        setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, label: e.target.value } })
                      }}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="node-type">Type</Label>
                    <Input
                      id="node-type"
                      value={selectedNode.data.type}
                      disabled
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="node-description">Description</Label>
                  <Textarea
                    id="node-description"
                    value={selectedNode.data.description || ''}
                    onChange={(e) => {
                      setNodes(nds => nds.map(n => 
                        n.id === selectedNode.id 
                          ? { ...n, data: { ...n.data, description: e.target.value } }
                          : n
                      ))
                      setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, description: e.target.value } })
                    }}
                    rows={2}
                  />
                </div>

                {/* Type-specific configuration */}
                {selectedNode.data.type === 'webhook' && (
                  <div className="space-y-3">
                    <h4 className="font-medium">Webhook Configuration</h4>
                    <div>
                      <Label htmlFor="webhook-url">Webhook URL</Label>
                      <Input
                        id="webhook-url"
                        placeholder="https://api.example.com/webhook"
                        value={selectedNode.data.config?.url || ''}
                        onChange={(e) => {
                          const newConfig = { ...selectedNode.data.config, url: e.target.value }
                          setNodes(nds => nds.map(n => 
                            n.id === selectedNode.id 
                              ? { ...n, data: { ...n.data, config: newConfig } }
                              : n
                          ))
                        }}
                      />
                    </div>
                    <div>
                      <Label htmlFor="webhook-method">HTTP Method</Label>
                      <Select 
                        value={selectedNode.data.config?.method || 'POST'}
                        onValueChange={(value) => {
                          const newConfig = { ...selectedNode.data.config, method: value }
                          setNodes(nds => nds.map(n => 
                            n.id === selectedNode.id 
                              ? { ...n, data: { ...n.data, config: newConfig } }
                              : n
                          ))
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="GET">GET</SelectItem>
                          <SelectItem value="POST">POST</SelectItem>
                          <SelectItem value="PUT">PUT</SelectItem>
                          <SelectItem value="DELETE">DELETE</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {selectedNode.data.type === 'delay' && (
                  <div className="space-y-3">
                    <h4 className="font-medium">Delay Configuration</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="delay-duration">Duration</Label>
                        <Input
                          id="delay-duration"
                          type="number"
                          placeholder="5"
                          value={selectedNode.data.config?.duration || ''}
                          onChange={(e) => {
                            const newConfig = { ...selectedNode.data.config, duration: parseInt(e.target.value) }
                            setNodes(nds => nds.map(n => 
                              n.id === selectedNode.id 
                                ? { ...n, data: { ...n.data, config: newConfig } }
                                : n
                            ))
                          }}
                        />
                      </div>
                      <div>
                        <Label htmlFor="delay-unit">Unit</Label>
                        <Select 
                          value={selectedNode.data.config?.unit || 'seconds'}
                          onValueChange={(value) => {
                            const newConfig = { ...selectedNode.data.config, unit: value }
                            setNodes(nds => nds.map(n => 
                              n.id === selectedNode.id 
                                ? { ...n, data: { ...n.data, config: newConfig } }
                                : n
                            ))
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="seconds">Seconds</SelectItem>
                            <SelectItem value="minutes">Minutes</SelectItem>
                            <SelectItem value="hours">Hours</SelectItem>
                            <SelectItem value="days">Days</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setShowNodeConfig(false)}>
                    Cancel
                  </Button>
                  <Button onClick={() => setShowNodeConfig(false)}>
                    Save Changes
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </ReactFlowProvider>
    </div>
  )
}