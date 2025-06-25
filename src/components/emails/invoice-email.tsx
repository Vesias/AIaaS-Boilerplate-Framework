/**
 * Professional Invoice Email Template
 * Beautiful responsive email template for sending invoices
 * Supports multiple languages, themes, and European compliance
 */

import React from 'react'
import { InvoiceData, SupportedLanguage } from '@/lib/invoice'

interface InvoiceEmailProps {
  invoice: InvoiceData
  language?: SupportedLanguage
  theme?: 'light' | 'dark' | 'branded'
  companyLogo?: string
  customMessage?: string
  paymentLink?: string
  downloadLink?: string
}

// Email translations
const emailTranslations = {
  en: {
    subject: 'Invoice {{invoiceNumber}} from {{companyName}}',
    greeting: 'Hello {{customerName}},',
    introMessage: 'Thank you for your business! Please find your invoice attached.',
    invoiceDetails: 'Invoice Details',
    payNow: 'Pay Now',
    downloadInvoice: 'Download Invoice',
    paymentInstructions: 'Payment Instructions',
    contactUs: 'Questions? Contact Us',
    footer: 'This is an automated email. Please do not reply to this address.',
    dueReminder: 'Payment is due by {{dueDate}}',
    amountDue: 'Amount Due',
    legalNotice: 'This invoice is generated automatically and is valid without signature.',
    privacyNotice: 'Your data is processed according to our privacy policy and GDPR regulations.',
    bankDetails: 'Bank Transfer Details',
    accountName: 'Account Name',
    iban: 'IBAN',
    bic: 'BIC/SWIFT',
    reference: 'Payment Reference'
  },
  de: {
    subject: 'Rechnung {{invoiceNumber}} von {{companyName}}',
    greeting: 'Hallo {{customerName}},',
    introMessage: 'Vielen Dank für Ihr Vertrauen! Anbei finden Sie Ihre Rechnung.',
    invoiceDetails: 'Rechnungsdetails',
    payNow: 'Jetzt bezahlen',
    downloadInvoice: 'Rechnung herunterladen',
    paymentInstructions: 'Zahlungshinweise',
    contactUs: 'Fragen? Kontaktieren Sie uns',
    footer: 'Dies ist eine automatisierte E-Mail. Bitte antworten Sie nicht auf diese Adresse.',
    dueReminder: 'Zahlung fällig bis {{dueDate}}',
    amountDue: 'Fälliger Betrag',
    legalNotice: 'Diese Rechnung wurde automatisch erstellt und ist ohne Unterschrift gültig.',
    privacyNotice: 'Ihre Daten werden gemäß unserer Datenschutzerklärung und DSGVO verarbeitet.',
    bankDetails: 'Bankverbindung',
    accountName: 'Kontoinhaber',
    iban: 'IBAN',
    bic: 'BIC/SWIFT',
    reference: 'Verwendungszweck'
  },
  fr: {
    subject: 'Facture {{invoiceNumber}} de {{companyName}}',
    greeting: 'Bonjour {{customerName}},',
    introMessage: 'Merci pour votre confiance ! Veuillez trouver votre facture en pièce jointe.',
    invoiceDetails: 'Détails de la facture',
    payNow: 'Payer maintenant',
    downloadInvoice: 'Télécharger la facture',
    paymentInstructions: 'Instructions de paiement',
    contactUs: 'Questions ? Contactez-nous',
    footer: 'Ceci est un email automatique. Veuillez ne pas répondre à cette adresse.',
    dueReminder: 'Paiement dû avant le {{dueDate}}',
    amountDue: 'Montant dû',
    legalNotice: 'Cette facture est générée automatiquement et est valide sans signature.',
    privacyNotice: 'Vos données sont traitées selon notre politique de confidentialité et le RGPD.',
    bankDetails: 'Coordonnées bancaires',
    accountName: 'Titulaire du compte',
    iban: 'IBAN',
    bic: 'BIC/SWIFT',
    reference: 'Référence de paiement'
  },
  es: {
    subject: 'Factura {{invoiceNumber}} de {{companyName}}',
    greeting: 'Hola {{customerName}},',
    introMessage: '¡Gracias por su confianza! Encuentre su factura adjunta.',
    invoiceDetails: 'Detalles de la factura',
    payNow: 'Pagar ahora',
    downloadInvoice: 'Descargar factura',
    paymentInstructions: 'Instrucciones de pago',
    contactUs: '¿Preguntas? Contáctenos',
    footer: 'Este es un email automatizado. No responda a esta dirección.',
    dueReminder: 'Pago vence el {{dueDate}}',
    amountDue: 'Importe debido',
    legalNotice: 'Esta factura se genera automáticamente y es válida sin firma.',
    privacyNotice: 'Sus datos se procesan según nuestra política de privacidad y GDPR.',
    bankDetails: 'Datos bancarios',
    accountName: 'Titular de la cuenta',
    iban: 'IBAN',
    bic: 'BIC/SWIFT',
    reference: 'Referencia de pago'
  },
  it: {
    subject: 'Fattura {{invoiceNumber}} da {{companyName}}',
    greeting: 'Ciao {{customerName}},',
    introMessage: 'Grazie per la fiducia! Trova la tua fattura in allegato.',
    invoiceDetails: 'Dettagli fattura',
    payNow: 'Paga ora',
    downloadInvoice: 'Scarica fattura',
    paymentInstructions: 'Istruzioni per il pagamento',
    contactUs: 'Domande? Contattaci',
    footer: 'Questa è una email automatica. Non rispondere a questo indirizzo.',
    dueReminder: 'Pagamento dovuto entro {{dueDate}}',
    amountDue: 'Importo dovuto',
    legalNotice: 'Questa fattura è generata automaticamente ed è valida senza firma.',
    privacyNotice: 'I tuoi dati sono elaborati secondo la nostra privacy policy e GDPR.',
    bankDetails: 'Coordinate bancarie',
    accountName: 'Intestatario conto',
    iban: 'IBAN',
    bic: 'BIC/SWIFT',
    reference: 'Causale pagamento'
  }
}

export function InvoiceEmail({
  invoice,
  language = 'en',
  theme = 'light',
  companyLogo,
  customMessage,
  paymentLink,
  downloadLink
}: InvoiceEmailProps) {
  const t = emailTranslations[language] || emailTranslations.en
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(language === 'de' ? 'de-DE' : 'en-US', {
      style: 'currency',
      currency: invoice.currency
    }).format(amount)
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat(language === 'de' ? 'de-DE' : 'en-US').format(date)
  }

  const replaceVariables = (text: string) => {
    return text
      .replace('{{invoiceNumber}}', invoice.invoiceNumber)
      .replace('{{companyName}}', invoice.companyInfo.name)
      .replace('{{customerName}}', invoice.customerInfo.name)
      .replace('{{dueDate}}', formatDate(invoice.dueDate))
  }

  const themeColors = {
    light: {
      background: '#ffffff',
      cardBackground: '#f8f9fa',
      text: '#333333',
      primary: '#2563eb',
      border: '#e5e7eb',
      accent: '#3b82f6'
    },
    dark: {
      background: '#1f2937',
      cardBackground: '#374151',
      text: '#f9fafb',
      primary: '#60a5fa',
      border: '#4b5563',
      accent: '#93c5fd'
    },
    branded: {
      background: '#ffffff',
      cardBackground: '#f0f9ff',
      text: '#1e293b',
      primary: '#0ea5e9',
      border: '#bae6fd',
      accent: '#0284c7'
    }
  }

  const colors = themeColors[theme]

  return (
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta httpEquiv="Content-Type" content="text/html; charset=UTF-8" />
        <title>{replaceVariables(t.subject)}</title>
        <style>
          {`
            body {
              background-color: ${colors.background};
              color: ${colors.text};
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              line-height: 1.6;
              margin: 0;
              padding: 0;
            }
            .email-container {
              max-width: 600px;
              margin: 0 auto;
              background-color: ${colors.background};
            }
            .header {
              background: linear-gradient(135deg, ${colors.primary}, ${colors.accent});
              color: white;
              padding: 30px 20px;
              text-align: center;
              border-radius: 8px 8px 0 0;
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
              font-weight: 600;
            }
            .logo {
              max-width: 150px;
              height: auto;
              margin-bottom: 15px;
            }
            .content {
              padding: 30px 20px;
              background-color: ${colors.background};
            }
            .card {
              background-color: ${colors.cardBackground};
              border: 1px solid ${colors.border};
              border-radius: 8px;
              padding: 20px;
              margin: 20px 0;
            }
            .invoice-summary {
              display: flex;
              justify-content: space-between;
              align-items: center;
              flex-wrap: wrap;
              gap: 15px;
            }
            .invoice-number {
              font-size: 24px;
              font-weight: 700;
              color: ${colors.primary};
            }
            .amount-due {
              font-size: 32px;
              font-weight: 700;
              color: ${colors.primary};
              text-align: right;
            }
            .amount-label {
              font-size: 14px;
              color: ${colors.text};
              opacity: 0.7;
              margin-bottom: 5px;
            }
            .details-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 15px;
              margin: 20px 0;
            }
            .detail-item {
              padding: 10px 0;
              border-bottom: 1px solid ${colors.border};
            }
            .detail-label {
              font-size: 12px;
              text-transform: uppercase;
              color: ${colors.text};
              opacity: 0.6;
              margin-bottom: 5px;
            }
            .detail-value {
              font-weight: 600;
              color: ${colors.text};
            }
            .btn {
              display: inline-block;
              padding: 12px 24px;
              margin: 10px 5px;
              background-color: ${colors.primary};
              color: white;
              text-decoration: none;
              border-radius: 6px;
              font-weight: 600;
              text-align: center;
              transition: background-color 0.3s ease;
            }
            .btn:hover {
              background-color: ${colors.accent};
            }
            .btn-secondary {
              background-color: transparent;
              color: ${colors.primary};
              border: 2px solid ${colors.primary};
            }
            .btn-secondary:hover {
              background-color: ${colors.primary};
              color: white;
            }
            .bank-details {
              background-color: ${colors.cardBackground};
              border-left: 4px solid ${colors.primary};
              padding: 15px;
              margin: 20px 0;
            }
            .bank-details h4 {
              margin: 0 0 10px 0;
              color: ${colors.primary};
            }
            .bank-row {
              display: flex;
              justify-content: space-between;
              margin: 5px 0;
              padding: 5px 0;
              border-bottom: 1px dotted ${colors.border};
            }
            .footer {
              background-color: ${colors.cardBackground};
              padding: 20px;
              text-align: center;
              font-size: 12px;
              color: ${colors.text};
              opacity: 0.7;
              border-radius: 0 0 8px 8px;
            }
            .due-warning {
              background-color: #fef3c7;
              border: 1px solid #f59e0b;
              color: #92400e;
              padding: 15px;
              border-radius: 6px;
              margin: 20px 0;
              text-align: center;
              font-weight: 600;
            }
            .status-badge {
              display: inline-block;
              padding: 4px 12px;
              border-radius: 20px;
              font-size: 12px;
              font-weight: 600;
              text-transform: uppercase;
            }
            .status-sent {
              background-color: #dbeafe;
              color: #1e40af;
            }
            .status-paid {
              background-color: #dcfce7;
              color: #166534;
            }
            .status-overdue {
              background-color: #fee2e2;
              color: #dc2626;
            }
            @media only screen and (max-width: 600px) {
              .email-container {
                width: 100% !important;
              }
              .content {
                padding: 20px 15px !important;
              }
              .invoice-summary {
                flex-direction: column;
                text-align: center;
              }
              .details-grid {
                grid-template-columns: 1fr;
              }
              .btn {
                display: block;
                margin: 10px 0;
              }
            }
          `}
        </style>
      </head>
      <body>
        <div className="email-container">
          <div className="header">
            {companyLogo && (
              <img src={companyLogo} alt={invoice.companyInfo.name} className="logo" />
            )}
            <h1>{t.invoiceDetails}</h1>
          </div>

          <div className="content">
            <p>{replaceVariables(t.greeting)}</p>
            <p>{customMessage || replaceVariables(t.introMessage)}</p>

            <div className="card">
              <div className="invoice-summary">
                <div>
                  <div className="invoice-number">#{invoice.invoiceNumber}</div>
                  <span className={`status-badge status-${invoice.status}`}>
                    {invoice.status.toUpperCase()}
                  </span>
                </div>
                <div>
                  <div className="amount-label">{t.amountDue}</div>
                  <div className="amount-due">{formatCurrency(invoice.total)}</div>
                </div>
              </div>

              <div className="details-grid">
                <div className="detail-item">
                  <div className="detail-label">{t.invoiceDetails.replace('Details', 'Date')}</div>
                  <div className="detail-value">{formatDate(invoice.issueDate)}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">Due Date</div>
                  <div className="detail-value">{formatDate(invoice.dueDate)}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">Customer</div>
                  <div className="detail-value">{invoice.customerInfo.name}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">Amount</div>
                  <div className="detail-value">{formatCurrency(invoice.total)}</div>
                </div>
              </div>
            </div>

            {invoice.status !== 'paid' && new Date() < invoice.dueDate && (
              <div className="due-warning">
                {replaceVariables(t.dueReminder)}
              </div>
            )}

            <div style={{ textAlign: 'center', margin: '30px 0' }}>
              {paymentLink && invoice.status !== 'paid' && (
                <a href={paymentLink} className="btn">{t.payNow}</a>
              )}
              {downloadLink && (
                <a href={downloadLink} className="btn btn-secondary">{t.downloadInvoice}</a>
              )}
            </div>

            {invoice.bankDetails && invoice.status !== 'paid' && (
              <div className="bank-details">
                <h4>{t.bankDetails}</h4>
                <div className="bank-row">
                  <span>{t.accountName}:</span>
                  <span>{invoice.bankDetails.accountName}</span>
                </div>
                <div className="bank-row">
                  <span>{t.iban}:</span>
                  <span>{invoice.bankDetails.iban}</span>
                </div>
                <div className="bank-row">
                  <span>{t.bic}:</span>
                  <span>{invoice.bankDetails.bic}</span>
                </div>
                <div className="bank-row">
                  <span>{t.reference}:</span>
                  <span>{invoice.invoiceNumber}</span>
                </div>
              </div>
            )}

            {invoice.paymentTerms && (
              <div className="card">
                <h4>{t.paymentInstructions}</h4>
                <p>{invoice.paymentTerms}</p>
              </div>
            )}

            <div style={{ textAlign: 'center', margin: '20px 0' }}>
              <p>{t.contactUs}: <a href={`mailto:${invoice.companyInfo.email}`} style={{ color: colors.primary }}>
                {invoice.companyInfo.email}
              </a></p>
            </div>
          </div>

          <div className="footer">
            <p>{t.footer}</p>
            <p>{t.legalNotice}</p>
            <p>{t.privacyNotice}</p>
            <p>
              {invoice.companyInfo.name} • {invoice.companyInfo.address.line1} • 
              {invoice.companyInfo.address.city}, {invoice.companyInfo.address.country}
            </p>
            {invoice.companyInfo.taxId && (
              <p>VAT ID: {invoice.companyInfo.taxId}</p>
            )}
          </div>
        </div>
      </body>
    </html>
  )
}

export default InvoiceEmail