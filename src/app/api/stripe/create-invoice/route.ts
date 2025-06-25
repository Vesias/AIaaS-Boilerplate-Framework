/**
 * Stripe Custom Invoice Generation API Endpoint
 * Provides comprehensive invoice creation, customization, and management for European VAT compliance
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createDatabaseService } from '@/lib/database'
import { stripe } from '@/lib/stripe'
import Stripe from 'stripe'

interface CustomInvoiceItem {
  description: string
  quantity: number
  unit_amount: number // in cents
  tax_rate?: string
  metadata?: Record<string, string>
}

interface CustomInvoiceRequest {
  customer_id?: string
  customer_email?: string
  items: CustomInvoiceItem[]
  currency?: string
  due_date?: string
  auto_advance?: boolean
  collection_method?: 'send_invoice' | 'charge_automatically'
  payment_settings?: {
    payment_method_types?: string[]
    default_payment_method?: string
  }
  footer?: string
  description?: string
  statement_descriptor?: string
  metadata?: Record<string, string>
  discount?: {
    coupon?: string
    promotion_code?: string
    percent_off?: number
    amount_off?: number
  }
  vat_settings?: {
    customer_location?: string
    business_type?: 'b2b' | 'b2c'
    vat_number?: string
    reverse_charge?: boolean
  }
  custom_fields?: Array<{
    name: string
    value: string
  }>
}

interface InvoiceTemplate {
  id: string
  name: string
  description: string
  template_type: 'service' | 'product' | 'subscription' | 'one_time'
  default_items: CustomInvoiceItem[]
  default_settings: Partial<CustomInvoiceRequest>
  created_at: string
}

// Predefined invoice templates
const INVOICE_TEMPLATES: InvoiceTemplate[] = [
  {
    id: 'saas_monthly',
    name: 'SaaS Monthly Subscription',
    description: 'Standard monthly SaaS subscription invoice',
    template_type: 'subscription',
    default_items: [
      {
        description: 'Roomicor Pro Plan - Monthly Subscription',
        quantity: 1,
        unit_amount: 2999, // €29.99
        metadata: {
          plan_type: 'pro',
          billing_period: 'monthly'
        }
      }
    ],
    default_settings: {
      currency: 'eur',
      collection_method: 'charge_automatically',
      auto_advance: true,
      payment_settings: {
        payment_method_types: ['card', 'sepa_debit']
      },
      statement_descriptor: 'ROOMICOR PRO'
    },
    created_at: new Date().toISOString()
  },
  {
    id: 'consulting_service',
    name: 'Consulting Services',
    description: 'Professional consulting services invoice',
    template_type: 'service',
    default_items: [
      {
        description: 'Automation Consulting Services',
        quantity: 1,
        unit_amount: 15000, // €150.00 per hour
        metadata: {
          service_type: 'consulting',
          rate_type: 'hourly'
        }
      }
    ],
    default_settings: {
      currency: 'eur',
      collection_method: 'send_invoice',
      auto_advance: false,
      payment_settings: {
        payment_method_types: ['card', 'sepa_debit', 'bancontact']
      },
      footer: 'Payment due within 30 days. Thank you for your business!'
    },
    created_at: new Date().toISOString()
  },
  {
    id: 'setup_fee',
    name: 'One-time Setup Fee',
    description: 'Initial setup and onboarding fee',
    template_type: 'one_time',
    default_items: [
      {
        description: 'Platform Setup and Configuration',
        quantity: 1,
        unit_amount: 49900, // €499.00
        metadata: {
          service_type: 'setup',
          one_time: 'true'
        }
      },
      {
        description: 'Data Migration Service',
        quantity: 1,
        unit_amount: 29900, // €299.00
        metadata: {
          service_type: 'migration',
          one_time: 'true'
        }
      }
    ],
    default_settings: {
      currency: 'eur',
      collection_method: 'send_invoice',
      auto_advance: true,
      payment_settings: {
        payment_method_types: ['card', 'sepa_debit']
      }
    },
    created_at: new Date().toISOString()
  }
]

// European VAT rates by country
const EU_VAT_RATES: Record<string, { standard: number, reduced?: number, country_name: string }> = {
  'AT': { standard: 20, reduced: 10, country_name: 'Austria' },
  'BE': { standard: 21, reduced: 6, country_name: 'Belgium' },
  'BG': { standard: 20, reduced: 9, country_name: 'Bulgaria' },
  'CY': { standard: 19, reduced: 5, country_name: 'Cyprus' },
  'CZ': { standard: 21, reduced: 10, country_name: 'Czech Republic' },
  'DE': { standard: 19, reduced: 7, country_name: 'Germany' },
  'DK': { standard: 25, country_name: 'Denmark' },
  'EE': { standard: 20, reduced: 9, country_name: 'Estonia' },
  'ES': { standard: 21, reduced: 10, country_name: 'Spain' },
  'FI': { standard: 24, reduced: 10, country_name: 'Finland' },
  'FR': { standard: 20, reduced: 5.5, country_name: 'France' },
  'GR': { standard: 24, reduced: 6, country_name: 'Greece' },
  'HR': { standard: 25, reduced: 5, country_name: 'Croatia' },
  'HU': { standard: 27, reduced: 5, country_name: 'Hungary' },
  'IE': { standard: 23, reduced: 9, country_name: 'Ireland' },
  'IT': { standard: 22, reduced: 4, country_name: 'Italy' },
  'LT': { standard: 21, reduced: 5, country_name: 'Lithuania' },
  'LU': { standard: 17, reduced: 3, country_name: 'Luxembourg' },
  'LV': { standard: 21, reduced: 5, country_name: 'Latvia' },
  'MT': { standard: 18, reduced: 5, country_name: 'Malta' },
  'NL': { standard: 21, reduced: 9, country_name: 'Netherlands' },
  'PL': { standard: 23, reduced: 5, country_name: 'Poland' },
  'PT': { standard: 23, reduced: 6, country_name: 'Portugal' },
  'RO': { standard: 19, reduced: 5, country_name: 'Romania' },
  'SE': { standard: 25, reduced: 6, country_name: 'Sweden' },
  'SI': { standard: 22, reduced: 5, country_name: 'Slovenia' },
  'SK': { standard: 20, reduced: 10, country_name: 'Slovakia' }
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
    const templateId = searchParams.get('template_id')

    switch (action) {
      case 'templates':
        // Return available invoice templates
        return NextResponse.json({
          templates: INVOICE_TEMPLATES,
          total: INVOICE_TEMPLATES.length,
          categories: {
            service: INVOICE_TEMPLATES.filter(t => t.template_type === 'service').length,
            product: INVOICE_TEMPLATES.filter(t => t.template_type === 'product').length,
            subscription: INVOICE_TEMPLATES.filter(t => t.template_type === 'subscription').length,
            one_time: INVOICE_TEMPLATES.filter(t => t.template_type === 'one_time').length
          }
        })

      case 'template':
        if (!templateId) {
          return NextResponse.json(
            { error: 'Template ID is required' },
            { status: 400 }
          )
        }

        const template = INVOICE_TEMPLATES.find(t => t.id === templateId)
        if (!template) {
          return NextResponse.json(
            { error: 'Template not found' },
            { status: 404 }
          )
        }

        return NextResponse.json(template)

      case 'vat_rates':
        // Return European VAT rates
        const countryCode = searchParams.get('country')
        if (countryCode) {
          const vatInfo = EU_VAT_RATES[countryCode.toUpperCase()]
          if (!vatInfo) {
            return NextResponse.json(
              { error: 'VAT information not available for this country' },
              { status: 404 }
            )
          }
          return NextResponse.json({
            country_code: countryCode.toUpperCase(),
            ...vatInfo
          })
        }

        return NextResponse.json({
          vat_rates: EU_VAT_RATES,
          countries_count: Object.keys(EU_VAT_RATES).length,
          last_updated: '2024-01-01' // In production, track actual update dates
        })

      case 'preview':
        // Generate invoice preview without creating actual invoice
        return await handleInvoicePreview(userId, request)

      case 'status':
        if (!invoiceId) {
          return NextResponse.json(
            { error: 'Invoice ID is required' },
            { status: 400 }
          )
        }

        try {
          const invoice = await stripe.invoices.retrieve(invoiceId)
          return NextResponse.json({
            invoice_id: invoice.id,
            status: invoice.status,
            amount_due: invoice.amount_due,
            amount_paid: invoice.amount_paid,
            currency: invoice.currency,
            hosted_invoice_url: invoice.hosted_invoice_url,
            invoice_pdf: invoice.invoice_pdf,
            payment_intent: invoice.payment_intent,
            due_date: invoice.due_date ? new Date(invoice.due_date * 1000).toISOString() : null,
            created: new Date(invoice.created * 1000).toISOString()
          })
        } catch (error) {
          return NextResponse.json(
            { error: 'Invoice not found' },
            { status: 404 }
          )
        }

      default:
        // Return invoice generation capabilities and settings
        return NextResponse.json({
          capabilities: {
            custom_invoice_creation: true,
            vat_compliance: true,
            multiple_currencies: ['eur', 'usd', 'gbp'],
            payment_methods: ['card', 'sepa_debit', 'bancontact', 'giropay', 'ideal'],
            automatic_tax_calculation: true,
            invoice_templates: true,
            custom_fields: true,
            dunning_management: true
          },
          supported_features: [
            'eu_vat_compliance',
            'reverse_charge',
            'invoice_customization',
            'payment_reminders',
            'multi_language_support',
            'pdf_generation',
            'webhook_notifications'
          ],
          default_settings: {
            currency: 'eur',
            collection_method: 'send_invoice',
            auto_advance: true,
            payment_terms: 30,
            late_fee_percentage: 1.5
          }
        })
    }
  } catch (error) {
    console.error('Stripe invoice GET error:', error)
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

    const body: CustomInvoiceRequest = await request.json()
    const {
      customer_id,
      customer_email,
      items,
      currency = 'eur',
      due_date,
      auto_advance = true,
      collection_method = 'send_invoice',
      payment_settings,
      footer,
      description,
      statement_descriptor,
      metadata = {},
      discount,
      vat_settings,
      custom_fields
    } = body

    // Validate required fields
    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: 'At least one invoice item is required' },
        { status: 400 }
      )
    }

    if (!customer_id && !customer_email) {
      return NextResponse.json(
        { error: 'Either customer_id or customer_email is required' },
        { status: 400 }
      )
    }

    const db = await createDatabaseService()

    // Get or create customer
    let customerId = customer_id
    if (!customerId && customer_email) {
      // Find existing customer by email
      const existingCustomers = await stripe.customers.list({
        email: customer_email,
        limit: 1
      })

      if (existingCustomers.data.length > 0) {
        customerId = existingCustomers.data[0].id
      } else {
        // Create new customer
        const newCustomer = await stripe.customers.create({
          email: customer_email,
          metadata: {
            created_by: userId,
            source: 'custom_invoice'
          }
        })
        customerId = newCustomer.id
      }
    }

    // Handle VAT settings and tax rates
    let automaticTax: Stripe.InvoiceCreateParams.AutomaticTax | undefined
    let defaultTaxRates: string[] = []

    if (vat_settings?.customer_location) {
      const countryCode = vat_settings.customer_location.toUpperCase()
      const vatInfo = EU_VAT_RATES[countryCode]

      if (vatInfo) {
        // Create or get tax rate for the country
        const taxRateName = `VAT ${countryCode}`
        const taxRates = await stripe.taxRates.list({
          limit: 100
        })

        let taxRate = taxRates.data.find(tr => 
          tr.display_name === taxRateName && 
          tr.percentage === vatInfo.standard
        )

        if (!taxRate) {
          taxRate = await stripe.taxRates.create({
            display_name: taxRateName,
            description: `${vatInfo.country_name} VAT`,
            jurisdiction: countryCode,
            percentage: vatInfo.standard,
            inclusive: false,
            metadata: {
              country: countryCode,
              rate_type: 'standard_vat'
            }
          })
        }

        if (!vat_settings.reverse_charge) {
          defaultTaxRates = [taxRate.id]
        }

        // Enable automatic tax if supported
        automaticTax = {
          enabled: true
        }
      }
    }

    // Create invoice items
    const invoiceItems: Stripe.InvoiceItemCreateParams[] = items.map(item => ({
      customer: customerId!,
      currency,
      amount: item.unit_amount * item.quantity,
      description: item.description,
      quantity: item.quantity,
      unit_amount: item.unit_amount,
      tax_rates: defaultTaxRates,
      metadata: item.metadata || {}
    }))

    // Create invoice items in Stripe
    const createdItems = await Promise.all(
      invoiceItems.map(item => stripe.invoiceItems.create(item))
    )

    // Prepare invoice creation parameters
    const invoiceParams: Stripe.InvoiceCreateParams = {
      customer: customerId!,
      currency,
      collection_method,
      auto_advance,
      description,
      footer,
      statement_descriptor,
      metadata: {
        ...metadata,
        created_by: userId,
        custom_invoice: 'true'
      }
    }

    // Add due date if specified
    if (due_date) {
      const dueDateTimestamp = Math.floor(new Date(due_date).getTime() / 1000)
      invoiceParams.due_date = dueDateTimestamp
    }

    // Add payment settings
    if (payment_settings) {
      invoiceParams.payment_settings = {
        payment_method_types: payment_settings.payment_method_types,
        default_payment_method: payment_settings.default_payment_method
      }
    }

    // Add automatic tax
    if (automaticTax) {
      invoiceParams.automatic_tax = automaticTax
    }

    // Add custom fields
    if (custom_fields && custom_fields.length > 0) {
      invoiceParams.custom_fields = custom_fields.map(field => ({
        name: field.name,
        value: field.value
      }))
    }

    // Create the invoice
    const invoice = await stripe.invoices.create(invoiceParams)

    // Apply discount if specified
    if (discount) {
      if (discount.coupon) {
        await stripe.invoices.update(invoice.id, {
          discounts: [{ coupon: discount.coupon }]
        })
      } else if (discount.promotion_code) {
        await stripe.invoices.update(invoice.id, {
          discounts: [{ promotion_code: discount.promotion_code }]
        })
      }
    }

    // Finalize the invoice if auto_advance is enabled
    let finalizedInvoice = invoice
    if (auto_advance) {
      finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id)
    }

    // Store invoice record in database
    await db.createInvoice({
      user_id: userId,
      stripe_invoice_id: finalizedInvoice.id,
      invoice_number: finalizedInvoice.number || `INV-${Date.now()}`,
      amount_paid: finalizedInvoice.amount_paid,
      amount_due: finalizedInvoice.amount_due,
      currency: finalizedInvoice.currency,
      status: finalizedInvoice.status as any,
      hosted_invoice_url: finalizedInvoice.hosted_invoice_url,
      invoice_pdf: finalizedInvoice.invoice_pdf,
      line_items: createdItems.map(item => ({
        description: item.description,
        quantity: item.quantity,
        unit_amount: item.unit_amount,
        amount: item.amount
      }))
    })

    // Send invoice if collection method is send_invoice
    if (collection_method === 'send_invoice' && auto_advance) {
      await stripe.invoices.sendInvoice(finalizedInvoice.id)
    }

    return NextResponse.json({
      success: true,
      invoice: {
        id: finalizedInvoice.id,
        number: finalizedInvoice.number,
        status: finalizedInvoice.status,
        amount_due: finalizedInvoice.amount_due,
        amount_paid: finalizedInvoice.amount_paid,
        currency: finalizedInvoice.currency,
        hosted_invoice_url: finalizedInvoice.hosted_invoice_url,
        invoice_pdf: finalizedInvoice.invoice_pdf,
        due_date: finalizedInvoice.due_date ? new Date(finalizedInvoice.due_date * 1000).toISOString() : null,
        created: new Date(finalizedInvoice.created * 1000).toISOString()
      },
      customer_id: customerId,
      items_created: createdItems.length,
      vat_applied: defaultTaxRates.length > 0,
      sent: collection_method === 'send_invoice' && auto_advance
    })
  } catch (error) {
    console.error('Stripe invoice creation error:', error)
    
    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        { 
          error: 'Stripe error',
          code: error.code,
          message: error.message,
          type: error.type
        },
        { status: 400 }
      )
    }

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
    const { action, invoice_id, ...params } = body

    if (!invoice_id) {
      return NextResponse.json(
        { error: 'Invoice ID is required' },
        { status: 400 }
      )
    }

    switch (action) {
      case 'finalize':
        try {
          const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice_id)
          return NextResponse.json({
            success: true,
            invoice: {
              id: finalizedInvoice.id,
              status: finalizedInvoice.status,
              finalized_at: new Date().toISOString()
            }
          })
        } catch (error) {
          return NextResponse.json(
            { error: 'Failed to finalize invoice' },
            { status: 400 }
          )
        }

      case 'send':
        try {
          const sentInvoice = await stripe.invoices.sendInvoice(invoice_id)
          return NextResponse.json({
            success: true,
            invoice: {
              id: sentInvoice.id,
              status: sentInvoice.status,
              sent_at: new Date().toISOString()
            }
          })
        } catch (error) {
          return NextResponse.json(
            { error: 'Failed to send invoice' },
            { status: 400 }
          )
        }

      case 'void':
        try {
          const voidedInvoice = await stripe.invoices.voidInvoice(invoice_id)
          return NextResponse.json({
            success: true,
            invoice: {
              id: voidedInvoice.id,
              status: voidedInvoice.status,
              voided_at: new Date().toISOString()
            }
          })
        } catch (error) {
          return NextResponse.json(
            { error: 'Failed to void invoice' },
            { status: 400 }
          )
        }

      case 'mark_paid':
        try {
          const paidInvoice = await stripe.invoices.pay(invoice_id, {
            paid_out_of_band: true
          })
          return NextResponse.json({
            success: true,
            invoice: {
              id: paidInvoice.id,
              status: paidInvoice.status,
              paid_at: new Date().toISOString()
            }
          })
        } catch (error) {
          return NextResponse.json(
            { error: 'Failed to mark invoice as paid' },
            { status: 400 }
          )
        }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Stripe invoice action error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Helper function for invoice preview
async function handleInvoicePreview(userId: string, request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json()
    const { items, currency = 'eur', vat_settings } = body

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: 'Items are required for preview' },
        { status: 400 }
      )
    }

    // Calculate subtotal
    const subtotal = items.reduce((sum: number, item: CustomInvoiceItem) => 
      sum + (item.unit_amount * item.quantity), 0
    )

    // Calculate VAT if applicable
    let vatAmount = 0
    let vatRate = 0
    let vatCountry = null

    if (vat_settings?.customer_location && !vat_settings.reverse_charge) {
      const countryCode = vat_settings.customer_location.toUpperCase()
      const vatInfo = EU_VAT_RATES[countryCode]

      if (vatInfo) {
        vatRate = vatInfo.standard
        vatAmount = Math.round(subtotal * (vatRate / 100))
        vatCountry = vatInfo.country_name
      }
    }

    const total = subtotal + vatAmount

    return NextResponse.json({
      preview: {
        items: items.map((item: CustomInvoiceItem) => ({
          ...item,
          line_total: item.unit_amount * item.quantity
        })),
        subtotal,
        vat: {
          rate: vatRate,
          amount: vatAmount,
          country: vatCountry,
          reverse_charge: vat_settings?.reverse_charge || false
        },
        total,
        currency,
        formatted: {
          subtotal: `${(subtotal / 100).toFixed(2)} ${currency.toUpperCase()}`,
          vat: `${(vatAmount / 100).toFixed(2)} ${currency.toUpperCase()}`,
          total: `${(total / 100).toFixed(2)} ${currency.toUpperCase()}`
        }
      }
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to generate preview' },
      { status: 500 }
    )
  }
}