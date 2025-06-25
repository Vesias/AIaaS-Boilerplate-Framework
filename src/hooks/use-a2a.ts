'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useUser } from '@clerk/nextjs'
import { toast } from 'sonner'

// Types for Agent-to-Agent communication
export interface A2AAgent {
  id: string
  name: string
  description: string
  type: 'local' | 'remote' | 'external'
  status: 'online' | 'offline' | 'busy' | 'error'
  capabilities: string[]
  endpoint?: string
  apiKey?: string
  metadata: Record<string, any>
  lastSeen: Date
  version: string
}

export interface A2AMessage {
  id: string
  fromAgent: string
  toAgent: string
  type: 'request' | 'response' | 'notification' | 'broadcast' | 'error'
  method?: string
  payload: any
  metadata: Record<string, any>
  timestamp: Date
  priority: 'low' | 'normal' | 'high' | 'urgent'
  status: 'pending' | 'sent' | 'delivered' | 'acknowledged' | 'failed'
  retryCount: number
  expiresAt?: Date
}

export interface A2AConversation {
  id: string
  participants: string[]
  messages: A2AMessage[]
  context: Record<string, any>
  startedAt: Date
  lastActivity: Date
  status: 'active' | 'paused' | 'completed' | 'archived'
  metadata: Record<string, any>
}

export interface A2ATask {
  id: string
  name: string
  description: string
  assignedTo: string
  requestedBy: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  parameters: Record<string, any>
  result?: any
  error?: string
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
  deadline?: Date
}

export interface A2ARegistry {
  agents: A2AAgent[]
  conversations: A2AConversation[]
  tasks: A2ATask[]
  lastUpdated: Date
}

export interface UseA2AOptions {
  // Agent configuration
  agentId?: string
  agentName?: string
  agentDescription?: string
  capabilities?: string[]
  
  // Network configuration
  registryEndpoint?: string
  heartbeatInterval?: number
  messageTimeout?: number
  maxRetries?: number
  
  // Features
  enableAutoDiscovery?: boolean
  enableHeartbeat?: boolean
  enableBroadcast?: boolean
  enableTaskQueue?: boolean
  
  // Callbacks
  onAgentConnected?: (agent: A2AAgent) => void
  onAgentDisconnected?: (agentId: string) => void
  onMessageReceived?: (message: A2AMessage) => void
  onTaskAssigned?: (task: A2ATask) => void
  onTaskCompleted?: (task: A2ATask) => void
  onError?: (error: any) => void
}

export interface UseA2AReturn {
  // Agent management
  localAgent: A2AAgent | null
  availableAgents: A2AAgent[]
  onlineAgents: A2AAgent[]
  
  // Registration
  registerAgent: (agent: Partial<A2AAgent>) => Promise<void>
  unregisterAgent: () => Promise<void>
  updateAgent: (updates: Partial<A2AAgent>) => Promise<void>
  
  // Discovery
  discoverAgents: () => Promise<A2AAgent[]>
  findAgentsByCapability: (capability: string) => A2AAgent[]
  getAgentStatus: (agentId: string) => Promise<A2AAgent | null>
  
  // Communication
  sendMessage: (toAgent: string, payload: any, options?: {
    type?: A2AMessage['type']
    method?: string
    priority?: A2AMessage['priority']
    expiresIn?: number
  }) => Promise<A2AMessage>
  broadcastMessage: (payload: any, options?: {
    capabilities?: string[]
    excludeAgents?: string[]
  }) => Promise<A2AMessage[]>
  
  // Conversations
  conversations: A2AConversation[]
  startConversation: (participants: string[], context?: Record<string, any>) => Promise<A2AConversation>
  getConversation: (conversationId: string) => A2AConversation | null
  endConversation: (conversationId: string) => Promise<void>
  
  // Task management
  tasks: A2ATask[]
  assignTask: (agentId: string, task: Omit<A2ATask, 'id' | 'assignedTo' | 'requestedBy' | 'status' | 'createdAt'>) => Promise<A2ATask>
  completeTask: (taskId: string, result: any) => Promise<void>
  cancelTask: (taskId: string) => Promise<void>
  getTaskStatus: (taskId: string) => A2ATask | null
  
  // State
  isConnected: boolean
  isRegistered: boolean
  registry: A2ARegistry | null
  messages: A2AMessage[]
  
  // Utilities
  exportRegistry: () => A2ARegistry
  clearMessages: () => void
  getNetworkStats: () => {
    agentCount: number
    messageCount: number
    taskCount: number
    conversationCount: number
    uptime: number
  }
}

/**
 * Agent-to-Agent Communication Hook
 * Enables distributed AI agent communication and coordination
 */
export function useA2A(options: UseA2AOptions = {}): UseA2AReturn {
  const {
    agentId,
    agentName = 'Roomicor Agent',
    agentDescription = 'Multi-purpose business automation agent',
    capabilities = ['task_management', 'invoice_generation', 'workflow_automation'],
    registryEndpoint = '/api/a2a/registry',
    heartbeatInterval = 30000,
    messageTimeout = 60000,
    maxRetries = 3,
    enableAutoDiscovery = true,
    enableHeartbeat = true,
    enableBroadcast = true,
    enableTaskQueue = true,
    onAgentConnected,
    onAgentDisconnected,
    onMessageReceived,
    onTaskAssigned,
    onTaskCompleted,
    onError,
  } = options

  // Clerk user context
  const { user } = useUser()
  
  // State
  const [localAgent, setLocalAgent] = useState<A2AAgent | null>(null)
  const [availableAgents, setAvailableAgents] = useState<A2AAgent[]>([])
  const [conversations, setConversations] = useState<A2AConversation[]>([])
  const [tasks, setTasks] = useState<A2ATask[]>([])
  const [messages, setMessages] = useState<A2AMessage[]>([])
  const [registry, setRegistry] = useState<A2ARegistry | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isRegistered, setIsRegistered] = useState(false)
  
  // Refs
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const messageQueueRef = useRef<A2AMessage[]>([])
  const taskQueueRef = useRef<A2ATask[]>([])

  // Generate agent ID if not provided
  const generatedAgentId = useRef(
    agentId || `roomicor-${user?.id || 'anonymous'}-${Date.now()}`
  )

  // Register agent in the network
  const registerAgent = useCallback(async (agentOverrides: Partial<A2AAgent> = {}): Promise<void> => {
    if (isRegistered) return

    try {
      const agent: A2AAgent = {
        id: generatedAgentId.current,
        name: agentName,
        description: agentDescription,
        type: 'local',
        status: 'online',
        capabilities,
        metadata: {
          userId: user?.id,
          userEmail: user?.primaryEmailAddress?.emailAddress,
          platform: 'roomicor',
          version: '1.0.0',
          ...agentOverrides.metadata,
        },
        lastSeen: new Date(),
        version: '1.0.0',
        ...agentOverrides,
      }

      const response = await fetch(`${registryEndpoint}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(agent),
      })

      if (!response.ok) {
        throw new Error('Failed to register agent')
      }

      const registeredAgent = await response.json()
      setLocalAgent(registeredAgent)
      setIsRegistered(true)

      // Establish WebSocket connection for real-time communication
      await establishConnection()

      // Start heartbeat if enabled
      if (enableHeartbeat) {
        startHeartbeat()
      }

      // Discover other agents if enabled
      if (enableAutoDiscovery) {
        await discoverAgents()
      }

      toast.success(`Agent "${agentName}" registered successfully`)

    } catch (error: any) {
      const errorMessage = error.message || 'Failed to register agent'
      onError?.(error)
      toast.error(errorMessage)
      throw error
    }
  }, [isRegistered, agentName, agentDescription, capabilities, user, registryEndpoint, enableHeartbeat, enableAutoDiscovery, onError])

  // Establish WebSocket connection
  const establishConnection = useCallback(async (): Promise<void> => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    try {
      const wsUrl = registryEndpoint.replace('/api/', '/ws/').replace('http', 'ws')
      wsRef.current = new WebSocket(`${wsUrl}?agentId=${generatedAgentId.current}`)

      wsRef.current.onopen = () => {
        setIsConnected(true)
        toast.success('Connected to A2A network')
        
        // Process queued messages
        processMessageQueue()
      }

      wsRef.current.onmessage = (event) => {
        try {
          const message: A2AMessage = JSON.parse(event.data)
          handleIncomingMessage(message)
        } catch (error) {
          console.error('Failed to parse A2A message:', error)
        }
      }

      wsRef.current.onclose = () => {
        setIsConnected(false)
        // Attempt reconnection
        setTimeout(establishConnection, 5000)
      }

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error)
        onError?.(error)
      }

    } catch (error: any) {
      console.error('Failed to establish connection:', error)
      onError?.(error)
    }
  }, [registryEndpoint, onError])

  // Handle incoming messages
  const handleIncomingMessage = useCallback((message: A2AMessage) => {
    setMessages(prev => [...prev, message])
    onMessageReceived?.(message)

    // Handle different message types
    switch (message.type) {
      case 'request':
        handleRequest(message)
        break
      case 'notification':
        handleNotification(message)
        break
      case 'broadcast':
        handleBroadcast(message)
        break
      default:
        // Generic message handling
        break
    }
  }, [onMessageReceived])

  // Handle incoming requests
  const handleRequest = useCallback(async (message: A2AMessage) => {
    try {
      let response: any = { success: true }

      // Handle standard methods
      switch (message.method) {
        case 'ping':
          response = { pong: true, timestamp: new Date().toISOString() }
          break
        
        case 'get_capabilities':
          response = { capabilities: localAgent?.capabilities || [] }
          break
        
        case 'get_status':
          response = { status: localAgent?.status || 'offline' }
          break
        
        case 'assign_task':
          const task = await handleTaskAssignment(message.payload)
          response = { task }
          break
        
        default:
          response = { error: `Unknown method: ${message.method}` }
      }

      // Send response back
      await sendMessage(message.fromAgent, response, {
        type: 'response',
        method: message.method,
      })

    } catch (error: any) {
      // Send error response
      await sendMessage(message.fromAgent, {
        error: error.message || 'Request processing failed'
      }, {
        type: 'error',
        method: message.method,
      })
    }
  }, [localAgent])

  // Handle task assignment
  const handleTaskAssignment = useCallback(async (taskData: any): Promise<A2ATask> => {
    const task: A2ATask = {
      id: `task-${Date.now()}`,
      name: taskData.name,
      description: taskData.description,
      assignedTo: generatedAgentId.current,
      requestedBy: taskData.requestedBy,
      status: 'pending',
      priority: taskData.priority || 'normal',
      parameters: taskData.parameters || {},
      createdAt: new Date(),
      deadline: taskData.deadline ? new Date(taskData.deadline) : undefined,
    }

    setTasks(prev => [...prev, task])
    onTaskAssigned?.(task)

    // Auto-start task processing if task queue is enabled
    if (enableTaskQueue) {
      processTask(task)
    }

    return task
  }, [onTaskAssigned, enableTaskQueue])

  // Process a task
  const processTask = useCallback(async (task: A2ATask) => {
    try {
      // Update task status
      setTasks(prev => prev.map(t => 
        t.id === task.id ? { ...t, status: 'in_progress', startedAt: new Date() } : t
      ))

      let result: any

      // Handle different task types based on name/description
      switch (task.name.toLowerCase()) {
        case 'create_task':
          result = await executeCreateTask(task.parameters)
          break
        
        case 'generate_invoice':
          result = await executeGenerateInvoice(task.parameters)
          break
        
        case 'trigger_workflow':
          result = await executeTriggerWorkflow(task.parameters)
          break
        
        case 'analyze_data':
          result = await executeAnalyzeData(task.parameters)
          break
        
        default:
          throw new Error(`Unknown task type: ${task.name}`)
      }

      // Complete task
      await completeTask(task.id, result)

    } catch (error: any) {
      // Fail task
      setTasks(prev => prev.map(t => 
        t.id === task.id ? { 
          ...t, 
          status: 'failed', 
          error: error.message,
          completedAt: new Date(),
        } : t
      ))
    }
  }, [])

  // Task execution methods
  const executeCreateTask = useCallback(async (params: any) => {
    const response = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: params.title,
        content: params.content,
        priority: params.priority,
        due_date: params.dueDate,
        user_id: user?.id,
      }),
    })
    return response.json()
  }, [user])

  const executeGenerateInvoice = useCallback(async (params: any) => {
    const response = await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerEmail: params.customerEmail,
        customerName: params.customerName,
        items: params.items,
        currency: params.currency,
        userId: user?.id,
      }),
    })
    return response.json()
  }, [user])

  const executeTriggerWorkflow = useCallback(async (params: any) => {
    const endpoint = params.platform === 'n8n' ? '/api/n8n/webhook' : '/api/make/webhook'
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workflowId: params.workflowId,
        data: params.data,
      }),
    })
    return response.json()
  }, [])

  const executeAnalyzeData = useCallback(async (params: any) => {
    const response = await fetch(`/api/${params.dataType}?analyze=true&timeRange=${params.timeRange}`)
    return response.json()
  }, [])

  // Handle notifications
  const handleNotification = useCallback((message: A2AMessage) => {
    const { type, data } = message.payload

    switch (type) {
      case 'agent_joined':
        setAvailableAgents(prev => [...prev, data.agent])
        onAgentConnected?.(data.agent)
        break
      
      case 'agent_left':
        setAvailableAgents(prev => prev.filter(a => a.id !== data.agentId))
        onAgentDisconnected?.(data.agentId)
        break
      
      case 'task_completed':
        setTasks(prev => prev.map(t => 
          t.id === data.taskId ? { ...t, ...data.task } : t
        ))
        onTaskCompleted?.(data.task)
        break
    }
  }, [onAgentConnected, onAgentDisconnected, onTaskCompleted])

  // Handle broadcasts
  const handleBroadcast = useCallback((message: A2AMessage) => {
    // Process broadcast message based on content
    console.log('Received broadcast:', message.payload)
  }, [])

  // Start heartbeat
  const startHeartbeat = useCallback(() => {
    if (heartbeatRef.current) return

    heartbeatRef.current = setInterval(async () => {
      try {
        await fetch(`${registryEndpoint}/heartbeat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentId: generatedAgentId.current,
            status: localAgent?.status || 'online',
            lastSeen: new Date().toISOString(),
          }),
        })
      } catch (error) {
        console.error('Heartbeat failed:', error)
      }
    }, heartbeatInterval)
  }, [registryEndpoint, heartbeatInterval, localAgent])

  // Process message queue
  const processMessageQueue = useCallback(() => {
    const queue = messageQueueRef.current
    messageQueueRef.current = []
    
    queue.forEach(message => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(message))
      }
    })
  }, [])

  // Unregister agent
  const unregisterAgent = useCallback(async (): Promise<void> => {
    if (!isRegistered || !localAgent) return

    try {
      await fetch(`${registryEndpoint}/unregister`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: localAgent.id }),
      })

      // Close WebSocket connection
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }

      // Stop heartbeat
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current)
        heartbeatRef.current = null
      }

      setLocalAgent(null)
      setIsRegistered(false)
      setIsConnected(false)

    } catch (error: any) {
      console.error('Failed to unregister agent:', error)
    }
  }, [isRegistered, localAgent, registryEndpoint])

  // Update agent
  const updateAgent = useCallback(async (updates: Partial<A2AAgent>): Promise<void> => {
    if (!localAgent) return

    try {
      const updatedAgent = { ...localAgent, ...updates, lastSeen: new Date() }
      
      const response = await fetch(`${registryEndpoint}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedAgent),
      })

      if (!response.ok) {
        throw new Error('Failed to update agent')
      }

      setLocalAgent(updatedAgent)

    } catch (error: any) {
      console.error('Failed to update agent:', error)
      onError?.(error)
    }
  }, [localAgent, registryEndpoint, onError])

  // Discover agents
  const discoverAgents = useCallback(async (): Promise<A2AAgent[]> => {
    try {
      const response = await fetch(`${registryEndpoint}/discover`)
      
      if (!response.ok) {
        throw new Error('Failed to discover agents')
      }

      const agents: A2AAgent[] = await response.json()
      setAvailableAgents(agents.filter(a => a.id !== generatedAgentId.current))
      
      return agents

    } catch (error: any) {
      console.error('Failed to discover agents:', error)
      onError?.(error)
      return []
    }
  }, [registryEndpoint, onError])

  // Find agents by capability
  const findAgentsByCapability = useCallback((capability: string): A2AAgent[] => {
    return availableAgents.filter(agent => 
      agent.capabilities.includes(capability)
    )
  }, [availableAgents])

  // Get agent status
  const getAgentStatus = useCallback(async (agentId: string): Promise<A2AAgent | null> => {
    try {
      const response = await fetch(`${registryEndpoint}/agent/${agentId}`)
      
      if (!response.ok) {
        return null
      }

      return await response.json()

    } catch (error) {
      console.error('Failed to get agent status:', error)
      return null
    }
  }, [registryEndpoint])

  // Send message
  const sendMessage = useCallback(async (
    toAgent: string,
    payload: any,
    options: {
      type?: A2AMessage['type']
      method?: string
      priority?: A2AMessage['priority']
      expiresIn?: number
    } = {}
  ): Promise<A2AMessage> => {
    const message: A2AMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      fromAgent: generatedAgentId.current,
      toAgent,
      type: options.type || 'request',
      method: options.method,
      payload,
      metadata: {
        timestamp: new Date().toISOString(),
        userAgent: 'Roomicor/1.0.0',
      },
      timestamp: new Date(),
      priority: options.priority || 'normal',
      status: 'pending',
      retryCount: 0,
      expiresAt: options.expiresIn ? new Date(Date.now() + options.expiresIn) : undefined,
    }

    // Send immediately if connected, otherwise queue
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
      message.status = 'sent'
    } else {
      messageQueueRef.current.push(message)
    }

    setMessages(prev => [...prev, message])
    return message
  }, [])

  // Broadcast message
  const broadcastMessage = useCallback(async (
    payload: any,
    options: {
      capabilities?: string[]
      excludeAgents?: string[]
    } = {}
  ): Promise<A2AMessage[]> => {
    if (!enableBroadcast) {
      throw new Error('Broadcasting is disabled')
    }

    let targetAgents = availableAgents

    // Filter by capabilities
    if (options.capabilities) {
      targetAgents = targetAgents.filter(agent =>
        options.capabilities!.some(cap => agent.capabilities.includes(cap))
      )
    }

    // Exclude specific agents
    if (options.excludeAgents) {
      targetAgents = targetAgents.filter(agent =>
        !options.excludeAgents!.includes(agent.id)
      )
    }

    // Send to all target agents
    const messages = await Promise.all(
      targetAgents.map(agent =>
        sendMessage(agent.id, payload, { type: 'broadcast' })
      )
    )

    return messages
  }, [availableAgents, enableBroadcast, sendMessage])

  // Start conversation
  const startConversation = useCallback(async (
    participants: string[],
    context: Record<string, any> = {}
  ): Promise<A2AConversation> => {
    const conversation: A2AConversation = {
      id: `conv-${Date.now()}`,
      participants: [generatedAgentId.current, ...participants],
      messages: [],
      context,
      startedAt: new Date(),
      lastActivity: new Date(),
      status: 'active',
      metadata: {},
    }

    setConversations(prev => [...prev, conversation])

    // Notify participants
    await Promise.all(
      participants.map(agentId =>
        sendMessage(agentId, {
          type: 'conversation_started',
          conversation,
        }, { type: 'notification' })
      )
    )

    return conversation
  }, [sendMessage])

  // Get conversation
  const getConversation = useCallback((conversationId: string): A2AConversation | null => {
    return conversations.find(c => c.id === conversationId) || null
  }, [conversations])

  // End conversation
  const endConversation = useCallback(async (conversationId: string): Promise<void> => {
    const conversation = getConversation(conversationId)
    if (!conversation) return

    // Update conversation status
    setConversations(prev => prev.map(c =>
      c.id === conversationId ? { ...c, status: 'completed' } : c
    ))

    // Notify participants
    await Promise.all(
      conversation.participants
        .filter(id => id !== generatedAgentId.current)
        .map(agentId =>
          sendMessage(agentId, {
            type: 'conversation_ended',
            conversationId,
          }, { type: 'notification' })
        )
    )
  }, [getConversation, sendMessage])

  // Assign task
  const assignTask = useCallback(async (
    agentId: string,
    taskData: Omit<A2ATask, 'id' | 'assignedTo' | 'requestedBy' | 'status' | 'createdAt'>
  ): Promise<A2ATask> => {
    const task: A2ATask = {
      id: `task-${Date.now()}`,
      assignedTo: agentId,
      requestedBy: generatedAgentId.current,
      status: 'pending',
      createdAt: new Date(),
      ...taskData,
    }

    setTasks(prev => [...prev, task])

    // Send task assignment message
    await sendMessage(agentId, {
      type: 'task_assigned',
      task,
    }, { 
      type: 'notification',
      priority: taskData.priority,
    })

    return task
  }, [sendMessage])

  // Complete task
  const completeTask = useCallback(async (taskId: string, result: any): Promise<void> => {
    setTasks(prev => prev.map(t =>
      t.id === taskId ? {
        ...t,
        status: 'completed',
        result,
        completedAt: new Date(),
      } : t
    ))

    const task = tasks.find(t => t.id === taskId)
    if (task) {
      onTaskCompleted?.(task)
      
      // Notify task requester
      await sendMessage(task.requestedBy, {
        type: 'task_completed',
        taskId,
        result,
      }, { type: 'notification' })
    }
  }, [tasks, onTaskCompleted, sendMessage])

  // Cancel task
  const cancelTask = useCallback(async (taskId: string): Promise<void> => {
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, status: 'cancelled' } : t
    ))

    const task = tasks.find(t => t.id === taskId)
    if (task) {
      // Notify assigned agent
      await sendMessage(task.assignedTo, {
        type: 'task_cancelled',
        taskId,
      }, { type: 'notification' })
    }
  }, [tasks, sendMessage])

  // Get task status
  const getTaskStatus = useCallback((taskId: string): A2ATask | null => {
    return tasks.find(t => t.id === taskId) || null
  }, [tasks])

  // Clear messages
  const clearMessages = useCallback(() => {
    setMessages([])
  }, [])

  // Export registry
  const exportRegistry = useCallback((): A2ARegistry => {
    return {
      agents: [localAgent, ...availableAgents].filter(Boolean) as A2AAgent[],
      conversations,
      tasks,
      lastUpdated: new Date(),
    }
  }, [localAgent, availableAgents, conversations, tasks])

  // Get network stats
  const getNetworkStats = useCallback(() => {
    const uptime = localAgent ? Date.now() - localAgent.lastSeen.getTime() : 0
    
    return {
      agentCount: availableAgents.length + (localAgent ? 1 : 0),
      messageCount: messages.length,
      taskCount: tasks.length,
      conversationCount: conversations.length,
      uptime,
    }
  }, [localAgent, availableAgents, messages, tasks, conversations])

  // Auto-register agent on mount
  useEffect(() => {
    if (user && !isRegistered) {
      registerAgent().catch(console.error)
    }

    // Cleanup on unmount
    return () => {
      unregisterAgent().catch(console.error)
    }
  }, [user, isRegistered]) // Note: not including registerAgent/unregisterAgent to avoid re-registration

  // Computed values
  const onlineAgents = availableAgents.filter(a => a.status === 'online')

  return {
    // Agent management
    localAgent,
    availableAgents,
    onlineAgents,
    
    // Registration
    registerAgent,
    unregisterAgent,
    updateAgent,
    
    // Discovery
    discoverAgents,
    findAgentsByCapability,
    getAgentStatus,
    
    // Communication
    sendMessage,
    broadcastMessage,
    
    // Conversations
    conversations,
    startConversation,
    getConversation,
    endConversation,
    
    // Task management
    tasks,
    assignTask,
    completeTask,
    cancelTask,
    getTaskStatus,
    
    // State
    isConnected,
    isRegistered,
    registry,
    messages,
    
    // Utilities
    exportRegistry,
    clearMessages,
    getNetworkStats,
  }
}

/**
 * Specialized hook for coordinating multiple AI agents
 */
export function useA2ACoordination() {
  const a2a = useA2A({
    capabilities: ['coordination', 'task_distribution', 'load_balancing'],
  })

  const distributeTask = useCallback(async (
    taskData: any,
    requiredCapability: string
  ): Promise<A2ATask | null> => {
    const availableAgents = a2a.findAgentsByCapability(requiredCapability)
    
    if (availableAgents.length === 0) {
      toast.error(`No agents available with capability: ${requiredCapability}`)
      return null
    }

    // Simple round-robin distribution
    const selectedAgent = availableAgents[Math.floor(Math.random() * availableAgents.length)]
    
    return a2a.assignTask(selectedAgent.id, taskData)
  }, [a2a])

  const coordinateWorkflow = useCallback(async (
    workflow: Array<{
      name: string
      capability: string
      parameters: any
      dependencies?: string[]
    }>
  ): Promise<A2ATask[]> => {
    const tasks: A2ATask[] = []
    
    // Process workflow steps
    for (const step of workflow) {
      const task = await distributeTask({
        name: step.name,
        description: `Workflow step: ${step.name}`,
        parameters: step.parameters,
        priority: 'normal' as const,
      }, step.capability)
      
      if (task) {
        tasks.push(task)
      }
    }
    
    return tasks
  }, [distributeTask])

  return {
    ...a2a,
    distributeTask,
    coordinateWorkflow,
  }
}