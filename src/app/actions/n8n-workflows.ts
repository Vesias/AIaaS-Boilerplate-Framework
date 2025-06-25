'use server'

import { N8nWorkflows, triggerN8nWorkflow } from '@/lib/n8n'
import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'

export async function triggerUserSignupWorkflow(email: string) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return { success: false, error: 'User not authenticated' }
    }

    const result = await N8nWorkflows.USER_SIGNUP(userId, email)
    
    return { 
      success: true, 
      message: 'Signup workflow triggered successfully',
      data: result
    }
  } catch (error: any) {
    console.error('Failed to trigger signup workflow:', error)
    return { 
      success: false, 
      error: error.message || 'Failed to trigger signup workflow' 
    }
  }
}

export async function triggerOrderWorkflow(orderId: string, amount: number) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return { success: false, error: 'User not authenticated' }
    }

    const result = await N8nWorkflows.ORDER_CREATED(orderId, userId, amount)
    
    return { 
      success: true, 
      message: 'Order workflow triggered successfully',
      data: result
    }
  } catch (error: any) {
    console.error('Failed to trigger order workflow:', error)
    return { 
      success: false, 
      error: error.message || 'Failed to trigger order workflow' 
    }
  }
}

export async function triggerPaymentSuccessWorkflow(paymentId: string, amount: number) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return { success: false, error: 'User not authenticated' }
    }

    const result = await N8nWorkflows.PAYMENT_SUCCESSFUL(paymentId, amount, userId)
    
    // Revalidate relevant pages after payment
    revalidatePath('/dashboard')
    revalidatePath('/profile')
    
    return { 
      success: true, 
      message: 'Payment success workflow triggered successfully',
      data: result
    }
  } catch (error: any) {
    console.error('Failed to trigger payment workflow:', error)
    return { 
      success: false, 
      error: error.message || 'Failed to trigger payment workflow' 
    }
  }
}

export async function triggerUserActivityWorkflow(action: string, metadata?: any) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return { success: false, error: 'User not authenticated' }
    }

    const result = await N8nWorkflows.USER_ACTIVITY(userId, action, metadata)
    
    return { 
      success: true, 
      message: 'User activity workflow triggered successfully',
      data: result
    }
  } catch (error: any) {
    console.error('Failed to trigger user activity workflow:', error)
    return { 
      success: false, 
      error: error.message || 'Failed to trigger user activity workflow' 
    }
  }
}

export async function sendNotificationWorkflow(
  type: string, 
  message: string, 
  channels: string[] = ['email']
) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return { success: false, error: 'User not authenticated' }
    }

    const result = await N8nWorkflows.SEND_NOTIFICATION(userId, type, message, channels)
    
    return { 
      success: true, 
      message: 'Notification workflow triggered successfully',
      data: result
    }
  } catch (error: any) {
    console.error('Failed to trigger notification workflow:', error)
    return { 
      success: false, 
      error: error.message || 'Failed to trigger notification workflow' 
    }
  }
}

export async function triggerCustomWorkflow(payload: any) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return { success: false, error: 'User not authenticated' }
    }

    // Add user context to custom payload
    const enrichedPayload = {
      ...payload,
      userId,
      timestamp: new Date().toISOString(),
      source: 'server-action'
    }

    const result = await triggerN8nWorkflow(enrichedPayload)
    
    return { 
      success: true, 
      message: 'Custom workflow triggered successfully',
      data: result
    }
  } catch (error: any) {
    console.error('Failed to trigger custom workflow:', error)
    return { 
      success: false, 
      error: error.message || 'Failed to trigger custom workflow' 
    }
  }
}