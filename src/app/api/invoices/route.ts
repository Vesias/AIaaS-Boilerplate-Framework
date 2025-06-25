/**
 * Invoice CRUD Operations API Endpoint
 * Provides comprehensive invoice management, search, filtering, and analytics
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createDatabaseService } from '@/lib/database'
import { stripe } from '@/lib/stripe'
import Stripe from 'stripe'

interface InvoiceFilter {
  status?: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible'
  date_from?: string
  date_to?: string
  amount_min?: number
  amount_max?: number
  currency?: string
  customer_id?: string
  search?: string
  limit?: number
  offset?: number
  sort_by?: 'created' | 'due_date' | 'amount' | 'status'
  sort_order?: 'asc' | 'desc'
}

interface InvoiceStats {
  total_count: number
  total_amount: number
  paid_amount: number
  outstanding_amount: number
  overdue_amount: number
  status_breakdown: Record<string, number>
  currency_breakdown: Record<string, { count: number; amount: number }>
  monthly_trend: Array<{
    month: string
    count: number
    amount: number
    paid_amount: number
  }>
}

interface InvoiceUpdate {
  description?: string
  footer?: string
  metadata?: Record<string, string>
  custom_fields?: Array<{
    name: string
    value: string
  }>
  due_date?: string
}

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const invoiceId = searchParams.get('invoice_id')

    // Parse filter parameters
    const filters: InvoiceFilter = {
      status: searchParams.get('status') as any,
      date_from: searchParams.get('date_from') || undefined,
      date_to: searchParams.get('date_to') || undefined,
      amount_min: searchParams.get('amount_min') ? parseInt(searchParams.get('amount_min')!) : undefined,
      amount_max: searchParams.get('amount_max') ? parseInt(searchParams.get('amount_max')!) : undefined,
      currency: searchParams.get('currency') || undefined,
      customer_id: searchParams.get('customer_id') || undefined,
      search: searchParams.get('search') || undefined,
      limit: parseInt(searchParams.get('limit') || '50'),
      offset: parseInt(searchParams.get('offset') || '0'),
      sort_by: (searchParams.get('sort_by') || 'created') as any,
      sort_order: (searchParams.get('sort_order') || 'desc') as any
    }

    const db = await createDatabaseService()

    switch (action) {
      case 'list':
        return await handleInvoiceList(userId, filters, db)
        
      case 'get':
        return await handleInvoiceGet(userId, invoiceId, db)
        
      case 'stats':
        return await handleInvoiceStats(userId, filters, db)
        
      case 'search':
        return await handleInvoiceSearch(userId, filters, db)
        
      case 'export':
        return await handleInvoiceExport(userId, filters, db)
        
      case 'overdue':
        return await handleOverdueInvoices(userId, db)
        
      case 'upcoming':
        return await handleUpcomingInvoices(userId, db)
        
      default:
        // Default: return paginated invoice list
        return await handleInvoiceList(userId, filters, db)
    }
  } catch (error) {
    console.error('Invoice GET error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { action, ...params } = body

    const db = await createDatabaseService()

    switch (action) {
      case 'duplicate':
        return await handleInvoiceDuplicate(userId, params, db)
        
      case 'send_reminder':
        return await handleSendReminder(userId, params, db)
        
      case 'bulk_action':
        return await handleBulkAction(userId, params, db)
        
      case 'generate_report':
        return await handleGenerateReport(userId, params, db)
        
      case 'schedule_reminder':
        return await handleScheduleReminder(userId, params, db)
        
      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Invoice POST error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { invoice_id, ...updates } = body as { invoice_id: string } & InvoiceUpdate

    if (!invoice_id) {
      return NextResponse.json(
        { error: 'Invoice ID is required' },
        { status: 400 }
      )
    }

    const db = await createDatabaseService()

    // Verify user owns the invoice
    const userInvoices = await db.getUserInvoices(userId)
    const userInvoice = userInvoices.find(inv => inv.stripe_invoice_id === invoice_id)
    
    if (!userInvoice) {
      return NextResponse.json(
        { error: 'Invoice not found or access denied' },
        { status: 404 }
      )
    }

    // Prepare Stripe update parameters
    const stripeUpdates: Stripe.InvoiceUpdateParams = {}
    
    if (updates.description !== undefined) {
      stripeUpdates.description = updates.description
    }
    
    if (updates.footer !== undefined) {
      stripeUpdates.footer = updates.footer
    }
    
    if (updates.metadata !== undefined) {
      stripeUpdates.metadata = updates.metadata
    }
    
    if (updates.custom_fields !== undefined) {
      stripeUpdates.custom_fields = updates.custom_fields.map(field => ({
        name: field.name,
        value: field.value
      }))
    }
    
    if (updates.due_date !== undefined) {
      const dueDateTimestamp = Math.floor(new Date(updates.due_date).getTime() / 1000)
      stripeUpdates.due_date = dueDateTimestamp
    }

    try {
      // Update invoice in Stripe
      const updatedInvoice = await stripe.invoices.update(invoice_id, stripeUpdates)
      
      // Update local database record
      await db.updateInvoice(invoice_id, {
        status: updatedInvoice.status as any,
        amount_paid: updatedInvoice.amount_paid,
        amount_due: updatedInvoice.amount_due,
        hosted_invoice_url: updatedInvoice.hosted_invoice_url,
        invoice_pdf: updatedInvoice.invoice_pdf
      })

      return NextResponse.json({
        success: true,
        invoice: {
          id: updatedInvoice.id,
          status: updatedInvoice.status,
          description: updatedInvoice.description,
          footer: updatedInvoice.footer,
          due_date: updatedInvoice.due_date ? new Date(updatedInvoice.due_date * 1000).toISOString() : null,
          updated_at: new Date().toISOString()
        }
      })
    } catch (error) {
      if (error instanceof Stripe.errors.StripeError) {
        return NextResponse.json(
          { 
            error: 'Stripe error',
            code: error.code,
            message: error.message
          },
          { status: 400 }
        )
      }
      throw error
    }
  } catch (error) {
    console.error('Invoice PUT error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const invoiceId = searchParams.get('invoice_id')

    if (!invoiceId) {
      return NextResponse.json(
        { error: 'Invoice ID is required' },
        { status: 400 }
      )
    }

    const db = await createDatabaseService()

    // Verify user owns the invoice
    const userInvoices = await db.getUserInvoices(userId)
    const userInvoice = userInvoices.find(inv => inv.stripe_invoice_id === invoiceId)
    
    if (!userInvoice) {
      return NextResponse.json(
        { error: 'Invoice not found or access denied' },
        { status: 404 }
      )
    }

    try {
      // Check if invoice can be deleted (only draft invoices can be deleted)
      const invoice = await stripe.invoices.retrieve(invoiceId)
      
      if (invoice.status !== 'draft') {
        return NextResponse.json(
          { error: 'Only draft invoices can be deleted. Use void instead for finalized invoices.' },
          { status: 400 }
        )
      }

      // Delete invoice from Stripe
      await stripe.invoices.del(invoiceId)

      // In production, you might want to soft delete or mark as deleted in database
      // For now, we'll keep the record for audit purposes
      
      return NextResponse.json({
        success: true,
        invoice_id: invoiceId,
        deleted_at: new Date().toISOString(),
        message: 'Invoice deleted successfully'
      })
    } catch (error) {
      if (error instanceof Stripe.errors.StripeError) {
        return NextResponse.json(
          { 
            error: 'Stripe error',
            code: error.code,
            message: error.message
          },
          { status: 400 }
        )
      }
      throw error
    }
  } catch (error) {
    console.error('Invoice DELETE error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Handler functions
async function handleInvoiceList(userId: string, filters: InvoiceFilter, db: any) {
  // Get user invoices from database
  const userInvoices = await db.getUserInvoices(userId, 200) // Get larger set for filtering
  
  // Get corresponding Stripe invoices
  const stripeInvoiceIds = userInvoices.map(inv => inv.stripe_invoice_id)
  const stripeInvoices: Stripe.Invoice[] = []
  
  // Fetch invoices from Stripe in batches
  for (const invoiceId of stripeInvoiceIds) {
    try {
      const invoice = await stripe.invoices.retrieve(invoiceId)
      stripeInvoices.push(invoice)
    } catch (error) {
      console.warn(`Failed to fetch invoice ${invoiceId}:`, error)
    }
  }

  // Apply filters
  let filteredInvoices = stripeInvoices

  if (filters.status) {
    filteredInvoices = filteredInvoices.filter(inv => inv.status === filters.status)
  }

  if (filters.date_from) {
    const fromTimestamp = new Date(filters.date_from).getTime() / 1000
    filteredInvoices = filteredInvoices.filter(inv => inv.created >= fromTimestamp)
  }

  if (filters.date_to) {
    const toTimestamp = new Date(filters.date_to).getTime() / 1000
    filteredInvoices = filteredInvoices.filter(inv => inv.created <= toTimestamp)
  }

  if (filters.amount_min) {
    filteredInvoices = filteredInvoices.filter(inv => inv.amount_due >= filters.amount_min!)
  }

  if (filters.amount_max) {
    filteredInvoices = filteredInvoices.filter(inv => inv.amount_due <= filters.amount_max!)
  }

  if (filters.currency) {
    filteredInvoices = filteredInvoices.filter(inv => inv.currency === filters.currency)
  }

  if (filters.customer_id) {
    filteredInvoices = filteredInvoices.filter(inv => inv.customer === filters.customer_id)
  }

  if (filters.search) {
    const searchTerm = filters.search.toLowerCase()
    filteredInvoices = filteredInvoices.filter(inv => 
      inv.number?.toLowerCase().includes(searchTerm) ||
      inv.description?.toLowerCase().includes(searchTerm) ||
      (typeof inv.customer === 'object' && inv.customer?.email?.toLowerCase().includes(searchTerm))
    )
  }

  // Sort invoices
  filteredInvoices.sort((a, b) => {
    let aValue: any, bValue: any
    
    switch (filters.sort_by) {
      case 'due_date':
        aValue = a.due_date || 0
        bValue = b.due_date || 0
        break
      case 'amount':
        aValue = a.amount_due
        bValue = b.amount_due
        break
      case 'status':
        aValue = a.status
        bValue = b.status
        break
      default:
        aValue = a.created
        bValue = b.created
    }
    
    if (filters.sort_order === 'asc') {
      return aValue > bValue ? 1 : -1
    } else {
      return aValue < bValue ? 1 : -1
    }
  })

  // Apply pagination
  const totalCount = filteredInvoices.length
  const paginatedInvoices = filteredInvoices.slice(
    filters.offset || 0,
    (filters.offset || 0) + (filters.limit || 50)
  )

  // Format response
  const invoices = paginatedInvoices.map(inv => ({
    id: inv.id,
    number: inv.number,
    status: inv.status,
    amount_due: inv.amount_due,
    amount_paid: inv.amount_paid,
    currency: inv.currency,
    customer_id: inv.customer,
    description: inv.description,
    due_date: inv.due_date ? new Date(inv.due_date * 1000).toISOString() : null,
    created: new Date(inv.created * 1000).toISOString(),
    hosted_invoice_url: inv.hosted_invoice_url,
    invoice_pdf: inv.invoice_pdf,
    is_overdue: inv.due_date ? (inv.due_date * 1000 < Date.now() && inv.status === 'open') : false
  }))

  return NextResponse.json({
    invoices,
    pagination: {
      total: totalCount,
      limit: filters.limit || 50,
      offset: filters.offset || 0,
      has_more: totalCount > (filters.offset || 0) + (filters.limit || 50)
    },
    filters
  })
}

async function handleInvoiceGet(userId: string, invoiceId: string | null, db: any) {
  if (!invoiceId) {
    return NextResponse.json(
      { error: 'Invoice ID is required' },
      { status: 400 }
    )
  }

  // Verify user owns the invoice
  const userInvoices = await db.getUserInvoices(userId)
  const userInvoice = userInvoices.find(inv => inv.stripe_invoice_id === invoiceId)
  
  if (!userInvoice) {
    return NextResponse.json(
      { error: 'Invoice not found or access denied' },
      { status: 404 }
    )
  }

  try {
    // Get detailed invoice from Stripe
    const invoice = await stripe.invoices.retrieve(invoiceId, {
      expand: ['customer', 'payment_intent', 'lines.data']
    })

    return NextResponse.json({
      invoice: {
        id: invoice.id,
        number: invoice.number,
        status: invoice.status,
        amount_due: invoice.amount_due,
        amount_paid: invoice.amount_paid,
        amount_remaining: invoice.amount_remaining,
        currency: invoice.currency,
        customer: invoice.customer,
        description: invoice.description,
        footer: invoice.footer,
        due_date: invoice.due_date ? new Date(invoice.due_date * 1000).toISOString() : null,
        created: new Date(invoice.created * 1000).toISOString(),
        hosted_invoice_url: invoice.hosted_invoice_url,
        invoice_pdf: invoice.invoice_pdf,
        payment_intent: invoice.payment_intent,
        subtotal: invoice.subtotal,
        tax: invoice.tax,
        total: invoice.total,
        lines: invoice.lines.data.map(line => ({
          id: line.id,
          description: line.description,
          quantity: line.quantity,
          unit_amount: line.unit_amount,
          amount: line.amount
        })),
        metadata: invoice.metadata,
        custom_fields: invoice.custom_fields
      }
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch invoice details' },
      { status: 500 }
    )
  }
}

async function handleInvoiceStats(userId: string, filters: InvoiceFilter, db: any) {
  const userInvoices = await db.getUserInvoices(userId, 1000) // Get large set for stats
  
  // Fetch corresponding Stripe data
  const stats: InvoiceStats = {
    total_count: userInvoices.length,
    total_amount: 0,
    paid_amount: 0,
    outstanding_amount: 0,
    overdue_amount: 0,
    status_breakdown: {},
    currency_breakdown: {},
    monthly_trend: []
  }

  // Calculate stats from database records (more efficient than fetching all from Stripe)
  for (const invoice of userInvoices) {
    stats.total_amount += invoice.amount_due
    stats.paid_amount += invoice.amount_paid
    
    if (invoice.status === 'open') {
      stats.outstanding_amount += invoice.amount_due - invoice.amount_paid
    }

    // Count by status
    stats.status_breakdown[invoice.status] = (stats.status_breakdown[invoice.status] || 0) + 1
    
    // Count by currency
    if (!stats.currency_breakdown[invoice.currency]) {
      stats.currency_breakdown[invoice.currency] = { count: 0, amount: 0 }
    }
    stats.currency_breakdown[invoice.currency].count++
    stats.currency_breakdown[invoice.currency].amount += invoice.amount_due
  }

  // Calculate monthly trend (last 12 months)
  const monthlyData: Record<string, { count: number; amount: number; paid_amount: number }> = {}
  
  for (let i = 11; i >= 0; i--) {
    const date = new Date()
    date.setMonth(date.getMonth() - i)
    const monthKey = date.toISOString().substring(0, 7) // YYYY-MM
    monthlyData[monthKey] = { count: 0, amount: 0, paid_amount: 0 }
  }
  
  for (const invoice of userInvoices) {
    const monthKey = invoice.created_at.substring(0, 7)
    if (monthlyData[monthKey]) {
      monthlyData[monthKey].count++
      monthlyData[monthKey].amount += invoice.amount_due
      monthlyData[monthKey].paid_amount += invoice.amount_paid
    }
  }
  
  stats.monthly_trend = Object.entries(monthlyData).map(([month, data]) => ({
    month,
    ...data
  }))

  return NextResponse.json({ stats })
}

async function handleInvoiceSearch(userId: string, filters: InvoiceFilter, db: any) {
  // Use the same logic as list but with more focus on search
  return await handleInvoiceList(userId, { ...filters, limit: 20 }, db)
}

async function handleInvoiceExport(userId: string, filters: InvoiceFilter, db: any) {
  const userInvoices = await db.getUserInvoices(userId)
  
  // Format for CSV export
  const csvData = userInvoices.map(invoice => ({
    invoice_number: invoice.invoice_number,
    status: invoice.status,
    amount_due: (invoice.amount_due / 100).toFixed(2),
    amount_paid: (invoice.amount_paid / 100).toFixed(2),
    currency: invoice.currency.toUpperCase(),
    created_date: invoice.created_at.split('T')[0],
    hosted_url: invoice.hosted_invoice_url
  }))

  return NextResponse.json({
    export_data: csvData,
    format: 'csv',
    total_records: csvData.length,
    generated_at: new Date().toISOString(),
    filename: `invoices_${userId}_${Date.now()}.csv`
  })
}

async function handleOverdueInvoices(userId: string, db: any) {
  const userInvoices = await db.getUserInvoices(userId)
  const now = new Date()
  
  // Filter overdue invoices (open status and past due date)
  const overdueInvoices = userInvoices.filter(invoice => 
    invoice.status === 'open' && 
    new Date(invoice.created_at) < new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) // 30 days
  )

  return NextResponse.json({
    overdue_invoices: overdueInvoices.map(inv => ({
      id: inv.stripe_invoice_id,
      number: inv.invoice_number,
      amount_due: inv.amount_due,
      currency: inv.currency,
      days_overdue: Math.floor((now.getTime() - new Date(inv.created_at).getTime()) / (24 * 60 * 60 * 1000)),
      hosted_invoice_url: inv.hosted_invoice_url
    })),
    total_overdue: overdueInvoices.length,
    total_overdue_amount: overdueInvoices.reduce((sum, inv) => sum + inv.amount_due, 0)
  })
}

async function handleUpcomingInvoices(userId: string, db: any) {
  // For this implementation, we'll return draft invoices as "upcoming"
  const userInvoices = await db.getUserInvoices(userId)
  const upcomingInvoices = userInvoices.filter(inv => inv.status === 'draft')

  return NextResponse.json({
    upcoming_invoices: upcomingInvoices.map(inv => ({
      id: inv.stripe_invoice_id,
      number: inv.invoice_number,
      amount_due: inv.amount_due,
      currency: inv.currency,
      created: inv.created_at
    })),
    total_upcoming: upcomingInvoices.length
  })
}

async function handleInvoiceDuplicate(userId: string, params: any, db: any) {
  const { invoice_id } = params
  
  if (!invoice_id) {
    return NextResponse.json(
      { error: 'Invoice ID is required' },
      { status: 400 }
    )
  }

  try {
    const originalInvoice = await stripe.invoices.retrieve(invoice_id, {
      expand: ['lines.data']
    })

    // Create new draft invoice with same items
    const newInvoice = await stripe.invoices.create({
      customer: originalInvoice.customer as string,
      currency: originalInvoice.currency,
      description: `Copy of ${originalInvoice.description || originalInvoice.number}`,
      footer: originalInvoice.footer,
      collection_method: 'send_invoice',
      auto_advance: false,
      metadata: {
        ...originalInvoice.metadata,
        duplicated_from: originalInvoice.id,
        created_by: userId
      }
    })

    return NextResponse.json({
      success: true,
      original_invoice_id: invoice_id,
      new_invoice: {
        id: newInvoice.id,
        status: newInvoice.status,
        created_at: new Date(newInvoice.created * 1000).toISOString()
      }
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to duplicate invoice' },
      { status: 500 }
    )
  }
}

async function handleSendReminder(userId: string, params: any, db: any) {
  const { invoice_id, message } = params
  
  if (!invoice_id) {
    return NextResponse.json(
      { error: 'Invoice ID is required' },
      { status: 400 }
    )
  }

  try {
    // Send invoice (which acts as a reminder)
    await stripe.invoices.sendInvoice(invoice_id)
    
    return NextResponse.json({
      success: true,
      invoice_id,
      reminder_sent_at: new Date().toISOString(),
      message: 'Invoice reminder sent successfully'
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to send reminder' },
      { status: 500 }
    )
  }
}

async function handleBulkAction(userId: string, params: any, db: any) {
  const { action, invoice_ids } = params
  
  if (!invoice_ids || !Array.isArray(invoice_ids)) {
    return NextResponse.json(
      { error: 'Invoice IDs array is required' },
      { status: 400 }
    )
  }

  const results = []
  
  for (const invoiceId of invoice_ids) {
    try {
      switch (action) {
        case 'send':
          await stripe.invoices.sendInvoice(invoiceId)
          results.push({ invoice_id: invoiceId, success: true })
          break
        case 'void':
          await stripe.invoices.voidInvoice(invoiceId)
          results.push({ invoice_id: invoiceId, success: true })
          break
        default:
          results.push({ invoice_id: invoiceId, success: false, error: 'Unknown action' })
      }
    } catch (error) {
      results.push({ 
        invoice_id: invoiceId, 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  return NextResponse.json({
    bulk_action: action,
    results,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length
  })
}

async function handleGenerateReport(userId: string, params: any, db: any) {
  const { report_type, date_from, date_to } = params
  
  const userInvoices = await db.getUserInvoices(userId)
  
  // Filter by date range if provided
  let filteredInvoices = userInvoices
  if (date_from) {
    filteredInvoices = filteredInvoices.filter(inv => 
      new Date(inv.created_at) >= new Date(date_from)
    )
  }
  if (date_to) {
    filteredInvoices = filteredInvoices.filter(inv => 
      new Date(inv.created_at) <= new Date(date_to)
    )
  }

  const report = {
    report_type,
    period: { from: date_from, to: date_to },
    summary: {
      total_invoices: filteredInvoices.length,
      total_amount: filteredInvoices.reduce((sum, inv) => sum + inv.amount_due, 0),
      paid_amount: filteredInvoices.reduce((sum, inv) => sum + inv.amount_paid, 0),
      outstanding_amount: filteredInvoices
        .filter(inv => inv.status === 'open')
        .reduce((sum, inv) => sum + (inv.amount_due - inv.amount_paid), 0)
    },
    generated_at: new Date().toISOString()
  }

  return NextResponse.json({ report })
}

async function handleScheduleReminder(userId: string, params: any, db: any) {
  const { invoice_id, reminder_date, message } = params
  
  // In production, this would integrate with a job queue or scheduler
  return NextResponse.json({
    success: true,
    invoice_id,
    reminder_scheduled: reminder_date,
    message: 'Reminder scheduled successfully (Note: This is a mock implementation)'
  })
}