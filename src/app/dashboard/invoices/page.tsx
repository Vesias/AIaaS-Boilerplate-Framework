'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { 
  Plus, 
  Download, 
  Eye, 
  Send, 
  CreditCard, 
  FileText, 
  Calendar, 
  Euro, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  Filter,
  Search,
  TrendingUp,
  Receipt,
  Loader2,
  Edit,
  Copy,
  Trash2
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'

interface Invoice {
  id: string
  number: string
  customerId: string
  customerName: string
  customerEmail: string
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
  amount: number
  currency: string
  issueDate: string
  dueDate: string
  paidDate?: string
  description: string
  items: InvoiceItem[]
  stripeInvoiceId?: string
  paymentIntentId?: string
  createdAt: string
  updatedAt: string
}

interface InvoiceItem {
  id: string
  description: string
  quantity: number
  rate: number
  amount: number
}

interface PaymentRecord {
  id: string
  invoiceId: string
  amount: number
  currency: string
  paymentDate: string
  paymentMethod: string
  stripePaymentId?: string
  status: 'succeeded' | 'pending' | 'failed'
}

export default function InvoicesPage() {
  const { userId } = useAuth()
  const { toast } = useToast()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [showInvoiceForm, setShowInvoiceForm] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState<'invoices' | 'payments' | 'analytics'>('invoices')

  // Mock data for demonstration
  useEffect(() => {
    const mockInvoices: Invoice[] = [
      {
        id: '1',
        number: 'INV-2024-001',
        customerId: 'cust_1',
        customerName: 'Acme Corporation',
        customerEmail: 'billing@acme.com',
        status: 'paid',
        amount: 2500.00,
        currency: 'EUR',
        issueDate: '2024-01-01',
        dueDate: '2024-01-31',
        paidDate: '2024-01-15',
        description: 'Monthly subscription and setup fee',
        items: [
          {
            id: '1',
            description: 'Pro Plan Subscription (January)',
            quantity: 1,
            rate: 2000.00,
            amount: 2000.00
          },
          {
            id: '2',
            description: 'Setup and Configuration',
            quantity: 1,
            rate: 500.00,
            amount: 500.00
          }
        ],
        stripeInvoiceId: 'in_1234567890',
        paymentIntentId: 'pi_1234567890',
        createdAt: '2024-01-01T10:00:00Z',
        updatedAt: '2024-01-15T14:30:00Z'
      },
      {
        id: '2',
        number: 'INV-2024-002',
        customerId: 'cust_2',
        customerName: 'Tech Startup GmbH',
        customerEmail: 'finance@techstartup.de',
        status: 'sent',
        amount: 1500.00,
        currency: 'EUR',
        issueDate: '2024-01-15',
        dueDate: '2024-02-14',
        description: 'Consulting services and API integration',
        items: [
          {
            id: '3',
            description: 'API Integration Consulting',
            quantity: 20,
            rate: 75.00,
            amount: 1500.00
          }
        ],
        stripeInvoiceId: 'in_0987654321',
        createdAt: '2024-01-15T09:00:00Z',
        updatedAt: '2024-01-15T09:00:00Z'
      },
      {
        id: '3',
        number: 'INV-2024-003',
        customerId: 'cust_3',
        customerName: 'Digital Agency Ltd',
        customerEmail: 'accounts@digitalagency.co.uk',
        status: 'overdue',
        amount: 3200.00,
        currency: 'EUR',
        issueDate: '2023-12-15',
        dueDate: '2024-01-14',
        description: 'Custom workflow development',
        items: [
          {
            id: '4',
            description: 'Custom Workflow Development',
            quantity: 32,
            rate: 100.00,
            amount: 3200.00
          }
        ],
        createdAt: '2023-12-15T16:00:00Z',
        updatedAt: '2023-12-15T16:00:00Z'
      },
      {
        id: '4',
        number: 'INV-2024-004',
        customerId: 'cust_1',
        customerName: 'Acme Corporation',
        customerEmail: 'billing@acme.com',
        status: 'draft',
        amount: 2000.00,
        currency: 'EUR',
        issueDate: '2024-01-20',
        dueDate: '2024-02-20',
        description: 'February subscription',
        items: [
          {
            id: '5',
            description: 'Pro Plan Subscription (February)',
            quantity: 1,
            rate: 2000.00,
            amount: 2000.00
          }
        ],
        createdAt: '2024-01-20T11:00:00Z',
        updatedAt: '2024-01-20T11:00:00Z'
      }
    ]

    const mockPayments: PaymentRecord[] = [
      {
        id: 'pay_1',
        invoiceId: '1',
        amount: 2500.00,
        currency: 'EUR',
        paymentDate: '2024-01-15T14:30:00Z',
        paymentMethod: 'card',
        stripePaymentId: 'pi_1234567890',
        status: 'succeeded'
      },
      {
        id: 'pay_2',
        invoiceId: '2',
        amount: 750.00,
        currency: 'EUR',
        paymentDate: '2024-01-18T10:15:00Z',
        paymentMethod: 'bank_transfer',
        status: 'pending'
      }
    ]

    setInvoices(mockInvoices)
    setPayments(mockPayments)
    setLoading(false)
  }, [])

  const filteredInvoices = invoices.filter(invoice => {
    const matchesFilter = filter === 'all' || invoice.status === filter
    const matchesSearch = 
      invoice.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.description.toLowerCase().includes(searchTerm.toLowerCase())
    
    return matchesFilter && matchesSearch
  })

  const invoiceStats = {
    total: invoices.length,
    draft: invoices.filter(i => i.status === 'draft').length,
    sent: invoices.filter(i => i.status === 'sent').length,
    paid: invoices.filter(i => i.status === 'paid').length,
    overdue: invoices.filter(i => i.status === 'overdue').length,
    totalAmount: invoices.reduce((sum, i) => sum + i.amount, 0),
    paidAmount: invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.amount, 0),
    pendingAmount: invoices.filter(i => ['sent', 'overdue'].includes(i.status)).reduce((sum, i) => sum + i.amount, 0)
  }

  const handleCreateInvoice = async (formData: FormData) => {
    // In a real app, this would create the invoice via API
    const newInvoice: Invoice = {
      id: Date.now().toString(),
      number: `INV-2024-${String(invoices.length + 1).padStart(3, '0')}`,
      customerId: 'temp_customer',
      customerName: formData.get('customerName') as string,
      customerEmail: formData.get('customerEmail') as string,
      status: 'draft',
      amount: parseFloat(formData.get('amount') as string) || 0,
      currency: 'EUR',
      issueDate: formData.get('issueDate') as string,
      dueDate: formData.get('dueDate') as string,
      description: formData.get('description') as string,
      items: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    setInvoices(prev => [newInvoice, ...prev])
    setShowInvoiceForm(false)
    toast({
      title: "Invoice created",
      description: `Invoice ${newInvoice.number} has been created.`
    })
  }

  const sendInvoice = async (id: string) => {
    setInvoices(prev => prev.map(invoice => 
      invoice.id === id ? { 
        ...invoice, 
        status: 'sent',
        updatedAt: new Date().toISOString()
      } : invoice
    ))
    
    toast({
      title: "Invoice sent",
      description: "The invoice has been sent to the customer."
    })
  }

  const markAsPaid = async (id: string) => {
    setInvoices(prev => prev.map(invoice => 
      invoice.id === id ? { 
        ...invoice, 
        status: 'paid',
        paidDate: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString()
      } : invoice
    ))
    
    toast({
      title: "Invoice marked as paid",
      description: "The invoice has been marked as paid."
    })
  }

  const downloadPDF = async (invoice: Invoice) => {
    // In a real app, this would generate and download a PDF
    toast({
      title: "PDF Downloaded",
      description: `Invoice ${invoice.number} PDF has been downloaded.`
    })
  }

  const duplicateInvoice = (id: string) => {
    const original = invoices.find(i => i.id === id)
    if (original) {
      const duplicate: Invoice = {
        ...original,
        id: Date.now().toString(),
        number: `INV-2024-${String(invoices.length + 1).padStart(3, '0')}`,
        status: 'draft',
        issueDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      setInvoices(prev => [duplicate, ...prev])
      toast({
        title: "Invoice duplicated",
        description: `Created ${duplicate.number} based on ${original.number}.`
      })
    }
  }

  const deleteInvoice = (id: string) => {
    setInvoices(prev => prev.filter(invoice => invoice.id !== id))
    toast({
      title: "Invoice deleted",
      description: "The invoice has been removed."
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'text-green-500'
      case 'sent': return 'text-blue-500'
      case 'overdue': return 'text-red-500'
      case 'draft': return 'text-gray-500'
      case 'cancelled': return 'text-gray-400'
      default: return 'text-gray-500'
    }
  }

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'paid': return 'default'
      case 'sent': return 'secondary'
      case 'overdue': return 'destructive'
      case 'draft': return 'outline'
      case 'cancelled': return 'outline'
      default: return 'outline'
    }
  }

  const PaymentHistory = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Payment History
        </CardTitle>
        <CardDescription>
          Track all payment transactions and their status
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {payments.map((payment) => {
            const invoice = invoices.find(i => i.id === payment.invoiceId)
            return (
              <div key={payment.id} className="flex items-center gap-4 p-3 border rounded-lg">
                <div className={`w-3 h-3 rounded-full ${
                  payment.status === 'succeeded' ? 'bg-green-500' :
                  payment.status === 'pending' ? 'bg-yellow-500' : 'bg-red-500'
                }`} />
                <div className="flex-1">
                  <h4 className="font-medium">{invoice?.number}</h4>
                  <p className="text-sm text-muted-foreground">
                    {invoice?.customerName} • {payment.paymentMethod}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(payment.paymentDate).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium">
                    €{payment.amount.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                  </p>
                  <Badge variant={
                    payment.status === 'succeeded' ? 'default' :
                    payment.status === 'pending' ? 'secondary' : 'destructive'
                  }>
                    {payment.status}
                  </Badge>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )

  const InvoiceAnalytics = () => (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              €{invoiceStats.totalAmount.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">
              Across {invoiceStats.total} invoices
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid Amount</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              €{invoiceStats.paidAmount.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">
              {Math.round((invoiceStats.paidAmount / invoiceStats.totalAmount) * 100)}% of total
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              €{invoiceStats.pendingAmount.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">
              {invoiceStats.sent + invoiceStats.overdue} invoices
            </p>
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Revenue by Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { status: 'paid', amount: invoiceStats.paidAmount, count: invoiceStats.paid, color: 'bg-green-500' },
              { status: 'sent', amount: invoices.filter(i => i.status === 'sent').reduce((sum, i) => sum + i.amount, 0), count: invoiceStats.sent, color: 'bg-blue-500' },
              { status: 'overdue', amount: invoices.filter(i => i.status === 'overdue').reduce((sum, i) => sum + i.amount, 0), count: invoiceStats.overdue, color: 'bg-red-500' },
              { status: 'draft', amount: invoices.filter(i => i.status === 'draft').reduce((sum, i) => sum + i.amount, 0), count: invoiceStats.draft, color: 'bg-gray-500' }
            ].map((item) => (
              <div key={item.status} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${item.color}`} />
                  <div>
                    <h4 className="font-medium capitalize">{item.status}</h4>
                    <p className="text-sm text-muted-foreground">{item.count} invoices</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium">
                    €{item.amount.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {Math.round((item.amount / invoiceStats.totalAmount) * 100)}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Invoices</h2>
          <p className="text-muted-foreground">
            Manage invoices, track payments, and monitor revenue
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowInvoiceForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Invoice
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{invoiceStats.total}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{invoiceStats.paid}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sent</CardTitle>
            <Send className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{invoiceStats.sent}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{invoiceStats.overdue}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Draft</CardTitle>
            <Edit className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{invoiceStats.draft}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="invoices">
          {/* Filters and Search */}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1">
              <Input
                placeholder="Search invoices..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Invoice List</CardTitle>
              <CardDescription>
                Manage your invoices and track their status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                  Loading invoices...
                </div>
              ) : filteredInvoices.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No invoices found. Create your first invoice to get started!
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredInvoices.map((invoice) => (
                    <div
                      key={invoice.id}
                      className="flex items-center gap-4 p-4 border rounded-lg"
                    >
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{invoice.number}</h3>
                          <Badge 
                            variant={getStatusVariant(invoice.status)}
                            className={getStatusColor(invoice.status)}
                          >
                            {invoice.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {invoice.customerName} • {invoice.description}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>Issued: {new Date(invoice.issueDate).toLocaleDateString()}</span>
                          <span>Due: {new Date(invoice.dueDate).toLocaleDateString()}</span>
                          {invoice.paidDate && (
                            <span>Paid: {new Date(invoice.paidDate).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <p className="font-medium text-lg">
                          €{invoice.amount.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-muted-foreground">{invoice.currency}</p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedInvoice(invoice)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadPDF(invoice)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        {invoice.status === 'draft' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => sendInvoice(invoice.id)}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        )}
                        {invoice.status === 'sent' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => markAsPaid(invoice.id)}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => duplicateInvoice(invoice.id)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteInvoice(invoice.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <PaymentHistory />
        </TabsContent>

        <TabsContent value="analytics">
          <InvoiceAnalytics />
        </TabsContent>
      </Tabs>

      {/* Create Invoice Dialog */}
      <Dialog open={showInvoiceForm} onOpenChange={setShowInvoiceForm}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Create New Invoice</DialogTitle>
          </DialogHeader>
          <form action={handleCreateInvoice} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customerName">Customer Name</Label>
                <Input
                  id="customerName"
                  name="customerName"
                  placeholder="Enter customer name"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="customerEmail">Customer Email</Label>
                <Input
                  id="customerEmail"
                  name="customerEmail"
                  type="email"
                  placeholder="Enter customer email"
                  required
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Enter invoice description"
                rows={3}
                required
              />
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (€)</Label>
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="issueDate">Issue Date</Label>
                <Input
                  id="issueDate"
                  name="issueDate"
                  type="date"
                  defaultValue={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="dueDate">Due Date</Label>
                <Input
                  id="dueDate"
                  name="dueDate"
                  type="date"
                  defaultValue={new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                  required
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowInvoiceForm(false)}>
                Cancel
              </Button>
              <Button type="submit">
                Create Invoice
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Invoice Details Dialog */}
      {selectedInvoice && (
        <Dialog open={!!selectedInvoice} onOpenChange={() => setSelectedInvoice(null)}>
          <DialogContent className="sm:max-w-[700px]">
            <DialogHeader>
              <DialogTitle>Invoice Details: {selectedInvoice.number}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Customer</Label>
                  <p className="text-sm">{selectedInvoice.customerName}</p>
                  <p className="text-sm text-muted-foreground">{selectedInvoice.customerEmail}</p>
                </div>
                <div>
                  <Label>Status</Label>
                  <Badge 
                    variant={getStatusVariant(selectedInvoice.status)}
                    className={`${getStatusColor(selectedInvoice.status)} mt-1`}
                  >
                    {selectedInvoice.status}
                  </Badge>
                </div>
              </div>
              
              <Separator />
              
              <div>
                <Label>Description</Label>
                <p className="text-sm text-muted-foreground">
                  {selectedInvoice.description}
                </p>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Issue Date</Label>
                  <p className="text-sm">{new Date(selectedInvoice.issueDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <Label>Due Date</Label>
                  <p className="text-sm">{new Date(selectedInvoice.dueDate).toLocaleDateString()}</p>
                </div>
                {selectedInvoice.paidDate && (
                  <div>
                    <Label>Paid Date</Label>
                    <p className="text-sm">{new Date(selectedInvoice.paidDate).toLocaleDateString()}</p>
                  </div>
                )}
              </div>
              
              <Separator />
              
              <div>
                <Label>Items</Label>
                <div className="mt-2 space-y-2">
                  {selectedInvoice.items.map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-2 bg-muted rounded">
                      <div>
                        <p className="font-medium">{item.description}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.quantity} × €{item.rate.toFixed(2)}
                        </p>
                      </div>
                      <p className="font-medium">
                        €{item.amount.toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              
              <Separator />
              
              <div className="text-right">
                <p className="text-lg font-bold">
                  Total: €{selectedInvoice.amount.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                </p>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSelectedInvoice(null)}>
                  Close
                </Button>
                <Button variant="outline" onClick={() => downloadPDF(selectedInvoice)}>
                  <Download className="mr-2 h-4 w-4" />
                  Download PDF
                </Button>
                {selectedInvoice.status === 'draft' && (
                  <Button onClick={() => {
                    sendInvoice(selectedInvoice.id)
                    setSelectedInvoice(null)
                  }}>
                    <Send className="mr-2 h-4 w-4" />
                    Send Invoice
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}