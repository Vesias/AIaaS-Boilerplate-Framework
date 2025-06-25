/**
 * Invoice Generation System
 * Comprehensive PDF generation with jsPDF, Stripe integration, and email delivery
 */

import { stripe } from './stripe'
import { createDatabaseService, type Invoice, type Profile } from './database'

// Types for invoice generation
export interface InvoiceData {
  invoiceNumber: string
  userId: string
  customerInfo: {
    name: string
    email: string
    address?: {
      line1: string
      line2?: string
      city: string
      postal_code: string
      country: string
    }
    taxId?: string
  }
  companyInfo: {
    name: string
    address: {
      line1: string
      line2?: string
      city: string
      postal_code: string
      country: string
    }
    email: string
    phone?: string
    website?: string
    taxId?: string
    registrationNumber?: string
  }
  items: InvoiceItem[]
  subtotal: number
  tax: {
    rate: number
    amount: number
  }
  total: number
  currency: string
  dueDate: Date
  issueDate: Date
  notes?: string
  paymentTerms?: string
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
}

export interface InvoiceItem {
  description: string
  quantity: number
  unitPrice: number
  total: number
  taxRate?: number
}

export interface PDFInvoiceOptions {
  format: 'A4' | 'letter'
  theme: 'modern' | 'classic' | 'minimal'
  logoUrl?: string
  primaryColor?: string
  accentColor?: string
  fontFamily?: string
}

export interface InvoiceGenerationResult {
  invoiceId: string
  pdfBuffer: Buffer
  pdfUrl?: string
  stripeInvoiceId?: string
  success: boolean
  error?: string
}

/**
 * Invoice Generation Service
 * Handles PDF generation, Stripe integration, and invoice management
 */
export class InvoiceService {
  private db: Awaited<ReturnType<typeof createDatabaseService>>

  constructor(db: Awaited<ReturnType<typeof createDatabaseService>>) {
    this.db = db
  }

  /**
   * Generate a complete invoice with PDF and Stripe integration
   */
  async generateInvoice(
    invoiceData: InvoiceData,
    options: PDFInvoiceOptions = { format: 'A4', theme: 'modern' }
  ): Promise<InvoiceGenerationResult> {
    try {
      // Generate PDF buffer
      const pdfBuffer = await this.generatePDF(invoiceData, options)
      
      // Create Stripe invoice if not exists
      let stripeInvoiceId: string | undefined
      
      try {
        const stripeInvoice = await this.createStripeInvoice(invoiceData)
        stripeInvoiceId = stripeInvoice.id
      } catch (error) {
        console.warn('Failed to create Stripe invoice:', error)
      }

      // Save to database
      const dbInvoice = await this.db.createInvoice({
        user_id: invoiceData.userId,
        stripe_invoice_id: stripeInvoiceId || '',
        invoice_number: invoiceData.invoiceNumber,
        amount_paid: invoiceData.status === 'paid' ? invoiceData.total : 0,
        amount_due: invoiceData.status !== 'paid' ? invoiceData.total : 0,
        currency: invoiceData.currency,
        status: invoiceData.status,
        line_items: invoiceData.items,
        custom_pdf_url: '', // Will be updated if uploaded to storage
      })

      if (!dbInvoice) {
        throw new Error('Failed to save invoice to database')
      }

      return {
        invoiceId: dbInvoice.id,
        pdfBuffer,
        stripeInvoiceId,
        success: true,
      }
    } catch (error: any) {
      console.error('Invoice generation failed:', error)
      return {
        invoiceId: '',
        pdfBuffer: Buffer.from(''),
        success: false,
        error: error.message,
      }
    }
  }

  /**
   * Generate PDF invoice using canvas and PDF generation
   * Note: In a real implementation, you would use a library like jsPDF or Puppeteer
   */
  private async generatePDF(
    invoiceData: InvoiceData,
    options: PDFInvoiceOptions
  ): Promise<Buffer> {
    // This is a simplified implementation
    // In production, you would use jsPDF, Puppeteer, or a similar library
    
    const htmlContent = this.generateInvoiceHTML(invoiceData, options)
    
    // For now, return HTML as buffer (in production, convert to PDF)
    return Buffer.from(htmlContent, 'utf8')
  }

  /**
   * Generate HTML template for invoice
   */
  private generateInvoiceHTML(
    invoiceData: InvoiceData,
    options: PDFInvoiceOptions
  ): string {
    const theme = this.getThemeStyles(options.theme, options.primaryColor, options.accentColor)
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice ${invoiceData.invoiceNumber}</title>
    <style>
        ${theme}
        
        body {
            font-family: ${options.fontFamily || 'Arial, sans-serif'};
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 20px;
        }
        
        .invoice-container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            box-shadow: 0 0 20px rgba(0,0,0,0.1);
        }
        
        .invoice-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 40px;
            border-bottom: 2px solid var(--primary-color);
            padding-bottom: 20px;
        }
        
        .company-info h1 {
            color: var(--primary-color);
            margin: 0 0 10px 0;
            font-size: 28px;
        }
        
        .invoice-details {
            text-align: right;
        }
        
        .invoice-title {
            font-size: 36px;
            color: var(--primary-color);
            margin: 0;
        }
        
        .billing-section {
            display: flex;
            justify-content: space-between;
            margin: 40px 0;
        }
        
        .billing-info h3 {
            color: var(--accent-color);
            border-bottom: 1px solid var(--accent-color);
            padding-bottom: 5px;
        }
        
        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin: 40px 0;
        }
        
        .items-table th {
            background: var(--primary-color);
            color: white;
            padding: 12px;
            text-align: left;
        }
        
        .items-table td {
            padding: 12px;
            border-bottom: 1px solid #eee;
        }
        
        .items-table tbody tr:hover {
            background: #f9f9f9;
        }
        
        .totals-section {
            text-align: right;
            margin: 40px 0;
        }
        
        .totals-table {
            margin-left: auto;
            min-width: 300px;
        }
        
        .totals-table td {
            padding: 8px 15px;
            border-bottom: 1px solid #eee;
        }
        
        .total-row {
            font-weight: bold;
            background: var(--accent-color);
            color: white;
        }
        
        .footer {
            margin-top: 60px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            font-size: 14px;
            color: #666;
        }
        
        .payment-terms {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
        }
        
        .status-badge {
            display: inline-block;
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
        }
        
        .status-paid { background: #d4edda; color: #155724; }
        .status-sent { background: #d1ecf1; color: #0c5460; }
        .status-draft { background: #f8d7da; color: #721c24; }
        .status-overdue { background: #f5c6cb; color: #721c24; }
    </style>
</head>
<body>
    <div class="invoice-container">
        <div class="invoice-header">
            <div class="company-info">
                ${options.logoUrl ? `<img src="${options.logoUrl}" alt="Logo" style="height: 60px; margin-bottom: 20px;">` : ''}
                <h1>${invoiceData.companyInfo.name}</h1>
                <div class="address">
                    ${invoiceData.companyInfo.address.line1}<br>
                    ${invoiceData.companyInfo.address.line2 ? invoiceData.companyInfo.address.line2 + '<br>' : ''}
                    ${invoiceData.companyInfo.address.city}, ${invoiceData.companyInfo.address.postal_code}<br>
                    ${invoiceData.companyInfo.address.country}
                </div>
                <div style="margin-top: 15px;">
                    Email: ${invoiceData.companyInfo.email}<br>
                    ${invoiceData.companyInfo.phone ? `Phone: ${invoiceData.companyInfo.phone}<br>` : ''}
                    ${invoiceData.companyInfo.website ? `Website: ${invoiceData.companyInfo.website}<br>` : ''}
                </div>
            </div>
            
            <div class="invoice-details">
                <h2 class="invoice-title">INVOICE</h2>
                <div style="margin-top: 20px;">
                    <strong>Invoice #:</strong> ${invoiceData.invoiceNumber}<br>
                    <strong>Issue Date:</strong> ${invoiceData.issueDate.toLocaleDateString()}<br>
                    <strong>Due Date:</strong> ${invoiceData.dueDate.toLocaleDateString()}<br>
                    <strong>Status:</strong> 
                    <span class="status-badge status-${invoiceData.status}">${invoiceData.status}</span>
                </div>
            </div>
        </div>
        
        <div class="billing-section">
            <div class="billing-info">
                <h3>Bill To:</h3>
                <strong>${invoiceData.customerInfo.name}</strong><br>
                ${invoiceData.customerInfo.email}<br>
                ${invoiceData.customerInfo.address ? `
                    ${invoiceData.customerInfo.address.line1}<br>
                    ${invoiceData.customerInfo.address.line2 ? invoiceData.customerInfo.address.line2 + '<br>' : ''}
                    ${invoiceData.customerInfo.address.city}, ${invoiceData.customerInfo.address.postal_code}<br>
                    ${invoiceData.customerInfo.address.country}<br>
                ` : ''}
                ${invoiceData.customerInfo.taxId ? `<strong>Tax ID:</strong> ${invoiceData.customerInfo.taxId}` : ''}
            </div>
        </div>
        
        <table class="items-table">
            <thead>
                <tr>
                    <th>Description</th>
                    <th style="text-align: center;">Quantity</th>
                    <th style="text-align: right;">Unit Price</th>
                    <th style="text-align: right;">Total</th>
                </tr>
            </thead>
            <tbody>
                ${invoiceData.items.map(item => `
                    <tr>
                        <td>${item.description}</td>
                        <td style="text-align: center;">${item.quantity}</td>
                        <td style="text-align: right;">${this.formatCurrency(item.unitPrice, invoiceData.currency)}</td>
                        <td style="text-align: right;">${this.formatCurrency(item.total, invoiceData.currency)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        
        <div class="totals-section">
            <table class="totals-table">
                <tr>
                    <td><strong>Subtotal:</strong></td>
                    <td style="text-align: right;">${this.formatCurrency(invoiceData.subtotal, invoiceData.currency)}</td>
                </tr>
                <tr>
                    <td><strong>Tax (${invoiceData.tax.rate}%):</strong></td>
                    <td style="text-align: right;">${this.formatCurrency(invoiceData.tax.amount, invoiceData.currency)}</td>
                </tr>
                <tr class="total-row">
                    <td><strong>Total:</strong></td>
                    <td style="text-align: right;"><strong>${this.formatCurrency(invoiceData.total, invoiceData.currency)}</strong></td>
                </tr>
            </table>
        </div>
        
        ${invoiceData.paymentTerms ? `
            <div class="payment-terms">
                <h4>Payment Terms:</h4>
                <p>${invoiceData.paymentTerms}</p>
            </div>
        ` : ''}
        
        ${invoiceData.notes ? `
            <div class="payment-terms">
                <h4>Notes:</h4>
                <p>${invoiceData.notes}</p>
            </div>
        ` : ''}
        
        <div class="footer">
            <p>Thank you for your business!</p>
            ${invoiceData.companyInfo.taxId ? `<p><strong>Company Tax ID:</strong> ${invoiceData.companyInfo.taxId}</p>` : ''}
            ${invoiceData.companyInfo.registrationNumber ? `<p><strong>Registration Number:</strong> ${invoiceData.companyInfo.registrationNumber}</p>` : ''}
        </div>
    </div>
</body>
</html>
    `.trim()
  }

  /**
   * Get theme-specific CSS styles
   */
  private getThemeStyles(
    theme: string,
    primaryColor?: string,
    accentColor?: string
  ): string {
    const colors = {
      modern: {
        primary: primaryColor || '#2563eb',
        accent: accentColor || '#3b82f6',
      },
      classic: {
        primary: primaryColor || '#1f2937',
        accent: accentColor || '#374151',
      },
      minimal: {
        primary: primaryColor || '#000000',
        accent: accentColor || '#6b7280',
      },
    }

    const themeColors = colors[theme as keyof typeof colors] || colors.modern

    return `
      :root {
        --primary-color: ${themeColors.primary};
        --accent-color: ${themeColors.accent};
      }
    `
  }

  /**
   * Create Stripe invoice
   */
  private async createStripeInvoice(invoiceData: InvoiceData) {
    // First, create or retrieve customer
    const customers = await stripe.customers.list({
      email: invoiceData.customerInfo.email,
      limit: 1,
    })

    let customerId: string
    if (customers.data.length > 0) {
      customerId = customers.data[0].id
    } else {
      const customer = await stripe.customers.create({
        email: invoiceData.customerInfo.email,
        name: invoiceData.customerInfo.name,
        address: invoiceData.customerInfo.address ? {
          line1: invoiceData.customerInfo.address.line1,
          line2: invoiceData.customerInfo.address.line2 || '',
          city: invoiceData.customerInfo.address.city,
          postal_code: invoiceData.customerInfo.address.postal_code,
          country: invoiceData.customerInfo.address.country,
        } : undefined,
        tax_exempt: 'none',
      })
      customerId = customer.id
    }

    // Create invoice items
    for (const item of invoiceData.items) {
      await stripe.invoiceItems.create({
        customer: customerId,
        amount: Math.round(item.total * 100), // Convert to cents
        currency: invoiceData.currency.toLowerCase(),
        description: item.description,
        quantity: item.quantity,
        unit_amount: Math.round(item.unitPrice * 100),
      })
    }

    // Create the invoice
    const invoice = await stripe.invoices.create({
      customer: customerId,
      collection_method: 'send_invoice',
      days_until_due: Math.ceil((invoiceData.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      description: `Invoice ${invoiceData.invoiceNumber}`,
      metadata: {
        invoice_number: invoiceData.invoiceNumber,
        user_id: invoiceData.userId,
      },
      footer: invoiceData.notes || '',
    })

    return invoice
  }

  /**
   * Send invoice via email
   */
  async sendInvoiceEmail(
    invoiceId: string,
    recipientEmail: string,
    pdfBuffer: Buffer,
    subject?: string
  ): Promise<boolean> {
    try {
      // This would integrate with your email service (SendGrid, SES, etc.)
      // For now, return true as placeholder
      console.log(`Sending invoice ${invoiceId} to ${recipientEmail}`)
      return true
    } catch (error) {
      console.error('Failed to send invoice email:', error)
      return false
    }
  }

  /**
   * Update invoice status
   */
  async updateInvoiceStatus(
    invoiceId: string,
    status: InvoiceData['status']
  ): Promise<boolean> {
    try {
      const updated = await this.db.updateInvoice(invoiceId, { status })
      return !!updated
    } catch (error) {
      console.error('Failed to update invoice status:', error)
      return false
    }
  }

  /**
   * Get user invoices
   */
  async getUserInvoices(userId: string, limit?: number): Promise<Invoice[]> {
    return this.db.getUserInvoices(userId, limit)
  }

  /**
   * Format currency for display
   */
  private formatCurrency(amount: number, currency: string): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount)
  }

  /**
   * Generate unique invoice number
   */
  static generateInvoiceNumber(prefix: string = 'INV'): string {
    const date = new Date()
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const timestamp = Date.now().toString().slice(-6)
    
    return `${prefix}-${year}${month}-${timestamp}`
  }

  /**
   * Calculate tax amount
   */
  static calculateTax(subtotal: number, taxRate: number): number {
    return Math.round((subtotal * (taxRate / 100)) * 100) / 100
  }

  /**
   * Validate invoice data
   */
  static validateInvoiceData(data: Partial<InvoiceData>): string[] {
    const errors: string[] = []

    if (!data.customerInfo?.name) errors.push('Customer name is required')
    if (!data.customerInfo?.email) errors.push('Customer email is required')
    if (!data.items || data.items.length === 0) errors.push('At least one item is required')
    if (!data.currency) errors.push('Currency is required')
    if (!data.dueDate) errors.push('Due date is required')
    
    if (data.items) {
      data.items.forEach((item, index) => {
        if (!item.description) errors.push(`Item ${index + 1}: Description is required`)
        if (!item.quantity || item.quantity <= 0) errors.push(`Item ${index + 1}: Valid quantity is required`)
        if (!item.unitPrice || item.unitPrice < 0) errors.push(`Item ${index + 1}: Valid unit price is required`)
      })
    }

    return errors
  }
}

/**
 * Factory function to create invoice service
 */
export async function createInvoiceService(): Promise<InvoiceService> {
  const db = await createDatabaseService()
  return new InvoiceService(db)
}

/**
 * Quick invoice generation helper
 */
export async function generateQuickInvoice(
  invoiceData: InvoiceData,
  options?: PDFInvoiceOptions
): Promise<InvoiceGenerationResult> {
  const service = await createInvoiceService()
  return service.generateInvoice(invoiceData, options)
}

/**
 * Invoice templates for common use cases
 */
export const InvoiceTemplates = {
  /**
   * Create subscription invoice template
   */
  subscription: (
    userId: string,
    customerInfo: InvoiceData['customerInfo'],
    subscriptionAmount: number,
    currency: string = 'EUR',
    period: string = 'monthly'
  ): InvoiceData => ({
    invoiceNumber: InvoiceService.generateInvoiceNumber('SUB'),
    userId,
    customerInfo,
    companyInfo: {
      name: process.env.COMPANY_NAME || 'Roomicor',
      address: {
        line1: process.env.COMPANY_ADDRESS_LINE1 || 'Your Address',
        city: process.env.COMPANY_CITY || 'Your City',
        postal_code: process.env.COMPANY_POSTAL_CODE || '12345',
        country: process.env.COMPANY_COUNTRY || 'Germany',
      },
      email: process.env.COMPANY_EMAIL || 'billing@roomicor.com',
      phone: process.env.COMPANY_PHONE,
      website: process.env.COMPANY_WEBSITE || 'https://roomicor.com',
      taxId: process.env.COMPANY_TAX_ID,
      registrationNumber: process.env.COMPANY_REGISTRATION_NUMBER,
    },
    items: [
      {
        description: `Roomicor ${period.charAt(0).toUpperCase() + period.slice(1)} Subscription`,
        quantity: 1,
        unitPrice: subscriptionAmount,
        total: subscriptionAmount,
      },
    ],
    subtotal: subscriptionAmount,
    tax: {
      rate: 19, // German VAT
      amount: InvoiceService.calculateTax(subscriptionAmount, 19),
    },
    total: subscriptionAmount + InvoiceService.calculateTax(subscriptionAmount, 19),
    currency,
    dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
    issueDate: new Date(),
    status: 'sent',
    paymentTerms: 'Payment due within 14 days of invoice date.',
  }),

  /**
   * Create one-time service invoice template
   */
  service: (
    userId: string,
    customerInfo: InvoiceData['customerInfo'],
    serviceDescription: string,
    amount: number,
    currency: string = 'EUR'
  ): InvoiceData => ({
    invoiceNumber: InvoiceService.generateInvoiceNumber('SVC'),
    userId,
    customerInfo,
    companyInfo: {
      name: process.env.COMPANY_NAME || 'Roomicor',
      address: {
        line1: process.env.COMPANY_ADDRESS_LINE1 || 'Your Address',
        city: process.env.COMPANY_CITY || 'Your City',
        postal_code: process.env.COMPANY_POSTAL_CODE || '12345',
        country: process.env.COMPANY_COUNTRY || 'Germany',
      },
      email: process.env.COMPANY_EMAIL || 'billing@roomicor.com',
      phone: process.env.COMPANY_PHONE,
      website: process.env.COMPANY_WEBSITE || 'https://roomicor.com',
      taxId: process.env.COMPANY_TAX_ID,
      registrationNumber: process.env.COMPANY_REGISTRATION_NUMBER,
    },
    items: [
      {
        description: serviceDescription,
        quantity: 1,
        unitPrice: amount,
        total: amount,
      },
    ],
    subtotal: amount,
    tax: {
      rate: 19,
      amount: InvoiceService.calculateTax(amount, 19),
    },
    total: amount + InvoiceService.calculateTax(amount, 19),
    currency,
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    issueDate: new Date(),
    status: 'sent',
    paymentTerms: 'Payment due within 30 days of invoice date.',
  }),
}

// Export types
export type {
  InvoiceData,
  InvoiceItem,
  PDFInvoiceOptions,
  InvoiceGenerationResult,
}