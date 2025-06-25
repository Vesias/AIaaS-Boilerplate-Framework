/**
 * AI Router - Intelligent Request Routing and Load Balancing
 * Routes AI requests to optimal providers based on performance, cost, and availability
 */

import { aiConfig, AIModel, ModelSelectionCriteria } from './ai-config'
import { usageTracker, estimateCost } from './token-counter'
import { getCachedAIResponse, cacheAIResponse } from './ai-cache'
import { toast } from 'sonner'

// Types for routing
export interface RoutingRequest {
  input: any
  operation: 'chat' | 'completion' | 'analysis' | 'creative' | 'code' | 'reasoning' | 'tool_call'
  context?: {
    userId?: string
    sessionId?: string
    priority?: 'low' | 'normal' | 'high' | 'urgent'
    budget?: number
    maxLatency?: number
    requiredCapabilities?: string[]
    preferredProvider?: string
    fallbackProviders?: string[]
  }
  metadata?: Record<string, any>
}

export interface RoutingResponse<T = any> {
  data: T
  metadata: {
    modelId: string
    provider: string
    cached: boolean
    tokens: {
      input: number
      output: number
      total: number
    }
    cost: number
    latency: number
    retries: number
    fallbackUsed: boolean
    routingDecision: string
  }
}

export interface ProviderHealth {
  providerId: string
  modelId: string
  status: 'healthy' | 'degraded' | 'unavailable'
  responseTime: number
  errorRate: number
  lastChecked: Date
  consecutiveFailures: number
  capacity: number // 0-100
}

export interface RoutingRule {
  id: string
  name: string
  priority: number
  condition: (request: RoutingRequest) => boolean
  action: {
    type: 'route' | 'cache' | 'reject' | 'modify'
    target?: string
    parameters?: Record<string, any>
  }
  enabled: boolean
}

export interface LoadBalancingStrategy {
  type: 'round_robin' | 'weighted' | 'least_connections' | 'response_time' | 'cost_optimized'
  weights?: Record<string, number>
  parameters?: Record<string, any>
}

// AI Request Router
export class AIRouter {
  private health: Map<string, ProviderHealth> = new Map()
  private rules: RoutingRule[] = []
  private loadBalancing: LoadBalancingStrategy = { type: 'cost_optimized' }
  private requestCounts: Map<string, number> = new Map()
  private responseTimes: Map<string, number[]> = new Map()
  private circuitBreakers: Map<string, { failures: number; lastFailure: Date; isOpen: boolean }> = new Map()

  constructor() {
    this.initializeDefaultRules()
    this.startHealthChecks()
  }

  /**
   * Route a request to the optimal provider
   */
  async route<T>(request: RoutingRequest): Promise<RoutingResponse<T>> {
    const startTime = Date.now()
    let retries = 0
    let fallbackUsed = false
    let routingDecision = ''

    try {
      // Apply routing rules
      const processedRequest = this.applyRules(request)
      
      // Check cache first
      const cacheKey = this.generateCacheKey(processedRequest)
      const cached = getCachedAIResponse<T>(
        cacheKey,
        'any', // Will be determined by routing
        processedRequest.operation,
        processedRequest.context?.userId
      )

      if (cached) {
        return {
          data: cached,
          metadata: {
            modelId: 'cached',
            provider: 'cache',
            cached: true,
            tokens: { input: 0, output: 0, total: 0 },
            cost: 0,
            latency: Date.now() - startTime,
            retries: 0,
            fallbackUsed: false,
            routingDecision: 'cache_hit',
          },
        }
      }

      // Select optimal model/provider
      const selection = this.selectOptimalProvider(processedRequest)
      if (!selection) {
        throw new Error('No available providers for this request')
      }

      routingDecision = selection.reasoning

      // Execute request with retries and fallbacks
      let response: T
      let tokens = { input: 0, output: 0, total: 0 }
      let cost = 0

      while (retries < 3) {
        try {
          const result = await this.executeRequest<T>(
            processedRequest,
            selection.model,
            selection.endpoint
          )
          
          response = result.data
          tokens = result.tokens
          cost = result.cost
          
          // Update health status
          this.updateProviderHealth(selection.model.id, true, Date.now() - startTime)
          break

        } catch (error: any) {
          retries++
          this.updateProviderHealth(selection.model.id, false, Date.now() - startTime)
          
          if (retries >= 3) {
            // Try fallback providers
            const fallback = this.selectFallbackProvider(processedRequest, selection.model.id)
            if (fallback) {
              fallbackUsed = true
              routingDecision += ` -> fallback_to_${fallback.model.id}`
              
              try {
                const result = await this.executeRequest<T>(
                  processedRequest,
                  fallback.model,
                  fallback.endpoint
                )
                
                response = result.data
                tokens = result.tokens
                cost = result.cost
                
                this.updateProviderHealth(fallback.model.id, true, Date.now() - startTime)
                break
              } catch (fallbackError) {
                this.updateProviderHealth(fallback.model.id, false, Date.now() - startTime)
                throw fallbackError
              }
            }
            
            throw error
          }
          
          // Wait before retry with exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000))
        }
      }

      // Cache successful response
      if (response! && this.shouldCache(processedRequest, cost)) {
        cacheAIResponse(
          cacheKey,
          response!,
          selection.model.id,
          processedRequest.operation,
          {
            ttl: this.getCacheTTL(processedRequest),
            userId: processedRequest.context?.userId,
          }
        )
      }

      // Track usage
      usageTracker.track({
        inputTokens: tokens.input,
        outputTokens: tokens.output,
        totalTokens: tokens.total,
        cost,
        modelId: selection.model.id,
        operation: processedRequest.operation,
        userId: processedRequest.context?.userId,
        sessionId: processedRequest.context?.sessionId,
      })

      return {
        data: response!,
        metadata: {
          modelId: selection.model.id,
          provider: selection.model.provider,
          cached: false,
          tokens,
          cost,
          latency: Date.now() - startTime,
          retries,
          fallbackUsed,
          routingDecision,
        },
      }

    } catch (error: any) {
      toast.error(`AI routing failed: ${error.message}`)
      throw new Error(`AI routing failed: ${error.message}`)
    }
  }

  /**
   * Select optimal provider based on request context and current health
   */
  private selectOptimalProvider(request: RoutingRequest): {
    model: AIModel
    endpoint: string
    reasoning: string
  } | null {
    // Get available models based on requirements
    const criteria: ModelSelectionCriteria = {
      task: request.operation,
      priority: this.determinePriority(request),
      maxCost: request.context?.budget,
      maxLatency: request.context?.maxLatency,
      requiredCapabilities: request.context?.requiredCapabilities,
    }

    const candidates = this.getEligibleModels(criteria, request.context?.preferredProvider)
    if (candidates.length === 0) return null

    // Apply load balancing strategy
    const selected = this.applyLoadBalancing(candidates, request)
    if (!selected) return null

    const endpoint = this.getProviderEndpoint(selected.provider)
    const reasoning = this.generateRoutingReasoning(selected, candidates, criteria)

    return {
      model: selected,
      endpoint,
      reasoning,
    }
  }

  /**
   * Get eligible models based on criteria and health
   */
  private getEligibleModels(criteria: ModelSelectionCriteria, preferredProvider?: string): AIModel[] {
    const allModels = aiConfig.listModels()
    
    return allModels.filter(model => {
      // Check basic availability
      if (!aiConfig.isModelAvailable(model.id)) return false
      
      // Check circuit breaker
      const circuitBreaker = this.circuitBreakers.get(model.id)
      if (circuitBreaker?.isOpen) {
        const timeSinceLastFailure = Date.now() - circuitBreaker.lastFailure.getTime()
        if (timeSinceLastFailure < 60000) return false // 1 minute cooldown
      }
      
      // Check health status
      const health = this.health.get(model.id)
      if (health?.status === 'unavailable') return false
      
      // Check capabilities
      if (criteria.requiredCapabilities) {
        const hasCapabilities = criteria.requiredCapabilities.every(cap =>
          model.capabilities.includes(cap)
        )
        if (!hasCapabilities) return false
      }
      
      // Check cost limits
      if (criteria.maxCost) {
        const estimatedCost = estimateCost(model.id, 1000, 1000) // Rough estimate
        if (estimatedCost > criteria.maxCost) return false
      }
      
      // Prefer specific provider if requested
      if (preferredProvider && model.provider !== preferredProvider) {
        return false
      }
      
      return true
    })
  }

  /**
   * Apply load balancing strategy to select from candidates
   */
  private applyLoadBalancing(candidates: AIModel[], request: RoutingRequest): AIModel | null {
    if (candidates.length === 0) return null
    if (candidates.length === 1) return candidates[0]

    switch (this.loadBalancing.type) {
      case 'round_robin':
        return this.roundRobinSelection(candidates)
        
      case 'weighted':
        return this.weightedSelection(candidates)
        
      case 'least_connections':
        return this.leastConnectionsSelection(candidates)
        
      case 'response_time':
        return this.responseTimeSelection(candidates)
        
      case 'cost_optimized':
        return this.costOptimizedSelection(candidates, request)
        
      default:
        return candidates[0]
    }
  }

  /**
   * Cost-optimized selection
   */
  private costOptimizedSelection(candidates: AIModel[], request: RoutingRequest): AIModel {
    const inputTokens = this.estimateInputTokens(request.input, request.operation)
    const outputTokens = inputTokens * 0.3 // Rough estimate
    
    // Score models by cost-performance ratio
    const scored = candidates.map(model => {
      const cost = estimateCost(model.id, inputTokens, outputTokens)
      const health = this.health.get(model.id)
      const responseTime = this.getAverageResponseTime(model.id)
      
      let score = 0
      
      // Cost factor (lower cost = higher score)
      score += Math.max(0, 100 - cost * 1000)
      
      // Performance factor
      if (model.performance.quality === 'high') score += 40
      else if (model.performance.quality === 'medium') score += 20
      
      // Speed factor
      if (model.performance.speed === 'fast') score += 30
      else if (model.performance.speed === 'medium') score += 15
      
      // Health factor
      if (health?.status === 'healthy') score += 20
      else if (health?.status === 'degraded') score += 5
      
      // Response time factor
      if (responseTime < 2000) score += 15
      else if (responseTime < 5000) score += 5
      
      return { model, score, cost }
    })
    
    // Sort by score and return best
    scored.sort((a, b) => b.score - a.score)
    return scored[0].model
  }

  /**
   * Round-robin selection
   */
  private roundRobinSelection(candidates: AIModel[]): AIModel {
    const key = 'round_robin_index'
    const currentIndex = this.requestCounts.get(key) || 0
    const selected = candidates[currentIndex % candidates.length]
    this.requestCounts.set(key, currentIndex + 1)
    return selected
  }

  /**
   * Weighted selection
   */
  private weightedSelection(candidates: AIModel[]): AIModel {
    const weights = this.loadBalancing.weights || {}
    const totalWeight = candidates.reduce((sum, model) => sum + (weights[model.id] || 1), 0)
    const random = Math.random() * totalWeight
    
    let currentWeight = 0
    for (const model of candidates) {
      currentWeight += weights[model.id] || 1
      if (random <= currentWeight) {
        return model
      }
    }
    
    return candidates[0]
  }

  /**
   * Least connections selection
   */
  private leastConnectionsSelection(candidates: AIModel[]): AIModel {
    let leastConnections = Infinity
    let selected = candidates[0]
    
    for (const model of candidates) {
      const connections = this.requestCounts.get(model.id) || 0
      if (connections < leastConnections) {
        leastConnections = connections
        selected = model
      }
    }
    
    return selected
  }

  /**
   * Response time-based selection
   */
  private responseTimeSelection(candidates: AIModel[]): AIModel {
    let bestTime = Infinity
    let selected = candidates[0]
    
    for (const model of candidates) {
      const avgTime = this.getAverageResponseTime(model.id)
      if (avgTime < bestTime) {
        bestTime = avgTime
        selected = model
      }
    }
    
    return selected
  }

  /**
   * Select fallback provider
   */
  private selectFallbackProvider(request: RoutingRequest, excludeModelId: string): {
    model: AIModel
    endpoint: string
  } | null {
    const fallbackProviders = request.context?.fallbackProviders || ['anthropic', 'openai']
    
    for (const providerId of fallbackProviders) {
      const models = aiConfig.getModelsForProvider(providerId)
        .filter(model => model.id !== excludeModelId && aiConfig.isModelAvailable(model.id))
      
      if (models.length > 0) {
        const model = models[0] // Take first available
        const endpoint = this.getProviderEndpoint(model.provider)
        return { model, endpoint }
      }
    }
    
    return null
  }

  /**
   * Execute request against specific provider
   */
  private async executeRequest<T>(
    request: RoutingRequest,
    model: AIModel,
    endpoint: string
  ): Promise<{
    data: T
    tokens: { input: number; output: number; total: number }
    cost: number
  }> {
    // Track active request
    const currentCount = this.requestCounts.get(model.id) || 0
    this.requestCounts.set(model.id, currentCount + 1)

    try {
      // This would integrate with the actual provider APIs
      // For now, we'll simulate the response
      const inputTokens = this.estimateInputTokens(request.input, request.operation)
      const outputTokens = Math.ceil(inputTokens * 0.3)
      const cost = estimateCost(model.id, inputTokens, outputTokens)

      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500))

      // Mock response based on operation
      let mockResponse: any
      switch (request.operation) {
        case 'chat':
          mockResponse = `AI response from ${model.name}: This is a simulated response to "${String(request.input).substring(0, 50)}..."`
          break
        case 'analysis':
          mockResponse = {
            summary: `Analysis by ${model.name}`,
            insights: ['Insight 1', 'Insight 2'],
            confidence: 0.85,
          }
          break
        default:
          mockResponse = `Response from ${model.name}`
      }

      return {
        data: mockResponse as T,
        tokens: {
          input: inputTokens,
          output: outputTokens,
          total: inputTokens + outputTokens,
        },
        cost,
      }

    } finally {
      // Track request completion
      const currentCount = this.requestCounts.get(model.id) || 0
      this.requestCounts.set(model.id, Math.max(0, currentCount - 1))
    }
  }

  /**
   * Update provider health metrics
   */
  private updateProviderHealth(modelId: string, success: boolean, responseTime: number): void {
    const health = this.health.get(modelId) || {
      providerId: '',
      modelId,
      status: 'healthy',
      responseTime: 0,
      errorRate: 0,
      lastChecked: new Date(),
      consecutiveFailures: 0,
      capacity: 100,
    }

    // Update response time (moving average)
    const times = this.responseTimes.get(modelId) || []
    times.push(responseTime)
    if (times.length > 10) times.shift() // Keep last 10
    this.responseTimes.set(modelId, times)
    
    health.responseTime = times.reduce((sum, time) => sum + time, 0) / times.length
    health.lastChecked = new Date()

    if (success) {
      health.consecutiveFailures = 0
      health.status = health.responseTime > 10000 ? 'degraded' : 'healthy'
      
      // Update circuit breaker
      const circuitBreaker = this.circuitBreakers.get(modelId)
      if (circuitBreaker) {
        circuitBreaker.failures = 0
        circuitBreaker.isOpen = false
      }
    } else {
      health.consecutiveFailures++
      
      if (health.consecutiveFailures >= 3) {
        health.status = 'unavailable'
        
        // Open circuit breaker
        this.circuitBreakers.set(modelId, {
          failures: health.consecutiveFailures,
          lastFailure: new Date(),
          isOpen: true,
        })
      } else {
        health.status = 'degraded'
      }
    }

    this.health.set(modelId, health)
  }

  /**
   * Apply routing rules to request
   */
  private applyRules(request: RoutingRequest): RoutingRequest {
    let processedRequest = { ...request }

    // Sort rules by priority
    const activeRules = this.rules
      .filter(rule => rule.enabled)
      .sort((a, b) => b.priority - a.priority)

    for (const rule of activeRules) {
      if (rule.condition(processedRequest)) {
        switch (rule.action.type) {
          case 'route':
            if (rule.action.target) {
              processedRequest.context = {
                ...processedRequest.context,
                preferredProvider: rule.action.target,
              }
            }
            break
            
          case 'modify':
            if (rule.action.parameters) {
              processedRequest = {
                ...processedRequest,
                context: {
                  ...processedRequest.context,
                  ...rule.action.parameters,
                },
              }
            }
            break
            
          case 'reject':
            throw new Error(`Request rejected by rule: ${rule.name}`)
        }
      }
    }

    return processedRequest
  }

  /**
   * Initialize default routing rules
   */
  private initializeDefaultRules(): void {
    this.rules = [
      {
        id: 'high-priority-fast-route',
        name: 'Route high priority requests to fast models',
        priority: 100,
        condition: (request) => request.context?.priority === 'urgent' || request.context?.priority === 'high',
        action: {
          type: 'modify',
          parameters: { preferredProvider: 'openai' },
        },
        enabled: true,
      },
      {
        id: 'cost-sensitive-route',
        name: 'Route budget-conscious requests to cheaper models',
        priority: 50,
        condition: (request) => (request.context?.budget || 999) < 0.01,
        action: {
          type: 'route',
          target: 'anthropic',
        },
        enabled: true,
      },
      {
        id: 'creative-task-route',
        name: 'Route creative tasks to Claude',
        priority: 75,
        condition: (request) => request.operation === 'creative',
        action: {
          type: 'route',
          target: 'anthropic',
        },
        enabled: true,
      },
    ]
  }

  /**
   * Start health check monitoring
   */
  private startHealthChecks(): void {
    setInterval(() => {
      this.performHealthChecks()
    }, 60000) // Every minute
  }

  /**
   * Perform health checks on providers
   */
  private async performHealthChecks(): Promise<void> {
    const models = aiConfig.listModels()
    
    for (const model of models) {
      try {
        // Simulate health check
        const startTime = Date.now()
        // In production, this would make actual health check requests
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50))
        
        this.updateProviderHealth(model.id, true, Date.now() - startTime)
      } catch (error) {
        this.updateProviderHealth(model.id, false, 5000)
      }
    }
  }

  // Utility methods
  private determinePriority(request: RoutingRequest): 'speed' | 'quality' | 'cost' | 'balanced' {
    if (request.context?.priority === 'urgent') return 'speed'
    if (request.context?.budget && request.context.budget < 0.01) return 'cost'
    if (request.operation === 'creative' || request.operation === 'analysis') return 'quality'
    return 'balanced'
  }

  private getProviderEndpoint(provider: string): string {
    const endpoints: Record<string, string> = {
      openai: '/api/providers/openai',
      anthropic: '/api/providers/anthropic',
      google: '/api/providers/google',
      local: '/api/providers/local',
    }
    return endpoints[provider] || '/api/providers/default'
  }

  private generateCacheKey(request: RoutingRequest): string {
    const keyData = {
      input: request.input,
      operation: request.operation,
      context: {
        requiredCapabilities: request.context?.requiredCapabilities,
        // Exclude user-specific data from cache key
      },
    }
    return JSON.stringify(keyData)
  }

  private shouldCache(request: RoutingRequest, cost: number): boolean {
    // Don't cache expensive requests
    if (cost > 0.1) return false
    
    // Don't cache user-specific requests
    if (request.context?.userId) return false
    
    // Don't cache real-time operations
    if (request.operation === 'tool_call') return false
    
    return true
  }

  private getCacheTTL(request: RoutingRequest): number {
    switch (request.operation) {
      case 'analysis': return 60 * 60 * 1000 // 1 hour
      case 'creative': return 30 * 60 * 1000 // 30 minutes
      case 'chat': return 15 * 60 * 1000 // 15 minutes
      default: return 30 * 60 * 1000 // 30 minutes
    }
  }

  private estimateInputTokens(input: any, operation: string): number {
    const inputStr = typeof input === 'string' ? input : JSON.stringify(input)
    return Math.ceil(inputStr.length / 4) // Rough approximation
  }

  private getAverageResponseTime(modelId: string): number {
    const times = this.responseTimes.get(modelId) || [2000] // Default 2s
    return times.reduce((sum, time) => sum + time, 0) / times.length
  }

  private generateRoutingReasoning(
    selected: AIModel,
    candidates: AIModel[],
    criteria: ModelSelectionCriteria
  ): string {
    let reasoning = `Selected ${selected.name} from ${candidates.length} candidates. `
    reasoning += `Strategy: ${this.loadBalancing.type}. `
    reasoning += `Priority: ${criteria.priority}. `
    
    if (criteria.maxCost) {
      reasoning += `Budget constraint: $${criteria.maxCost}. `
    }
    
    const health = this.health.get(selected.id)
    if (health) {
      reasoning += `Health: ${health.status} (${Math.round(health.responseTime)}ms avg). `
    }
    
    return reasoning
  }

  // Public API methods
  getHealth(): ProviderHealth[] {
    return Array.from(this.health.values())
  }

  getRoutingRules(): RoutingRule[] {
    return [...this.rules]
  }

  updateRoutingRules(rules: RoutingRule[]): void {
    this.rules = rules
  }

  updateLoadBalancing(strategy: LoadBalancingStrategy): void {
    this.loadBalancing = strategy
  }

  getMetrics(): {
    totalRequests: number
    providerDistribution: Record<string, number>
    averageLatency: number
    failureRate: number
    cacheHitRate: number
  } {
    const totalRequests = Array.from(this.requestCounts.values()).reduce((sum, count) => sum + count, 0)
    const providerDistribution: Record<string, number> = {}
    
    this.requestCounts.forEach((count, modelId) => {
      const model = aiConfig.getModel(modelId)
      if (model) {
        providerDistribution[model.provider] = (providerDistribution[model.provider] || 0) + count
      }
    })

    const allResponseTimes = Array.from(this.responseTimes.values()).flat()
    const averageLatency = allResponseTimes.length > 0
      ? allResponseTimes.reduce((sum, time) => sum + time, 0) / allResponseTimes.length
      : 0

    const healthValues = Array.from(this.health.values())
    const failedHealthChecks = healthValues.filter(h => h.status !== 'healthy').length
    const failureRate = healthValues.length > 0 ? failedHealthChecks / healthValues.length : 0

    return {
      totalRequests,
      providerDistribution,
      averageLatency,
      failureRate,
      cacheHitRate: 0, // Would be calculated from cache metrics
    }
  }
}

// Global router instance
export const aiRouter = new AIRouter()

// High-level routing function
export async function routeAIRequest<T>(request: RoutingRequest): Promise<RoutingResponse<T>> {
  return aiRouter.route<T>(request)
}

// Convenience functions for common operations
export async function routeChat(
  message: string,
  options: {
    userId?: string
    sessionId?: string
    priority?: 'low' | 'normal' | 'high' | 'urgent'
    budget?: number
  } = {}
): Promise<RoutingResponse<string>> {
  return routeAIRequest<string>({
    input: message,
    operation: 'chat',
    context: options,
  })
}

export async function routeAnalysis(
  data: any,
  options: {
    userId?: string
    type?: string
    budget?: number
  } = {}
): Promise<RoutingResponse<any>> {
  return routeAIRequest({
    input: data,
    operation: 'analysis',
    context: options,
  })
}

export async function routeCreative(
  prompt: string,
  options: {
    userId?: string
    style?: string
    budget?: number
  } = {}
): Promise<RoutingResponse<string>> {
  return routeAIRequest<string>({
    input: prompt,
    operation: 'creative',
    context: options,
  })
}

export async function routeCode(
  request: string,
  options: {
    userId?: string
    language?: string
    budget?: number
  } = {}
): Promise<RoutingResponse<string>> {
  return routeAIRequest<string>({
    input: request,
    operation: 'code',
    context: {
      ...options,
      requiredCapabilities: ['code'],
    },
  })
}

// Router configuration utilities
export function configureRouting(config: {
  loadBalancing?: LoadBalancingStrategy
  rules?: RoutingRule[]
}): void {
  if (config.loadBalancing) {
    aiRouter.updateLoadBalancing(config.loadBalancing)
  }
  
  if (config.rules) {
    aiRouter.updateRoutingRules(config.rules)
  }
}

export function getRoutingMetrics() {
  return aiRouter.getMetrics()
}

export function getProviderHealth() {
  return aiRouter.getHealth()
}