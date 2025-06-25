'use client'

import { useState, useRef } from 'react'
import { useReactToPrint } from 'react-to-print'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { 
  Download, 
  Print, 
  Share, 
  Edit, 
  Copy,
  FileText,
  Calendar,
  DollarSign,
  User,
  Building,
  CreditCard,
  ExternalLink
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

export interface InvoiceData {
  id: string
  invoiceNumber: string
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
  issueDate: string
  dueDate: string
  currency: string
  from: {
    name: string
    company?: string
    address: string
    city: string
    state: string
    postalCode: string
    country: string
    email?: string
    phone?: string
  }
  to: {
    name: string
    company?: string
    address: string
    city: string
    state: string
    postalCode: string
    country: string
    email?: string
    phone?: string
  }
  items: {
    id: string
    description: string
    quantity: number
    rate: number
    amount: number
    taxRate?: number
  }[]
  subtotal: number
  taxAmount: number
  discountAmount: number
  totalAmount: number
  notes?: string
  terms?: string
  paymentInstructions?: string
}

interface InvoiceViewerProps {
  invoice: InvoiceData
  onEdit?: () => void
  onDuplicate?: () => void
  onDownload?: (format: 'pdf' | 'html') => void
  onShare?: () => void
  className?: string
  showActions?: boolean
  printable?: boolean
}

export default function InvoiceViewer({
  invoice,
  onEdit,
  onDuplicate,
  onDownload,
  onShare,
  className,
  showActions = true,
  printable = true
}: InvoiceViewerProps) {
  const printRef = useRef<HTMLDivElement>(null)
  const [showShareDialog, setShowShareDialog] = useState(false)

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `Invoice ${invoice.invoiceNumber}`,
  })

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: invoice.currency
    }).format(amount)
  }

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

  const copyShareLink = () => {
    const link = `${window.location.origin}/invoice/${invoice.id}`
    navigator.clipboard.writeText(link)
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header Actions */}
      {showActions && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Invoice {invoice.invoiceNumber}</h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={getStatusColor(invoice.status)}>
                {invoice.status.toUpperCase()}
              </Badge>
              <span className="text-sm text-muted-foreground">
                Created {format(new Date(invoice.issueDate), 'MMM dd, yyyy')}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onShare && (
              <Button variant="outline" size="sm" onClick={() => setShowShareDialog(true)}>
                <Share className="h-4 w-4 mr-2" />
                Share
              </Button>
            )}
            {onDuplicate && (
              <Button variant="outline" size="sm" onClick={onDuplicate}>
                <Copy className="h-4 w-4 mr-2" />
                Duplicate
              </Button>
            )}
            {onDownload && (
              <Button variant="outline" size="sm" onClick={() => onDownload('pdf')}>
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
            )}
            {printable && (
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Print className="h-4 w-4 mr-2" />
                Print
              </Button>
            )}
            {onEdit && (
              <Button size="sm" onClick={onEdit}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Invoice Content */}
      <div ref={printRef} className="bg-white">
        <Card className="shadow-lg">
          <CardContent className="p-8">
            {/* Header */}
            <div className="flex justify-between items-start mb-8">
              <div>
                <h1 className="text-4xl font-bold text-gray-900 mb-2">INVOICE</h1>
                <div className="text-sm text-gray-600 space-y-1">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Invoice #{invoice.invoiceNumber}
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Issue Date: {format(new Date(invoice.issueDate), 'MMM dd, yyyy')}
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Due Date: {format(new Date(invoice.dueDate), 'MMM dd, yyyy')}
                  </div>
                </div>
              </div>
              
              <div className="text-right">
                <Badge className={cn("text-lg px-4 py-2", getStatusColor(invoice.status))}>
                  {invoice.status.toUpperCase()}
                </Badge>
                <div className="mt-4">
                  <div className="text-3xl font-bold text-gray-900">
                    {formatCurrency(invoice.totalAmount)}
                  </div>
                  <div className="text-sm text-gray-600">Total Amount</div>
                </div>
              </div>
            </div>

            {/* Addresses */}
            <div className="grid md:grid-cols-2 gap-8 mb-8">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <User className="h-5 w-5 text-gray-600" />
                  <h3 className="font-semibold text-gray-900">From:</h3>
                </div>
                <div className="text-sm text-gray-600 space-y-1 ml-7">
                  <div className="font-medium text-gray-900">{invoice.from.name}</div>
                  {invoice.from.company && <div>{invoice.from.company}</div>}
                  <div>{invoice.from.address}</div>
                  <div>{invoice.from.city}, {invoice.from.state} {invoice.from.postalCode}</div>
                  <div>{invoice.from.country}</div>
                  {invoice.from.email && <div>{invoice.from.email}</div>}
                  {invoice.from.phone && <div>{invoice.from.phone}</div>}
                </div>
              </div>
              
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Building className="h-5 w-5 text-gray-600" />
                  <h3 className="font-semibold text-gray-900">To:</h3>
                </div>
                <div className="text-sm text-gray-600 space-y-1 ml-7">
                  <div className="font-medium text-gray-900">{invoice.to.name}</div>
                  {invoice.to.company && <div>{invoice.to.company}</div>}
                  <div>{invoice.to.address}</div>
                  <div>{invoice.to.city}, {invoice.to.state} {invoice.to.postalCode}</div>
                  <div>{invoice.to.country}</div>
                  {invoice.to.email && <div>{invoice.to.email}</div>}
                  {invoice.to.phone && <div>{invoice.to.phone}</div>}
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="mb-8">
              <div className="overflow-hidden border border-gray-200 rounded-lg">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left py-3 px-4 font-semibold text-gray-900">Description</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-900 w-20">Qty</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-900 w-24">Rate</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-900 w-24">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {invoice.items.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div className="font-medium">{item.description}</div>
                          {item.taxRate && item.taxRate > 0 && (
                            <div className="text-xs text-gray-500">Tax: {item.taxRate}%</div>
                          )}
                        </td>
                        <td className="text-right py-3 px-4">{item.quantity}</td>
                        <td className="text-right py-3 px-4">{formatCurrency(item.rate)}</td>
                        <td className="text-right py-3 px-4 font-medium">{formatCurrency(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals */}
            <div className="flex justify-end mb-8">
              <div className="w-80 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium">{formatCurrency(invoice.subtotal)}</span>
                </div>
                {invoice.taxAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Tax:</span>
                    <span className="font-medium">{formatCurrency(invoice.taxAmount)}</span>
                  </div>
                )}
                {invoice.discountAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Discount:</span>
                    <span className="font-medium text-red-600">-{formatCurrency(invoice.discountAmount)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between">
                  <span className="font-semibold text-lg">Total:</span>
                  <span className="font-bold text-xl">{formatCurrency(invoice.totalAmount)}</span>
                </div>
              </div>
            </div>

            {/* Payment Instructions */}
            {invoice.paymentInstructions && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CreditCard className="h-5 w-5 text-blue-600" />
                  <h4 className="font-semibold text-blue-900">Payment Instructions</h4>
                </div>
                <p className="text-sm text-blue-800">{invoice.paymentInstructions}</p>
              </div>
            )}

            {/* Notes and Terms */}
            {(invoice.notes || invoice.terms) && (
              <div className="border-t pt-6 space-y-4">
                {invoice.notes && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Notes:</h4>
                    <p className="text-sm text-gray-600 leading-relaxed">{invoice.notes}</p>
                  </div>
                )}
                {invoice.terms && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Terms & Conditions:</h4>
                    <p className="text-sm text-gray-600 leading-relaxed">{invoice.terms}</p>
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="mt-8 pt-6 border-t text-center text-xs text-gray-500">
              <p>Invoice generated on {format(new Date(), 'MMM dd, yyyy')}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Share Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Invoice</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Share Link</h4>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={`${window.location.origin}/invoice/${invoice.id}`}
                  className="flex-1 px-3 py-2 border rounded-md bg-gray-50 text-sm"
                />
                <Button size="sm" onClick={copyShareLink}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Quick Actions</h4>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => window.open(`mailto:${invoice.to.email}?subject=Invoice ${invoice.invoiceNumber}`)}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Email Client
                </Button>
                <Button variant="outline" onClick={() => onDownload?.('pdf')}>
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}