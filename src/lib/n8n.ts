interface N8nWebhookPayload {
  event?: string
  [key: string]: any
}

interface N8nResponse {
  success?: boolean
  workflowId?: string
  executionId?: string
  data?: any
  error?: string
}

export async function triggerN8nWorkflow(payload: N8nWebhookPayload): Promise<N8nResponse> {
  if (!process.env.N8N_WEBHOOK_URL) {
    throw new Error('N8N_WEBHOOK_URL is not configured')
  }

  try {
    const response = await fetch(process.env.N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.N8N_API_KEY && {
          'Authorization': `Bearer ${process.env.N8N_API_KEY}`
        })
      },
      body: JSON.stringify({
        ...payload,
        timestamp: new Date().toISOString(),
        source: 'nextjs-app'
      }),
    })

    if (!response.ok) {
      throw new Error(`n8n webhook failed: ${response.status} ${response.statusText}`)
    }

    // Some webhooks might not return JSON
    const contentType = response.headers.get('content-type')
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json()
      return data
    } else {
      const text = await response.text()
      return { success: true, data: text }
    }
  } catch (error: any) {
    console.error('Error triggering n8n workflow:', error)
    throw new Error(`Failed to trigger n8n workflow: ${error.message}`)
  }
}

export async function getN8nWorkflows() {
  if (!process.env.N8N_INSTANCE_URL || !process.env.N8N_API_KEY) {
    throw new Error('n8n API configuration missing (N8N_INSTANCE_URL or N8N_API_KEY)')
  }

  try {
    const response = await fetch(`${process.env.N8N_INSTANCE_URL}/api/v1/workflows`, {
      headers: {
        'X-N8N-API-KEY': process.env.N8N_API_KEY,
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch workflows: ${response.status} ${response.statusText}`)
    }

    return response.json()
  } catch (error: any) {
    console.error('Error fetching n8n workflows:', error)
    throw error
  }
}

export async function executeN8nWorkflow(workflowId: string, data?: any) {
  if (!process.env.N8N_INSTANCE_URL || !process.env.N8N_API_KEY) {
    throw new Error('n8n API configuration missing')
  }

  try {
    const response = await fetch(
      `${process.env.N8N_INSTANCE_URL}/api/v1/workflows/${workflowId}/execute`,
      {
        method: 'POST',
        headers: {
          'X-N8N-API-KEY': process.env.N8N_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: data || {} }),
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to execute workflow: ${response.status} ${response.statusText}`)
    }

    return response.json()
  } catch (error: any) {
    console.error('Error executing n8n workflow:', error)
    throw error
  }
}

// Predefined workflow triggers for common events
export const N8nWorkflows = {
  USER_SIGNUP: (userId: string, email: string) => triggerN8nWorkflow({
    event: 'user.signup',
    userId,
    email,
    platform: 'web'
  }),

  ORDER_CREATED: (orderId: string, userId: string, amount: number) => triggerN8nWorkflow({
    event: 'order.created',
    orderId,
    userId,
    amount,
    currency: 'EUR'
  }),

  PAYMENT_SUCCESSFUL: (paymentId: string, amount: number, userId: string) => triggerN8nWorkflow({
    event: 'payment.successful',
    paymentId,
    amount,
    userId,
    provider: 'stripe'
  }),

  USER_ACTIVITY: (userId: string, action: string, metadata?: any) => triggerN8nWorkflow({
    event: 'user.activity',
    userId,
    action,
    metadata,
    timestamp: new Date().toISOString()
  }),

  SEND_NOTIFICATION: (userId: string, type: string, message: string, channels?: string[]) => triggerN8nWorkflow({
    event: 'notification.send',
    userId,
    type,
    message,
    channels: channels || ['email']
  })
}