import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export async function POST(req: NextRequest) {
  try {
    // Verify webhook authentication (if configured)
    const authHeader = req.headers.get('authorization')
    if (process.env.N8N_WEBHOOK_AUTH) {
      if (authHeader !== `Bearer ${process.env.N8N_WEBHOOK_AUTH}`) {
        console.error('n8n webhook: Unauthorized request')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const data = await req.json()
    
    // Log webhook receipt
    console.log('Received n8n webhook:', {
      timestamp: new Date().toISOString(),
      headers: Object.fromEntries(req.headers.entries()),
      data: data
    })
    
    // Process webhook based on event type
    if (data.event) {
      await handleWebhookEvent(data)
    }
    
    return NextResponse.json({ 
      success: true,
      message: 'Webhook processed successfully',
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    console.error('Error processing n8n webhook:', error)
    return NextResponse.json(
      { 
        error: 'Failed to process webhook',
        message: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

// Handle GET requests (useful for webhook testing)
export async function GET(req: NextRequest) {
  return NextResponse.json({ 
    status: 'n8n webhook endpoint is active',
    timestamp: new Date().toISOString(),
    url: req.url
  })
}

async function handleWebhookEvent(data: any) {
  // Handle different types of events from n8n workflows
  switch (data.event) {
    case 'user.signup':
      await handleUserSignup(data)
      break
    
    case 'order.completed':
      await handleOrderCompleted(data)
      break
    
    case 'workflow.completed':
      await handleWorkflowCompleted(data)
      break
    
    case 'notification.send':
      await handleNotification(data)
      break
    
    default:
      console.log(`Unhandled n8n event type: ${data.event}`)
      // Store in database or forward to another service
  }
}

async function handleUserSignup(data: any) {
  console.log('Processing user signup from n8n:', data)
  // Example: Update user profile, send welcome email, etc.
}

async function handleOrderCompleted(data: any) {
  console.log('Processing order completion from n8n:', data)
  // Example: Update inventory, send confirmation, etc.
}

async function handleWorkflowCompleted(data: any) {
  console.log('n8n workflow completed:', data)
  // Example: Log completion, trigger next workflow, etc.
}

async function handleNotification(data: any) {
  console.log('Processing notification from n8n:', data)
  // Example: Send push notification, email, SMS, etc.
}