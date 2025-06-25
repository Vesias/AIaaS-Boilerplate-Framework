'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  Plus, 
  Search, 
  Filter, 
  MoreHorizontal,
  Eye,
  Edit,
  Copy,
  Trash2,
  Download,
  Send,
  Calendar,
  DollarSign,
  User,
  Building,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { format, isAfter, isBefore, addDays } from 'date-fns'

export interface Invoice {
  id: string
  invoiceNumber: string
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
  clientName: string
  clientCompany?: string
  clientEmail: string
  amount: number
  currency: string
  issueDate: string
  dueDate: string
  paidDate?: string
  createdAt: string
  updatedAt: string
}

interface InvoiceListProps {
  invoices: Invoice[]
  onView: (invoice: Invoice) => void
  onEdit: (invoice: Invoice) => void
  onDuplicate: (invoice: Invoice) => void
  onDelete: (invoiceId: string) => void
  onSend: (invoice: Invoice) => void
  onMarkPaid: (invoiceId: string) => void
  onBulkAction: (action: string, invoiceIds: string[]) => void
  className?: string
  enableBulkActions?: boolean
}

export default function InvoiceList({
  invoices,
  onView,
  onEdit,
  onDuplicate,
  onDelete,
  onSend,
  onMarkPaid,
  onBulkAction,
  className,
  enableBulkActions = true
}: InvoiceListProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([])

  const filteredAndSortedInvoices = useMemo(() => {
    let filtered = invoices.filter(invoice => {
      const matchesSearch = searchTerm === '' || 
        invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.clientCompany?.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter

      return matchesSearch && matchesStatus
    })

    return filtered.sort((a, b) => {
      let aValue: any, bValue: any

      switch (sortBy) {
        case 'invoiceNumber':
          aValue = a.invoiceNumber
          bValue = b.invoiceNumber
          break
        case 'clientName':
          aValue = a.clientName
          bValue = b.clientName
          break
        case 'amount':
          aValue = a.amount
          bValue = b.amount
          break
        case 'dueDate':
          aValue = new Date(a.dueDate).getTime()
          bValue = new Date(b.dueDate).getTime()
          break
        default:
          aValue = new Date(a.createdAt).getTime()
          bValue = new Date(b.createdAt).getTime()
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })
  }, [invoices, searchTerm, statusFilter, sortBy, sortOrder])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800'
      case 'sent': return 'bg-blue-100 text-blue-800'
      case 'overdue': return 'bg-red-100 text-red-800'
      case 'cancelled': return 'bg-gray-100 text-gray-800'
      case 'draft': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid': return CheckCircle
      case 'sent': return Clock
      case 'overdue': return AlertTriangle
      case 'cancelled': return XCircle
      case 'draft': return FileText
      default: return FileText
    }
  }

  const isOverdue = (invoice: Invoice) => {
    return invoice.status !== 'paid' && isAfter(new Date(), new Date(invoice.dueDate))
  }

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount)
  }

  const toggleInvoiceSelection = (invoiceId: string) => {
    setSelectedInvoices(prev => 
      prev.includes(invoiceId) 
        ? prev.filter(id => id !== invoiceId)
        : [...prev, invoiceId]
    )
  }

  const handleBulkAction = (action: string) => {
    onBulkAction(action, selectedInvoices)
    setSelectedInvoices([])
  }

  const InvoiceCard = ({ invoice }: { invoice: Invoice }) => {
    const StatusIcon = getStatusIcon(invoice.status)
    const overdue = isOverdue(invoice)

    return (
      <Card className={cn(
        "transition-all hover:shadow-md",
        selectedInvoices.includes(invoice.id) && "ring-2 ring-blue-500",
        overdue && "border-red-200"
      )}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              {enableBulkActions && (
                <Checkbox
                  checked={selectedInvoices.includes(invoice.id)}
                  onCheckedChange={() => toggleInvoiceSelection(invoice.id)}
                  className="mt-1"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <StatusIcon className={cn("h-4 w-4", overdue && "text-red-500")} />
                  <CardTitle className="text-lg truncate">
                    {invoice.invoiceNumber}
                  </CardTitle>
                  <Badge className={cn(getStatusColor(invoice.status), overdue && "bg-red-100 text-red-800")}>
                    {overdue ? 'OVERDUE' : invoice.status.toUpperCase()}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span>{invoice.clientName}</span>
                    {invoice.clientCompany && (
                      <>
                        <span>•</span>
                        <Building className="h-3 w-3" />
                        <span>{invoice.clientCompany}</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      <span className="font-medium text-foreground">
                        {formatCurrency(invoice.amount, invoice.currency)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>Due {format(new Date(invoice.dueDate), 'MMM dd')}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => onView(invoice)}>
                <Eye className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Created {format(new Date(invoice.createdAt), 'MMM dd, yyyy')}</span>
            {invoice.paidDate && (
              <span>Paid {format(new Date(invoice.paidDate), 'MMM dd, yyyy')}</span>
            )}
          </div>

          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => onView(invoice)} className="flex-1">
              <Eye className="h-3 w-3 mr-1" />
              View
            </Button>
            <Button size="sm" variant="outline" onClick={() => onEdit(invoice)} className="flex-1">
              <Edit className="h-3 w-3 mr-1" />
              Edit
            </Button>
            {invoice.status === 'draft' && (
              <Button size="sm" onClick={() => onSend(invoice)} className="flex-1">
                <Send className="h-3 w-3 mr-1" />
                Send
              </Button>
            )}
            {invoice.status === 'sent' && (
              <Button size="sm" onClick={() => onMarkPaid(invoice.id)} className="flex-1">
                <CheckCircle className="h-3 w-3 mr-1" />
                Mark Paid
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Invoices</h2>
          <p className="text-muted-foreground">
            Manage your invoices and track payments
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Invoice
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search invoices..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="createdAt">Created Date</SelectItem>
            <SelectItem value="dueDate">Due Date</SelectItem>
            <SelectItem value="amount">Amount</SelectItem>
            <SelectItem value="clientName">Client Name</SelectItem>
            <SelectItem value="invoiceNumber">Invoice Number</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
        >
          {sortOrder === 'asc' ? '↑' : '↓'}
        </Button>
      </div>

      {/* Bulk Actions */}
      {enableBulkActions && selectedInvoices.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {selectedInvoices.length} invoice{selectedInvoices.length !== 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => handleBulkAction('send')}>
                Send
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleBulkAction('mark-paid')}>
                Mark Paid
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleBulkAction('download')}>
                <Download className="h-3 w-3 mr-1" />
                Download
              </Button>
              <Button size="sm" variant="destructive" onClick={() => handleBulkAction('delete')}>
                Delete
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedInvoices([])}>
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Invoice Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredAndSortedInvoices.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No invoices found</h3>
              <p className="text-muted-foreground mb-4">
                {invoices.length === 0 
                  ? "Create your first invoice to get started."
                  : "Try adjusting your search criteria."
                }
              </p>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Invoice
              </Button>
            </CardContent>
          </Card>
        ) : (
          filteredAndSortedInvoices.map((invoice) => (
            <InvoiceCard key={invoice.id} invoice={invoice} />
          ))
        )}
      </div>
    </div>
  )
}