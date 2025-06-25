'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart
} from 'recharts'
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  FileText, 
  Clock, 
  CheckCircle,
  AlertTriangle,
  Calendar,
  Users,
  Target
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { format, subMonths, startOfMonth, endOfMonth, eachMonthOfInterval } from 'date-fns'

interface Invoice {
  id: string
  amount: number
  currency: string
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
  issueDate: string
  dueDate: string
  paidDate?: string
  clientName: string
}

interface InvoiceAnalyticsProps {
  invoices: Invoice[]
  dateRange?: 'month' | 'quarter' | 'year'
  className?: string
}

const COLORS = {
  paid: '#10b981',
  sent: '#3b82f6',
  overdue: '#ef4444',
  draft: '#f59e0b',
  cancelled: '#6b7280'
}

export default function InvoiceAnalytics({ invoices, dateRange = 'year', className }: InvoiceAnalyticsProps) {
  const analyticsData = useMemo(() => {
    const now = new Date()
    const startDate = dateRange === 'month' ? subMonths(now, 1) : 
                     dateRange === 'quarter' ? subMonths(now, 3) : 
                     subMonths(now, 12)

    const filteredInvoices = invoices.filter(invoice => 
      new Date(invoice.issueDate) >= startDate
    )

    // Revenue metrics
    const totalRevenue = filteredInvoices
      .filter(inv => inv.status === 'paid')
      .reduce((sum, inv) => sum + inv.amount, 0)

    const pendingRevenue = filteredInvoices
      .filter(inv => inv.status === 'sent')
      .reduce((sum, inv) => sum + inv.amount, 0)

    const overdueRevenue = filteredInvoices
      .filter(inv => inv.status === 'overdue')
      .reduce((sum, inv) => sum + inv.amount, 0)

    // Count metrics
    const totalInvoices = filteredInvoices.length
    const paidInvoices = filteredInvoices.filter(inv => inv.status === 'paid').length
    const overdueInvoices = filteredInvoices.filter(inv => inv.status === 'overdue').length

    // Monthly revenue trend
    const months = eachMonthOfInterval({
      start: startDate,
      end: now
    })

    const monthlyRevenue = months.map(month => {
      const monthStart = startOfMonth(month)
      const monthEnd = endOfMonth(month)
      
      const monthInvoices = filteredInvoices.filter(inv => {
        const issueDate = new Date(inv.issueDate)
        return issueDate >= monthStart && issueDate <= monthEnd
      })

      const paid = monthInvoices
        .filter(inv => inv.status === 'paid')
        .reduce((sum, inv) => sum + inv.amount, 0)

      const sent = monthInvoices
        .filter(inv => inv.status === 'sent')
        .reduce((sum, inv) => sum + inv.amount, 0)

      return {
        month: format(month, 'MMM'),
        paid,
        sent,
        total: paid + sent
      }
    })

    // Status distribution
    const statusCounts = filteredInvoices.reduce((acc, invoice) => {
      acc[invoice.status] = (acc[invoice.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const statusDistribution = Object.entries(statusCounts).map(([status, count]) => ({
      name: status.charAt(0).toUpperCase() + status.slice(1),
      value: count,
      color: COLORS[status as keyof typeof COLORS]
    }))

    // Top clients
    const clientRevenue = filteredInvoices.reduce((acc, invoice) => {
      if (invoice.status === 'paid') {
        acc[invoice.clientName] = (acc[invoice.clientName] || 0) + invoice.amount
      }
      return acc
    }, {} as Record<string, number>)

    const topClients = Object.entries(clientRevenue)
      .map(([client, revenue]) => ({ client, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)

    // Payment time analysis
    const paidInvoicesWithDates = filteredInvoices.filter(inv => 
      inv.status === 'paid' && inv.paidDate
    )

    const averagePaymentTime = paidInvoicesWithDates.length > 0 
      ? paidInvoicesWithDates.reduce((sum, inv) => {
          const issueDate = new Date(inv.issueDate)
          const paidDate = new Date(inv.paidDate!)
          const days = Math.ceil((paidDate.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24))
          return sum + days
        }, 0) / paidInvoicesWithDates.length
      : 0

    return {
      totalRevenue,
      pendingRevenue,
      overdueRevenue,
      totalInvoices,
      paidInvoices,
      overdueInvoices,
      monthlyRevenue,
      statusDistribution,
      topClients,
      averagePaymentTime,
      collectionRate: totalInvoices > 0 ? (paidInvoices / totalInvoices) * 100 : 0
    }
  }, [invoices, dateRange])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const StatCard = ({ 
    title, 
    value, 
    change, 
    trend, 
    icon: Icon, 
    description,
    color = "text-gray-600"
  }: {
    title: string
    value: string | number
    change?: number
    trend?: 'up' | 'down'
    icon: any
    description?: string
    color?: string
  }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={cn("h-4 w-4", color)} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {change !== undefined && (
          <div className={cn(
            "flex items-center text-xs",
            trend === 'up' ? 'text-green-600' : 'text-red-600'
          )}>
            {trend === 'up' ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
            {Math.abs(change)}% from last period
          </div>
        )}
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  )

  return (
    <div className={cn("space-y-6", className)}>
      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Revenue"
          value={formatCurrency(analyticsData.totalRevenue)}
          icon={DollarSign}
          color="text-green-600"
          description={`${analyticsData.paidInvoices} paid invoices`}
        />
        <StatCard
          title="Pending Revenue"
          value={formatCurrency(analyticsData.pendingRevenue)}
          icon={Clock}
          color="text-blue-600"
          description="Awaiting payment"
        />
        <StatCard
          title="Overdue Amount"
          value={formatCurrency(analyticsData.overdueRevenue)}
          icon={AlertTriangle}
          color="text-red-600"
          description={`${analyticsData.overdueInvoices} overdue invoices`}
        />
        <StatCard
          title="Collection Rate"
          value={`${Math.round(analyticsData.collectionRate)}%`}
          icon={Target}
          color="text-purple-600"
          description="Payment success rate"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Revenue Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue Trend</CardTitle>
            <CardDescription>Monthly revenue over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analyticsData.monthlyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Area 
                    type="monotone" 
                    dataKey="paid" 
                    stackId="1" 
                    stroke="#10b981" 
                    fill="#10b981" 
                    fillOpacity={0.6}
                    name="Paid"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="sent" 
                    stackId="1" 
                    stroke="#3b82f6" 
                    fill="#3b82f6" 
                    fillOpacity={0.6}
                    name="Pending"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Invoice Status</CardTitle>
            <CardDescription>Distribution by status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analyticsData.statusDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {analyticsData.statusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Top Clients */}
        <Card>
          <CardHeader>
            <CardTitle>Top Clients</CardTitle>
            <CardDescription>Highest paying clients</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analyticsData.topClients.map((client, index) => (
                <div key={client.client} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                      {index + 1}
                    </div>
                    <span className="font-medium">{client.client}</span>
                  </div>
                  <span className="text-sm font-medium">
                    {formatCurrency(client.revenue)}
                  </span>
                </div>
              ))}
              {analyticsData.topClients.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No client data available</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Payment Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Performance</CardTitle>
            <CardDescription>Collection metrics and timing</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Collection Rate</span>
                <span>{Math.round(analyticsData.collectionRate)}%</span>
              </div>
              <Progress value={analyticsData.collectionRate} className="h-2" />
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4">
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold">
                  {Math.round(analyticsData.averagePaymentTime)}
                </div>
                <div className="text-sm text-muted-foreground">Avg. Payment Days</div>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold">
                  {analyticsData.overdueInvoices}
                </div>
                <div className="text-sm text-muted-foreground">Overdue Invoices</div>
              </div>
            </div>

            <div className="pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Paid Invoices</span>
                <span className="text-green-600 font-medium">
                  {analyticsData.paidInvoices} / {analyticsData.totalInvoices}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Total Revenue</span>
                <span className="font-medium">
                  {formatCurrency(analyticsData.totalRevenue)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}