/**
 * Payment Received Email Template
 * Confirmation email for successful payments
 * Includes receipt details and next steps
 */

import React from 'react'
import { InvoiceData, SupportedLanguage } from '@/lib/invoice'

interface PaymentReceivedProps {
  invoice: InvoiceData
  language?: SupportedLanguage
  paymentMethod: string
  transactionId?: string
  paymentDate?: Date
  customMessage?: string
  companyLogo?: string
  receiptDownloadLink?: string
  nextInvoiceDate?: Date
  includeTaxReceipt?: boolean
  isPartialPayment?: boolean
  remainingBalance?: number
}

// Payment confirmation translations
const paymentTranslations = {
  en: {
    subject: 'Payment Received - Invoice {{invoiceNumber}} from {{companyName}}',
    greeting: 'Dear {{customerName}},',
    thankYou: 'Thank you for your payment!',
    confirmationMessage: 'We have successfully received your payment for invoice {{invoiceNumber}}. Your account has been updated accordingly.',
    paymentDetails: 'Payment Details',
    invoiceNumber: 'Invoice Number',
    paymentAmount: 'Payment Amount',
    paymentMethod: 'Payment Method',
    paymentDate: 'Payment Date',
    transactionId: 'Transaction ID',
    remainingBalance: 'Remaining Balance',
    paidInFull: 'Paid in Full',
    partialPayment: 'Partial Payment',
    accountStatus: 'Account Status',
    currentlyActive: 'Currently Active',
    nextInvoice: 'Next Invoice Date',
    downloadReceipt: 'Download Receipt',
    downloadInvoice: 'Download Paid Invoice',
    taxReceipt: 'Tax Receipt Available',
    whatNext: 'What\'s Next?',
    servicesContinue: 'Your services will continue uninterrupted.',
    supportAccess: 'You have full access to all features.',
    renewalInfo: 'Your next invoice will be generated automatically.',
    questionsTitle: 'Questions or Issues?',
    contactSupport: 'Contact our support team if you have any questions about this payment or your account.',
    supportEmail: 'Email Support',
    supportPhone: 'Call Support',
    thankYouFooter: 'Thank you for choosing {{companyName}}!',
    automaticEmail: 'This is an automatic confirmation. Please keep this email for your records.',
    refundPolicy: 'Refund requests must be submitted within 30 days of payment.',
    vatNotice: 'VAT receipt available for business customers.',
    accountUpdated: 'Your account status has been updated automatically.'
  },
  de: {
    subject: 'Zahlung erhalten - Rechnung {{invoiceNumber}} von {{companyName}}',
    greeting: 'Sehr geehrte(r) {{customerName}},',
    thankYou: 'Vielen Dank für Ihre Zahlung!',
    confirmationMessage: 'Wir haben Ihre Zahlung für Rechnung {{invoiceNumber}} erfolgreich erhalten. Ihr Konto wurde entsprechend aktualisiert.',
    paymentDetails: 'Zahlungsdetails',
    invoiceNumber: 'Rechnungsnummer',
    paymentAmount: 'Zahlungsbetrag',
    paymentMethod: 'Zahlungsmethode',
    paymentDate: 'Zahlungsdatum',
    transactionId: 'Transaktions-ID',
    remainingBalance: 'Restbetrag',
    paidInFull: 'Vollständig bezahlt',
    partialPayment: 'Teilzahlung',
    accountStatus: 'Kontostatus',
    currentlyActive: 'Derzeit aktiv',
    nextInvoice: 'Nächstes Rechnungsdatum',
    downloadReceipt: 'Quittung herunterladen',
    downloadInvoice: 'Bezahlte Rechnung herunterladen',
    taxReceipt: 'Steuerbeleg verfügbar',
    whatNext: 'Wie geht es weiter?',
    servicesContinue: 'Ihre Services werden ununterbrochen fortgesetzt.',
    supportAccess: 'Sie haben vollen Zugang zu allen Funktionen.',
    renewalInfo: 'Ihre nächste Rechnung wird automatisch erstellt.',
    questionsTitle: 'Fragen oder Probleme?',
    contactSupport: 'Kontaktieren Sie unser Support-Team, wenn Sie Fragen zu dieser Zahlung oder Ihrem Konto haben.',
    supportEmail: 'E-Mail Support',
    supportPhone: 'Support anrufen',
    thankYouFooter: 'Vielen Dank, dass Sie sich für {{companyName}} entschieden haben!',
    automaticEmail: 'Dies ist eine automatische Bestätigung. Bitte bewahren Sie diese E-Mail für Ihre Unterlagen auf.',
    refundPolicy: 'Erstattungsanträge müssen innerhalb von 30 Tagen nach Zahlung gestellt werden.',
    vatNotice: 'MwSt.-Beleg für Geschäftskunden verfügbar.',
    accountUpdated: 'Ihr Kontostatus wurde automatisch aktualisiert.'
  },
  fr: {
    subject: 'Paiement reçu - Facture {{invoiceNumber}} de {{companyName}}',
    greeting: 'Cher(e) {{customerName}},',
    thankYou: 'Merci pour votre paiement !',
    confirmationMessage: 'Nous avons reçu avec succès votre paiement pour la facture {{invoiceNumber}}. Votre compte a été mis à jour en conséquence.',
    paymentDetails: 'Détails du paiement',
    invoiceNumber: 'Numéro de facture',
    paymentAmount: 'Montant du paiement',
    paymentMethod: 'Méthode de paiement',
    paymentDate: 'Date de paiement',
    transactionId: 'ID de transaction',
    remainingBalance: 'Solde restant',
    paidInFull: 'Payé intégralement',
    partialPayment: 'Paiement partiel',
    accountStatus: 'Statut du compte',
    currentlyActive: 'Actuellement actif',
    nextInvoice: 'Date de la prochaine facture',
    downloadReceipt: 'Télécharger le reçu',
    downloadInvoice: 'Télécharger la facture payée',
    taxReceipt: 'Reçu fiscal disponible',
    whatNext: 'Que se passe-t-il ensuite ?',
    servicesContinue: 'Vos services continueront sans interruption.',
    supportAccess: 'Vous avez un accès complet à toutes les fonctionnalités.',
    renewalInfo: 'Votre prochaine facture sera générée automatiquement.',
    questionsTitle: 'Questions ou problèmes ?',
    contactSupport: 'Contactez notre équipe de support si vous avez des questions sur ce paiement ou votre compte.',
    supportEmail: 'Support par email',
    supportPhone: 'Appeler le support',
    thankYouFooter: 'Merci d\'avoir choisi {{companyName}} !',
    automaticEmail: 'Ceci est une confirmation automatique. Veuillez conserver cet email pour vos dossiers.',
    refundPolicy: 'Les demandes de remboursement doivent être soumises dans les 30 jours suivant le paiement.',
    vatNotice: 'Reçu TVA disponible pour les clients professionnels.',
    accountUpdated: 'Le statut de votre compte a été mis à jour automatiquement.'
  },
  es: {
    subject: 'Pago recibido - Factura {{invoiceNumber}} de {{companyName}}',
    greeting: 'Estimado(a) {{customerName}},',
    thankYou: '¡Gracias por su pago!',
    confirmationMessage: 'Hemos recibido exitosamente su pago para la factura {{invoiceNumber}}. Su cuenta ha sido actualizada en consecuencia.',
    paymentDetails: 'Detalles del pago',
    invoiceNumber: 'Número de factura',
    paymentAmount: 'Monto del pago',
    paymentMethod: 'Método de pago',
    paymentDate: 'Fecha de pago',
    transactionId: 'ID de transacción',
    remainingBalance: 'Saldo restante',
    paidInFull: 'Pagado completamente',
    partialPayment: 'Pago parcial',
    accountStatus: 'Estado de la cuenta',
    currentlyActive: 'Actualmente activa',
    nextInvoice: 'Fecha de la próxima factura',
    downloadReceipt: 'Descargar recibo',
    downloadInvoice: 'Descargar factura pagada',
    taxReceipt: 'Recibo fiscal disponible',
    whatNext: '¿Qué sigue?',
    servicesContinue: 'Sus servicios continuarán sin interrupción.',
    supportAccess: 'Tiene acceso completo a todas las funciones.',
    renewalInfo: 'Su próxima factura se generará automáticamente.',
    questionsTitle: '¿Preguntas o problemas?',
    contactSupport: 'Contacte a nuestro equipo de soporte si tiene preguntas sobre este pago o su cuenta.',
    supportEmail: 'Soporte por email',
    supportPhone: 'Llamar al soporte',
    thankYouFooter: '¡Gracias por elegir {{companyName}}!',
    automaticEmail: 'Esta es una confirmación automática. Conserve este email para sus registros.',
    refundPolicy: 'Las solicitudes de reembolso deben enviarse dentro de 30 días del pago.',
    vatNotice: 'Recibo de IVA disponible para clientes empresariales.',
    accountUpdated: 'El estado de su cuenta ha sido actualizado automáticamente.'
  },
  it: {
    subject: 'Pagamento ricevuto - Fattura {{invoiceNumber}} da {{companyName}}',
    greeting: 'Gentile {{customerName}},',
    thankYou: 'Grazie per il suo pagamento!',
    confirmationMessage: 'Abbiamo ricevuto con successo il suo pagamento per la fattura {{invoiceNumber}}. Il suo account è stato aggiornato di conseguenza.',
    paymentDetails: 'Dettagli del pagamento',
    invoiceNumber: 'Numero fattura',
    paymentAmount: 'Importo del pagamento',
    paymentMethod: 'Metodo di pagamento',
    paymentDate: 'Data del pagamento',
    transactionId: 'ID transazione',
    remainingBalance: 'Saldo rimanente',
    paidInFull: 'Pagato interamente',
    partialPayment: 'Pagamento parziale',
    accountStatus: 'Stato dell\'account',
    currentlyActive: 'Attualmente attivo',
    nextInvoice: 'Data prossima fattura',
    downloadReceipt: 'Scarica ricevuta',
    downloadInvoice: 'Scarica fattura pagata',
    taxReceipt: 'Ricevuta fiscale disponibile',
    whatNext: 'Cosa succede dopo?',
    servicesContinue: 'I suoi servizi continueranno senza interruzioni.',
    supportAccess: 'Ha accesso completo a tutte le funzionalità.',
    renewalInfo: 'La sua prossima fattura sarà generata automaticamente.',
    questionsTitle: 'Domande o problemi?',
    contactSupport: 'Contatti il nostro team di supporto se ha domande su questo pagamento o sul suo account.',
    supportEmail: 'Supporto via email',
    supportPhone: 'Chiama il supporto',
    thankYouFooter: 'Grazie per aver scelto {{companyName}}!',
    automaticEmail: 'Questa è una conferma automatica. Conservi questa email per i suoi archivi.',
    refundPolicy: 'Le richieste di rimborso devono essere presentate entro 30 giorni dal pagamento.',
    vatNotice: 'Ricevuta IVA disponibile per clienti business.',
    accountUpdated: 'Lo stato del suo account è stato aggiornato automaticamente.'
  }
}

export function PaymentReceived({
  invoice,
  language = 'en',
  paymentMethod,
  transactionId,
  paymentDate = new Date(),
  customMessage,
  companyLogo,
  receiptDownloadLink,
  nextInvoiceDate,
  includeTaxReceipt = false,
  isPartialPayment = false,
  remainingBalance = 0
}: PaymentReceivedProps) {
  const t = paymentTranslations[language] || paymentTranslations.en
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(language === 'de' ? 'de-DE' : language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : language === 'it' ? 'it-IT' : 'en-US', {
      style: 'currency',
      currency: invoice.currency
    }).format(amount)
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat(language === 'de' ? 'de-DE' : language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : language === 'it' ? 'it-IT' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  const formatDateShort = (date: Date) => {
    return new Intl.DateTimeFormat(language === 'de' ? 'de-DE' : language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : language === 'it' ? 'it-IT' : 'en-US').format(date)
  }

  const replaceVariables = (text: string) => {
    return text
      .replace(/\{\{invoiceNumber\}\}/g, invoice.invoiceNumber)
      .replace(/\{\{companyName\}\}/g, invoice.companyInfo.name)
      .replace(/\{\{customerName\}\}/g, invoice.customerInfo.name)
  }

  const paidAmount = isPartialPayment ? invoice.total - remainingBalance : invoice.total

  return (
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta httpEquiv="Content-Type" content="text/html; charset=UTF-8" />
        <title>{replaceVariables(t.subject)}</title>
        <style>
          {`
            body {
              background-color: #f0f9ff;
              color: #1e293b;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              line-height: 1.6;
              margin: 0;
              padding: 0;
            }
            .email-container {
              max-width: 600px;
              margin: 20px auto;
              background-color: #ffffff;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
            }
            .header {
              background: linear-gradient(135deg, #10b981, #059669);
              color: white;
              padding: 40px 20px;
              text-align: center;
              position: relative;
            }
            .header::before {
              content: '';
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="1"/><circle cx="20" cy="20" r="10" fill="rgba(255,255,255,0.05)"/><circle cx="80" cy="30" r="8" fill="rgba(255,255,255,0.05)"/><circle cx="70" cy="80" r="12" fill="rgba(255,255,255,0.05)"/></svg>') center/cover;
            }
            .logo {
              max-width: 120px;
              height: auto;
              margin-bottom: 20px;
              position: relative;
              z-index: 1;
            }
            .success-icon {
              font-size: 64px;
              margin-bottom: 20px;
              position: relative;
              z-index: 1;
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
              font-weight: 700;
              position: relative;
              z-index: 1;
            }
            .content {
              padding: 40px 30px;
            }
            .success-message {
              background: linear-gradient(135deg, #ecfdf5, #d1fae5);
              border: 2px solid #10b981;
              border-radius: 12px;
              padding: 25px;
              margin: 25px 0;
              text-align: center;
            }
            .payment-summary {
              background-color: #f8fafc;
              border-radius: 12px;
              padding: 25px;
              margin: 25px 0;
              border: 1px solid #e2e8f0;
            }
            .summary-header {
              background-color: #1e293b;
              color: white;
              margin: -25px -25px 20px -25px;
              padding: 15px 25px;
              border-radius: 12px 12px 0 0;
              font-weight: 600;
              font-size: 16px;
            }
            .summary-row {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 12px 0;
              border-bottom: 1px solid #e2e8f0;
            }
            .summary-row:last-child {
              border-bottom: none;
              margin-top: 10px;
              padding-top: 20px;
              border-top: 2px solid #10b981;
              font-weight: 700;
              font-size: 18px;
              color: #10b981;
            }
            .amount-paid {
              font-size: 36px;
              font-weight: 700;
              color: #10b981;
              text-align: center;
              margin: 25px 0;
              padding: 25px;
              background: linear-gradient(135deg, #ecfdf5, #d1fae5);
              border-radius: 12px;
              border: 2px solid #10b981;
            }
            .status-badge {
              display: inline-block;
              background-color: #10b981;
              color: white;
              padding: 8px 16px;
              border-radius: 20px;
              font-size: 12px;
              font-weight: 600;
              text-transform: uppercase;
              margin: 10px 0;
            }
            .partial-badge {
              background-color: #f59e0b;
            }
            .btn {
              display: inline-block;
              padding: 15px 30px;
              margin: 10px 8px;
              background-color: #10b981;
              color: white;
              text-decoration: none;
              border-radius: 8px;
              font-weight: 600;
              text-align: center;
              font-size: 16px;
              transition: all 0.3s ease;
              box-shadow: 0 4px 6px rgba(16, 185, 129, 0.2);
            }
            .btn:hover {
              background-color: #059669;
              transform: translateY(-2px);
              box-shadow: 0 6px 12px rgba(16, 185, 129, 0.3);
            }
            .btn-secondary {
              background-color: transparent;
              color: #10b981;
              border: 2px solid #10b981;
              box-shadow: none;
            }
            .btn-secondary:hover {
              background-color: #10b981;
              color: white;
            }
            .next-steps {
              background: linear-gradient(135deg, #eff6ff, #dbeafe);
              border: 1px solid #3b82f6;
              border-radius: 12px;
              padding: 25px;
              margin: 25px 0;
            }
            .next-steps h3 {
              color: #1e40af;
              margin: 0 0 15px 0;
            }
            .next-steps ul {
              margin: 15px 0;
              padding-left: 20px;
            }
            .next-steps li {
              margin: 8px 0;
              color: #1e293b;
            }
            .contact-section {
              background-color: #fef3c7;
              border: 1px solid #f59e0b;
              border-radius: 12px;
              padding: 25px;
              margin: 25px 0;
              text-align: center;
            }
            .contact-section h3 {
              color: #92400e;
              margin: 0 0 20px 0;
            }
            .contact-methods {
              display: flex;
              justify-content: center;
              gap: 15px;
              flex-wrap: wrap;
            }
            .contact-method {
              background-color: #f59e0b;
              color: white;
              text-decoration: none;
              padding: 12px 24px;
              border-radius: 8px;
              font-weight: 600;
              transition: all 0.3s ease;
            }
            .contact-method:hover {
              background-color: #d97706;
              transform: translateY(-2px);
            }
            .remaining-balance {
              background-color: #fef3c7;
              border: 2px solid #f59e0b;
              border-radius: 12px;
              padding: 20px;
              margin: 20px 0;
              text-align: center;
            }
            .remaining-amount {
              font-size: 24px;
              font-weight: 700;
              color: #92400e;
              margin: 10px 0;
            }
            .footer {
              background-color: #f8fafc;
              padding: 30px 20px;
              text-align: center;
              font-size: 14px;
              color: #64748b;
              border-top: 1px solid #e2e8f0;
            }
            .footer-highlight {
              background: linear-gradient(135deg, #10b981, #059669);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
              background-clip: text;
              font-weight: 700;
              font-size: 16px;
              margin-bottom: 15px;
            }
            @media only screen and (max-width: 600px) {
              .email-container {
                margin: 10px;
                border-radius: 8px;
              }
              .content {
                padding: 25px 20px;
              }
              .btn {
                display: block;
                margin: 10px 0;
                width: 100%;
                box-sizing: border-box;
              }
              .contact-methods {
                flex-direction: column;
                align-items: center;
              }
              .contact-method {
                width: 100%;
                max-width: 200px;
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
            <div className="success-icon">✅</div>
            <h1>{t.thankYou}</h1>
          </div>

          <div className="content">
            <p>{replaceVariables(t.greeting)}</p>

            <div className="success-message">
              <h2 style={{ margin: '0 0 15px 0', color: '#065f46' }}>
                {isPartialPayment ? t.partialPayment : t.paidInFull}
              </h2>
              <p style={{ margin: 0, fontSize: '16px' }}>
                {customMessage || replaceVariables(t.confirmationMessage)}
              </p>
            </div>

            <div className="amount-paid">
              <div style={{ fontSize: '16px', marginBottom: '10px', opacity: 0.8 }}>
                {t.paymentAmount}
              </div>
              <div>{formatCurrency(paidAmount)}</div>
              <div className={`status-badge ${isPartialPayment ? 'partial-badge' : ''}`}>
                {isPartialPayment ? t.partialPayment : t.paidInFull}
              </div>
            </div>

            {isPartialPayment && remainingBalance > 0 && (
              <div className="remaining-balance">
                <div><strong>{t.remainingBalance}</strong></div>
                <div className="remaining-amount">{formatCurrency(remainingBalance)}</div>
                <p style={{ margin: '10px 0 0 0', fontSize: '14px' }}>
                  Please arrange payment for the remaining balance at your earliest convenience.
                </p>
              </div>
            )}

            <div className="payment-summary">
              <div className="summary-header">
                {t.paymentDetails}
              </div>
              <div className="summary-row">
                <span>{t.invoiceNumber}:</span>
                <span><strong>#{invoice.invoiceNumber}</strong></span>
              </div>
              <div className="summary-row">
                <span>{t.paymentDate}:</span>
                <span>{formatDate(paymentDate)}</span>
              </div>
              <div className="summary-row">
                <span>{t.paymentMethod}:</span>
                <span>{paymentMethod}</span>
              </div>
              {transactionId && (
                <div className="summary-row">
                  <span>{t.transactionId}:</span>
                  <span><code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>{transactionId}</code></span>
                </div>
              )}
              <div className="summary-row">
                <span>{t.accountStatus}:</span>
                <span style={{ color: '#10b981', fontWeight: '600' }}>{t.currentlyActive}</span>
              </div>
              <div className="summary-row">
                <span><strong>{t.paymentAmount}:</strong></span>
                <span><strong>{formatCurrency(paidAmount)}</strong></span>
              </div>
            </div>

            <div style={{ textAlign: 'center', margin: '30px 0' }}>
              {receiptDownloadLink && (
                <a href={receiptDownloadLink} className="btn">{t.downloadReceipt}</a>
              )}
              <a href="#" className="btn btn-secondary">{t.downloadInvoice}</a>
            </div>

            <div className="next-steps">
              <h3>{t.whatNext}</h3>
              <ul>
                <li>{t.servicesContinue}</li>
                <li>{t.supportAccess}</li>
                {nextInvoiceDate && (
                  <li>{t.renewalInfo} ({formatDateShort(nextInvoiceDate)})</li>
                )}
                <li>{t.accountUpdated}</li>
              </ul>
              {includeTaxReceipt && (
                <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#e0f2fe', borderRadius: '6px' }}>
                  <strong>{t.taxReceipt}</strong> - {t.vatNotice}
                </div>
              )}
            </div>

            <div className="contact-section">
              <h3>{t.questionsTitle}</h3>
              <p>{t.contactSupport}</p>
              <div className="contact-methods">
                <a href={`mailto:${invoice.companyInfo.email}`} className="contact-method">
                  {t.supportEmail}
                </a>
                {invoice.companyInfo.phone && (
                  <a href={`tel:${invoice.companyInfo.phone}`} className="contact-method">
                    {t.supportPhone}
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="footer">
            <div className="footer-highlight">
              {replaceVariables(t.thankYouFooter)}
            </div>
            <p>{t.automaticEmail}</p>
            <p style={{ fontSize: '12px', margin: '15px 0' }}>
              {t.refundPolicy}
            </p>
            <p>
              {invoice.companyInfo.name} • {invoice.companyInfo.address.line1} • 
              {invoice.companyInfo.address.city}, {invoice.companyInfo.address.country}
            </p>
            {invoice.companyInfo.taxId && (
              <p>VAT ID: {invoice.companyInfo.taxId}</p>
            )}
            <p style={{ fontSize: '11px', marginTop: '20px', opacity: 0.7 }}>
              Payment processed on {formatDate(paymentDate)}
              {transactionId && ` • Transaction ID: ${transactionId}`}
            </p>
          </div>
        </div>
      </body>
    </html>
  )
}

export default PaymentReceived