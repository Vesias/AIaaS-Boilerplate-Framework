// Make.com Webhook Headers
export interface MakeWebhookHeaders {
  'x-webhook-token'?: string
  'x-make-signature'?: string
  'content-type': string
  'user-agent'?: string
}

// Make.com Response Types
export interface MakeErrorResponse {
  error: string
  details?: string
  timestamp: string
  execution_id?: string
}

export interface MakeSuccessResponse {
  success: boolean
  message?: string
  data?: any
  timestamp: string
  execution_id?: string
  scenario_id?: string
}

// Make.com Webhook Payload Types
export interface MakeWebhookPayload {
  event?: string
  scenario_id?: string
  execution_id?: string
  timestamp?: string
  data?: any
  source?: string
  [key: string]: any
}

// Common Make.com Event Types
export interface MakeEventBase {
  event: string
  timestamp?: string
  source?: string
  scenario_id?: string
  execution_id?: string
}

export interface MakeFormSubmissionEvent extends MakeEventBase {
  event: 'form.submitted'
  formType: string
  submittedAt: string
  data: {
    name?: string
    email?: string
    message?: string
    phone?: string
    company?: string
    [key: string]: any
  }
}

export interface MakeUserEvent extends MakeEventBase {
  event: 'user.registered' | 'user.updated' | 'user.deleted'
  userId: string
  email: string
  userData?: {
    firstName?: string
    lastName?: string
    company?: string
    phone?: string
    [key: string]: any
  }
  platform: string
}

export interface MakeOrderEvent extends MakeEventBase {
  event: 'order.created' | 'order.updated' | 'order.completed' | 'order.cancelled'
  orderId: string
  orderData: {
    customerId?: string
    amount: number
    currency: string
    status: string
    items?: Array<{
      id: string
      name: string
      quantity: number
      price: number
    }>
    shippingAddress?: {
      street: string
      city: string
      country: string
      postalCode: string
    }
    [key: string]: any
  }
}

export interface MakePaymentEvent extends MakeEventBase {
  event: 'payment.completed' | 'payment.failed' | 'payment.refunded'
  paymentId: string
  amount: number
  currency: string
  userId: string
  provider: 'stripe' | 'paypal' | 'bank' | 'other'
  metadata?: {
    orderId?: string
    stripeSessionId?: string
    [key: string]: any
  }
}

export interface MakeEmailEvent extends MakeEventBase {
  event: 'email.campaign' | 'email.sent' | 'email.opened' | 'email.clicked'
  campaignType?: string
  recipients: string[]
  content?: {
    subject: string
    template?: string
    variables?: { [key: string]: any }
  }
  stats?: {
    sent?: number
    delivered?: number
    opened?: number
    clicked?: number
  }
}

export interface MakeDataEvent extends MakeEventBase {
  event: 'data.export' | 'data.import' | 'data.sync'
  exportType?: string
  importType?: string
  filters?: { [key: string]: any }
  status: 'started' | 'in_progress' | 'completed' | 'failed'
  recordCount?: number
  fileUrl?: string
}

export interface MakeSupportEvent extends MakeEventBase {
  event: 'support.ticket.created' | 'support.ticket.updated' | 'support.ticket.resolved'
  ticket: {
    id: string
    subject: string
    description: string
    priority: 'low' | 'normal' | 'high' | 'urgent'
    status: 'open' | 'in_progress' | 'resolved' | 'closed'
    userId?: string
    assignedTo?: string
    tags?: string[]
  }
}

export interface MakeInventoryEvent extends MakeEventBase {
  event: 'inventory.updated' | 'inventory.low_stock' | 'inventory.out_of_stock'
  productId: string
  quantity: number
  action?: 'increase' | 'decrease' | 'set'
  threshold?: number
  supplier?: string
  warehouse?: string
}

export interface MakeNotificationEvent extends MakeEventBase {
  event: 'notification.send' | 'notification.delivered' | 'notification.failed'
  userId: string
  type: 'welcome' | 'confirmation' | 'reminder' | 'alert' | 'marketing'
  message: string
  channels: ('email' | 'sms' | 'push' | 'slack' | 'discord' | 'webhook')[]
  priority: 'low' | 'normal' | 'high' | 'urgent'
  deliveryStatus?: {
    email?: 'sent' | 'delivered' | 'failed'
    sms?: 'sent' | 'delivered' | 'failed'
    push?: 'sent' | 'delivered' | 'failed'
  }
}

// Union type for all Make.com events
export type MakeEvent = 
  | MakeFormSubmissionEvent
  | MakeUserEvent
  | MakeOrderEvent
  | MakePaymentEvent
  | MakeEmailEvent
  | MakeDataEvent
  | MakeSupportEvent
  | MakeInventoryEvent
  | MakeNotificationEvent

// Make.com Scenario Configuration
export interface MakeScenarioConfig {
  id: string
  name: string
  webhookUrl: string
  active: boolean
  schedulingType: 'immediately' | 'scheduled' | 'manual'
  interval?: number
  timezone?: string
  lastExecution?: string
  nextExecution?: string
}

// Make.com API Response Types
export interface MakeApiResponse<T = any> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: any
  }
  pagination?: {
    page: number
    limit: number
    total: number
    hasMore: boolean
  }
}

export interface MakeExecutionLog {
  executionId: string
  scenarioId: string
  status: 'running' | 'success' | 'error' | 'warning'
  startedAt: string
  finishedAt?: string
  duration?: number
  operations: number
  dataTransfer: number
  error?: {
    message: string
    details?: any
  }
}

// Make.com Module Types
export interface MakeModule {
  id: string
  name: string
  type: string
  position: {
    x: number
    y: number
  }
  parameters: { [key: string]: any }
  mapping?: { [key: string]: any }
}

export interface MakeConnection {
  source: {
    moduleId: string
    output: string
  }
  target: {
    moduleId: string
    input: string
  }
}

export interface MakeScenario {
  id: string
  name: string
  description?: string
  active: boolean
  modules: MakeModule[]
  connections: MakeConnection[]
  createdAt: string
  updatedAt: string
  lastExecution?: string
  executionCount: number
}

// Error Types
export interface MakeError {
  message: string
  code?: string
  statusCode?: number
  details?: any
  scenarioId?: string
  executionId?: string
}

// Configuration Types
export interface MakeConfig {
  webhookUrl?: string
  webhookToken?: string
  webhookSecret?: string
  apiToken?: string
}

// Response wrapper for Make.com scenario triggers
export interface MakeScenarioResponse {
  success: boolean
  scenarioId?: string
  executionId?: string
  data?: any
  error?: string
  timestamp?: string
}