/**
 * Professional Invoice PDF Generator using React-PDF
 * Supports multiple templates, European compliance, and custom branding
 */

'use client'

import React from 'react'
import { Document, Page, Text, View, StyleSheet, Image, Font, PDFDownloadLink, pdf } from '@react-pdf/renderer'
import { InvoiceData, PDFInvoiceOptions, SupportedLanguage, EU_VAT_RATES } from '@/lib/invoice'

// Register fonts for better typography
// Note: In production, you'd load actual font files
// Font.register({
//   family: 'Inter',
//   fonts: [
//     { src: '/fonts/Inter-Regular.ttf' },
//     { src: '/fonts/Inter-Bold.ttf', fontWeight: 'bold' },
//   ]
// })

interface InvoicePDFProps {
  invoice: InvoiceData
  options: PDFInvoiceOptions
}

// PDF translations for different languages
const pdfTranslations = {
  en: {
    invoice: 'INVOICE',
    billTo: 'Bill To',
    invoiceNumber: 'Invoice #',
    issueDate: 'Issue Date',
    dueDate: 'Due Date',
    description: 'Description',
    quantity: 'Qty',
    unitPrice: 'Unit Price',
    total: 'Total',
    subtotal: 'Subtotal',
    tax: 'Tax',
    totalAmount: 'Total Amount',
    paymentTerms: 'Payment Terms',
    notes: 'Notes',
    thankYou: 'Thank you for your business!',
    page: 'Page',
    of: 'of',
    vatNumber: 'VAT Number',
    taxId: 'Tax ID',
    bankDetails: 'Bank Details',
    accountName: 'Account Name',
    iban: 'IBAN',
    bic: 'BIC/SWIFT',
    exemptReason: 'Tax Exempt Reason',
    reverseCharge: 'Reverse Charge',
    legalNotice: 'This invoice is computer generated and valid without signature.',
    companyDetails: 'Company Details'
  },
  de: {
    invoice: 'RECHNUNG',
    billTo: 'Rechnungsempfänger',
    invoiceNumber: 'Rechnungsnr.',
    issueDate: 'Rechnungsdatum',
    dueDate: 'Fälligkeitsdatum',
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
    page: 'Seite',
    of: 'von',
    vatNumber: 'USt-IdNr.',
    taxId: 'Steuernummer',
    bankDetails: 'Bankverbindung',
    accountName: 'Kontoinhaber',
    iban: 'IBAN',
    bic: 'BIC/SWIFT',
    exemptReason: 'Steuerbefreiungsgrund',
    reverseCharge: 'Reverse Charge Verfahren',
    legalNotice: 'Diese Rechnung wurde maschinell erstellt und ist ohne Unterschrift gültig.',
    companyDetails: 'Firmenangaben'
  },
  fr: {
    invoice: 'FACTURE',
    billTo: 'Facturer à',
    invoiceNumber: 'N° de facture',
    issueDate: 'Date d\'émission',
    dueDate: 'Date d\'échéance',
    description: 'Description',
    quantity: 'Qté',
    unitPrice: 'Prix unitaire',
    total: 'Total',
    subtotal: 'Sous-total',
    tax: 'TVA',
    totalAmount: 'Montant total',
    paymentTerms: 'Conditions de paiement',
    notes: 'Notes',
    thankYou: 'Merci pour votre confiance !',
    page: 'Page',
    of: 'sur',
    vatNumber: 'N° TVA',
    taxId: 'N° fiscal',
    bankDetails: 'Coordonnées bancaires',
    accountName: 'Titulaire',
    iban: 'IBAN',
    bic: 'BIC/SWIFT',
    exemptReason: 'Raison d\'exemption',
    reverseCharge: 'Autoliquidation',
    legalNotice: 'Cette facture est générée informatiquement et valide sans signature.',
    companyDetails: 'Détails de l\'entreprise'
  }
}

// Create PDF styles based on theme
const createStyles = (theme: string, primaryColor?: string) => {
  const colors = {
    modern: {
      primary: primaryColor || '#2563eb',
      accent: '#3b82f6',
      text: '#1f2937',
      light: '#f3f4f6',
      border: '#e5e7eb'
    },
    classic: {
      primary: primaryColor || '#1f2937',
      accent: '#374151',
      text: '#111827',
      light: '#f9fafb',
      border: '#d1d5db'
    },
    minimal: {
      primary: primaryColor || '#000000',
      accent: '#6b7280',
      text: '#000000',
      light: '#ffffff',
      border: '#f3f4f6'
    },
    corporate: {
      primary: primaryColor || '#1e40af',
      accent: '#3730a3',
      text: '#0f172a',
      light: '#f8fafc',
      border: '#cbd5e1'
    },
    creative: {
      primary: primaryColor || '#7c3aed',
      accent: '#a855f7',
      text: '#374151',
      light: '#fefefe',
      border: '#e5e7eb'
    }
  }

  const themeColors = colors[theme as keyof typeof colors] || colors.modern

  return StyleSheet.create({
    page: {
      flexDirection: 'column',
      backgroundColor: '#ffffff',
      padding: 30,
      fontFamily: 'Helvetica',
      fontSize: 10,
      color: themeColors.text
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 30,
      paddingBottom: 20,
      borderBottomWidth: 2,
      borderBottomColor: themeColors.primary,
      borderBottomStyle: 'solid'
    },
    logo: {
      width: 120,
      height: 60,
      objectFit: 'contain'
    },
    companyInfo: {
      flex: 1,
      paddingLeft: 20
    },
    companyName: {
      fontSize: 24,
      fontWeight: 'bold',
      color: themeColors.primary,
      marginBottom: 8
    },
    invoiceTitle: {
      textAlign: 'right',
      flex: 1
    },
    invoiceTitleText: {
      fontSize: 36,
      fontWeight: 'bold',
      color: themeColors.primary,
      marginBottom: 10
    },
    invoiceDetails: {
      textAlign: 'right',
      fontSize: 10
    },
    billingSection: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginVertical: 30
    },
    billingInfo: {
      flex: 1,
      marginRight: 20
    },
    sectionTitle: {
      fontSize: 12,
      fontWeight: 'bold',
      color: themeColors.accent,
      marginBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: themeColors.accent,
      paddingBottom: 2
    },
    customerInfo: {
      lineHeight: 1.4
    },
    table: {
      marginVertical: 20
    },
    tableHeader: {
      flexDirection: 'row',
      backgroundColor: themeColors.primary,
      color: 'white',
      padding: 8,
      fontWeight: 'bold',
      fontSize: 10
    },
    tableRow: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: themeColors.border,
      borderBottomStyle: 'solid',
      minHeight: 30,
      alignItems: 'center',
      padding: 8
    },
    tableRowEven: {
      backgroundColor: themeColors.light
    },
    col1: { flex: 3 }, // Description
    col2: { flex: 1, textAlign: 'center' }, // Quantity  
    col3: { flex: 1.5, textAlign: 'right' }, // Unit Price
    col4: { flex: 1.5, textAlign: 'right' }, // Total
    totalsSection: {
      alignSelf: 'flex-end',
      width: 250,
      marginTop: 20
    },
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      padding: 6,
      borderBottomWidth: 1,
      borderBottomColor: themeColors.border,
      borderBottomStyle: 'solid'
    },
    totalRowFinal: {
      backgroundColor: themeColors.accent,
      color: 'white',
      fontWeight: 'bold',
      fontSize: 12,
      marginTop: 5
    },
    footer: {
      marginTop: 40,
      paddingTop: 20,
      borderTopWidth: 1,
      borderTopColor: themeColors.border,
      borderTopStyle: 'solid'
    },
    footerSection: {
      marginBottom: 15
    },
    footerTitle: {
      fontSize: 11,
      fontWeight: 'bold',
      marginBottom: 5,
      color: themeColors.primary
    },
    footerText: {
      fontSize: 9,
      lineHeight: 1.3,
      color: themeColors.text
    },
    bankDetails: {
      backgroundColor: themeColors.light,
      padding: 10,
      marginVertical: 15,
      borderLeftWidth: 3,
      borderLeftColor: themeColors.primary,
      borderLeftStyle: 'solid'
    },
    bankRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginVertical: 2
    },
    statusBadge: {
      backgroundColor: themeColors.primary,
      color: 'white',
      padding: '4 8',
      borderRadius: 10,
      fontSize: 8,
      textTransform: 'uppercase',
      textAlign: 'center',
      alignSelf: 'flex-start'
    },
    pageNumber: {
      position: 'absolute',
      fontSize: 8,
      bottom: 20,
      left: 0,
      right: 0,
      textAlign: 'center',
      color: themeColors.accent
    },
    vatBreakdown: {
      backgroundColor: themeColors.light,
      padding: 10,
      marginVertical: 10,
      borderRadius: 4
    },
    exemptNotice: {
      backgroundColor: '#fef3c7',
      padding: 8,
      marginVertical: 10,
      borderRadius: 4,
      fontSize: 9,
      color: '#92400e'
    },
    qrCode: {
      width: 80,
      height: 80,
      alignSelf: 'center',
      marginVertical: 10
    }
  })
}

// Main PDF Document Component
const InvoicePDFDocument: React.FC<InvoicePDFProps> = ({ invoice, options }) => {
  const styles = createStyles(options.theme, options.primaryColor)
  const t = pdfTranslations[options.language] || pdfTranslations.en

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(options.language === 'de' ? 'de-DE' : options.language === 'fr' ? 'fr-FR' : 'en-US', {
      style: 'currency',
      currency: invoice.currency,
      minimumFractionDigits: 2
    }).format(amount)
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat(options.language === 'de' ? 'de-DE' : options.language === 'fr' ? 'fr-FR' : 'en-US').format(date)
  }

  return (
    <Document>
      <Page size={options.format} style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.companyInfo}>
            {options.logoUrl && (
              <Image
                style={styles.logo}
                src={options.logoUrl}
              />
            )}
            <Text style={styles.companyName}>{invoice.companyInfo.name}</Text>
            <Text>{invoice.companyInfo.address.line1}</Text>
            {invoice.companyInfo.address.line2 && (
              <Text>{invoice.companyInfo.address.line2}</Text>
            )}
            <Text>{invoice.companyInfo.address.city}, {invoice.companyInfo.address.postal_code}</Text>
            <Text>{invoice.companyInfo.address.country}</Text>
            <Text style={{ marginTop: 8 }}>
              {invoice.companyInfo.email}
            </Text>
            {invoice.companyInfo.phone && (
              <Text>{invoice.companyInfo.phone}</Text>
            )}
            {invoice.companyInfo.website && (
              <Text>{invoice.companyInfo.website}</Text>
            )}
          </View>
          
          <View style={styles.invoiceTitle}>
            <Text style={styles.invoiceTitleText}>{t.invoice}</Text>
            <View style={styles.invoiceDetails}>
              <Text style={{ fontWeight: 'bold', marginBottom: 4 }}>
                {t.invoiceNumber}: {invoice.invoiceNumber}
              </Text>
              <Text>{t.issueDate}: {formatDate(invoice.issueDate)}</Text>
              <Text>{t.dueDate}: {formatDate(invoice.dueDate)}</Text>
              <View style={{ ...styles.statusBadge, marginTop: 8 }}>
                <Text>{invoice.status.toUpperCase()}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Billing Information */}
        <View style={styles.billingSection}>
          <View style={styles.billingInfo}>
            <Text style={styles.sectionTitle}>{t.billTo}</Text>
            <View style={styles.customerInfo}>
              <Text style={{ fontWeight: 'bold', marginBottom: 4 }}>
                {invoice.customerInfo.name}
              </Text>
              <Text>{invoice.customerInfo.email}</Text>
              {invoice.customerInfo.address && (
                <View style={{ marginTop: 4 }}>
                  <Text>{invoice.customerInfo.address.line1}</Text>
                  {invoice.customerInfo.address.line2 && (
                    <Text>{invoice.customerInfo.address.line2}</Text>
                  )}
                  <Text>
                    {invoice.customerInfo.address.city}, {invoice.customerInfo.address.postal_code}
                  </Text>
                  <Text>{invoice.customerInfo.address.country}</Text>
                </View>
              )}
              {invoice.customerInfo.taxId && (
                <Text style={{ marginTop: 4 }}>
                  {t.vatNumber}: {invoice.customerInfo.taxId}
                </Text>
              )}
            </View>
          </View>
          
          <View style={styles.billingInfo}>
            <Text style={styles.sectionTitle}>{t.companyDetails}</Text>
            {invoice.companyInfo.taxId && (
              <Text>{t.taxId}: {invoice.companyInfo.taxId}</Text>
            )}
            {invoice.companyInfo.registrationNumber && (
              <Text>Reg. No.: {invoice.companyInfo.registrationNumber}</Text>
            )}
          </View>
        </View>

        {/* Items Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.col1}>{t.description}</Text>
            <Text style={styles.col2}>{t.quantity}</Text>
            <Text style={styles.col3}>{t.unitPrice}</Text>
            <Text style={styles.col4}>{t.total}</Text>
          </View>
          
          {invoice.items.map((item, index) => (
            <View 
              key={index} 
              style={[
                styles.tableRow, 
                index % 2 === 0 ? styles.tableRowEven : {}
              ]}
            >
              <Text style={styles.col1}>{item.description}</Text>
              <Text style={styles.col2}>{item.quantity}</Text>
              <Text style={styles.col3}>{formatCurrency(item.unitPrice)}</Text>
              <Text style={styles.col4}>{formatCurrency(item.total)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text>{t.subtotal}:</Text>
            <Text>{formatCurrency(invoice.subtotal)}</Text>
          </View>
          
          {invoice.tax.exempt ? (
            <View style={styles.exemptNotice}>
              <Text>{t.exemptReason}: {invoice.tax.exemptReason || t.reverseCharge}</Text>
            </View>
          ) : (
            <View style={styles.totalRow}>
              <Text>{t.tax} ({invoice.tax.rate}%):</Text>
              <Text>{formatCurrency(invoice.tax.amount)}</Text>
            </View>
          )}
          
          <View style={[styles.totalRow, styles.totalRowFinal]}>
            <Text>{t.totalAmount}:</Text>
            <Text>{formatCurrency(invoice.total)}</Text>
          </View>
        </View>

        {/* VAT Breakdown for EU compliance */}
        {options.includeVATBreakdown && invoice.tax.breakdown && (
          <View style={styles.vatBreakdown}>
            <Text style={styles.footerTitle}>VAT Breakdown</Text>
            {invoice.tax.breakdown.map((breakdown, index) => (
              <View key={index} style={styles.bankRow}>
                <Text>{breakdown.description} ({breakdown.rate}%):</Text>
                <Text>{formatCurrency(breakdown.amount)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Bank Details */}
        {invoice.bankDetails && (
          <View style={styles.bankDetails}>
            <Text style={styles.footerTitle}>{t.bankDetails}</Text>
            <View style={styles.bankRow}>
              <Text>{t.accountName}:</Text>
              <Text>{invoice.bankDetails.accountName}</Text>
            </View>
            <View style={styles.bankRow}>
              <Text>{t.iban}:</Text>
              <Text>{invoice.bankDetails.iban}</Text>
            </View>
            <View style={styles.bankRow}>
              <Text>{t.bic}:</Text>
              <Text>{invoice.bankDetails.bic}</Text>
            </View>
            <View style={styles.bankRow}>
              <Text>Reference:</Text>
              <Text>{invoice.invoiceNumber}</Text>
            </View>
          </View>
        )}

        {/* Payment Terms */}
        {options.includePaymentTerms && invoice.paymentTerms && (
          <View style={styles.footerSection}>
            <Text style={styles.footerTitle}>{t.paymentTerms}</Text>
            <Text style={styles.footerText}>{invoice.paymentTerms}</Text>
          </View>
        )}

        {/* Notes */}
        {invoice.notes && (
          <View style={styles.footerSection}>
            <Text style={styles.footerTitle}>{t.notes}</Text>
            <Text style={styles.footerText}>{invoice.notes}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>{t.thankYou}</Text>
          <Text style={[styles.footerText, { marginTop: 10 }]}>
            {t.legalNotice}
          </Text>
          {options.customCSS && (
            <Text style={[styles.footerText, { marginTop: 5, fontSize: 8 }]}>
              Generated with Roomicor Invoice System
            </Text>
          )}
        </View>

        {/* QR Code for payment (if enabled) */}
        {options.includeQRCode && (
          <View style={styles.qrCode}>
            {/* QR Code would be generated here with payment info */}
            <Text style={{ fontSize: 8, textAlign: 'center' }}>
              QR Code for Payment
            </Text>
          </View>
        )}

        {/* Page Number */}
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => 
          `${t.page} ${pageNumber} ${t.of} ${totalPages}`
        } fixed />
      </Page>
    </Document>
  )
}

// Main component for generating and downloading PDFs
interface InvoicePDFGeneratorProps {
  invoice: InvoiceData
  options?: Partial<PDFInvoiceOptions>
  onGenerated?: (pdfBlob: Blob) => void
  children?: React.ReactNode
}

export const InvoicePDFGenerator: React.FC<InvoicePDFGeneratorProps> = ({
  invoice,
  options = {},
  onGenerated,
  children
}) => {
  const defaultOptions: PDFInvoiceOptions = {
    format: 'A4',
    theme: 'modern',
    language: 'en',
    includeQRCode: false,
    includePaymentTerms: true,
    includeVATBreakdown: true,
    ...options
  }

  const handleGenerate = async () => {
    try {
      const blob = await pdf(<InvoicePDFDocument invoice={invoice} options={defaultOptions} />).toBlob()
      onGenerated?.(blob)
      return blob
    } catch (error) {
      console.error('PDF generation failed:', error)
      throw error
    }
  }

  return (
    <div>
      {children ? (
        <div onClick={handleGenerate}>
          {children}
        </div>
      ) : (
        <PDFDownloadLink
          document={<InvoicePDFDocument invoice={invoice} options={defaultOptions} />}
          fileName={`invoice-${invoice.invoiceNumber}.pdf`}
          style={{
            textDecoration: 'none',
            padding: '10px 20px',
            backgroundColor: '#2563eb',
            color: 'white',
            borderRadius: '6px',
            display: 'inline-block',
            fontWeight: '600'
          }}
        >
          {({ blob, url, loading, error }) =>
            loading ? 'Generating PDF...' : 'Download Invoice PDF'
          }
        </PDFDownloadLink>
      )}
    </div>
  )
}

// Utility function to generate PDF blob directly
export const generateInvoicePDF = async (
  invoice: InvoiceData,
  options: PDFInvoiceOptions
): Promise<Blob> => {
  return await pdf(<InvoicePDFDocument invoice={invoice} options={options} />).toBlob()
}

// Utility function to generate PDF buffer for server-side use
export const generateInvoicePDFBuffer = async (
  invoice: InvoiceData,
  options: PDFInvoiceOptions
): Promise<Buffer> => {
  const blob = await pdf(<InvoicePDFDocument invoice={invoice} options={options} />).toBlob()
  const arrayBuffer = await blob.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

export default InvoicePDFGenerator