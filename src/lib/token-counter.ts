/**
 * Token Counter and Usage Tracking
 * Accurate token counting, cost calculation, and usage analytics for AI operations
 */

import { aiConfig } from './ai-config'

// Types for token counting
export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  cost: number
  modelId: string
  timestamp: Date
  operation: string
  userId?: string
  sessionId?: string
}

export interface TokenStats {
  total: number
  input: number
  output: number
  cost: number
  averagePerRequest: number
  requestCount: number
}

export interface UsageReport {
  period: 'hour' | 'day' | 'week' | 'month'
  startDate: Date
  endDate: Date
  totalCost: number
  totalTokens: number
  requestCount: number
  modelBreakdown: Record<string, TokenStats>
  userBreakdown: Record<string, TokenStats>
  operationBreakdown: Record<string, TokenStats>
  trends: {
    costTrend: number // percentage change
    tokenTrend: number
    requestTrend: number
  }
}

export interface CostAlert {
  type: 'daily_limit' | 'monthly_limit' | 'request_limit' | 'spike_detection'
  severity: 'warning' | 'critical'
  message: string
  currentUsage: number
  limit: number
  timestamp: Date
}

// Token counting utilities
export class TokenCounter {
  // Approximate token counting for different models
  // In production, you'd use the actual tokenizer for each model
  static countTokens(text: string, modelId: string = 'gpt-4'): number {
    if (!text) return 0

    // Basic approximation: ~4 characters per token for most models
    let baseTokens = Math.ceil(text.length / 4)

    // Model-specific adjustments
    const model = aiConfig.getModel(modelId)
    if (model?.provider === 'anthropic') {
      // Claude models tend to use slightly more tokens
      baseTokens = Math.ceil(baseTokens * 1.1)
    } else if (model?.provider === 'openai' && modelId.includes('gpt-3.5')) {
      // GPT-3.5 is slightly more efficient
      baseTokens = Math.ceil(baseTokens * 0.95)
    }

    return Math.max(1, baseTokens)
  }

  // Count tokens for messages array (chat format)
  static countChatTokens(messages: Array<{ role: string; content: string }>, modelId: string = 'gpt-4'): number {
    let totalTokens = 0

    for (const message of messages) {
      // Base message tokens
      totalTokens += this.countTokens(message.content, modelId)
      
      // Role tokens (usually 1-2 tokens per role)
      totalTokens += 2
      
      // Message formatting tokens
      totalTokens += 3
    }

    // Add conversation formatting tokens
    totalTokens += 3

    return totalTokens
  }

  // Count tokens for tool calls
  static countToolTokens(toolCalls: Array<{ name: string; arguments: any }>, modelId: string = 'gpt-4'): number {
    let totalTokens = 0

    for (const toolCall of toolCalls) {
      totalTokens += this.countTokens(toolCall.name, modelId)
      totalTokens += this.countTokens(JSON.stringify(toolCall.arguments), modelId)
      totalTokens += 10 // Function call overhead
    }

    return totalTokens
  }

  // Estimate output tokens based on input and model
  static estimateOutputTokens(inputTokens: number, modelId: string, operation: string = 'chat'): number {
    const model = aiConfig.getModel(modelId)
    if (!model) return Math.ceil(inputTokens * 0.3) // Default ratio

    // Operation-specific ratios
    const ratios = {
      chat: 0.3,
      completion: 0.5,
      analysis: 0.8,
      creative: 1.2,
      code: 0.6,
      summarization: 0.2,
      translation: 1.0,
      expansion: 2.0,
    }

    const ratio = ratios[operation as keyof typeof ratios] || 0.3
    
    // Model-specific adjustments
    if (model.provider === 'anthropic') {
      return Math.ceil(inputTokens * ratio * 1.1) // Claude tends to be more verbose
    }

    return Math.ceil(inputTokens * ratio)
  }
}

// Usage tracking and analytics
export class UsageTracker {
  private usage: TokenUsage[] = []
  private alerts: CostAlert[] = []
  private limits = {
    daily: 50, // $50
    monthly: 1000, // $1000
    request: 5, // $5 per request
  }

  constructor() {
    this.loadFromStorage()
  }

  /**
   * Track a new usage event
   */
  track(usage: Omit<TokenUsage, 'timestamp'>): void {
    const fullUsage: TokenUsage = {
      ...usage,
      timestamp: new Date(),
    }

    this.usage.push(fullUsage)
    this.checkLimits(fullUsage)
    this.saveToStorage()
  }

  /**
   * Track usage for a chat completion
   */
  trackChatCompletion(
    modelId: string,
    messages: Array<{ role: string; content: string }>,
    response: string,
    options: {
      operation?: string
      userId?: string
      sessionId?: string
    } = {}
  ): TokenUsage {
    const inputTokens = TokenCounter.countChatTokens(messages, modelId)
    const outputTokens = TokenCounter.countTokens(response, modelId)
    const cost = aiConfig.estimateCost(modelId, inputTokens, outputTokens)

    const usage: Omit<TokenUsage, 'timestamp'> = {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      cost,
      modelId,
      operation: options.operation || 'chat',
      userId: options.userId,
      sessionId: options.sessionId,
    }

    this.track(usage)
    return { ...usage, timestamp: new Date() }
  }

  /**
   * Track usage for tool calls
   */
  trackToolUsage(
    modelId: string,
    toolCalls: Array<{ name: string; arguments: any; result?: any }>,
    options: {
      operation?: string
      userId?: string
      sessionId?: string
    } = {}
  ): TokenUsage {
    const inputTokens = TokenCounter.countToolTokens(toolCalls, modelId)
    const outputTokens = toolCalls.reduce((total, call) => {
      return total + (call.result ? TokenCounter.countTokens(JSON.stringify(call.result), modelId) : 0)
    }, 0)
    const cost = aiConfig.estimateCost(modelId, inputTokens, outputTokens)

    const usage: Omit<TokenUsage, 'timestamp'> = {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      cost,
      modelId,
      operation: options.operation || 'tool_call',
      userId: options.userId,
      sessionId: options.sessionId,
    }

    this.track(usage)
    return { ...usage, timestamp: new Date() }
  }

  /**
   * Get usage for a specific period
   */
  getUsage(
    period: 'hour' | 'day' | 'week' | 'month' = 'day',
    endDate: Date = new Date()
  ): TokenUsage[] {
    const startDate = new Date(endDate)
    
    switch (period) {
      case 'hour':
        startDate.setHours(startDate.getHours() - 1)
        break
      case 'day':
        startDate.setDate(startDate.getDate() - 1)
        break
      case 'week':
        startDate.setDate(startDate.getDate() - 7)
        break
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1)
        break
    }

    return this.usage.filter(usage => 
      usage.timestamp >= startDate && usage.timestamp <= endDate
    )
  }

  /**
   * Generate usage report
   */
  generateReport(
    period: 'hour' | 'day' | 'week' | 'month' = 'day',
    endDate: Date = new Date()
  ): UsageReport {
    const usageData = this.getUsage(period, endDate)
    const previousUsageData = this.getUsage(period, new Date(endDate.getTime() - this.getPeriodMs(period)))

    const totalCost = usageData.reduce((sum, usage) => sum + usage.cost, 0)
    const totalTokens = usageData.reduce((sum, usage) => sum + usage.totalTokens, 0)
    const requestCount = usageData.length

    const previousCost = previousUsageData.reduce((sum, usage) => sum + usage.cost, 0)
    const previousTokens = previousUsageData.reduce((sum, usage) => sum + usage.totalTokens, 0)
    const previousRequests = previousUsageData.length

    const startDate = new Date(endDate)
    switch (period) {
      case 'hour': startDate.setHours(startDate.getHours() - 1); break
      case 'day': startDate.setDate(startDate.getDate() - 1); break
      case 'week': startDate.setDate(startDate.getDate() - 7); break
      case 'month': startDate.setMonth(startDate.getMonth() - 1); break
    }

    return {
      period,
      startDate,
      endDate,
      totalCost,
      totalTokens,
      requestCount,
      modelBreakdown: this.calculateBreakdown(usageData, 'modelId'),
      userBreakdown: this.calculateBreakdown(usageData, 'userId'),
      operationBreakdown: this.calculateBreakdown(usageData, 'operation'),
      trends: {
        costTrend: this.calculateTrend(totalCost, previousCost),
        tokenTrend: this.calculateTrend(totalTokens, previousTokens),
        requestTrend: this.calculateTrend(requestCount, previousRequests),
      },
    }
  }

  /**
   * Get current usage statistics
   */
  getCurrentStats(): {
    today: TokenStats
    thisMonth: TokenStats
    allTime: TokenStats
  } {
    const today = this.getUsage('day')
    const thisMonth = this.getUsage('month')
    const allTime = this.usage

    return {
      today: this.calculateStats(today),
      thisMonth: this.calculateStats(thisMonth),
      allTime: this.calculateStats(allTime),
    }
  }

  /**
   * Check if usage is within limits
   */
  isWithinLimits(type: 'daily' | 'monthly' | 'request', amount: number): boolean {
    switch (type) {
      case 'daily':
        const todayUsage = this.getUsage('day')
        const todayCost = todayUsage.reduce((sum, usage) => sum + usage.cost, 0)
        return (todayCost + amount) <= this.limits.daily

      case 'monthly':
        const monthUsage = this.getUsage('month')
        const monthCost = monthUsage.reduce((sum, usage) => sum + usage.cost, 0)
        return (monthCost + amount) <= this.limits.monthly

      case 'request':
        return amount <= this.limits.request

      default:
        return true
    }
  }

  /**
   * Update usage limits
   */
  updateLimits(limits: Partial<typeof this.limits>): void {
    this.limits = { ...this.limits, ...limits }
    this.saveToStorage()
  }

  /**
   * Get usage alerts
   */
  getAlerts(): CostAlert[] {
    return this.alerts.slice(-50) // Return last 50 alerts
  }

  /**
   * Clear old alerts
   */
  clearOldAlerts(days: number = 7): void {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    
    this.alerts = this.alerts.filter(alert => alert.timestamp > cutoff)
    this.saveToStorage()
  }

  /**
   * Export usage data
   */
  export(): any {
    return {
      usage: this.usage,
      alerts: this.alerts,
      limits: this.limits,
      timestamp: new Date().toISOString(),
    }
  }

  /**
   * Import usage data
   */
  import(data: any): void {
    if (data.usage) {
      this.usage = data.usage.map((u: any) => ({
        ...u,
        timestamp: new Date(u.timestamp),
      }))
    }
    
    if (data.alerts) {
      this.alerts = data.alerts.map((a: any) => ({
        ...a,
        timestamp: new Date(a.timestamp),
      }))
    }
    
    if (data.limits) {
      this.limits = { ...this.limits, ...data.limits }
    }
    
    this.saveToStorage()
  }

  /**
   * Clear all usage data
   */
  clear(): void {
    this.usage = []
    this.alerts = []
    this.saveToStorage()
  }

  // Private methods
  private checkLimits(usage: TokenUsage): void {
    // Check request limit
    if (usage.cost > this.limits.request) {
      this.alerts.push({
        type: 'request_limit',
        severity: 'warning',
        message: `Request cost ($${usage.cost.toFixed(4)}) exceeds limit ($${this.limits.request})`,
        currentUsage: usage.cost,
        limit: this.limits.request,
        timestamp: new Date(),
      })
    }

    // Check daily limit
    const todayUsage = this.getUsage('day')
    const todayCost = todayUsage.reduce((sum, u) => sum + u.cost, 0)
    
    if (todayCost > this.limits.daily * 0.8) { // 80% warning
      this.alerts.push({
        type: 'daily_limit',
        severity: todayCost > this.limits.daily ? 'critical' : 'warning',
        message: `Daily usage ($${todayCost.toFixed(2)}) ${todayCost > this.limits.daily ? 'exceeds' : 'approaching'} limit ($${this.limits.daily})`,
        currentUsage: todayCost,
        limit: this.limits.daily,
        timestamp: new Date(),
      })
    }

    // Check monthly limit
    const monthUsage = this.getUsage('month')
    const monthCost = monthUsage.reduce((sum, u) => sum + u.cost, 0)
    
    if (monthCost > this.limits.monthly * 0.8) { // 80% warning
      this.alerts.push({
        type: 'monthly_limit',
        severity: monthCost > this.limits.monthly ? 'critical' : 'warning',
        message: `Monthly usage ($${monthCost.toFixed(2)}) ${monthCost > this.limits.monthly ? 'exceeds' : 'approaching'} limit ($${this.limits.monthly})`,
        currentUsage: monthCost,
        limit: this.limits.monthly,
        timestamp: new Date(),
      })
    }

    // Spike detection (cost > 5x average)
    const recentUsage = this.getUsage('day').slice(-10) // Last 10 requests
    if (recentUsage.length >= 5) {
      const averageCost = recentUsage.slice(0, -1).reduce((sum, u) => sum + u.cost, 0) / (recentUsage.length - 1)
      
      if (usage.cost > averageCost * 5) {
        this.alerts.push({
          type: 'spike_detection',
          severity: 'warning',
          message: `Cost spike detected: $${usage.cost.toFixed(4)} (${(usage.cost / averageCost).toFixed(1)}x average)`,
          currentUsage: usage.cost,
          limit: averageCost * 5,
          timestamp: new Date(),
        })
      }
    }
  }

  private calculateBreakdown(usageData: TokenUsage[], groupBy: keyof TokenUsage): Record<string, TokenStats> {
    const breakdown: Record<string, TokenStats> = {}

    for (const usage of usageData) {
      const key = String(usage[groupBy] || 'unknown')
      
      if (!breakdown[key]) {
        breakdown[key] = {
          total: 0,
          input: 0,
          output: 0,
          cost: 0,
          averagePerRequest: 0,
          requestCount: 0,
        }
      }

      breakdown[key].total += usage.totalTokens
      breakdown[key].input += usage.inputTokens
      breakdown[key].output += usage.outputTokens
      breakdown[key].cost += usage.cost
      breakdown[key].requestCount += 1
    }

    // Calculate averages
    Object.values(breakdown).forEach(stats => {
      stats.averagePerRequest = stats.requestCount > 0 ? stats.total / stats.requestCount : 0
    })

    return breakdown
  }

  private calculateStats(usageData: TokenUsage[]): TokenStats {
    if (usageData.length === 0) {
      return {
        total: 0,
        input: 0,
        output: 0,
        cost: 0,
        averagePerRequest: 0,
        requestCount: 0,
      }
    }

    const total = usageData.reduce((sum, usage) => sum + usage.totalTokens, 0)
    const input = usageData.reduce((sum, usage) => sum + usage.inputTokens, 0)
    const output = usageData.reduce((sum, usage) => sum + usage.outputTokens, 0)
    const cost = usageData.reduce((sum, usage) => sum + usage.cost, 0)

    return {
      total,
      input,
      output,
      cost,
      averagePerRequest: total / usageData.length,
      requestCount: usageData.length,
    }
  }

  private calculateTrend(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0
    return ((current - previous) / previous) * 100
  }

  private getPeriodMs(period: 'hour' | 'day' | 'week' | 'month'): number {
    switch (period) {
      case 'hour': return 60 * 60 * 1000
      case 'day': return 24 * 60 * 60 * 1000
      case 'week': return 7 * 24 * 60 * 60 * 1000
      case 'month': return 30 * 24 * 60 * 60 * 1000
    }
  }

  private saveToStorage(): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('roomicor-usage-tracker', JSON.stringify({
          usage: this.usage.slice(-1000), // Keep last 1000 entries
          alerts: this.alerts.slice(-50), // Keep last 50 alerts
          limits: this.limits,
        }))
      } catch (error) {
        console.error('Failed to save usage data:', error)
      }
    }
  }

  private loadFromStorage(): void {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('roomicor-usage-tracker')
        if (stored) {
          const data = JSON.parse(stored)
          
          if (data.usage) {
            this.usage = data.usage.map((u: any) => ({
              ...u,
              timestamp: new Date(u.timestamp),
            }))
          }
          
          if (data.alerts) {
            this.alerts = data.alerts.map((a: any) => ({
              ...a,
              timestamp: new Date(a.timestamp),
            }))
          }
          
          if (data.limits) {
            this.limits = { ...this.limits, ...data.limits }
          }
        }
      } catch (error) {
        console.error('Failed to load usage data:', error)
      }
    }
  }
}

// Global instance
export const usageTracker = new UsageTracker()

// Utility functions
export function countTokens(text: string, modelId?: string): number {
  return TokenCounter.countTokens(text, modelId)
}

export function countChatTokens(messages: Array<{ role: string; content: string }>, modelId?: string): number {
  return TokenCounter.countChatTokens(messages, modelId)
}

export function estimateOutputTokens(inputTokens: number, modelId: string, operation?: string): number {
  return TokenCounter.estimateOutputTokens(inputTokens, modelId, operation)
}

export function estimateCost(modelId: string, inputTokens: number, outputTokens: number = 0): number {
  return aiConfig.estimateCost(modelId, inputTokens, outputTokens)
}

export function trackUsage(usage: Omit<TokenUsage, 'timestamp'>): void {
  usageTracker.track(usage)
}

export function getCurrentUsageStats(): ReturnType<UsageTracker['getCurrentStats']> {
  return usageTracker.getCurrentStats()
}

export function isWithinBudget(cost: number, type: 'daily' | 'monthly' | 'request' = 'request'): boolean {
  return usageTracker.isWithinLimits(type, cost)
}

export function getUsageReport(period: 'hour' | 'day' | 'week' | 'month' = 'day'): UsageReport {
  return usageTracker.generateReport(period)
}

export function getUsageAlerts(): CostAlert[] {
  return usageTracker.getAlerts()
}