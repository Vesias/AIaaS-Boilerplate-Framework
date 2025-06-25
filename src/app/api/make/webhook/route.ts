import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import crypto from 'crypto'

interface MakeWebhookPayload {
  event?: string
  scenario_id?: string
  execution_id?: string
  timestamp?: string
  data?: any
  [key: string]: any
}

// Verify webhook signature (if configured in Make.com)
function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  try {
    const hmac = crypto.createHmac('sha256', secret)
    hmac.update(payload)
    const calculatedSignature = `sha256=${hmac.digest('hex')}`
    return crypto.timingSafeEqual(
      Buffer.from(calculatedSignature),
      Buffer.from(signature)
    )
  } catch (error) {
    console.error('Error verifying webhook signature:', error)
    return false
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const data: MakeWebhookPayload = JSON.parse(body)
    
    // Verify webhook token (basic authentication)
    const token = req.headers.get('x-webhook-token')
    if (process.env.MAKE_WEBHOOK_TOKEN && token !== process.env.MAKE_WEBHOOK_TOKEN) {
      console.error('Make.com webhook: Invalid token')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Optional: Verify webhook signature for enhanced security
    const signature = req.headers.get('x-make-signature')
    if (signature && process.env.MAKE_WEBHOOK_SECRET) {
      const isValid = verifyWebhookSignature(
        body,
        signature,
        process.env.MAKE_WEBHOOK_SECRET
      )
      
      if (!isValid) {
        console.error('Make.com webhook: Invalid signature')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }
    
    // Log webhook receipt
    console.log('Received Make.com webhook:', {
      scenario_id: data.scenario_id,
      execution_id: data.execution_id,
      event: data.event,
      timestamp: new Date().toISOString()
    })
    
    // Process webhook based on event type
    if (data.event) {
      await handleMakeWebhookEvent(data)
    }
    
    // Return success response (Make.com expects JSON)
    return NextResponse.json({
      success: true,
      message: 'Webhook processed successfully',
      receivedAt: new Date().toISOString(),
      execution_id: data.execution_id
    })
  } catch (error: any) {
    console.error('Error processing Make.com webhook:', error)
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

// Handle GET requests for webhook testing and verification
export async function GET(req: NextRequest) {
  try {
    // Handle Make.com webhook verification challenge
    const challenge = req.nextUrl.searchParams.get('challenge')
    
    if (challenge) {
      // Echo back the challenge for webhook verification
      return new NextResponse(challenge, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      })
    }
    
    // Standard endpoint info
    return NextResponse.json({
      status: 'Make.com webhook endpoint is active',
      timestamp: new Date().toISOString(),
      endpoint: req.url
    })
  } catch (error) {
    console.error('Error handling GET request:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function handleMakeWebhookEvent(data: MakeWebhookPayload) {
  // Handle different types of events from Make.com scenarios
  try {
    switch (data.event) {
      case 'form.submitted':
        await handleFormSubmission(data)
        break
      
      case 'user.created':
        await handleUserCreated(data)
        break
      
      case 'order.processed':
        await handleOrderProcessed(data)
        break
      
      case 'email.sent':
        await handleEmailSent(data)
        break
      
      case 'data.sync':
        await handleDataSync(data)
        break
      
      case 'notification.delivered':
        await handleNotificationDelivered(data)
        break
      
      default:
        console.log(`Unhandled Make.com event type: ${data.event}`)
        // Store unknown events for debugging
        await logUnknownEvent(data)
    }
  } catch (error) {
    console.error(`Error handling Make.com event ${data.event}:`, error)
    throw error
  }
}

async function handleFormSubmission(data: MakeWebhookPayload) {
  console.log('Processing form submission from Make.com:', data)
  // Example: Save to database, send confirmation email, etc.
  
  // You could trigger other workflows or update user records here
}

async function handleUserCreated(data: MakeWebhookPayload) {
  console.log('Processing user creation from Make.com:', data)
  // Example: Set up user profile, send welcome email, etc.
}

async function handleOrderProcessed(data: MakeWebhookPayload) {
  console.log('Processing order from Make.com:', data)
  // Example: Update inventory, send confirmation, create invoice, etc.
}

async function handleEmailSent(data: MakeWebhookPayload) {
  console.log('Email sent notification from Make.com:', data)
  // Example: Update email status, track delivery, etc.
}

async function handleDataSync(data: MakeWebhookPayload) {
  console.log('Data sync completed from Make.com:', data)
  // Example: Update local cache, trigger UI refresh, etc.
}

async function handleNotificationDelivered(data: MakeWebhookPayload) {
  console.log('Notification delivered via Make.com:', data)
  // Example: Update notification status, log delivery, etc.
}

async function logUnknownEvent(data: MakeWebhookPayload) {
  console.log('Unknown Make.com event received:', {
    event: data.event,
    scenario_id: data.scenario_id,
    execution_id: data.execution_id,
    data: data
  })
  
  // In production, you might want to store this in a database
  // for analysis and debugging
}