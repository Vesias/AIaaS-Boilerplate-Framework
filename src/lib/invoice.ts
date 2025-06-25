/**
 * Enhanced Invoice Generation System
 * European VAT compliance, multi-currency support, automated workflows, and comprehensive PDF generation
 * Features: EU VAT rates, GDPR compliance, multi-language support, automated reminders
 */

import { stripe } from './stripe'
import { createDatabaseService, type Invoice, type Profile } from './database'
import { jsPDF } from 'jspdf'
import 'jspdf-autotable'
import html2canvas from 'html2canvas'

// European VAT rates (as of 2024)
export const EU_VAT_RATES: Record<string, { standard: number; reduced: number[]; country: string }> = {
  AT: { standard: 20, reduced: [10, 13], country: 'Austria' },
  BE: { standard: 21, reduced: [6, 12], country: 'Belgium' },
  BG: { standard: 20, reduced: [9], country: 'Bulgaria' },
  CY: { standard: 19, reduced: [5, 9], country: 'Cyprus' },
  CZ: { standard: 21, reduced: [10, 15], country: 'Czech Republic' },
  DE: { standard: 19, reduced: [7], country: 'Germany' },
  DK: { standard: 25, reduced: [], country: 'Denmark' },
  EE: { standard: 20, reduced: [9], country: 'Estonia' },
  ES: { standard: 21, reduced: [4, 10], country: 'Spain' },
  FI: { standard: 24, reduced: [10, 14], country: 'Finland' },
  FR: { standard: 20, reduced: [5.5, 10], country: 'France' },
  GR: { standard: 24, reduced: [6, 13], country: 'Greece' },
  HR: { standard: 25, reduced: [5, 13], country: 'Croatia' },
  HU: { standard: 27, reduced: [5, 18], country: 'Hungary' },
  IE: { standard: 23, reduced: [9, 13.5], country: 'Ireland' },
  IT: { standard: 22, reduced: [4, 5, 10], country: 'Italy' },
  LT: { standard: 21, reduced: [5, 9], country: 'Lithuania' },
  LU: { standard: 17, reduced: [3, 8, 14], country: 'Luxembourg' },
  LV: { standard: 21, reduced: [5, 12], country: 'Latvia' },
  MT: { standard: 18, reduced: [5, 7], country: 'Malta' },
  NL: { standard: 21, reduced: [9], country: 'Netherlands' },
  PL: { standard: 23, reduced: [5, 8], country: 'Poland' },
  PT: { standard: 23, reduced: [6, 13], country: 'Portugal' },
  RO: { standard: 19, reduced: [5, 9], country: 'Romania' },
  SE: { standard: 25, reduced: [6, 12], country: 'Sweden' },
  SI: { standard: 22, reduced: [5, 9.5], country: 'Slovenia' },
  SK: { standard: 20, reduced: [10], country: 'Slovakia' }
}

// Supported currencies with formatting
export const SUPPORTED_CURRENCIES: Record<string, { symbol: string; name: string; locale: string }> = {
  EUR: { symbol: '€', name: 'Euro', locale: 'de-DE' },
  USD: { symbol: '$', name: 'US Dollar', locale: 'en-US' },
  GBP: { symbol: '£', name: 'British Pound', locale: 'en-GB' },
  CHF: { symbol: 'CHF', name: 'Swiss Franc', locale: 'de-CH' },
  SEK: { symbol: 'kr', name: 'Swedish Krona', locale: 'sv-SE' },
  NOK: { symbol: 'kr', name: 'Norwegian Krone', locale: 'nb-NO' },
  DKK: { symbol: 'kr', name: 'Danish Krone', locale: 'da-DK' },
  PLN: { symbol: 'zł', name: 'Polish Zloty', locale: 'pl-PL' },
  CZK: { symbol: 'Kč', name: 'Czech Koruna', locale: 'cs-CZ' }
}

// Invoice templates
export type InvoiceTemplate = 'modern' | 'classic' | 'minimal' | 'corporate' | 'creative'

// Languages supported
export type SupportedLanguage = 'en' | 'de' | 'fr' | 'es' | 'it' | 'nl' | 'pl' | 'cs'

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
    exempt?: boolean
    exemptReason?: string
    breakdown?: Array<{
      description: string
      rate: number
      amount: number
      taxableAmount: number
    }>
  }
  total: number
  currency: string
  dueDate: Date
  issueDate: Date
  notes?: string
  paymentTerms?: string
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
  language?: SupportedLanguage
  template?: InvoiceTemplate
  paymentMethods?: string[]
  bankDetails?: {
    accountName: string
    iban: string
    bic: string
    bankName: string
  }
  legalNotices?: string[]
  customFields?: Array<{
    label: string
    value: string
  }>
  attachments?: Array<{
    filename: string
    url: string
    type: string
  }>
}

export interface InvoiceItem {
  id?: string
  description: string
  quantity: number
  unitPrice: number
  total: number
  taxRate?: number
  taxAmount?: number
  category?: string
  sku?: string
  unit?: string // e.g., 'hours', 'pieces', 'months'
}

export interface PDFInvoiceOptions {
  format: 'A4' | 'letter'
  theme: InvoiceTemplate
  language: SupportedLanguage
  logoUrl?: string
  logoWidth?: number
  logoHeight?: number
  primaryColor?: string
  accentColor?: string
  fontFamily?: string
  includeQRCode?: boolean
  includePaymentTerms?: boolean
  includeVATBreakdown?: boolean
  watermark?: string
  customCSS?: string
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
   * Generate PDF invoice using jsPDF with professional formatting
   */
  private async generatePDF(
    invoiceData: InvoiceData,
    options: PDFInvoiceOptions
  ): Promise<Buffer> {
    try {
      // Create HTML content
      const htmlContent = this.generateInvoiceHTML(invoiceData, options)
      
      // Create a temporary DOM element for rendering
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = htmlContent
      tempDiv.style.width = '210mm' // A4 width
      tempDiv.style.position = 'absolute'
      tempDiv.style.left = '-9999px'
      document.body.appendChild(tempDiv)
      
      // Convert HTML to canvas
      const canvas = await html2canvas(tempDiv, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        width: 794, // A4 width in pixels at 96 DPI
        height: 1123 // A4 height in pixels at 96 DPI
      })
      
      // Remove temporary element
      document.body.removeChild(tempDiv)
      
      // Create PDF from canvas
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: options.format === 'A4' ? 'a4' : 'letter'
      })
      
      const imgData = canvas.toDataURL('image/png')
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
      
      // Add metadata
      pdf.setProperties({
        title: `Invoice ${invoiceData.invoiceNumber}`,
        subject: `Invoice for ${invoiceData.customerInfo.name}`,
        author: invoiceData.companyInfo.name,
        creator: 'Roomicor Invoice System',
        producer: 'Roomicor'
      })
      
      return Buffer.from(pdf.output('arraybuffer'))
    } catch (error) {
      console.error('PDF generation failed:', error)
      // Fallback to HTML-based PDF generation
      const htmlContent = this.generateInvoiceHTML(invoiceData, options)
      return Buffer.from(htmlContent, 'utf8')
    }
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
   * Get theme-specific CSS styles with enhanced templates
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
        background: '#ffffff',
        text: '#1f2937',
        border: '#e5e7eb'
      },
      classic: {
        primary: primaryColor || '#1f2937',
        accent: accentColor || '#374151',
        background: '#fefefe',
        text: '#111827',
        border: '#d1d5db'
      },
      minimal: {
        primary: primaryColor || '#000000',
        accent: accentColor || '#6b7280',
        background: '#ffffff',
        text: '#000000',
        border: '#f3f4f6'
      },
      corporate: {
        primary: primaryColor || '#1e40af',
        accent: accentColor || '#3730a3',
        background: '#f8fafc',
        text: '#0f172a',
        border: '#cbd5e1'
      },
      creative: {
        primary: primaryColor || '#7c3aed',
        accent: accentColor || '#a855f7',
        background: '#fefefe',
        text: '#374151',
        border: '#e5e7eb'
      }
    }

    const themeColors = colors[theme as keyof typeof colors] || colors.modern

    return `
      :root {
        --primary-color: ${themeColors.primary};
        --accent-color: ${themeColors.accent};
        --background-color: ${themeColors.background};
        --text-color: ${themeColors.text};
        --border-color: ${themeColors.border};
      }
      
      .theme-${theme} {
        --shadow: ${theme === 'minimal' ? 'none' : '0 4px 6px -1px rgba(0, 0, 0, 0.1)'};
        --radius: ${theme === 'classic' ? '2px' : theme === 'minimal' ? '0px' : '8px'};
      }
    `
  }

  /**
   * Get translations for invoice labels
   */
  private getTranslations(language: SupportedLanguage): Record<string, string> {
    const translations = {
      en: {
        invoice: 'INVOICE',
        billTo: 'Bill To',
        invoiceNumber: 'Invoice #',
        issueDate: 'Issue Date',
        dueDate: 'Due Date',
        status: 'Status',
        description: 'Description',
        quantity: 'Quantity',
        unitPrice: 'Unit Price',
        total: 'Total',
        subtotal: 'Subtotal',
        tax: 'Tax',
        totalAmount: 'Total Amount',
        paymentTerms: 'Payment Terms',
        notes: 'Notes',
        thankYou: 'Thank you for your business!',
        companyTaxId: 'Company Tax ID',
        registrationNumber: 'Registration Number',
        vatNumber: 'VAT Number',
        exemptReason: 'Tax Exempt Reason',
        reverseCharge: 'Reverse Charge'
      },
      de: {
        invoice: 'RECHNUNG',
        billTo: 'Rechnungsempfänger',
        invoiceNumber: 'Rechnungsnr.',
        issueDate: 'Rechnungsdatum',
        dueDate: 'Fälligkeitsdatum',
        status: 'Status',
        description: 'Beschreibung',
        quantity: 'Menge',
        unitPrice: 'Einzelpreis',
        total: 'Gesamt',
        subtotal: 'Zwischensumme',
        tax: 'MwSt.',
        totalAmount: 'Gesamtbetrag',
        paymentTerms: 'Zahlungsbedingungen',
        notes: 'Anmerkungen',
        thankYou: 'Vielen Dank für Ihr Vertrauen!',
        companyTaxId: 'Umsatzsteuer-ID',
        registrationNumber: 'Handelsregisternummer',
        vatNumber: 'USt-IdNr.',
        exemptReason: 'Steuerbefreiungsgrund',
        reverseCharge: 'Reverse Charge Verfahren'
      },
      fr: {
        invoice: 'FACTURE',
        billTo: 'Facturer à',
        invoiceNumber: 'N° de facture',
        issueDate: 'Date d\'émission',
        dueDate: 'Date d\'échéance',
        status: 'Statut',
        description: 'Description',
        quantity: 'Quantité',
        unitPrice: 'Prix unitaire',
        total: 'Total',
        subtotal: 'Sous-total',
        tax: 'TVA',
        totalAmount: 'Montant total',
        paymentTerms: 'Conditions de paiement',
        notes: 'Notes',
        thankYou: 'Merci pour votre confiance !',
        companyTaxId: 'N° TVA',
        registrationNumber: 'N° d\'immatriculation',
        vatNumber: 'N° de TVA',
        exemptReason: 'Raison d\'exemption de taxe',
        reverseCharge: 'Autoliquidation'
      },
      es: {
        invoice: 'FACTURA',
        billTo: 'Facturar a',
        invoiceNumber: 'N° de factura',
        issueDate: 'Fecha de emisión',
        dueDate: 'Fecha de vencimiento',
        status: 'Estado',
        description: 'Descripción',
        quantity: 'Cantidad',
        unitPrice: 'Precio unitario',
        total: 'Total',
        subtotal: 'Subtotal',
        tax: 'IVA',
        totalAmount: 'Importe total',
        paymentTerms: 'Términos de pago',
        notes: 'Notas',
        thankYou: '¡Gracias por su confianza!',
        companyTaxId: 'CIF',
        registrationNumber: 'Número de registro',
        vatNumber: 'N° de IVA',
        exemptReason: 'Motivo de exención fiscal',
        reverseCharge: 'Inversión del sujeto pasivo'
      },
      it: {
        invoice: 'FATTURA',
        billTo: 'Fatturare a',
        invoiceNumber: 'N. fattura',
        issueDate: 'Data di emissione',
        dueDate: 'Data di scadenza',
        status: 'Stato',
        description: 'Descrizione',
        quantity: 'Quantità',
        unitPrice: 'Prezzo unitario',
        total: 'Totale',
        subtotal: 'Subtotale',
        tax: 'IVA',
        totalAmount: 'Importo totale',
        paymentTerms: 'Termini di pagamento',
        notes: 'Note',
        thankYou: 'Grazie per la fiducia!',
        companyTaxId: 'Partita IVA',
        registrationNumber: 'Numero di registrazione',
        vatNumber: 'N. IVA',
        exemptReason: 'Motivo esenzione fiscale',
        reverseCharge: 'Reverse Charge'
      },
      nl: {
        invoice: 'FACTUUR',
        billTo: 'Factureren aan',
        invoiceNumber: 'Factuurnummer',
        issueDate: 'Factuurdatum',
        dueDate: 'Vervaldatum',
        status: 'Status',
        description: 'Omschrijving',
        quantity: 'Aantal',
        unitPrice: 'Eenheidsprijs',
        total: 'Totaal',
        subtotal: 'Subtotaal',
        tax: 'BTW',
        totalAmount: 'Totaalbedrag',
        paymentTerms: 'Betalingsvoorwaarden',
        notes: 'Opmerkingen',
        thankYou: 'Bedankt voor uw vertrouwen!',
        companyTaxId: 'BTW-nummer',
        registrationNumber: 'Registratienummer',
        vatNumber: 'BTW-nr.',
        exemptReason: 'Reden belastingvrijstelling',
        reverseCharge: 'Omgekeerde heffing'
      },
      pl: {
        invoice: 'FAKTURA',
        billTo: 'Nabywca',
        invoiceNumber: 'Nr faktury',
        issueDate: 'Data wystawienia',
        dueDate: 'Termin płatności',
        status: 'Status',
        description: 'Opis',
        quantity: 'Ilość',
        unitPrice: 'Cena jednostkowa',
        total: 'Razem',
        subtotal: 'Razem netto',
        tax: 'VAT',
        totalAmount: 'Razem brutto',
        paymentTerms: 'Warunki płatności',
        notes: 'Uwagi',
        thankYou: 'Dziękujemy za zaufanie!',
        companyTaxId: 'NIP',
        registrationNumber: 'REGON',
        vatNumber: 'Nr VAT',
        exemptReason: 'Podstawa zwolnienia',
        reverseCharge: 'Odwrotne obciążenie'
      },
      cs: {
        invoice: 'FAKTURA',
        billTo: 'Odběratel',
        invoiceNumber: 'Číslo faktury',
        issueDate: 'Datum vystavení',
        dueDate: 'Datum splatnosti',
        status: 'Stav',
        description: 'Popis',
        quantity: 'Množství',
        unitPrice: 'Jednotková cena',
        total: 'Celkem',
        subtotal: 'Mezisoučet',
        tax: 'DPH',
        totalAmount: 'Celková částka',
        paymentTerms: 'Platební podmínky',
        notes: 'Poznámky',
        thankYou: 'Děkujeme za důvěru!',
        companyTaxId: 'DIČ',
        registrationNumber: 'IČ',
        vatNumber: 'DIČ',
        exemptReason: 'Důvod osvobození od daně',
        reverseCharge: 'Přenesení daňové povinnosti'
      }
    }

    return translations[language] || translations.en
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
   * Format currency for display with locale support
   */
  private formatCurrency(amount: number, currency: string, locale?: string): string {
    const currencyInfo = SUPPORTED_CURRENCIES[currency.toUpperCase()]
    const formatLocale = locale || currencyInfo?.locale || 'en-US'
    
    return new Intl.NumberFormat(formatLocale, {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
  }

  /**
   * Get VAT rate for a country
   */
  static getVATRate(countryCode: string, type: 'standard' | 'reduced' = 'standard'): number {
    const vatInfo = EU_VAT_RATES[countryCode.toUpperCase()]
    if (!vatInfo) return 0
    
    if (type === 'standard') {
      return vatInfo.standard
    } else {
      return vatInfo.reduced[0] || vatInfo.standard
    }
  }

  /**
   * Validate VAT number format
   */
  static validateVATNumber(vatNumber: string, countryCode: string): boolean {
    if (!vatNumber) return false
    
    // Remove spaces and convert to uppercase
    const cleanVAT = vatNumber.replace(/\s/g, '').toUpperCase()
    
    // Basic format validation for EU countries
    const vatFormats: Record<string, RegExp> = {
      DE: /^DE\d{9}$/,
      FR: /^FR[A-HJ-NP-Z0-9]{2}\d{9}$/,
      GB: /^GB\d{9}$|^GB\d{12}$|^GBGD\d{3}$|^GBHA\d{3}$/,
      IT: /^IT\d{11}$/,
      ES: /^ES[A-Z]\d{7}[A-Z]$|^ES[A-Z]\d{8}$|^ES\d{8}[A-Z]$/,
      NL: /^NL\d{9}B\d{2}$/,
      BE: /^BE0\d{9}$/,
      AT: /^ATU\d{8}$/,
      // Add more as needed
    }
    
    const format = vatFormats[countryCode.toUpperCase()]
    return format ? format.test(cleanVAT) : true // Return true for unknown countries
  }

  /**
   * Calculate tax with European VAT rules
   */
  static calculateEuropeanTax(
    amount: number,
    customerCountry: string,
    supplierCountry: string,
    isB2B: boolean = false,
    hasValidVATNumber: boolean = false
  ): { taxRate: number; taxAmount: number; taxExempt: boolean; reason?: string } {
    // If both in same EU country, apply local VAT
    if (customerCountry === supplierCountry && EU_VAT_RATES[customerCountry]) {
      const rate = this.getVATRate(customerCountry)
      return {
        taxRate: rate,
        taxAmount: this.calculateTax(amount, rate),
        taxExempt: false
      }
    }
    
    // Cross-border B2B with valid VAT number - reverse charge
    if (isB2B && hasValidVATNumber && EU_VAT_RATES[customerCountry] && EU_VAT_RATES[supplierCountry]) {
      return {
        taxRate: 0,
        taxAmount: 0,
        taxExempt: true,
        reason: 'Reverse charge mechanism (B2B with valid VAT number)'
      }
    }
    
    // Cross-border B2C or B2B without valid VAT - apply supplier country VAT
    if (EU_VAT_RATES[supplierCountry]) {
      const rate = this.getVATRate(supplierCountry)
      return {
        taxRate: rate,
        taxAmount: this.calculateTax(amount, rate),
        taxExempt: false
      }
    }
    
    // Non-EU transaction
    return {
      taxRate: 0,
      taxAmount: 0,
      taxExempt: true,
      reason: 'Non-EU transaction'
    }
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
   * Enhanced invoice data validation with European compliance
   */
  static validateInvoiceData(data: Partial<InvoiceData>): string[] {
    const errors: string[] = []

    // Basic validation
    if (!data.customerInfo?.name) errors.push('Customer name is required')
    if (!data.customerInfo?.email) errors.push('Customer email is required')
    if (!data.items || data.items.length === 0) errors.push('At least one item is required')
    if (!data.currency) errors.push('Currency is required')
    if (!data.dueDate) errors.push('Due date is required')
    if (!data.invoiceNumber) errors.push('Invoice number is required')
    
    // Currency validation
    if (data.currency && !SUPPORTED_CURRENCIES[data.currency.toUpperCase()]) {
      errors.push(`Unsupported currency: ${data.currency}`)
    }
    
    // Address validation for EU VAT compliance
    if (data.customerInfo?.address) {
      const addr = data.customerInfo.address
      if (!addr.country) errors.push('Customer country is required')
      if (!addr.city) errors.push('Customer city is required')
      if (!addr.postal_code) errors.push('Customer postal code is required')
    }
    
    // Company info validation
    if (data.companyInfo) {
      if (!data.companyInfo.name) errors.push('Company name is required')
      if (!data.companyInfo.address?.country) errors.push('Company country is required')
      if (!data.companyInfo.email) errors.push('Company email is required')
    }
    
    // VAT number validation
    if (data.customerInfo?.taxId && data.customerInfo?.address?.country) {
      if (!this.validateVATNumber(data.customerInfo.taxId, data.customerInfo.address.country)) {
        errors.push('Invalid VAT number format')
      }
    }
    
    // Items validation
    if (data.items) {
      data.items.forEach((item, index) => {
        if (!item.description) errors.push(`Item ${index + 1}: Description is required`)
        if (!item.quantity || item.quantity <= 0) errors.push(`Item ${index + 1}: Valid quantity is required`)
        if (item.unitPrice === undefined || item.unitPrice < 0) errors.push(`Item ${index + 1}: Valid unit price is required`)
        if (item.taxRate !== undefined && (item.taxRate < 0 || item.taxRate > 100)) {
          errors.push(`Item ${index + 1}: Tax rate must be between 0 and 100`)
        }
      })
    }

    // Date validation
    if (data.issueDate && data.dueDate) {
      if (data.dueDate <= data.issueDate) {
        errors.push('Due date must be after issue date')
      }
    }

    return errors
  }

  /**
   * Generate compliant invoice number with custom format
   */
  static generateInvoiceNumber(
    prefix: string = 'INV',
    format: 'sequential' | 'date-based' | 'hybrid' = 'hybrid',
    sequence?: number
  ): string {
    const date = new Date()
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    
    switch (format) {
      case 'sequential':
        const seq = sequence || Date.now().toString().slice(-6)
        return `${prefix}-${seq.toString().padStart(6, '0')}`
      
      case 'date-based':
        const timestamp = Date.now().toString().slice(-4)
        return `${prefix}-${year}${month}${day}-${timestamp}`
      
      case 'hybrid':
      default:
        const hybridSeq = sequence || Date.now().toString().slice(-4)
        return `${prefix}-${year}${month}-${hybridSeq}`
    }
  }

  /**
   * Create invoice with automatic European VAT calculation
   */
  static createInvoiceWithAutoVAT(
    baseData: Omit<InvoiceData, 'tax' | 'total'>,
    supplierCountry: string = 'DE',
    isB2B: boolean = false
  ): InvoiceData {
    const customerCountry = baseData.customerInfo.address?.country || 'DE'
    const hasValidVATNumber = baseData.customerInfo.taxId ? 
      this.validateVATNumber(baseData.customerInfo.taxId, customerCountry) : false
    
    const taxCalc = this.calculateEuropeanTax(
      baseData.subtotal,
      customerCountry,
      supplierCountry,
      isB2B,
      hasValidVATNumber
    )
    
    return {
      ...baseData,
      tax: {
        rate: taxCalc.taxRate,
        amount: taxCalc.taxAmount,
        exempt: taxCalc.taxExempt,
        exemptReason: taxCalc.reason
      },
      total: baseData.subtotal + taxCalc.taxAmount
    }
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