/**
 * Payment Reminder Email Template
 * Automated reminder emails for overdue invoices
 * Supports escalation levels and multiple languages
 */

import React from 'react'
import { InvoiceData, SupportedLanguage } from '@/lib/invoice'

interface PaymentReminderProps {
  invoice: InvoiceData
  language?: SupportedLanguage
  reminderLevel: 1 | 2 | 3 // Escalation levels
  daysOverdue: number
  customMessage?: string
  paymentLink?: string
  contactEmail?: string
  contactPhone?: string
  companyLogo?: string
  lateFeesAmount?: number
}

// Reminder translations
const reminderTranslations = {
  en: {
    subject: {
      1: 'Friendly Reminder: Invoice {{invoiceNumber}} Payment Due',
      2: 'Second Notice: Invoice {{invoiceNumber}} is {{daysOverdue}} Days Overdue',
      3: 'Final Notice: Invoice {{invoiceNumber}} - Immediate Action Required'
    },
    greeting: 'Dear {{customerName}},',
    urgencyLevel: {
      1: 'friendly reminder',
      2: 'urgent reminder',
      3: 'final notice'
    },
    introMessage: {
      1: 'We hope this email finds you well. This is a {{urgencyLevel}} that your payment for invoice {{invoiceNumber}} was due on {{dueDate}}.',
      2: 'Your invoice {{invoiceNumber}} is now {{daysOverdue}} days overdue. Please arrange payment at your earliest convenience.',
      3: 'This is a final notice regarding your overdue invoice {{invoiceNumber}}. Immediate action is required to avoid further escalation.'
    },
    paymentRequest: {
      1: 'We kindly ask you to process the payment at your earliest convenience.',
      2: 'Please arrange payment immediately to avoid any service interruption.',
      3: 'Payment must be received within 7 days to avoid collection proceedings.'
    },
    amountDue: 'Amount Due',
    daysOverdue: 'Days Overdue',
    originalDueDate: 'Original Due Date',
    newDueDate: 'Payment Required By',
    payNow: 'Pay Now',
    downloadInvoice: 'Download Invoice',
    contactUs: 'Contact Us',
    lateFees: 'Late Fees Applied',
    consequences: {
      2: 'Continued non-payment may result in late fees and service suspension.',
      3: 'Failure to pay may result in: account suspension, additional collection fees, and legal action.'
    },
    footer: {
      1: 'Thank you for your prompt attention to this matter.',
      2: 'We appreciate your immediate attention to resolve this matter.',
      3: 'We trust this matter will be resolved promptly to avoid further action.'
    },
    automated: 'This is an automated reminder. If you have already made this payment, please disregard this notice.',
    assistance: 'If you need assistance or have questions about this invoice, please contact us immediately.'
  },
  de: {
    subject: {
      1: 'Freundliche Erinnerung: Rechnung {{invoiceNumber}} - Zahlung fällig',
      2: 'Zweite Mahnung: Rechnung {{invoiceNumber}} ist {{daysOverdue}} Tage überfällig',
      3: 'Letzte Mahnung: Rechnung {{invoiceNumber}} - Sofortiges Handeln erforderlich'
    },
    greeting: 'Sehr geehrte(r) {{customerName}},',
    urgencyLevel: {
      1: 'freundliche Erinnerung',
      2: 'dringende Mahnung',
      3: 'letzte Mahnung'
    },
    introMessage: {
      1: 'Dies ist eine {{urgencyLevel}}, dass die Zahlung für Rechnung {{invoiceNumber}} am {{dueDate}} fällig war.',
      2: 'Ihre Rechnung {{invoiceNumber}} ist nun {{daysOverdue}} Tage überfällig. Bitte veranlassen Sie die Zahlung umgehend.',
      3: 'Dies ist eine letzte Mahnung bezüglich Ihrer überfälligen Rechnung {{invoiceNumber}}. Sofortiges Handeln ist erforderlich.'
    },
    paymentRequest: {
      1: 'Wir bitten Sie höflich, die Zahlung baldmöglichst zu veranlassen.',
      2: 'Bitte veranlassen Sie die Zahlung sofort, um Serviceunterbrechungen zu vermeiden.',
      3: 'Die Zahlung muss innerhalb von 7 Tagen eingehen, um Inkassomaßnahmen zu vermeiden.'
    },
    amountDue: 'Fälliger Betrag',
    daysOverdue: 'Tage überfällig',
    originalDueDate: 'Ursprüngliches Fälligkeitsdatum',
    newDueDate: 'Zahlung erforderlich bis',
    payNow: 'Jetzt bezahlen',
    downloadInvoice: 'Rechnung herunterladen',
    contactUs: 'Kontaktieren Sie uns',
    lateFees: 'Mahngebühren erhoben',
    consequences: {
      2: 'Weitere Nichtzahlung kann zu Mahngebühren und Serviceaussetzung führen.',
      3: 'Nichtzahlung kann zur Folge haben: Kontosperrung, zusätzliche Inkassogebühren und rechtliche Schritte.'
    },
    footer: {
      1: 'Vielen Dank für Ihre prompte Bearbeitung.',
      2: 'Wir schätzen Ihre sofortige Aufmerksamkeit zur Lösung dieser Angelegenheit.',
      3: 'Wir vertrauen darauf, dass diese Angelegenheit prompt gelöst wird.'
    },
    automated: 'Dies ist eine automatische Erinnerung. Falls Sie bereits bezahlt haben, ignorieren Sie diese Nachricht.',
    assistance: 'Wenn Sie Hilfe benötigen oder Fragen zu dieser Rechnung haben, kontaktieren Sie uns sofort.'
  },
  fr: {
    subject: {
      1: 'Rappel amical: Facture {{invoiceNumber}} - Paiement dû',
      2: 'Deuxième rappel: Facture {{invoiceNumber}} en retard de {{daysOverdue}} jours',
      3: 'Dernier rappel: Facture {{invoiceNumber}} - Action immédiate requise'
    },
    greeting: 'Cher(e) {{customerName}},',
    urgencyLevel: {
      1: 'rappel amical',
      2: 'rappel urgent',
      3: 'dernier rappel'
    },
    introMessage: {
      1: 'Ceci est un {{urgencyLevel}} que le paiement de la facture {{invoiceNumber}} était dû le {{dueDate}}.',
      2: 'Votre facture {{invoiceNumber}} est maintenant en retard de {{daysOverdue}} jours. Veuillez procéder au paiement dans les plus brefs délais.',
      3: 'Ceci est un dernier rappel concernant votre facture en retard {{invoiceNumber}}. Une action immédiate est requise.'
    },
    paymentRequest: {
      1: 'Nous vous demandons gentiment de procéder au paiement dès que possible.',
      2: 'Veuillez procéder au paiement immédiatement pour éviter toute interruption de service.',
      3: 'Le paiement doit être reçu dans les 7 jours pour éviter des procédures de recouvrement.'
    },
    amountDue: 'Montant dû',
    daysOverdue: 'Jours de retard',
    originalDueDate: 'Date d\'échéance originale',
    newDueDate: 'Paiement requis avant le',
    payNow: 'Payer maintenant',
    downloadInvoice: 'Télécharger la facture',
    contactUs: 'Nous contacter',
    lateFees: 'Frais de retard appliqués',
    consequences: {
      2: 'Le non-paiement continu peut entraîner des frais de retard et la suspension du service.',
      3: 'Le défaut de paiement peut entraîner: suspension du compte, frais de recouvrement supplémentaires et action en justice.'
    },
    footer: {
      1: 'Merci pour votre attention rapide à cette question.',
      2: 'Nous apprécions votre attention immédiate pour résoudre cette question.',
      3: 'Nous espérons que cette question sera résolue rapidement.'
    },
    automated: 'Ceci est un rappel automatique. Si vous avez déjà effectué ce paiement, ignorez cet avis.',
    assistance: 'Si vous avez besoin d\'aide ou avez des questions sur cette facture, contactez-nous immédiatement.'
  }
}

export function PaymentReminder({
  invoice,
  language = 'en',
  reminderLevel,
  daysOverdue,
  customMessage,
  paymentLink,
  contactEmail,
  contactPhone,
  companyLogo,
  lateFeesAmount
}: PaymentReminderProps) {
  const t = reminderTranslations[language] || reminderTranslations.en
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(language === 'de' ? 'de-DE' : language === 'fr' ? 'fr-FR' : 'en-US', {
      style: 'currency',
      currency: invoice.currency
    }).format(amount)
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat(language === 'de' ? 'de-DE' : language === 'fr' ? 'fr-FR' : 'en-US').format(date)
  }

  const replaceVariables = (text: string) => {
    return text
      .replace(/\{\{invoiceNumber\}\}/g, invoice.invoiceNumber)
      .replace(/\{\{customerName\}\}/g, invoice.customerInfo.name)
      .replace(/\{\{dueDate\}\}/g, formatDate(invoice.dueDate))
      .replace(/\{\{daysOverdue\}\}/g, daysOverdue.toString())
      .replace(/\{\{urgencyLevel\}\}/g, t.urgencyLevel[reminderLevel])
  }

  const getUrgencyColor = () => {
    switch (reminderLevel) {
      case 1: return '#3b82f6' // Blue - friendly
      case 2: return '#f59e0b' // Orange - warning
      case 3: return '#dc2626' // Red - urgent
      default: return '#3b82f6'
    }
  }

  const getNewDueDate = () => {
    const newDate = new Date()
    newDate.setDate(newDate.getDate() + (reminderLevel === 3 ? 7 : 14))
    return newDate
  }

  const totalAmountDue = lateFeesAmount ? invoice.total + lateFeesAmount : invoice.total

  return (
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta httpEquiv="Content-Type" content="text/html; charset=UTF-8" />
        <title>{replaceVariables(t.subject[reminderLevel])}</title>
        <style>
          {`
            body {
              background-color: #f8f9fa;
              color: #333333;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              line-height: 1.6;
              margin: 0;
              padding: 0;
            }
            .email-container {
              max-width: 600px;
              margin: 20px auto;
              background-color: #ffffff;
              border-radius: 8px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header {
              background: linear-gradient(135deg, ${getUrgencyColor()}, ${getUrgencyColor()}cc);
              color: white;
              padding: 30px 20px;
              text-align: center;
            }
            .logo {
              max-width: 120px;
              height: auto;
              margin-bottom: 15px;
            }
            .urgency-badge {
              display: inline-block;
              background-color: rgba(255, 255, 255, 0.2);
              padding: 8px 16px;
              border-radius: 20px;
              font-size: 14px;
              font-weight: 600;
              text-transform: uppercase;
              margin-bottom: 10px;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
              font-weight: 600;
            }
            .content {
              padding: 30px 20px;
            }
            .overdue-alert {
              background-color: ${reminderLevel === 3 ? '#fee2e2' : reminderLevel === 2 ? '#fef3c7' : '#dbeafe'};
              border: 2px solid ${getUrgencyColor()};
              border-radius: 8px;
              padding: 20px;
              margin: 20px 0;
              text-align: center;
            }
            .overdue-days {
              font-size: 36px;
              font-weight: 700;
              color: ${getUrgencyColor()};
              margin: 10px 0;
            }
            .invoice-summary {
              background-color: #f8f9fa;
              border-radius: 8px;
              padding: 20px;
              margin: 20px 0;
            }
            .summary-row {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 10px 0;
              border-bottom: 1px solid #e5e7eb;
            }
            .summary-row:last-child {
              border-bottom: none;
              font-weight: 700;
              font-size: 18px;
              color: ${getUrgencyColor()};
            }
            .amount-highlight {
              font-size: 32px;
              font-weight: 700;
              color: ${getUrgencyColor()};
              text-align: center;
              margin: 20px 0;
              padding: 20px;
              background-color: ${reminderLevel === 3 ? '#fee2e2' : '#f8f9fa'};
              border-radius: 8px;
              border: 2px solid ${getUrgencyColor()};
            }
            .btn {
              display: inline-block;
              padding: 15px 30px;
              margin: 10px 5px;
              background-color: ${getUrgencyColor()};
              color: white;
              text-decoration: none;
              border-radius: 6px;
              font-weight: 600;
              text-align: center;
              font-size: 16px;
              transition: all 0.3s ease;
            }
            .btn:hover {
              opacity: 0.9;
              transform: translateY(-1px);
            }
            .btn-secondary {
              background-color: transparent;
              color: ${getUrgencyColor()};
              border: 2px solid ${getUrgencyColor()};
            }
            .consequences {
              background-color: #fff3cd;
              border: 1px solid #ffeaa7;
              border-radius: 6px;
              padding: 15px;
              margin: 20px 0;
            }
            .consequences.final {
              background-color: #f8d7da;
              border-color: #f5c6cb;
              color: #721c24;
            }
            .contact-info {
              background-color: #e7f3ff;
              border-radius: 8px;
              padding: 20px;
              margin: 20px 0;
              text-align: center;
            }
            .contact-info h3 {
              margin: 0 0 15px 0;
              color: ${getUrgencyColor()};
            }
            .contact-methods {
              display: flex;
              justify-content: center;
              gap: 20px;
              flex-wrap: wrap;
            }
            .contact-method {
              color: ${getUrgencyColor()};
              text-decoration: none;
              font-weight: 600;
              padding: 8px 16px;
              border: 1px solid ${getUrgencyColor()};
              border-radius: 4px;
            }
            .footer {
              background-color: #f8f9fa;
              padding: 20px;
              text-align: center;
              font-size: 12px;
              color: #6b7280;
              border-top: 1px solid #e5e7eb;
            }
            .late-fees {
              background-color: #fee2e2;
              border: 1px solid #fecaca;
              border-radius: 6px;
              padding: 15px;
              margin: 20px 0;
              color: #dc2626;
            }
            @media only screen and (max-width: 600px) {
              .email-container {
                margin: 10px;
                border-radius: 4px;
              }
              .content {
                padding: 20px 15px;
              }
              .btn {
                display: block;
                margin: 10px 0;
              }
              .contact-methods {
                flex-direction: column;
                align-items: center;
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
            <div className="urgency-badge">
              {t.urgencyLevel[reminderLevel].toUpperCase()}
            </div>
            <h1>{replaceVariables(t.subject[reminderLevel])}</h1>
          </div>

          <div className="content">
            <p>{replaceVariables(t.greeting)}</p>

            <div className="overdue-alert">
              <div className="overdue-days">{daysOverdue}</div>
              <div><strong>{t.daysOverdue}</strong></div>
            </div>

            <p>{customMessage || replaceVariables(t.introMessage[reminderLevel])}</p>

            <div className="amount-highlight">
              <div style={{ fontSize: '14px', marginBottom: '10px' }}>{t.amountDue}</div>
              <div>{formatCurrency(totalAmountDue)}</div>
            </div>

            <div className="invoice-summary">
              <div className="summary-row">
                <span>Invoice Number:</span>
                <span><strong>#{invoice.invoiceNumber}</strong></span>
              </div>
              <div className="summary-row">
                <span>{t.originalDueDate}:</span>
                <span>{formatDate(invoice.dueDate)}</span>
              </div>
              <div className="summary-row">
                <span>{t.daysOverdue}:</span>
                <span><strong>{daysOverdue} days</strong></span>
              </div>
              {lateFeesAmount && lateFeesAmount > 0 && (
                <div className="summary-row">
                  <span>{t.lateFees}:</span>
                  <span><strong>{formatCurrency(lateFeesAmount)}</strong></span>
                </div>
              )}
              <div className="summary-row">
                <span><strong>Total Amount Due:</strong></span>
                <span><strong>{formatCurrency(totalAmountDue)}</strong></span>
              </div>
            </div>

            {lateFeesAmount && lateFeesAmount > 0 && (
              <div className="late-fees">
                <strong>{t.lateFees}:</strong> {formatCurrency(lateFeesAmount)} has been added to your account due to late payment.
              </div>
            )}

            <p><strong>{replaceVariables(t.paymentRequest[reminderLevel])}</strong></p>

            <div style={{ textAlign: 'center', margin: '30px 0' }}>
              {paymentLink && (
                <a href={paymentLink} className="btn">{t.payNow}</a>
              )}
              <a href="#" className="btn btn-secondary">{t.downloadInvoice}</a>
            </div>

            {(reminderLevel === 2 || reminderLevel === 3) && (
              <div className={`consequences ${reminderLevel === 3 ? 'final' : ''}`}>
                <strong>Important:</strong> {t.consequences[reminderLevel]}
              </div>
            )}

            {reminderLevel === 3 && (
              <div className="summary-row" style={{ margin: '20px 0', padding: '15px', backgroundColor: '#fee2e2', borderRadius: '6px' }}>
                <span><strong>{t.newDueDate}:</strong></span>
                <span><strong>{formatDate(getNewDueDate())}</strong></span>
              </div>
            )}

            <div className="contact-info">
              <h3>{t.contactUs}</h3>
              <div className="contact-methods">
                {contactEmail && (
                  <a href={`mailto:${contactEmail}`} className="contact-method">
                    📧 {contactEmail}
                  </a>
                )}
                {contactPhone && (
                  <a href={`tel:${contactPhone}`} className="contact-method">
                    📞 {contactPhone}
                  </a>
                )}
              </div>
            </div>

            <p style={{ fontStyle: 'italic', color: '#6b7280' }}>{t.assistance}</p>
          </div>

          <div className="footer">
            <p><strong>{t.footer[reminderLevel]}</strong></p>
            <p>{t.automated}</p>
            <p>
              {invoice.companyInfo.name} • {invoice.companyInfo.address.line1} • 
              {invoice.companyInfo.address.city}, {invoice.companyInfo.address.country}
            </p>
            {invoice.companyInfo.taxId && (
              <p>VAT ID: {invoice.companyInfo.taxId}</p>
            )}
            <p style={{ fontSize: '10px', marginTop: '15px' }}>
              This is a system-generated reminder. Please do not reply to this email.
            </p>
          </div>
        </div>
      </body>
    </html>
  )
}

export default PaymentReminder