interface MakeScenarioPayload {
  event?: string
  timestamp?: string
  source?: string
  [key: string]: any
}

interface MakeScenarioResponse {
  success: boolean
  scenarioId?: string
  executionId?: string
  data?: any
  error?: string
}

export async function triggerMakeScenario(
  payload: MakeScenarioPayload
): Promise<MakeScenarioResponse> {
  if (!process.env.MAKE_WEBHOOK_URL) {
    throw new Error('MAKE_WEBHOOK_URL is not configured')
  }

  try {
    const response = await fetch(process.env.MAKE_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.MAKE_WEBHOOK_TOKEN && {
          'X-Webhook-Token': process.env.MAKE_WEBHOOK_TOKEN
        })
      },
      body: JSON.stringify({
        ...payload,
        timestamp: new Date().toISOString(),
        source: 'nextjs-app'
      }),
    })

    if (!response.ok) {
      throw new Error(`Make.com webhook failed: ${response.status} ${response.statusText}`)
    }

    // Handle different response formats from Make.com
    const contentType = response.headers.get('content-type')
    let data: any

    if (contentType && contentType.includes('application/json')) {
      data = await response.json()
    } else {
      const text = await response.text()
      data = { response: text }
    }
    
    return {
      success: true,
      executionId: data.executionId || data.execution_id,
      scenarioId: data.scenarioId || data.scenario_id,
      data: data
    }
  } catch (error: any) {
    console.error('Error triggering Make.com scenario:', error)
    throw new Error(`Failed to trigger Make.com scenario: ${error.message}`)
  }
}

export async function triggerMakeScenarioWithRetry(
  payload: MakeScenarioPayload,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<MakeScenarioResponse> {
  let lastError: Error

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await triggerMakeScenario(payload)
    } catch (error: any) {
      lastError = error
      console.warn(`Make.com scenario trigger attempt ${attempt} failed:`, error.message)
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delayMs * attempt))
      }
    }
  }

  throw lastError!
}

// Predefined Make.com scenario triggers for common events
export const MakeScenarios = {
  FORM_SUBMISSION: (formType: string, formData: any) => triggerMakeScenario({
    event: 'form.submitted',
    formType,
    data: formData,
    submittedAt: new Date().toISOString()
  }),

  USER_REGISTRATION: (userId: string, email: string, userData?: any) => triggerMakeScenario({
    event: 'user.registered',
    userId,
    email,
    userData,
    platform: 'web'
  }),

  ORDER_CREATED: (orderId: string, orderData: any) => triggerMakeScenario({
    event: 'order.created',
    orderId,
    orderData,
    currency: 'EUR'
  }),

  PAYMENT_COMPLETED: (paymentId: string, amount: number, userId: string) => triggerMakeScenario({
    event: 'payment.completed',
    paymentId,
    amount,
    userId,
    provider: 'stripe'
  }),

  EMAIL_CAMPAIGN: (campaignType: string, recipients: string[], content: any) => triggerMakeScenario({
    event: 'email.campaign',
    campaignType,
    recipients,
    content,
    scheduledAt: new Date().toISOString()
  }),

  DATA_EXPORT: (exportType: string, filters?: any) => triggerMakeScenario({
    event: 'data.export',
    exportType,
    filters,
    requestedAt: new Date().toISOString()
  }),

  USER_ACTIVITY: (userId: string, activity: string, metadata?: any) => triggerMakeScenario({
    event: 'user.activity',
    userId,
    activity,
    metadata,
    timestamp: new Date().toISOString()
  }),

  SUPPORT_TICKET: (ticketData: any) => triggerMakeScenario({
    event: 'support.ticket.created',
    ticket: ticketData,
    priority: ticketData.priority || 'normal',
    createdAt: new Date().toISOString()
  }),

  INVENTORY_UPDATE: (productId: string, quantity: number, action: 'increase' | 'decrease') => triggerMakeScenario({
    event: 'inventory.updated',
    productId,
    quantity,
    action,
    updatedAt: new Date().toISOString()
  }),

  NOTIFICATION_SEND: (userId: string, type: string, message: string, channels?: string[]) => triggerMakeScenario({
    event: 'notification.send',
    userId,
    type,
    message,
    channels: channels || ['email'],
    priority: 'normal'
  })
}

// Utility function to validate Make.com webhook response
export function validateMakeResponse(response: any): boolean {
  return (
    response &&
    typeof response === 'object' &&
    (response.success === true || response.status === 'success')
  )
}

// Function to format data for Make.com consumption
export function formatForMake(data: any): any {
  // Make.com often expects flat structures
  // This utility can help flatten nested objects if needed
  
  if (Array.isArray(data)) {
    return data.map(item => formatForMake(item))
  }
  
  if (data && typeof data === 'object') {
    const formatted: any = {}
    
    for (const [key, value] of Object.entries(data)) {
      // Convert dates to ISO strings
      if (value instanceof Date) {
        formatted[key] = value.toISOString()
      }
      // Convert undefined to null (Make.com handles null better)
      else if (value === undefined) {
        formatted[key] = null
      }
      // Keep other values as-is
      else {
        formatted[key] = value
      }
    }
    
    return formatted
  }
  
  return data
}