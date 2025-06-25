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
  Brain, 
  Zap, 
  DollarSign, 
  Clock, 
  TrendingUp,
  BarChart3,
  Activity,
  Target,
  AlertTriangle,
  CheckCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface AIUsageData {
  id: string
  timestamp: string
  model: string
  service: 'openai' | 'anthropic' | 'google' | 'cohere' | 'huggingface'
  tokens: {
    input: number
    output: number
    total: number
  }
  cost: number
  latency: number
  success: boolean
  context: {
    feature: 'chat' | 'completion' | 'generation' | 'analysis'
    user: string
  }
}

interface AIUsageStatsProps {
  usageData: AIUsageData[]
  currentLimits?: {
    monthly_tokens: number
    monthly_cost: number
    daily_requests: number
  }
  className?: string
  dateRange?: 'day' | 'week' | 'month'
}

const SERVICE_COLORS = {
  openai: '#00a67e',
  anthropic: '#d97757',
  google: '#4285f4',
  cohere: '#39c5bb',
  huggingface: '#ff9500'
}

const DEFAULT_LIMITS = {
  monthly_tokens: 1000000,
  monthly_cost: 100,
  daily_requests: 1000
}

export default function AIUsageStats({ 
  usageData, 
  currentLimits = DEFAULT_LIMITS,
  className,
  dateRange = 'month'
}: AIUsageStatsProps) {
  const analyticsData = useMemo(() => {
    const now = new Date()
    const startDate = dateRange === 'day' ? new Date(now.getTime() - 24 * 60 * 60 * 1000) :
                     dateRange === 'week' ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) :
                     new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const filteredData = usageData.filter(item => 
      new Date(item.timestamp) >= startDate
    )

    // Total metrics
    const totalTokens = filteredData.reduce((sum, item) => sum + item.tokens.total, 0)
    const totalCost = filteredData.reduce((sum, item) => sum + item.cost, 0)
    const totalRequests = filteredData.length
    const successfulRequests = filteredData.filter(item => item.success).length
    const averageLatency = filteredData.reduce((sum, item) => sum + item.latency, 0) / filteredData.length || 0

    // Usage by service
    const serviceUsage = Object.keys(SERVICE_COLORS).map(service => {
      const serviceData = filteredData.filter(item => item.service === service)
      return {
        service,
        requests: serviceData.length,
        tokens: serviceData.reduce((sum, item) => sum + item.tokens.total, 0),
        cost: serviceData.reduce((sum, item) => sum + item.cost, 0),
        color: SERVICE_COLORS[service as keyof typeof SERVICE_COLORS]
      }
    }).filter(item => item.requests > 0)

    // Usage by model
    const modelStats = new Map()
    filteredData.forEach(item => {
      if (!modelStats.has(item.model)) {
        modelStats.set(item.model, {
          model: item.model,
          requests: 0,
          tokens: 0,
          cost: 0,
          avgLatency: 0,
          successRate: 0
        })
      }
      const stats = modelStats.get(item.model)
      stats.requests++
      stats.tokens += item.tokens.total
      stats.cost += item.cost
      stats.avgLatency += item.latency
      if (item.success) stats.successRate++
    })

    const modelUsage = Array.from(modelStats.values()).map(stats => ({
      ...stats,
      avgLatency: stats.avgLatency / stats.requests,
      successRate: (stats.successRate / stats.requests) * 100
    })).sort((a, b) => b.requests - a.requests)

    // Daily usage trend
    const dailyUsage = {}
    for (let i = dateRange === 'day' ? 24 : dateRange === 'week' ? 7 : 30; i >= 0; i--) {
      const date = new Date(now.getTime() - i * (dateRange === 'day' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000))
      const dateKey = dateRange === 'day' 
        ? date.toISOString().slice(11, 16) // HH:MM
        : date.toISOString().slice(0, 10) // YYYY-MM-DD

      dailyUsage[dateKey] = {
        date: dateKey,
        requests: 0,
        tokens: 0,
        cost: 0
      }
    }

    filteredData.forEach(item => {
      const date = new Date(item.timestamp)
      const dateKey = dateRange === 'day' 
        ? date.toISOString().slice(11, 16)
        : date.toISOString().slice(0, 10)
      
      if (dailyUsage[dateKey]) {
        dailyUsage[dateKey].requests++
        dailyUsage[dateKey].tokens += item.tokens.total
        dailyUsage[dateKey].cost += item.cost
      }
    })

    const usageTrend = Object.values(dailyUsage)

    // Feature usage
    const featureUsage = Object.keys(['chat', 'completion', 'generation', 'analysis']).map(feature => {
      const featureData = filteredData.filter(item => item.context.feature === feature)
      return {
        name: feature.charAt(0).toUpperCase() + feature.slice(1),
        value: featureData.length,
        tokens: featureData.reduce((sum, item) => sum + item.tokens.total, 0),
        cost: featureData.reduce((sum, item) => sum + item.cost, 0)
      }
    }).filter(item => item.value > 0)

    // Calculate usage percentages
    const tokenUsagePercent = (totalTokens / currentLimits.monthly_tokens) * 100
    const costUsagePercent = (totalCost / currentLimits.monthly_cost) * 100
    const requestUsagePercent = (totalRequests / currentLimits.daily_requests) * 100

    return {
      totalTokens,
      totalCost,
      totalRequests,
      successfulRequests,
      averageLatency,
      successRate: (successfulRequests / totalRequests) * 100 || 0,
      serviceUsage,
      modelUsage,
      usageTrend,
      featureUsage,
      limits: {
        tokens: { used: totalTokens, limit: currentLimits.monthly_tokens, percent: tokenUsagePercent },
        cost: { used: totalCost, limit: currentLimits.monthly_cost, percent: costUsagePercent },
        requests: { used: totalRequests, limit: currentLimits.daily_requests, percent: requestUsagePercent }
      }
    }
  }, [usageData, currentLimits, dateRange])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const StatCard = ({ 
    title, 
    value, 
    subtitle, 
    icon: Icon, 
    trend,
    color = "text-gray-600"
  }: {
    title: string
    value: string | number
    subtitle?: string
    icon: any
    trend?: 'up' | 'down' | 'stable'
    color?: string
  }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={cn("h-4 w-4", color)} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  )

  const getLimitColor = (percent: number) => {
    if (percent >= 90) return 'text-red-600'
    if (percent >= 75) return 'text-yellow-600'
    return 'text-green-600'
  }

  const getLimitBadgeVariant = (percent: number) => {
    if (percent >= 90) return 'destructive'
    if (percent >= 75) return 'default'
    return 'secondary'
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">AI Usage Analytics</h2>
        <p className="text-muted-foreground">
          Monitor your AI service usage, costs, and performance
        </p>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Requests"
          value={formatNumber(analyticsData.totalRequests)}
          subtitle={`${Math.round(analyticsData.successRate)}% success rate`}
          icon={Activity}
          color="text-blue-600"
        />
        <StatCard
          title="Tokens Used"
          value={formatNumber(analyticsData.totalTokens)}
          subtitle={`${Math.round(analyticsData.limits.tokens.percent)}% of limit`}
          icon={Brain}
          color={getLimitColor(analyticsData.limits.tokens.percent)}
        />
        <StatCard
          title="Total Cost"
          value={formatCurrency(analyticsData.totalCost)}
          subtitle={`${Math.round(analyticsData.limits.cost.percent)}% of budget`}
          icon={DollarSign}
          color={getLimitColor(analyticsData.limits.cost.percent)}
        />
        <StatCard
          title="Avg Latency"
          value={`${Math.round(analyticsData.averageLatency)}ms`}
          subtitle="Response time"
          icon={Clock}
          color="text-purple-600"
        />
      </div>

      {/* Usage Limits */}
      <Card>
        <CardHeader>
          <CardTitle>Usage Limits</CardTitle>
          <CardDescription>Current usage vs limits</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Monthly Tokens</span>
              <div className="flex items-center gap-2">
                <span>{formatNumber(analyticsData.limits.tokens.used)} / {formatNumber(analyticsData.limits.tokens.limit)}</span>
                <Badge variant={getLimitBadgeVariant(analyticsData.limits.tokens.percent)}>
                  {Math.round(analyticsData.limits.tokens.percent)}%
                </Badge>
              </div>
            </div>
            <Progress value={analyticsData.limits.tokens.percent} className="h-2" />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Monthly Cost</span>
              <div className="flex items-center gap-2">
                <span>{formatCurrency(analyticsData.limits.cost.used)} / {formatCurrency(analyticsData.limits.cost.limit)}</span>
                <Badge variant={getLimitBadgeVariant(analyticsData.limits.cost.percent)}>
                  {Math.round(analyticsData.limits.cost.percent)}%
                </Badge>
              </div>
            </div>
            <Progress value={analyticsData.limits.cost.percent} className="h-2" />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Daily Requests</span>
              <div className="flex items-center gap-2">
                <span>{formatNumber(analyticsData.limits.requests.used)} / {formatNumber(analyticsData.limits.requests.limit)}</span>
                <Badge variant={getLimitBadgeVariant(analyticsData.limits.requests.percent)}>
                  {Math.round(analyticsData.limits.requests.percent)}%
                </Badge>
              </div>
            </div>
            <Progress value={analyticsData.limits.requests.percent} className="h-2" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Usage Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Usage Trend</CardTitle>
            <CardDescription>Requests and tokens over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analyticsData.usageTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Area 
                    type="monotone" 
                    dataKey="requests" 
                    stroke="#3b82f6" 
                    fill="#3b82f6" 
                    fillOpacity={0.3}
                    name="Requests"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Service Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Service Usage</CardTitle>
            <CardDescription>Distribution by AI service</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analyticsData.serviceUsage}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ service, percent }) => `${service} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="requests"
                  >
                    {analyticsData.serviceUsage.map((entry, index) => (
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

      {/* Model Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Model Performance</CardTitle>
          <CardDescription>Usage statistics by AI model</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analyticsData.modelUsage.slice(0, 5).map((model) => (
              <div key={model.model} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{model.model}</span>
                  <div className="flex items-center gap-4 text-sm">
                    <span>{model.requests} requests</span>
                    <span>{formatCurrency(model.cost)}</span>
                    <span>{Math.round(model.avgLatency)}ms avg</span>
                    <Badge variant={model.successRate >= 95 ? 'default' : 'secondary'}>
                      {Math.round(model.successRate)}% success
                    </Badge>
                  </div>
                </div>
                <Progress value={(model.requests / analyticsData.totalRequests) * 100} className="h-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}