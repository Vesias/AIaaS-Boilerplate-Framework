'use client'

import { useState, useRef } from 'react'
import { useReactToPrint } from 'react-to-print'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Plus, 
  Trash2, 
  FileText, 
  Download, 
  Print, 
  Send, 
  Save, 
  Eye,
  Calendar,
  DollarSign,
  Hash,
  User,
  Building,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  Clock,
  Calculator,
  Copy,
  Edit,
  CheckCircle,
  AlertTriangle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { format, addDays } from 'date-fns'

export interface InvoiceItem {
  id: string
  description: string
  quantity: number
  rate: number
  amount: number
  taxRate?: number
  category?: string
}

export interface InvoiceAddress {
  name: string
  company?: string
  address: string
  city: string
  state: string
  postalCode: string
  country: string
  email?: string
  phone?: string
  taxId?: string
}

export interface InvoiceData {
  id: string
  invoiceNumber: string
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
  issueDate: string
  dueDate: string
  currency: string
  
  // Addresses
  from: InvoiceAddress
  to: InvoiceAddress
  
  // Items
  items: InvoiceItem[]
  
  // Totals
  subtotal: number
  taxAmount: number
  discountAmount: number
  totalAmount: number
  
  // Additional info
  notes?: string
  terms?: string
  paymentMethod?: string
  paymentInstructions?: string
  
  // Metadata
  template: string
  language: string
  createdAt: string
  updatedAt: string
}

interface InvoiceGeneratorProps {
  invoice?: InvoiceData
  onSave: (invoice: InvoiceData) => void
  onSend: (invoice: InvoiceData) => void
  className?: string
  templates?: InvoiceTemplate[]
  currencies?: string[]
  taxRates?: { name: string; rate: number }[]
}

interface InvoiceTemplate {
  id: string
  name: string
  preview: string
  description: string
}

const DEFAULT_TEMPLATES: InvoiceTemplate[] = [
  {
    id: 'modern',
    name: 'Modern',
    preview: '/templates/modern.png',
    description: 'Clean and professional design'
  },
  {
    id: 'classic',
    name: 'Classic',
    preview: '/templates/classic.png',
    description: 'Traditional business invoice'
  },
  {
    id: 'minimal',
    name: 'Minimal',
    preview: '/templates/minimal.png',
    description: 'Simple and elegant layout'
  }
]

const DEFAULT_CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD']
const DEFAULT_TAX_RATES = [
  { name: 'VAT (19%)', rate: 19 },
  { name: 'VAT (21%)', rate: 21 },
  { name: 'Sales Tax (8.5%)', rate: 8.5 },
  { name: 'GST (10%)', rate: 10 }
]

export default function InvoiceGenerator({
  invoice,
  onSave,
  onSend,
  className,
  templates = DEFAULT_TEMPLATES,
  currencies = DEFAULT_CURRENCIES,
  taxRates = DEFAULT_TAX_RATES
}: InvoiceGeneratorProps) {
  const printRef = useRef<HTMLDivElement>(null)
  const [invoiceData, setInvoiceData] = useState<InvoiceData>(
    invoice || {
      id: `inv-${Date.now()}`,
      invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
      status: 'draft',
      issueDate: format(new Date(), 'yyyy-MM-dd'),
      dueDate: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
      currency: 'USD',
      from: {
        name: '',
        company: '',
        address: '',
        city: '',
        state: '',
        postalCode: '',
        country: '',
        email: '',
        phone: ''
      },
      to: {
        name: '',
        company: '',
        address: '',
        city: '',
        state: '',
        postalCode: '',
        country: '',
        email: '',
        phone: ''
      },
      items: [],
      subtotal: 0,
      taxAmount: 0,
      discountAmount: 0,
      totalAmount: 0,
      template: 'modern',
      language: 'en',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  )

  const [selectedTemplate, setSelectedTemplate] = useState(invoiceData.template)
  const [showPreview, setShowPreview] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `Invoice ${invoiceData.invoiceNumber}`,
  })

  // Calculate totals
  const calculateTotals = () => {
    const subtotal = invoiceData.items.reduce((sum, item) => sum + item.amount, 0)
    const taxAmount = invoiceData.items.reduce((sum, item) => {
      const itemTax = item.amount * (item.taxRate || 0) / 100
      return sum + itemTax
    }, 0)
    const totalAmount = subtotal + taxAmount - invoiceData.discountAmount

    setInvoiceData(prev => ({
      ...prev,
      subtotal,
      taxAmount,
      totalAmount,
      updatedAt: new Date().toISOString()
    }))
  }

  // Add new item
  const addItem = () => {
    const newItem: InvoiceItem = {
      id: `item-${Date.now()}`,
      description: '',
      quantity: 1,
      rate: 0,
      amount: 0,
      taxRate: 0
    }

    setInvoiceData(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }))
  }

  // Update item
  const updateItem = (itemId: string, updates: Partial<InvoiceItem>) => {
    setInvoiceData(prev => ({
      ...prev,
      items: prev.items.map(item => {
        if (item.id === itemId) {
          const updatedItem = { ...item, ...updates }
          // Recalculate amount if quantity or rate changed
          if ('quantity' in updates || 'rate' in updates) {
            updatedItem.amount = updatedItem.quantity * updatedItem.rate
          }
          return updatedItem
        }
        return item
      })
    }))
  }

  // Remove item
  const removeItem = (itemId: string) => {
    setInvoiceData(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== itemId)
    }))
  }

  // Validate invoice
  const validateInvoice = (): string[] => {
    const errors: string[] = []

    if (!invoiceData.from.name) errors.push('Sender name is required')
    if (!invoiceData.from.address) errors.push('Sender address is required')
    if (!invoiceData.to.name) errors.push('Recipient name is required')
    if (!invoiceData.to.address) errors.push('Recipient address is required')
    if (invoiceData.items.length === 0) errors.push('At least one item is required')
    if (invoiceData.items.some(item => !item.description)) errors.push('All items must have descriptions')
    if (invoiceData.items.some(item => item.quantity <= 0)) errors.push('All items must have positive quantities')
    if (invoiceData.items.some(item => item.rate < 0)) errors.push('All items must have non-negative rates')

    return errors
  }

  // Handle save
  const handleSave = async () => {
    const errors = validateInvoice()
    setValidationErrors(errors)

    if (errors.length > 0) return

    setIsSaving(true)
    try {
      await onSave(invoiceData)
    } finally {
      setIsSaving(false)
    }
  }

  // Handle send
  const handleSend = async () => {
    const errors = validateInvoice()
    setValidationErrors(errors)

    if (errors.length > 0) return

    if (invoiceData.status === 'draft') {
      setInvoiceData(prev => ({ ...prev, status: 'sent' }))
    }

    await onSend(invoiceData)
  }

  // Calculate totals when items change
  React.useEffect(() => {
    calculateTotals()
  }, [invoiceData.items, invoiceData.discountAmount])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: invoiceData.currency
    }).format(amount)
  }

  const InvoicePreview = () => (
    <div ref={printRef} className="bg-white p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">INVOICE</h1>
          <div className="text-sm text-gray-600">
            <div>Invoice #{invoiceData.invoiceNumber}</div>
            <div>Issue Date: {format(new Date(invoiceData.issueDate), 'MMM dd, yyyy')}</div>
            <div>Due Date: {format(new Date(invoiceData.dueDate), 'MMM dd, yyyy')}</div>
          </div>
        </div>
        <div className="text-right">
          <Badge variant={
            invoiceData.status === 'paid' ? 'default' :
            invoiceData.status === 'overdue' ? 'destructive' :
            invoiceData.status === 'sent' ? 'secondary' : 'outline'
          }>
            {invoiceData.status.toUpperCase()}
          </Badge>
        </div>
      </div>

      {/* Addresses */}
      <div className="grid md:grid-cols-2 gap-8 mb-8">
        <div>
          <h3 className="font-semibold text-gray-900 mb-2">From:</h3>
          <div className="text-sm text-gray-600 space-y-1">
            <div className="font-medium">{invoiceData.from.name}</div>
            {invoiceData.from.company && <div>{invoiceData.from.company}</div>}
            <div>{invoiceData.from.address}</div>
            <div>{invoiceData.from.city}, {invoiceData.from.state} {invoiceData.from.postalCode}</div>
            <div>{invoiceData.from.country}</div>
            {invoiceData.from.email && <div>{invoiceData.from.email}</div>}
            {invoiceData.from.phone && <div>{invoiceData.from.phone}</div>}
          </div>
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 mb-2">To:</h3>
          <div className="text-sm text-gray-600 space-y-1">
            <div className="font-medium">{invoiceData.to.name}</div>
            {invoiceData.to.company && <div>{invoiceData.to.company}</div>}
            <div>{invoiceData.to.address}</div>
            <div>{invoiceData.to.city}, {invoiceData.to.state} {invoiceData.to.postalCode}</div>
            <div>{invoiceData.to.country}</div>
            {invoiceData.to.email && <div>{invoiceData.to.email}</div>}
            {invoiceData.to.phone && <div>{invoiceData.to.phone}</div>}
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="mb-8">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="text-left py-2 font-semibold">Description</th>
              <th className="text-right py-2 font-semibold w-20">Qty</th>
              <th className="text-right py-2 font-semibold w-24">Rate</th>
              <th className="text-right py-2 font-semibold w-24">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoiceData.items.map((item) => (
              <tr key={item.id} className="border-b border-gray-100">
                <td className="py-2">{item.description}</td>
                <td className="text-right py-2">{item.quantity}</td>
                <td className="text-right py-2">{formatCurrency(item.rate)}</td>
                <td className="text-right py-2">{formatCurrency(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="flex justify-end mb-8">
        <div className="w-64 space-y-2">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>{formatCurrency(invoiceData.subtotal)}</span>
          </div>
          {invoiceData.taxAmount > 0 && (
            <div className="flex justify-between">
              <span>Tax:</span>
              <span>{formatCurrency(invoiceData.taxAmount)}</span>
            </div>
          )}
          {invoiceData.discountAmount > 0 && (
            <div className="flex justify-between">
              <span>Discount:</span>
              <span>-{formatCurrency(invoiceData.discountAmount)}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between font-bold text-lg">
            <span>Total:</span>
            <span>{formatCurrency(invoiceData.totalAmount)}</span>
          </div>
        </div>
      </div>

      {/* Notes and Terms */}
      {(invoiceData.notes || invoiceData.terms) && (
        <div className="border-t pt-6 space-y-4">
          {invoiceData.notes && (
            <div>
              <h4 className="font-semibold mb-2">Notes:</h4>
              <p className="text-sm text-gray-600">{invoiceData.notes}</p>
            </div>
          )}
          {invoiceData.terms && (
            <div>
              <h4 className="font-semibold mb-2">Terms & Conditions:</h4>
              <p className="text-sm text-gray-600">{invoiceData.terms}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Invoice Generator</h2>
          <p className="text-muted-foreground">
            Create and customize professional invoices
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowPreview(true)}>
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button variant="outline" onClick={handlePrint}>
            <Print className="h-4 w-4 mr-2" />
            Print
          </Button>
          <Button variant="outline" onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <div className="animate-spin h-4 w-4 mr-2 border-2 border-gray-300 border-t-blue-600 rounded-full" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save
          </Button>
          <Button onClick={handleSend}>
            <Send className="h-4 w-4 mr-2" />
            Send
          </Button>
        </div>
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              {validationErrors.map((error, index) => (
                <div key={index}>• {error}</div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="details" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="addresses">Addresses</TabsTrigger>
              <TabsTrigger value="items">Items</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Invoice Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="invoiceNumber">Invoice Number</Label>
                      <Input
                        id="invoiceNumber"
                        value={invoiceData.invoiceNumber}
                        onChange={(e) => setInvoiceData(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="status">Status</Label>
                      <Select 
                        value={invoiceData.status} 
                        onValueChange={(value: any) => setInvoiceData(prev => ({ ...prev, status: value }))}
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
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="issueDate">Issue Date</Label>
                      <Input
                        id="issueDate"
                        type="date"
                        value={invoiceData.issueDate}
                        onChange={(e) => setInvoiceData(prev => ({ ...prev, issueDate: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="dueDate">Due Date</Label>
                      <Input
                        id="dueDate"
                        type="date"
                        value={invoiceData.dueDate}
                        onChange={(e) => setInvoiceData(prev => ({ ...prev, dueDate: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="currency">Currency</Label>
                    <Select 
                      value={invoiceData.currency} 
                      onValueChange={(value) => setInvoiceData(prev => ({ ...prev, currency: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {currencies.map(currency => (
                          <SelectItem key={currency} value={currency}>{currency}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="addresses" className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                {/* From Address */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      From Address
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label htmlFor="fromName">Name</Label>
                      <Input
                        id="fromName"
                        value={invoiceData.from.name}
                        onChange={(e) => setInvoiceData(prev => ({
                          ...prev,
                          from: { ...prev.from, name: e.target.value }
                        }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="fromCompany">Company</Label>
                      <Input
                        id="fromCompany"
                        value={invoiceData.from.company}
                        onChange={(e) => setInvoiceData(prev => ({
                          ...prev,
                          from: { ...prev.from, company: e.target.value }
                        }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="fromAddress">Address</Label>
                      <Textarea
                        id="fromAddress"
                        value={invoiceData.from.address}
                        onChange={(e) => setInvoiceData(prev => ({
                          ...prev,
                          from: { ...prev.from, address: e.target.value }
                        }))}
                        rows={2}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="fromCity">City</Label>
                        <Input
                          id="fromCity"
                          value={invoiceData.from.city}
                          onChange={(e) => setInvoiceData(prev => ({
                            ...prev,
                            from: { ...prev.from, city: e.target.value }
                          }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="fromState">State</Label>
                        <Input
                          id="fromState"
                          value={invoiceData.from.state}
                          onChange={(e) => setInvoiceData(prev => ({
                            ...prev,
                            from: { ...prev.from, state: e.target.value }
                          }))}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="fromPostalCode">Postal Code</Label>
                        <Input
                          id="fromPostalCode"
                          value={invoiceData.from.postalCode}
                          onChange={(e) => setInvoiceData(prev => ({
                            ...prev,
                            from: { ...prev.from, postalCode: e.target.value }
                          }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="fromCountry">Country</Label>
                        <Input
                          id="fromCountry"
                          value={invoiceData.from.country}
                          onChange={(e) => setInvoiceData(prev => ({
                            ...prev,
                            from: { ...prev.from, country: e.target.value }
                          }))}
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="fromEmail">Email</Label>
                      <Input
                        id="fromEmail"
                        type="email"
                        value={invoiceData.from.email}
                        onChange={(e) => setInvoiceData(prev => ({
                          ...prev,
                          from: { ...prev.from, email: e.target.value }
                        }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="fromPhone">Phone</Label>
                      <Input
                        id="fromPhone"
                        value={invoiceData.from.phone}
                        onChange={(e) => setInvoiceData(prev => ({
                          ...prev,
                          from: { ...prev.from, phone: e.target.value }
                        }))}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* To Address */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building className="h-4 w-4" />
                      To Address
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label htmlFor="toName">Name</Label>
                      <Input
                        id="toName"
                        value={invoiceData.to.name}
                        onChange={(e) => setInvoiceData(prev => ({
                          ...prev,
                          to: { ...prev.to, name: e.target.value }
                        }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="toCompany">Company</Label>
                      <Input
                        id="toCompany"
                        value={invoiceData.to.company}
                        onChange={(e) => setInvoiceData(prev => ({
                          ...prev,
                          to: { ...prev.to, company: e.target.value }
                        }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="toAddress">Address</Label>
                      <Textarea
                        id="toAddress"
                        value={invoiceData.to.address}
                        onChange={(e) => setInvoiceData(prev => ({
                          ...prev,
                          to: { ...prev.to, address: e.target.value }
                        }))}
                        rows={2}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="toCity">City</Label>
                        <Input
                          id="toCity"
                          value={invoiceData.to.city}
                          onChange={(e) => setInvoiceData(prev => ({
                            ...prev,
                            to: { ...prev.to, city: e.target.value }
                          }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="toState">State</Label>
                        <Input
                          id="toState"
                          value={invoiceData.to.state}
                          onChange={(e) => setInvoiceData(prev => ({
                            ...prev,
                            to: { ...prev.to, state: e.target.value }
                          }))}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="toPostalCode">Postal Code</Label>
                        <Input
                          id="toPostalCode"
                          value={invoiceData.to.postalCode}
                          onChange={(e) => setInvoiceData(prev => ({
                            ...prev,
                            to: { ...prev.to, postalCode: e.target.value }
                          }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="toCountry">Country</Label>
                        <Input
                          id="toCountry"
                          value={invoiceData.to.country}
                          onChange={(e) => setInvoiceData(prev => ({
                            ...prev,
                            to: { ...prev.to, country: e.target.value }
                          }))}
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="toEmail">Email</Label>
                      <Input
                        id="toEmail"
                        type="email"
                        value={invoiceData.to.email}
                        onChange={(e) => setInvoiceData(prev => ({
                          ...prev,
                          to: { ...prev.to, email: e.target.value }
                        }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="toPhone">Phone</Label>
                      <Input
                        id="toPhone"
                        value={invoiceData.to.phone}
                        onChange={(e) => setInvoiceData(prev => ({
                          ...prev,
                          to: { ...prev.to, phone: e.target.value }
                        }))}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="items" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Invoice Items</CardTitle>
                    <Button onClick={addItem}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Item
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {invoiceData.items.map((item, index) => (
                      <div key={item.id} className="grid grid-cols-12 gap-2 items-end p-3 border rounded-lg">
                        <div className="col-span-4">
                          <Label htmlFor={`item-desc-${index}`}>Description</Label>
                          <Input
                            id={`item-desc-${index}`}
                            value={item.description}
                            onChange={(e) => updateItem(item.id, { description: e.target.value })}
                            placeholder="Item description"
                          />
                        </div>
                        <div className="col-span-2">
                          <Label htmlFor={`item-qty-${index}`}>Quantity</Label>
                          <Input
                            id={`item-qty-${index}`}
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.quantity}
                            onChange={(e) => updateItem(item.id, { quantity: parseFloat(e.target.value) || 0 })}
                          />
                        </div>
                        <div className="col-span-2">
                          <Label htmlFor={`item-rate-${index}`}>Rate</Label>
                          <Input
                            id={`item-rate-${index}`}
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.rate}
                            onChange={(e) => updateItem(item.id, { rate: parseFloat(e.target.value) || 0 })}
                          />
                        </div>
                        <div className="col-span-2">
                          <Label htmlFor={`item-tax-${index}`}>Tax %</Label>
                          <Select 
                            value={item.taxRate?.toString() || '0'} 
                            onValueChange={(value) => updateItem(item.id, { taxRate: parseFloat(value) })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">No Tax</SelectItem>
                              {taxRates.map(rate => (
                                <SelectItem key={rate.rate} value={rate.rate.toString()}>
                                  {rate.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-1">
                          <Label>Amount</Label>
                          <div className="text-sm font-medium p-2">
                            {formatCurrency(item.amount)}
                          </div>
                        </div>
                        <div className="col-span-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeItem(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}

                    {invoiceData.items.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No items added yet</p>
                        <Button onClick={addItem} className="mt-2">
                          <Plus className="h-4 w-4 mr-2" />
                          Add your first item
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Discount */}
                  <Separator className="my-4" />
                  <div className="flex justify-end">
                    <div className="w-64">
                      <Label htmlFor="discount">Discount Amount</Label>
                      <Input
                        id="discount"
                        type="number"
                        min="0"
                        step="0.01"
                        value={invoiceData.discountAmount}
                        onChange={(e) => setInvoiceData(prev => ({ 
                          ...prev, 
                          discountAmount: parseFloat(e.target.value) || 0 
                        }))}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Additional Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={invoiceData.notes}
                      onChange={(e) => setInvoiceData(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Additional notes for the client"
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label htmlFor="terms">Terms & Conditions</Label>
                    <Textarea
                      id="terms"
                      value={invoiceData.terms}
                      onChange={(e) => setInvoiceData(prev => ({ ...prev, terms: e.target.value }))}
                      placeholder="Payment terms and conditions"
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label htmlFor="paymentInstructions">Payment Instructions</Label>
                    <Textarea
                      id="paymentInstructions"
                      value={invoiceData.paymentInstructions}
                      onChange={(e) => setInvoiceData(prev => ({ ...prev, paymentInstructions: e.target.value }))}
                      placeholder="How the client should pay"
                      rows={2}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Summary */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                Invoice Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatCurrency(invoiceData.subtotal)}</span>
              </div>
              {invoiceData.taxAmount > 0 && (
                <div className="flex justify-between">
                  <span>Tax:</span>
                  <span>{formatCurrency(invoiceData.taxAmount)}</span>
                </div>
              )}
              {invoiceData.discountAmount > 0 && (
                <div className="flex justify-between">
                  <span>Discount:</span>
                  <span>-{formatCurrency(invoiceData.discountAmount)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-bold text-lg">
                <span>Total:</span>
                <span>{formatCurrency(invoiceData.totalAmount)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Template Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Template</CardTitle>
            </CardHeader>
            <CardContent>
              <Select 
                value={selectedTemplate} 
                onValueChange={(value) => {
                  setSelectedTemplate(value)
                  setInvoiceData(prev => ({ ...prev, template: value }))
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {templates.map(template => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {templates.find(t => t.id === selectedTemplate)?.description}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-5xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Invoice Preview</DialogTitle>
          </DialogHeader>
          <div className="overflow-auto max-h-[80vh]">
            <InvoicePreview />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}