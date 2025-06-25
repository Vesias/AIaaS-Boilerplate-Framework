/**
 * Universal AI Request Processor
 * Handles multiple AI providers with intelligent routing, caching, and fallback mechanisms
 */

import { EventEmitter } from 'events'
import { createDatabaseService } from './database'

// Types for AI processing
export interface AIProvider {
  id: string
  name: string
  type: 'openai' | 'anthropic' | 'google' | 'azure' | 'custom'
  endpoint: string
  apiKey: string
  models: AIModel[]
  capabilities: string[]
  rateLimit: {
    requestsPerMinute: number
    tokensPerMinute?: number
  }
  pricing: {
    inputTokenPrice: number  // per 1k tokens
    outputTokenPrice: number // per 1k tokens
  }
  status: 'active' | 'inactive' | 'maintenance' | 'error'
  priority: number // Higher number = higher priority
  metadata?: Record<string, any>
}

export interface AIModel {
  id: string
  name: string
  description: string
  maxTokens: number
  contextWindow: number
  capabilities: string[]
  pricing: {
    input: number
    output: number
  }
  metadata?: Record<string, any>
}

export interface AIRequest {
  id: string
  userId?: string
  sessionId?: string
  prompt: string
  messages?: AIMessage[]
  model?: string
  providerId?: string
  parameters: {
    temperature?: number
    maxTokens?: number
    topP?: number
    frequencyPenalty?: number
    presencePenalty?: number
    stop?: string[]
    stream?: boolean
  }
  context?: {
    systemPrompt?: string
    functions?: AIFunction[]
    tools?: AITool[]
  }
  metadata?: Record<string, any>
  priority: 'low' | 'normal' | 'high' | 'urgent'
  tags?: string[]
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant' | 'function' | 'tool'
  content: string
  name?: string
  functionCall?: {
    name: string
    arguments: string
  }
  toolCalls?: AIToolCall[]
}

export interface AIFunction {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, any>
    required?: string[]
  }
}

export interface AITool {
  type: 'function'
  function: AIFunction
}

export interface AIToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export interface AIResponse {
  id: string
  requestId: string
  providerId: string
  model: string
  content: string
  finishReason: 'stop' | 'length' | 'function_call' | 'tool_calls' | 'content_filter'
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
    estimatedCost: number
  }
  metadata: {
    processingTime: number
    timestamp: Date
    cached: boolean
    retryCount: number
  }
  functionCall?: {
    name: string
    arguments: string
  }
  toolCalls?: AIToolCall[]
}

export interface AIProcessorConfig {
  providers: AIProvider[]
  routing: {
    strategy: 'priority' | 'cost' | 'speed' | 'quality' | 'round_robin'
    fallbackEnabled: boolean
    maxRetries: number
    retryDelay: number
  }
  caching: {
    enabled: boolean
    ttlSeconds: number
    maxSize: number
    strategy: 'lru' | 'fifo'
  }
  rateLimit: {
    globalEnabled: boolean
    perProviderEnabled: boolean
    perUserEnabled: boolean
  }
  monitoring: {
    metricsEnabled: boolean
    loggingLevel: 'none' | 'basic' | 'detailed'
    alerting: boolean
  }
}

export interface AIMetrics {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  averageResponseTime: number
  totalTokensUsed: number
  totalCost: number
  cacheHitRate: number
  providerDistribution: Record<string, number>
  modelDistribution: Record<string, number>
}

/**
 * Universal AI Request Processor
 * Routes requests to appropriate providers with intelligent fallback and caching
 */
export class AIRequestProcessor extends EventEmitter {
  private config: AIProcessorConfig
  private db: Awaited<ReturnType<typeof createDatabaseService>>
  private providers: Map<string, AIProvider> = new Map()
  private cache: Map<string, { response: AIResponse; timestamp: Date; ttl: number }> = new Map()
  private rateLimiters: Map<string, { requests: number; resetTime: Date }> = new Map()
  private metrics: AIMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    totalTokensUsed: 0,
    totalCost: 0,
    cacheHitRate: 0,
    providerDistribution: {},
    modelDistribution: {},
  }

  constructor(
    config: AIProcessorConfig,
    db: Awaited<ReturnType<typeof createDatabaseService>>
  ) {
    super()
    this.config = config
    this.db = db

    // Initialize providers
    config.providers.forEach(provider => {
      this.providers.set(provider.id, provider)
    })

    // Start monitoring
    this.startMonitoring()
  }

  /**
   * Process AI request with intelligent routing
   */
  async processRequest(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now()
    request.id = request.id || this.generateRequestId()

    try {
      this.metrics.totalRequests++
      this.emit('requestStarted', request)

      // Check cache first
      if (this.config.caching.enabled) {
        const cached = this.getCachedResponse(request)
        if (cached) {
          this.metrics.cacheHitRate = this.calculateCacheHitRate()
          this.emit('cacheHit', { request, response: cached })
          return cached
        }
      }

      // Select provider and model
      const { provider, model } = await this.selectProviderAndModel(request)
      
      if (!provider) {
        throw new Error('No available provider found')
      }

      // Check rate limits
      if (this.config.rateLimit.perProviderEnabled) {
        await this.checkRateLimit(provider.id)
      }

      // Make request to provider
      const response = await this.makeProviderRequest(request, provider, model)
      
      // Update metrics
      this.updateMetrics(response, provider, model, startTime)

      // Cache response
      if (this.config.caching.enabled) {
        this.cacheResponse(request, response)
      }

      // Log request
      await this.logRequest(request, response)

      this.emit('requestCompleted', { request, response })
      return response

    } catch (error: any) {
      this.metrics.failedRequests++
      
      // Try fallback if enabled
      if (this.config.routing.fallbackEnabled && request.metadata?.retryCount !== this.config.routing.maxRetries) {
        console.warn(`Request failed, attempting fallback: ${error.message}`)
        
        const retryRequest = {
          ...request,
          metadata: {
            ...request.metadata,
            retryCount: (request.metadata?.retryCount || 0) + 1,
          },
        }

        // Delay before retry
        await new Promise(resolve => setTimeout(resolve, this.config.routing.retryDelay))
        
        return this.processRequest(retryRequest)
      }

      this.emit('requestFailed', { request, error })
      throw error
    }
  }

  /**
   * Select provider and model based on routing strategy
   */
  private async selectProviderAndModel(request: AIRequest): Promise<{
    provider: AIProvider | null
    model: AIModel | null
  }> {
    // If specific provider requested
    if (request.providerId) {
      const provider = this.providers.get(request.providerId)
      if (provider && provider.status === 'active') {
        const model = this.selectModelForProvider(provider, request.model)
        return { provider, model }
      }
    }

    // Get available providers
    const availableProviders = Array.from(this.providers.values())
      .filter(p => p.status === 'active')

    if (availableProviders.length === 0) {
      return { provider: null, model: null }
    }

    let selectedProvider: AIProvider

    switch (this.config.routing.strategy) {
      case 'priority':
        selectedProvider = availableProviders.sort((a, b) => b.priority - a.priority)[0]
        break

      case 'cost':
        selectedProvider = this.selectCheapestProvider(availableProviders, request)
        break

      case 'speed':
        selectedProvider = this.selectFastestProvider(availableProviders)
        break

      case 'quality':
        selectedProvider = this.selectHighestQualityProvider(availableProviders, request)
        break

      case 'round_robin':
        selectedProvider = this.selectRoundRobinProvider(availableProviders)
        break

      default:
        selectedProvider = availableProviders[0]
    }

    const model = this.selectModelForProvider(selectedProvider, request.model)
    return { provider: selectedProvider, model }
  }

  /**
   * Select model for provider
   */
  private selectModelForProvider(provider: AIProvider, requestedModel?: string): AIModel | null {
    if (requestedModel) {
      const model = provider.models.find(m => m.id === requestedModel || m.name === requestedModel)
      if (model) return model
    }

    // Return default model (first one)
    return provider.models[0] || null
  }

  /**
   * Provider selection strategies
   */
  private selectCheapestProvider(providers: AIProvider[], request: AIRequest): AIProvider {
    return providers.reduce((cheapest, current) => {
      const cheapestCost = this.estimateRequestCost(cheapest, request)
      const currentCost = this.estimateRequestCost(current, request)
      return currentCost < cheapestCost ? current : cheapest
    })
  }

  private selectFastestProvider(providers: AIProvider[]): AIProvider {
    // In a real implementation, this would use historical performance data
    return providers.sort((a, b) => a.rateLimit.requestsPerMinute - b.rateLimit.requestsPerMinute)[0]
  }

  private selectHighestQualityProvider(providers: AIProvider[], request: AIRequest): AIProvider {
    // In a real implementation, this would use quality metrics
    return providers.sort((a, b) => b.priority - a.priority)[0]
  }

  private selectRoundRobinProvider(providers: AIProvider[]): AIProvider {
    // Simple round-robin based on total requests
    const index = this.metrics.totalRequests % providers.length
    return providers[index]
  }

  /**
   * Estimate request cost
   */
  private estimateRequestCost(provider: AIProvider, request: AIRequest): number {
    const model = this.selectModelForProvider(provider, request.model)
    if (!model) return Infinity

    // Estimate token count (rough approximation)
    const promptTokens = this.estimateTokenCount(request.prompt)
    const maxTokens = request.parameters.maxTokens || model.maxTokens / 4
    
    const inputCost = (promptTokens / 1000) * model.pricing.input
    const outputCost = (maxTokens / 1000) * model.pricing.output
    
    return inputCost + outputCost
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokenCount(text: string): number {
    // Very rough approximation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4)
  }

  /**
   * Make request to provider
   */
  private async makeProviderRequest(
    request: AIRequest,
    provider: AIProvider,
    model: AIModel | null
  ): Promise<AIResponse> {
    if (!model) {
      throw new Error(`No suitable model found for provider ${provider.name}`)
    }

    const requestBody = this.buildProviderRequest(request, provider, model)
    const headers = this.buildProviderHeaders(provider)

    const response = await fetch(provider.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      throw new Error(`Provider request failed: ${response.status} ${response.statusText}`)
    }

    const responseData = await response.json()
    return this.parseProviderResponse(responseData, provider, model, request)
  }

  /**
   * Build provider-specific request
   */
  private buildProviderRequest(request: AIRequest, provider: AIProvider, model: AIModel): any {
    switch (provider.type) {
      case 'openai':
        return this.buildOpenAIRequest(request, model)
      case 'anthropic':
        return this.buildAnthropicRequest(request, model)
      case 'google':
        return this.buildGoogleRequest(request, model)
      default:
        return this.buildGenericRequest(request, model)
    }
  }

  /**
   * Build OpenAI request
   */
  private buildOpenAIRequest(request: AIRequest, model: AIModel): any {
    const messages = request.messages || [
      { role: 'user' as const, content: request.prompt }
    ]

    if (request.context?.systemPrompt) {
      messages.unshift({
        role: 'system',
        content: request.context.systemPrompt,
      })
    }

    return {
      model: model.id,
      messages,
      temperature: request.parameters.temperature || 0.7,
      max_tokens: request.parameters.maxTokens || 1000,
      top_p: request.parameters.topP,
      frequency_penalty: request.parameters.frequencyPenalty,
      presence_penalty: request.parameters.presencePenalty,
      stop: request.parameters.stop,
      stream: request.parameters.stream || false,
      tools: request.context?.tools,
      functions: request.context?.functions,
    }
  }

  /**
   * Build Anthropic request
   */
  private buildAnthropicRequest(request: AIRequest, model: AIModel): any {
    return {
      model: model.id,
      max_tokens: request.parameters.maxTokens || 1000,
      temperature: request.parameters.temperature || 0.7,
      system: request.context?.systemPrompt,
      messages: request.messages || [
        { role: 'user', content: request.prompt }
      ],
      stream: request.parameters.stream || false,
    }
  }

  /**
   * Build Google request
   */
  private buildGoogleRequest(request: AIRequest, model: AIModel): any {
    return {
      model: model.id,
      prompt: {
        text: request.prompt,
      },
      temperature: request.parameters.temperature || 0.7,
      candidateCount: 1,
      maxOutputTokens: request.parameters.maxTokens || 1000,
    }
  }

  /**
   * Build generic request
   */
  private buildGenericRequest(request: AIRequest, model: AIModel): any {
    return {
      model: model.id,
      prompt: request.prompt,
      temperature: request.parameters.temperature || 0.7,
      max_tokens: request.parameters.maxTokens || 1000,
      ...request.parameters,
    }
  }

  /**
   * Build provider headers
   */
  private buildProviderHeaders(provider: AIProvider): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    switch (provider.type) {
      case 'openai':
        headers['Authorization'] = `Bearer ${provider.apiKey}`
        break
      case 'anthropic':
        headers['x-api-key'] = provider.apiKey
        headers['anthropic-version'] = '2023-06-01'
        break
      case 'google':
        headers['Authorization'] = `Bearer ${provider.apiKey}`
        break
      default:
        headers['Authorization'] = `Bearer ${provider.apiKey}`
    }

    return headers
  }

  /**
   * Parse provider response
   */
  private parseProviderResponse(
    responseData: any,
    provider: AIProvider,
    model: AIModel,
    request: AIRequest
  ): AIResponse {
    switch (provider.type) {
      case 'openai':
        return this.parseOpenAIResponse(responseData, provider, model, request)
      case 'anthropic':
        return this.parseAnthropicResponse(responseData, provider, model, request)
      case 'google':
        return this.parseGoogleResponse(responseData, provider, model, request)
      default:
        return this.parseGenericResponse(responseData, provider, model, request)
    }
  }

  /**
   * Parse OpenAI response
   */
  private parseOpenAIResponse(responseData: any, provider: AIProvider, model: AIModel, request: AIRequest): AIResponse {
    const choice = responseData.choices[0]
    const usage = responseData.usage

    return {
      id: responseData.id,
      requestId: request.id,
      providerId: provider.id,
      model: model.id,
      content: choice.message.content || '',
      finishReason: choice.finish_reason,
      usage: {
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
        estimatedCost: this.calculateCost(usage, model),
      },
      metadata: {
        processingTime: 0, // Will be set by caller
        timestamp: new Date(),
        cached: false,
        retryCount: request.metadata?.retryCount || 0,
      },
      functionCall: choice.message.function_call,
      toolCalls: choice.message.tool_calls,
    }
  }

  /**
   * Parse Anthropic response
   */
  private parseAnthropicResponse(responseData: any, provider: AIProvider, model: AIModel, request: AIRequest): AIResponse {
    return {
      id: responseData.id,
      requestId: request.id,
      providerId: provider.id,
      model: model.id,
      content: responseData.content[0]?.text || '',
      finishReason: responseData.stop_reason,
      usage: {
        promptTokens: responseData.usage.input_tokens,
        completionTokens: responseData.usage.output_tokens,
        totalTokens: responseData.usage.input_tokens + responseData.usage.output_tokens,
        estimatedCost: this.calculateCost(responseData.usage, model),
      },
      metadata: {
        processingTime: 0,
        timestamp: new Date(),
        cached: false,
        retryCount: request.metadata?.retryCount || 0,
      },
    }
  }

  /**
   * Parse Google response
   */
  private parseGoogleResponse(responseData: any, provider: AIProvider, model: AIModel, request: AIRequest): AIResponse {
    const candidate = responseData.candidates[0]
    
    return {
      id: this.generateResponseId(),
      requestId: request.id,
      providerId: provider.id,
      model: model.id,
      content: candidate.output || '',
      finishReason: 'stop',
      usage: {
        promptTokens: this.estimateTokenCount(request.prompt),
        completionTokens: this.estimateTokenCount(candidate.output || ''),
        totalTokens: 0, // Will be calculated
        estimatedCost: 0, // Will be calculated
      },
      metadata: {
        processingTime: 0,
        timestamp: new Date(),
        cached: false,
        retryCount: request.metadata?.retryCount || 0,
      },
    }
  }

  /**
   * Parse generic response
   */
  private parseGenericResponse(responseData: any, provider: AIProvider, model: AIModel, request: AIRequest): AIResponse {
    return {
      id: responseData.id || this.generateResponseId(),
      requestId: request.id,
      providerId: provider.id,
      model: model.id,
      content: responseData.content || responseData.text || '',
      finishReason: 'stop',
      usage: {
        promptTokens: responseData.usage?.prompt_tokens || 0,
        completionTokens: responseData.usage?.completion_tokens || 0,
        totalTokens: responseData.usage?.total_tokens || 0,
        estimatedCost: 0,
      },
      metadata: {
        processingTime: 0,
        timestamp: new Date(),
        cached: false,
        retryCount: request.metadata?.retryCount || 0,
      },
    }
  }

  /**
   * Calculate cost based on usage
   */
  private calculateCost(usage: any, model: AIModel): number {
    const inputCost = (usage.prompt_tokens || usage.input_tokens || 0) / 1000 * model.pricing.input
    const outputCost = (usage.completion_tokens || usage.output_tokens || 0) / 1000 * model.pricing.output
    return inputCost + outputCost
  }

  /**
   * Cache management
   */
  private getCachedResponse(request: AIRequest): AIResponse | null {
    const cacheKey = this.generateCacheKey(request)
    const cached = this.cache.get(cacheKey)
    
    if (!cached) return null
    
    // Check if expired
    const now = new Date()
    if (now.getTime() - cached.timestamp.getTime() > cached.ttl * 1000) {
      this.cache.delete(cacheKey)
      return null
    }
    
    // Mark as cached and return
    const response = { ...cached.response }
    response.metadata.cached = true
    return response
  }

  private cacheResponse(request: AIRequest, response: AIResponse): void {
    if (this.cache.size >= this.config.caching.maxSize) {
      // Remove oldest entry (FIFO) or least recently used (LRU)
      const firstKey = this.cache.keys().next().value
      if (firstKey) {
        this.cache.delete(firstKey)
      }
    }

    const cacheKey = this.generateCacheKey(request)
    this.cache.set(cacheKey, {
      response,
      timestamp: new Date(),
      ttl: this.config.caching.ttlSeconds,
    })
  }

  private generateCacheKey(request: AIRequest): string {
    // Create cache key from request content and parameters
    const keyData = {
      prompt: request.prompt,
      model: request.model,
      parameters: request.parameters,
      systemPrompt: request.context?.systemPrompt,
    }
    return Buffer.from(JSON.stringify(keyData)).toString('base64')
  }

  /**
   * Rate limiting
   */
  private async checkRateLimit(providerId: string): Promise<void> {
    const provider = this.providers.get(providerId)
    if (!provider) return

    const limiter = this.rateLimiters.get(providerId)
    const now = new Date()

    if (!limiter || now > limiter.resetTime) {
      // Reset rate limiter
      this.rateLimiters.set(providerId, {
        requests: 1,
        resetTime: new Date(now.getTime() + 60000), // 1 minute
      })
      return
    }

    if (limiter.requests >= provider.rateLimit.requestsPerMinute) {
      const waitTime = limiter.resetTime.getTime() - now.getTime()
      throw new Error(`Rate limit exceeded for provider ${provider.name}. Wait ${waitTime}ms`)
    }

    limiter.requests++
  }

  /**
   * Metrics and monitoring
   */
  private updateMetrics(response: AIResponse, provider: AIProvider, model: AIModel, startTime: number): void {
    this.metrics.successfulRequests++
    this.metrics.totalTokensUsed += response.usage.totalTokens
    this.metrics.totalCost += response.usage.estimatedCost
    
    const processingTime = Date.now() - startTime
    response.metadata.processingTime = processingTime
    
    // Update average response time
    this.metrics.averageResponseTime = 
      ((this.metrics.averageResponseTime * (this.metrics.successfulRequests - 1)) + processingTime) / 
      this.metrics.successfulRequests

    // Update distribution metrics
    this.metrics.providerDistribution[provider.id] = (this.metrics.providerDistribution[provider.id] || 0) + 1
    this.metrics.modelDistribution[model.id] = (this.metrics.modelDistribution[model.id] || 0) + 1
  }

  private calculateCacheHitRate(): number {
    const cacheHits = this.metrics.successfulRequests - this.metrics.totalRequests + this.cache.size
    return this.metrics.totalRequests > 0 ? (cacheHits / this.metrics.totalRequests) * 100 : 0
  }

  private startMonitoring(): void {
    if (this.config.monitoring.metricsEnabled) {
      setInterval(() => {
        this.emit('metrics', this.getMetrics())
      }, 60000) // Every minute
    }
  }

  /**
   * Logging
   */
  private async logRequest(request: AIRequest, response: AIResponse): Promise<void> {
    try {
      if (this.config.monitoring.loggingLevel === 'none') return

      const logData = {
        requestId: request.id,
        userId: request.userId,
        sessionId: request.sessionId,
        providerId: response.providerId,
        model: response.model,
        promptLength: request.prompt.length,
        responseLength: response.content.length,
        tokensUsed: response.usage.totalTokens,
        cost: response.usage.estimatedCost,
        processingTime: response.metadata.processingTime,
        cached: response.metadata.cached,
        timestamp: new Date(),
      }

      // In a real implementation, this would save to database
      if (this.config.monitoring.loggingLevel === 'detailed') {
        console.log('AI Request Log:', logData)
      }
    } catch (error) {
      console.warn('Failed to log AI request:', error)
    }
  }

  /**
   * Utility methods
   */
  private generateRequestId(): string {
    return `ai_req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  private generateResponseId(): string {
    return `ai_res_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  /**
   * Public methods
   */
  addProvider(provider: AIProvider): void {
    this.providers.set(provider.id, provider)
    this.emit('providerAdded', provider)
  }

  removeProvider(providerId: string): void {
    this.providers.delete(providerId)
    this.rateLimiters.delete(providerId)
    this.emit('providerRemoved', providerId)
  }

  updateProviderStatus(providerId: string, status: AIProvider['status']): void {
    const provider = this.providers.get(providerId)
    if (provider) {
      provider.status = status
      this.emit('providerStatusChanged', { providerId, status })
    }
  }

  getMetrics(): AIMetrics {
    return { ...this.metrics }
  }

  getProviders(): AIProvider[] {
    return Array.from(this.providers.values())
  }

  clearCache(): void {
    this.cache.clear()
    this.emit('cacheCleared')
  }

  async healthCheck(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {}
    
    for (const provider of this.providers.values()) {
      if (provider.status !== 'active') {
        results[provider.id] = false
        continue
      }

      try {
        // Simple health check request
        const testRequest: AIRequest = {
          id: 'health_check',
          prompt: 'Hello',
          parameters: { maxTokens: 10 },
          priority: 'low',
        }

        await this.makeProviderRequest(testRequest, provider, provider.models[0])
        results[provider.id] = true
      } catch (error) {
        results[provider.id] = false
        this.updateProviderStatus(provider.id, 'error')
      }
    }

    return results
  }
}

/**
 * Factory function to create AI processor
 */
export async function createAIProcessor(config: AIProcessorConfig): Promise<AIRequestProcessor> {
  const db = await createDatabaseService()
  return new AIRequestProcessor(config, db)
}

/**
 * Default configuration
 */
export const defaultAIProcessorConfig: AIProcessorConfig = {
  providers: [],
  routing: {
    strategy: 'priority',
    fallbackEnabled: true,
    maxRetries: 2,
    retryDelay: 1000,
  },
  caching: {
    enabled: true,
    ttlSeconds: 300, // 5 minutes
    maxSize: 1000,
    strategy: 'lru',
  },
  rateLimit: {
    globalEnabled: true,
    perProviderEnabled: true,
    perUserEnabled: false,
  },
  monitoring: {
    metricsEnabled: true,
    loggingLevel: 'basic',
    alerting: false,
  },
}

/**
 * Provider templates
 */
export const ProviderTemplates = {
  openai: (apiKey: string): AIProvider => ({
    id: 'openai',
    name: 'OpenAI',
    type: 'openai',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    apiKey,
    models: [
      {
        id: 'gpt-4',
        name: 'GPT-4',
        description: 'Most capable GPT-4 model',
        maxTokens: 8192,
        contextWindow: 128000,
        capabilities: ['text', 'function_calling', 'tools'],
        pricing: { input: 0.03, output: 0.06 },
      },
      {
        id: 'gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        description: 'Fast and efficient model',
        maxTokens: 4096,
        contextWindow: 16384,
        capabilities: ['text', 'function_calling'],
        pricing: { input: 0.001, output: 0.002 },
      },
    ],
    capabilities: ['text_generation', 'function_calling', 'tools', 'streaming'],
    rateLimit: { requestsPerMinute: 3000, tokensPerMinute: 150000 },
    pricing: { inputTokenPrice: 0.03, outputTokenPrice: 0.06 },
    status: 'active',
    priority: 1,
  }),

  anthropic: (apiKey: string): AIProvider => ({
    id: 'anthropic',
    name: 'Anthropic',
    type: 'anthropic',
    endpoint: 'https://api.anthropic.com/v1/messages',
    apiKey,
    models: [
      {
        id: 'claude-3-opus-20240229',
        name: 'Claude 3 Opus',
        description: 'Most powerful Claude model',
        maxTokens: 4096,
        contextWindow: 200000,
        capabilities: ['text', 'analysis'],
        pricing: { input: 0.015, output: 0.075 },
      },
      {
        id: 'claude-3-sonnet-20240229',
        name: 'Claude 3 Sonnet',
        description: 'Balanced Claude model',
        maxTokens: 4096,
        contextWindow: 200000,
        capabilities: ['text', 'analysis'],
        pricing: { input: 0.003, output: 0.015 },
      },
    ],
    capabilities: ['text_generation', 'analysis', 'reasoning'],
    rateLimit: { requestsPerMinute: 1000 },
    pricing: { inputTokenPrice: 0.015, outputTokenPrice: 0.075 },
    status: 'active',
    priority: 2,
  }),
}

// Export types
export type {
  AIProvider,
  AIModel,
  AIRequest,
  AIMessage,
  AIFunction,
  AITool,
  AIToolCall,
  AIResponse,
  AIProcessorConfig,
  AIMetrics,
}