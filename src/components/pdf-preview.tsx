/**
 * Live PDF Preview Component
 * Real-time preview of invoice PDFs with editing capabilities
 */

'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { PDFViewer } from '@react-pdf/renderer'
import { InvoiceData, PDFInvoiceOptions, InvoiceTemplate, SupportedLanguage } from '@/lib/invoice'
import { InvoicePDFGenerator, generateInvoicePDF } from './invoice-pdf-generator'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Download, Eye, Edit, Settings, Palette, Globe } from 'lucide-react'

interface PDFPreviewProps {
  initialInvoice: InvoiceData
  onInvoiceChange?: (invoice: InvoiceData) => void
  onDownload?: (pdfBlob: Blob) => void
  height?: number
  showControls?: boolean
  allowEditing?: boolean
}

const templateOptions: { value: InvoiceTemplate; label: string; description: string }[] = [
  { value: 'modern', label: 'Modern', description: 'Clean and contemporary design' },
  { value: 'classic', label: 'Classic', description: 'Traditional professional layout' },
  { value: 'minimal', label: 'Minimal', description: 'Simple and elegant' },
  { value: 'corporate', label: 'Corporate', description: 'Formal business style' },
  { value: 'creative', label: 'Creative', description: 'Colorful and dynamic' }
]

const languageOptions: { value: SupportedLanguage; label: string; flag: string }[] = [
  { value: 'en', label: 'English', flag: '🇺🇸' },
  { value: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { value: 'fr', label: 'Français', flag: '🇫🇷' },
  { value: 'es', label: 'Español', flag: '🇪🇸' },
  { value: 'it', label: 'Italiano', flag: '🇮🇹' },
  { value: 'nl', label: 'Nederlands', flag: '🇳🇱' },
  { value: 'pl', label: 'Polski', flag: '🇵🇱' },
  { value: 'cs', label: 'Čeština', flag: '🇨🇿' }
]

const colorPresets = [
  { name: 'Blue', primary: '#2563eb', accent: '#3b82f6' },
  { name: 'Green', primary: '#10b981', accent: '#34d399' },
  { name: 'Purple', primary: '#7c3aed', accent: '#a855f7' },
  { name: 'Red', primary: '#dc2626', accent: '#ef4444' },
  { name: 'Orange', primary: '#ea580c', accent: '#f97316' },
  { name: 'Teal', primary: '#0d9488', accent: '#14b8a6' },
  { name: 'Indigo', primary: '#4338ca', accent: '#6366f1' },
  { name: 'Pink', primary: '#db2777', accent: '#ec4899' }
]

export const PDFPreview: React.FC<PDFPreviewProps> = ({
  initialInvoice,
  onInvoiceChange,
  onDownload,
  height = 600,
  showControls = true,
  allowEditing = true
}) => {
  const [invoice, setInvoice] = useState<InvoiceData>(initialInvoice)
  const [pdfOptions, setPdfOptions] = useState<PDFInvoiceOptions>({
    format: 'A4',
    theme: 'modern',
    language: 'en',
    primaryColor: '#2563eb',
    accentColor: '#3b82f6',
    includeQRCode: false,
    includePaymentTerms: true,
    includeVATBreakdown: true,
    fontFamily: 'Helvetica'
  })
  const [isGenerating, setIsGenerating] = useState(false)
  const [previewMode, setPreviewMode] = useState<'pdf' | 'edit'>('pdf')

  // Update parent when invoice changes
  useEffect(() => {
    onInvoiceChange?.(invoice)
  }, [invoice, onInvoiceChange])

  // Memoized PDF document to prevent unnecessary re-renders
  const pdfDocument = useMemo(() => (
    <InvoicePDFGenerator 
      invoice={invoice} 
      options={pdfOptions}
    />
  ), [invoice, pdfOptions])

  const handleDownload = async () => {
    setIsGenerating(true)
    try {
      const pdfBlob = await generateInvoicePDF(invoice, pdfOptions)
      onDownload?.(pdfBlob)
      
      // Trigger browser download
      const url = URL.createObjectURL(pdfBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = `invoice-${invoice.invoiceNumber}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to generate PDF:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  const updateInvoiceField = (field: keyof InvoiceData, value: any) => {
    setInvoice(prev => ({ ...prev, [field]: value }))
  }

  const updateCustomerInfo = (field: string, value: string) => {
    setInvoice(prev => ({
      ...prev,
      customerInfo: { ...prev.customerInfo, [field]: value }
    }))
  }

  const updateCompanyInfo = (field: string, value: string) => {
    setInvoice(prev => ({
      ...prev,
      companyInfo: { ...prev.companyInfo, [field]: value }
    }))
  }

  const addItem = () => {
    const newItem = {
      id: `item-${Date.now()}`,
      description: 'New Item',
      quantity: 1,
      unitPrice: 0,
      total: 0
    }
    setInvoice(prev => ({
      ...prev,
      items: [...prev.items, newItem],
      subtotal: prev.subtotal,
      total: prev.total
    }))
  }

  const updateItem = (index: number, field: string, value: any) => {
    setInvoice(prev => {
      const newItems = [...prev.items]
      newItems[index] = { ...newItems[index], [field]: value }
      
      // Recalculate total for the item
      if (field === 'quantity' || field === 'unitPrice') {
        newItems[index].total = newItems[index].quantity * newItems[index].unitPrice
      }
      
      // Recalculate invoice totals
      const subtotal = newItems.reduce((sum, item) => sum + item.total, 0)
      const taxAmount = (subtotal * prev.tax.rate) / 100
      const total = subtotal + taxAmount
      
      return {
        ...prev,
        items: newItems,
        subtotal,
        tax: { ...prev.tax, amount: taxAmount },
        total
      }
    })
  }

  const removeItem = (index: number) => {
    setInvoice(prev => {
      const newItems = prev.items.filter((_, i) => i !== index)
      const subtotal = newItems.reduce((sum, item) => sum + item.total, 0)
      const taxAmount = (subtotal * prev.tax.rate) / 100
      const total = subtotal + taxAmount
      
      return {
        ...prev,
        items: newItems,
        subtotal,
        tax: { ...prev.tax, amount: taxAmount },
        total
      }
    })
  }

  const applyColorPreset = (preset: typeof colorPresets[0]) => {
    setPdfOptions(prev => ({
      ...prev,
      primaryColor: preset.primary,
      accentColor: preset.accent
    }))
  }

  return (
    <div className="w-full">
      {showControls && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Invoice Preview</h3>
            <div className="flex items-center gap-2">
              <Button
                variant={previewMode === 'pdf' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPreviewMode('pdf')}
              >
                <Eye className="w-4 h-4 mr-2" />
                Preview
              </Button>
              {allowEditing && (
                <Button
                  variant={previewMode === 'edit' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPreviewMode('edit')}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              )}
              <Button
                onClick={handleDownload}
                disabled={isGenerating}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Download className="w-4 h-4 mr-2" />
                {isGenerating ? 'Generating...' : 'Download PDF'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* PDF Preview */}
        <div className={`${previewMode === 'edit' && showControls ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
          <Card>
            <CardContent className="p-0">
              <div style={{ height: `${height}px` }} className="w-full">
                <PDFViewer 
                  style={{ width: '100%', height: '100%', border: 'none' }}
                  showToolbar={false}
                >
                  {pdfDocument}
                </PDFViewer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Controls Panel */}
        {showControls && previewMode === 'edit' && allowEditing && (
          <div className="lg:col-span-1">
            <Tabs defaultValue="content" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="content">Content</TabsTrigger>
                <TabsTrigger value="design">
                  <Palette className="w-4 h-4 mr-1" />
                  Design
                </TabsTrigger>
                <TabsTrigger value="settings">
                  <Settings className="w-4 h-4 mr-1" />
                  Options
                </TabsTrigger>
              </TabsList>

              {/* Content Tab */}
              <TabsContent value="content" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Invoice Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label>Invoice Number</Label>
                      <Input
                        value={invoice.invoiceNumber}
                        onChange={(e) => updateInvoiceField('invoiceNumber', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Due Date</Label>
                      <Input
                        type="date"
                        value={invoice.dueDate.toISOString().split('T')[0]}
                        onChange={(e) => updateInvoiceField('dueDate', new Date(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label>Status</Label>
                      <Select
                        value={invoice.status}
                        onValueChange={(value) => updateInvoiceField('status', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="sent">Sent</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
                          <SelectItem value="overdue">Overdue</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Customer Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label>Customer Name</Label>
                      <Input
                        value={invoice.customerInfo.name}
                        onChange={(e) => updateCustomerInfo('name', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={invoice.customerInfo.email}
                        onChange={(e) => updateCustomerInfo('email', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>VAT Number</Label>
                      <Input
                        value={invoice.customerInfo.taxId || ''}
                        onChange={(e) => updateCustomerInfo('taxId', e.target.value)}
                        placeholder="VAT123456789"
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-sm">Items</CardTitle>
                    <Button size="sm" onClick={addItem} variant="outline">
                      Add Item
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {invoice.items.map((item, index) => (
                        <div key={index} className="p-3 border rounded-lg space-y-2">
                          <div className="flex justify-between items-start">
                            <span className="text-sm font-medium">Item {index + 1}</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeItem(index)}
                              className="text-red-500 hover:text-red-700"
                            >
                              ×
                            </Button>
                          </div>
                          <Input
                            placeholder="Description"
                            value={item.description}
                            onChange={(e) => updateItem(index, 'description', e.target.value)}
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              type="number"
                              placeholder="Qty"
                              value={item.quantity}
                              onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                            />
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="Price"
                              value={item.unitPrice}
                              onChange={(e) => updateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                            />
                          </div>
                          <div className="text-right text-sm">
                            Total: €{item.total.toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Notes & Terms</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label>Payment Terms</Label>
                      <Textarea
                        value={invoice.paymentTerms || ''}
                        onChange={(e) => updateInvoiceField('paymentTerms', e.target.value)}
                        placeholder="Payment due within 30 days..."
                      />
                    </div>
                    <div>
                      <Label>Notes</Label>
                      <Textarea
                        value={invoice.notes || ''}
                        onChange={(e) => updateInvoiceField('notes', e.target.value)}
                        placeholder="Additional notes..."
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Design Tab */}
              <TabsContent value="design" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Template</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Select
                      value={pdfOptions.theme}
                      onValueChange={(value: InvoiceTemplate) => setPdfOptions(prev => ({ ...prev, theme: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {templateOptions.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            <div className="flex flex-col">
                              <span>{option.label}</span>
                              <span className="text-xs text-muted-foreground">{option.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center">
                      <Globe className="w-4 h-4 mr-2" />
                      Language
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Select
                      value={pdfOptions.language}
                      onValueChange={(value: SupportedLanguage) => setPdfOptions(prev => ({ ...prev, language: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {languageOptions.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.flag} {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Color Presets</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-2">
                      {colorPresets.map(preset => (
                        <Button
                          key={preset.name}
                          variant="outline"
                          size="sm"
                          onClick={() => applyColorPreset(preset)}
                          className="justify-start"
                        >
                          <div 
                            className="w-4 h-4 rounded mr-2" 
                            style={{ backgroundColor: preset.primary }}
                          />
                          {preset.name}
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Custom Colors</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label>Primary Color</Label>
                      <Input
                        type="color"
                        value={pdfOptions.primaryColor}
                        onChange={(e) => setPdfOptions(prev => ({ ...prev, primaryColor: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>Accent Color</Label>
                      <Input
                        type="color"
                        value={pdfOptions.accentColor}
                        onChange={(e) => setPdfOptions(prev => ({ ...prev, accentColor: e.target.value }))}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Settings Tab */}
              <TabsContent value="settings" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">PDF Options</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Page Format</Label>
                      <Select
                        value={pdfOptions.format}
                        onValueChange={(value: 'A4' | 'letter') => setPdfOptions(prev => ({ ...prev, format: value }))}
                      >
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="A4">A4</SelectItem>
                          <SelectItem value="letter">Letter</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between">
                      <Label>Include QR Code</Label>
                      <Switch
                        checked={pdfOptions.includeQRCode}
                        onCheckedChange={(checked) => setPdfOptions(prev => ({ ...prev, includeQRCode: checked }))}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label>Payment Terms</Label>
                      <Switch
                        checked={pdfOptions.includePaymentTerms}
                        onCheckedChange={(checked) => setPdfOptions(prev => ({ ...prev, includePaymentTerms: checked }))}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label>VAT Breakdown</Label>
                      <Switch
                        checked={pdfOptions.includeVATBreakdown}
                        onCheckedChange={(checked) => setPdfOptions(prev => ({ ...prev, includeVATBreakdown: checked }))}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Branding</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label>Logo URL</Label>
                      <Input
                        value={pdfOptions.logoUrl || ''}
                        onChange={(e) => setPdfOptions(prev => ({ ...prev, logoUrl: e.target.value }))}
                        placeholder="https://example.com/logo.png"
                      />
                    </div>
                    <div>
                      <Label>Watermark Text</Label>
                      <Input
                        value={pdfOptions.watermark || ''}
                        onChange={(e) => setPdfOptions(prev => ({ ...prev, watermark: e.target.value }))}
                        placeholder="DRAFT"
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </div>
  )
}

export default PDFPreview