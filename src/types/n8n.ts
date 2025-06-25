// n8n Workflow Response Types
export interface N8nWorkflowResponse {
  success: boolean
  workflowId?: string
  executionId?: string
  data?: any
  error?: string
  message?: string
  timestamp?: string
}

// n8n Webhook Request Types
export interface N8nWebhookRequest {
  headers: {
    [key: string]: string
  }
  body: any
  query?: {
    [key: string]: string
  }
}

// Common n8n Event Types
export interface N8nEventBase {
  event: string
  timestamp?: string
  source?: string
}

export interface N8nUserSignupEvent extends N8nEventBase {
  event: 'user.signup'
  userId: string
  email: string
  platform: string
  metadata?: {
    referralCode?: string
    utmSource?: string
    [key: string]: any
  }
}

export interface N8nOrderEvent extends N8nEventBase {
  event: 'order.created' | 'order.updated' | 'order.completed' | 'order.cancelled'
  orderId: string
  userId: string
  amount: number
  currency: string
  status?: string
  items?: Array<{
    id: string
    name: string
    quantity: number
    price: number
  }>
}

export interface N8nPaymentEvent extends N8nEventBase {
  event: 'payment.successful' | 'payment.failed' | 'payment.refunded'
  paymentId: string
  orderId?: string
  userId: string
  amount: number
  currency: string
  provider: 'stripe' | 'paypal' | 'bank'
  metadata?: {
    stripeSessionId?: string
    [key: string]: any
  }
}

export interface N8nUserActivityEvent extends N8nEventBase {
  event: 'user.activity'
  userId: string
  action: string
  page?: string
  metadata?: {
    userAgent?: string
    ip?: string
    duration?: number
    [key: string]: any
  }
}

export interface N8nNotificationEvent extends N8nEventBase {
  event: 'notification.send'
  userId: string
  type: 'welcome' | 'confirmation' | 'reminder' | 'alert' | 'marketing'
  message: string
  channels: ('email' | 'sms' | 'push' | 'slack' | 'discord')[]
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  metadata?: {
    templateId?: string
    variables?: { [key: string]: any }
    [key: string]: any
  }
}

export interface N8nWorkflowEvent extends N8nEventBase {
  event: 'workflow.started' | 'workflow.completed' | 'workflow.failed'
  workflowId: string
  executionId: string
  status: 'running' | 'success' | 'error' | 'waiting'
  duration?: number
  error?: string
}

// Union type for all n8n events
export type N8nEvent = 
  | N8nUserSignupEvent
  | N8nOrderEvent
  | N8nPaymentEvent
  | N8nUserActivityEvent
  | N8nNotificationEvent
  | N8nWorkflowEvent

// n8n API Response Types
export interface N8nWorkflow {
  id: string
  name: string
  active: boolean
  createdAt: string
  updatedAt: string
  tags?: Array<{
    id: string
    name: string
  }>
  nodes: N8nNode[]
  connections: N8nConnections
}

export interface N8nNode {
  id: string
  name: string
  type: string
  typeVersion: number
  position: [number, number]
  parameters: { [key: string]: any }
}

export interface N8nConnections {
  [nodeName: string]: {
    main?: Array<Array<{
      node: string
      type: string
      index: number
    }>>
  }
}

export interface N8nExecution {
  id: string
  workflowId: string
  mode: string
  retryOf?: string
  retrySuccessId?: string
  startedAt: string
  stoppedAt?: string
  finished: boolean
  status: 'running' | 'success' | 'error' | 'waiting' | 'canceled'
  data?: {
    resultData: {
      runData: { [nodeName: string]: any[] }
    }
  }
}

// Configuration Types
export interface N8nConfig {
  webhookUrl?: string
  apiKey?: string
  instanceUrl?: string
  webhookAuth?: string
}

// Error Types
export interface N8nError {
  message: string
  code?: string
  statusCode?: number
  details?: any
}

// Webhook Payload Types for sending to n8n
export interface N8nWebhookPayload {
  event?: string
  timestamp?: string
  source?: string
  [key: string]: any
}