'use server'

import { triggerMakeScenario, MakeScenarios } from '@/lib/make'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export async function processFormSubmission(formData: FormData) {
  try {
    const data = {
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      message: formData.get('message') as string,
      company: formData.get('company') as string,
      phone: formData.get('phone') as string,
      formType: formData.get('formType') as string || 'contact',
      submittedAt: new Date().toISOString(),
    }

    // Validate required fields
    if (!data.email || !data.name) {
      return { 
        success: false, 
        error: 'Name and email are required' 
      }
    }

    // Trigger Make.com scenario for form submission
    const result = await MakeScenarios.FORM_SUBMISSION(data.formType, data)

    return { 
      success: true, 
      message: 'Form submitted successfully',
      executionId: result.executionId 
    }
  } catch (error: any) {
    console.error('Failed to process form submission:', error)
    return { 
      success: false, 
      error: 'Failed to process form submission' 
    }
  }
}

export async function handleUserRegistration(userId: string, email: string, userData?: any) {
  try {
    // Trigger Make.com scenario for user registration
    const result = await MakeScenarios.USER_REGISTRATION(userId, email, userData)

    return {
      success: true,
      message: 'User registration processed',
      executionId: result.executionId
    }
  } catch (error: any) {
    console.error('Failed to process user registration:', error)
    return {
      success: false,
      error: 'Failed to process user registration'
    }
  }
}

export async function handleOrderCreation(orderId: string, orderData: any) {
  try {
    // Trigger Make.com scenario for order creation
    const result = await MakeScenarios.ORDER_CREATED(orderId, orderData)

    return {
      success: true,
      message: 'Order creation processed',
      executionId: result.executionId
    }
  } catch (error: any) {
    console.error('Failed to process order creation:', error)
    return {
      success: false,
      error: 'Failed to process order creation'
    }
  }
}

export async function handlePaymentCompleted(paymentId: string, amount: number, userId: string) {
  try {
    // Trigger Make.com scenario for payment completion
    const result = await MakeScenarios.PAYMENT_COMPLETED(paymentId, amount, userId)

    return {
      success: true,
      message: 'Payment completion processed',
      executionId: result.executionId
    }
  } catch (error: any) {
    console.error('Failed to process payment completion:', error)
    return {
      success: false,
      error: 'Failed to process payment completion'
    }
  }
}

export async function triggerEmailCampaign(campaignType: string, recipients: string[], content: any) {
  try {
    const { userId } = await auth()
    if (!userId) {
      redirect('/sign-in')
    }

    // Trigger Make.com scenario for email campaign
    const result = await MakeScenarios.EMAIL_CAMPAIGN(campaignType, recipients, content)

    return {
      success: true,
      message: 'Email campaign triggered',
      executionId: result.executionId,
      campaignType,
      recipientCount: recipients.length
    }
  } catch (error: any) {
    console.error('Failed to trigger email campaign:', error)
    return {
      success: false,
      error: 'Failed to trigger email campaign'
    }
  }
}

export async function requestDataExport(exportType: string, filters?: any) {
  try {
    const { userId } = await auth()
    if (!userId) {
      redirect('/sign-in')
    }

    // Trigger Make.com scenario for data export
    const result = await MakeScenarios.DATA_EXPORT(exportType, filters)

    return {
      success: true,
      message: 'Data export requested',
      executionId: result.executionId,
      exportType
    }
  } catch (error: any) {
    console.error('Failed to request data export:', error)
    return {
      success: false,
      error: 'Failed to request data export'
    }
  }
}

export async function trackUserActivity(activity: string, metadata?: any) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return {
        success: false,
        error: 'User not authenticated'
      }
    }

    // Trigger Make.com scenario for user activity tracking
    const result = await MakeScenarios.USER_ACTIVITY(userId, activity, metadata)

    return {
      success: true,
      message: 'User activity tracked',
      executionId: result.executionId
    }
  } catch (error: any) {
    console.error('Failed to track user activity:', error)
    return {
      success: false,
      error: 'Failed to track user activity'
    }
  }
}

export async function createSupportTicket(ticketData: {
  subject: string
  description: string
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  category?: string
}) {
  try {
    const { userId } = await auth()
    if (!userId) {
      redirect('/sign-in')
    }

    const ticket = {
      ...ticketData,
      id: `ticket_${Date.now()}`,
      userId,
      status: 'open' as const,
      createdAt: new Date().toISOString()
    }

    // Trigger Make.com scenario for support ticket creation
    const result = await MakeScenarios.SUPPORT_TICKET(ticket)

    return {
      success: true,
      message: 'Support ticket created',
      executionId: result.executionId,
      ticketId: ticket.id
    }
  } catch (error: any) {
    console.error('Failed to create support ticket:', error)
    return {
      success: false,
      error: 'Failed to create support ticket'
    }
  }
}

export async function updateInventory(productId: string, quantity: number, action: 'increase' | 'decrease') {
  try {
    const { userId } = await auth()
    if (!userId) {
      redirect('/sign-in')
    }

    // Trigger Make.com scenario for inventory update
    const result = await MakeScenarios.INVENTORY_UPDATE(productId, quantity, action)

    return {
      success: true,
      message: 'Inventory updated',
      executionId: result.executionId,
      productId,
      quantity,
      action
    }
  } catch (error: any) {
    console.error('Failed to update inventory:', error)
    return {
      success: false,
      error: 'Failed to update inventory'
    }
  }
}

export async function sendNotification(
  userId: string, 
  type: string, 
  message: string, 
  channels?: string[]
) {
  try {
    // Trigger Make.com scenario for notification
    const result = await MakeScenarios.NOTIFICATION_SEND(userId, type, message, channels)

    return {
      success: true,
      message: 'Notification sent',
      executionId: result.executionId,
      channels: channels || ['email']
    }
  } catch (error: any) {
    console.error('Failed to send notification:', error)
    return {
      success: false,
      error: 'Failed to send notification'
    }
  }
}

// Custom Make.com scenario trigger
export async function triggerCustomScenario(event: string, data: any) {
  try {
    const result = await triggerMakeScenario({
      event,
      ...data,
      timestamp: new Date().toISOString(),
      source: 'nextjs-custom-action'
    })

    return {
      success: true,
      message: 'Custom scenario triggered',
      executionId: result.executionId,
      event
    }
  } catch (error: any) {
    console.error('Failed to trigger custom scenario:', error)
    return {
      success: false,
      error: 'Failed to trigger custom scenario'
    }
  }
}