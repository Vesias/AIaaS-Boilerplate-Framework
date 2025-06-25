/**
 * AI Configuration and Model Management
 * Centralized configuration for AI models, providers, and intelligent routing
 */

import { toast } from 'sonner'

// Types for AI configuration
export interface AIModel {
  id: string
  name: string
  provider: 'openai' | 'anthropic' | 'google' | 'local' | 'custom'
  type: 'chat' | 'completion' | 'embedding' | 'image' | 'audio'
  capabilities: string[]
  pricing: {
    input: number  // per 1k tokens
    output: number // per 1k tokens
    training?: number
  }
  limits: {
    maxTokens: number
    contextWindow: number
    maxRequests?: number
    rateLimit?: number
  }
  performance: {
    speed: 'fast' | 'medium' | 'slow'
    quality: 'high' | 'medium' | 'low'
    reliability: number // 0-100
  }
  metadata: {
    version: string
    description: string
    releaseDate: string
    deprecated?: boolean
    beta?: boolean
  }
}

export interface AIProvider {
  id: string
  name: string
  description: string
  baseUrl: string
  apiKeyRequired: boolean
  models: AIModel[]
  features: string[]
  regions: string[]
  status: 'active' | 'maintenance' | 'deprecated'
}

export interface ModelSelectionCriteria {
  task: 'chat' | 'completion' | 'analysis' | 'creative' | 'code' | 'reasoning'
  priority: 'speed' | 'quality' | 'cost' | 'balanced'
  maxCost?: number
  maxLatency?: number
  requiredCapabilities?: string[]
  contextSize?: number
}

export interface AIConfiguration {
  defaultProvider: string
  fallbackProviders: string[]
  modelPreferences: Record<string, string> // task -> model mapping
  costLimits: {
    daily: number
    monthly: number
    perRequest: number
  }
  performance: {
    timeout: number
    retryAttempts: number
    concurrentRequests: number
  }
  features: {
    autoFallback: boolean
    costOptimization: boolean
    caching: boolean
    monitoring: boolean
  }
  apiKeys: Record<string, string>
}

// Default models configuration
export const DEFAULT_MODELS: AIModel[] = [
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    type: 'chat',
    capabilities: ['text', 'images', 'reasoning', 'code', 'analysis'],
    pricing: { input: 0.005, output: 0.015 },
    limits: { maxTokens: 4096, contextWindow: 128000 },
    performance: { speed: 'fast', quality: 'high', reliability: 95 },
    metadata: {
      version: '2024-05-13',
      description: 'Latest multimodal model with improved reasoning',
      releaseDate: '2024-05-13',
    },
  },
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'openai',
    type: 'chat',
    capabilities: ['text', 'images', 'reasoning', 'code'],
    pricing: { input: 0.01, output: 0.03 },
    limits: { maxTokens: 4096, contextWindow: 128000 },
    performance: { speed: 'medium', quality: 'high', reliability: 98 },
    metadata: {
      version: '2024-04-09',
      description: 'Most capable GPT-4 model',
      releaseDate: '2024-04-09',
    },
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    provider: 'openai',
    type: 'chat',
    capabilities: ['text', 'code'],
    pricing: { input: 0.0005, output: 0.0015 },
    limits: { maxTokens: 4096, contextWindow: 16385 },
    performance: { speed: 'fast', quality: 'medium', reliability: 99 },
    metadata: {
      version: '0125',
      description: 'Fast and cost-effective chat model',
      releaseDate: '2024-01-25',
    },
  },
  {
    id: 'claude-3-opus',
    name: 'Claude 3 Opus',
    provider: 'anthropic',
    type: 'chat',
    capabilities: ['text', 'images', 'reasoning', 'analysis', 'creative'],
    pricing: { input: 0.015, output: 0.075 },
    limits: { maxTokens: 4096, contextWindow: 200000 },
    performance: { speed: 'slow', quality: 'high', reliability: 96 },
    metadata: {
      version: '20240229',
      description: 'Most capable Claude model for complex tasks',
      releaseDate: '2024-02-29',
    },
  },
  {
    id: 'claude-3-sonnet',
    name: 'Claude 3 Sonnet',
    provider: 'anthropic',
    type: 'chat',
    capabilities: ['text', 'images', 'reasoning', 'code'],
    pricing: { input: 0.003, output: 0.015 },
    limits: { maxTokens: 4096, contextWindow: 200000 },
    performance: { speed: 'medium', quality: 'high', reliability: 97 },
    metadata: {
      version: '20240229',
      description: 'Balanced Claude model for most tasks',
      releaseDate: '2024-02-29',
    },
  },
  {
    id: 'claude-3-haiku',
    name: 'Claude 3 Haiku',
    provider: 'anthropic',
    type: 'chat',
    capabilities: ['text', 'code', 'analysis'],
    pricing: { input: 0.00025, output: 0.00125 },
    limits: { maxTokens: 4096, contextWindow: 200000 },
    performance: { speed: 'fast', quality: 'medium', reliability: 98 },
    metadata: {
      version: '20240307',
      description: 'Fast and affordable Claude model',
      releaseDate: '2024-03-07',
    },
  },
]

// Default providers configuration
export const DEFAULT_PROVIDERS: AIProvider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'Leading AI research company with GPT models',
    baseUrl: 'https://api.openai.com/v1',
    apiKeyRequired: true,
    models: DEFAULT_MODELS.filter(m => m.provider === 'openai'),
    features: ['chat', 'completion', 'embeddings', 'images', 'audio'],
    regions: ['us', 'eu'],
    status: 'active',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'AI safety focused company with Claude models',
    baseUrl: 'https://api.anthropic.com/v1',
    apiKeyRequired: true,
    models: DEFAULT_MODELS.filter(m => m.provider === 'anthropic'),
    features: ['chat', 'analysis', 'reasoning'],
    regions: ['us', 'eu'],
    status: 'active',
  },
]

// AI Configuration Manager
export class AIConfigManager {
  private config: AIConfiguration
  private models: Map<string, AIModel> = new Map()
  private providers: Map<string, AIProvider> = new Map()
  private usage: Map<string, { requests: number; tokens: number; cost: number }> = new Map()

  constructor(initialConfig?: Partial<AIConfiguration>) {
    this.config = {
      defaultProvider: 'openai',
      fallbackProviders: ['anthropic'],
      modelPreferences: {
        chat: 'gpt-4o',
        analysis: 'claude-3-sonnet',
        creative: 'claude-3-opus',
        code: 'gpt-4-turbo',
        reasoning: 'claude-3-opus',
      },
      costLimits: {
        daily: 50,
        monthly: 1000,
        perRequest: 5,
      },
      performance: {
        timeout: 30000,
        retryAttempts: 3,
        concurrentRequests: 5,
      },
      features: {
        autoFallback: true,
        costOptimization: true,
        caching: true,
        monitoring: true,
      },
      apiKeys: {},
      ...initialConfig,
    }

    this.initializeModels()
    this.initializeProviders()
  }

  private initializeModels(): void {
    DEFAULT_MODELS.forEach(model => {
      this.models.set(model.id, model)
    })
  }

  private initializeProviders(): void {
    DEFAULT_PROVIDERS.forEach(provider => {
      this.providers.set(provider.id, provider)
    })
  }

  /**
   * Select the best model based on criteria
   */
  selectModel(criteria: ModelSelectionCriteria): AIModel | null {
    const availableModels = Array.from(this.models.values()).filter(model => {
      // Filter by capabilities
      if (criteria.requiredCapabilities) {
        const hasCapabilities = criteria.requiredCapabilities.every(cap =>
          model.capabilities.includes(cap)
        )
        if (!hasCapabilities) return false
      }

      // Filter by context size
      if (criteria.contextSize && model.limits.contextWindow < criteria.contextSize) {
        return false
      }

      // Filter by cost
      if (criteria.maxCost) {
        const estimatedCost = this.estimateCost(model.id, 1000, 1000)
        if (estimatedCost > criteria.maxCost) return false
      }

      return true
    })

    if (availableModels.length === 0) return null

    // Score models based on priority
    const scoredModels = availableModels.map(model => {
      let score = 0

      switch (criteria.priority) {
        case 'speed':
          score += model.performance.speed === 'fast' ? 100 : 
                   model.performance.speed === 'medium' ? 60 : 20
          break
        case 'quality':
          score += model.performance.quality === 'high' ? 100 : 
                   model.performance.quality === 'medium' ? 60 : 20
          break
        case 'cost':
          const cost = model.pricing.input + model.pricing.output
          score += Math.max(0, 100 - cost * 1000) // Lower cost = higher score
          break
        case 'balanced':
          score += model.performance.quality === 'high' ? 40 : 
                   model.performance.quality === 'medium' ? 25 : 10
          score += model.performance.speed === 'fast' ? 30 : 
                   model.performance.speed === 'medium' ? 20 : 10
          const balancedCost = model.pricing.input + model.pricing.output
          score += Math.max(0, 30 - balancedCost * 1000)
          break
      }

      // Add reliability bonus
      score += model.performance.reliability * 0.5

      // Prefer non-deprecated models
      if (!model.metadata.deprecated) score += 20

      return { model, score }
    })

    // Sort by score and return best model
    scoredModels.sort((a, b) => b.score - a.score)
    return scoredModels[0]?.model || null
  }

  /**
   * Get model by task preference
   */
  getModelForTask(task: string): AIModel | null {
    const preferredModelId = this.config.modelPreferences[task]
    if (preferredModelId && this.models.has(preferredModelId)) {
      return this.models.get(preferredModelId)!
    }

    // Fallback to selection based on task
    return this.selectModel({
      task: task as any,
      priority: 'balanced',
    })
  }

  /**
   * Estimate cost for a request
   */
  estimateCost(modelId: string, inputTokens: number, outputTokens: number): number {
    const model = this.models.get(modelId)
    if (!model) return 0

    return (inputTokens / 1000) * model.pricing.input + 
           (outputTokens / 1000) * model.pricing.output
  }

  /**
   * Check if request is within cost limits
   */
  isWithinCostLimits(modelId: string, inputTokens: number, outputTokens: number): boolean {
    const requestCost = this.estimateCost(modelId, inputTokens, outputTokens)
    
    if (requestCost > this.config.costLimits.perRequest) {
      return false
    }

    const usage = this.usage.get(modelId) || { requests: 0, tokens: 0, cost: 0 }
    const today = new Date().toDateString()
    const todayUsage = this.getTodayUsage()
    
    return (todayUsage + requestCost) <= this.config.costLimits.daily
  }

  /**
   * Track usage for a model
   */
  trackUsage(modelId: string, inputTokens: number, outputTokens: number): void {
    const cost = this.estimateCost(modelId, inputTokens, outputTokens)
    const totalTokens = inputTokens + outputTokens
    
    const current = this.usage.get(modelId) || { requests: 0, tokens: 0, cost: 0 }
    this.usage.set(modelId, {
      requests: current.requests + 1,
      tokens: current.tokens + totalTokens,
      cost: current.cost + cost,
    })
  }

  /**
   * Get today's usage across all models
   */
  getTodayUsage(): number {
    // This would integrate with persistent storage
    return Array.from(this.usage.values())
      .reduce((total, usage) => total + usage.cost, 0)
  }

  /**
   * Get available models for a provider
   */
  getModelsForProvider(providerId: string): AIModel[] {
    return Array.from(this.models.values())
      .filter(model => model.provider === providerId)
  }

  /**
   * Check model availability
   */
  isModelAvailable(modelId: string): boolean {
    const model = this.models.get(modelId)
    if (!model) return false

    const provider = this.providers.get(model.provider)
    if (!provider || provider.status !== 'active') return false

    if (model.metadata.deprecated) return false

    return true
  }

  /**
   * Get fallback models for a given model
   */
  getFallbackModels(modelId: string): AIModel[] {
    const originalModel = this.models.get(modelId)
    if (!originalModel) return []

    return Array.from(this.models.values())
      .filter(model => 
        model.id !== modelId &&
        model.type === originalModel.type &&
        this.isModelAvailable(model.id) &&
        model.capabilities.some(cap => originalModel.capabilities.includes(cap))
      )
      .sort((a, b) => {
        // Prefer same provider
        if (a.provider === originalModel.provider && b.provider !== originalModel.provider) return -1
        if (b.provider === originalModel.provider && a.provider !== originalModel.provider) return 1
        
        // Then by reliability
        return b.performance.reliability - a.performance.reliability
      })
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<AIConfiguration>): void {
    this.config = { ...this.config, ...updates }
  }

  /**
   * Get current configuration
   */
  getConfig(): AIConfiguration {
    return { ...this.config }
  }

  /**
   * Add custom model
   */
  addModel(model: AIModel): void {
    this.models.set(model.id, model)
  }

  /**
   * Add custom provider
   */
  addProvider(provider: AIProvider): void {
    this.providers.set(provider.id, provider)
  }

  /**
   * Get model details
   */
  getModel(modelId: string): AIModel | null {
    return this.models.get(modelId) || null
  }

  /**
   * Get provider details
   */
  getProvider(providerId: string): AIProvider | null {
    return this.providers.get(providerId) || null
  }

  /**
   * List all available models
   */
  listModels(): AIModel[] {
    return Array.from(this.models.values())
  }

  /**
   * List all providers
   */
  listProviders(): AIProvider[] {
    return Array.from(this.providers.values())
  }

  /**
   * Export configuration
   */
  export(): any {
    return {
      config: this.config,
      models: Array.from(this.models.entries()),
      providers: Array.from(this.providers.entries()),
      usage: Array.from(this.usage.entries()),
      timestamp: new Date().toISOString(),
    }
  }

  /**
   * Import configuration
   */
  import(data: any): void {
    if (data.config) {
      this.config = { ...this.config, ...data.config }
    }
    
    if (data.models) {
      data.models.forEach(([id, model]: [string, AIModel]) => {
        this.models.set(id, model)
      })
    }
    
    if (data.providers) {
      data.providers.forEach(([id, provider]: [string, AIProvider]) => {
        this.providers.set(id, provider)
      })
    }
    
    if (data.usage) {
      data.usage.forEach(([id, usage]: [string, any]) => {
        this.usage.set(id, usage)
      })
    }
  }

  /**
   * Reset to defaults
   */
  reset(): void {
    this.models.clear()
    this.providers.clear()
    this.usage.clear()
    
    this.initializeModels()
    this.initializeProviders()
  }
}

// Global instance
export const aiConfig = new AIConfigManager()

// Utility functions
export function getOptimalModel(
  task: string,
  options: {
    maxCost?: number
    priority?: 'speed' | 'quality' | 'cost' | 'balanced'
    capabilities?: string[]
  } = {}
): AIModel | null {
  return aiConfig.selectModel({
    task: task as any,
    priority: options.priority || 'balanced',
    maxCost: options.maxCost,
    requiredCapabilities: options.capabilities,
  })
}

export function estimateRequestCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number = 0
): number {
  return aiConfig.estimateCost(modelId, inputTokens, outputTokens)
}

export function isRequestAffordable(
  modelId: string,
  inputTokens: number,
  outputTokens: number = 0
): boolean {
  return aiConfig.isWithinCostLimits(modelId, inputTokens, outputTokens)
}

export function getModelCapabilities(modelId: string): string[] {
  const model = aiConfig.getModel(modelId)
  return model?.capabilities || []
}

export function findModelsByCapability(capability: string): AIModel[] {
  return aiConfig.listModels().filter(model =>
    model.capabilities.includes(capability)
  )
}

export function getProviderModels(providerId: string): AIModel[] {
  return aiConfig.getModelsForProvider(providerId)
}

// Model recommendation system
export class ModelRecommendationEngine {
  private configManager: AIConfigManager

  constructor(configManager: AIConfigManager) {
    this.configManager = configManager
  }

  /**
   * Recommend model based on user context and task
   */
  recommend(context: {
    task: string
    userPreferences?: any
    budget?: number
    urgency?: 'low' | 'medium' | 'high'
    quality?: 'acceptable' | 'good' | 'excellent'
  }): {
    primary: AIModel | null
    alternatives: AIModel[]
    reasoning: string
  } {
    let priority: 'speed' | 'quality' | 'cost' | 'balanced' = 'balanced'

    // Determine priority based on context
    if (context.urgency === 'high') {
      priority = 'speed'
    } else if (context.quality === 'excellent') {
      priority = 'quality'
    } else if (context.budget && context.budget < 10) {
      priority = 'cost'
    }

    const primary = this.configManager.selectModel({
      task: context.task as any,
      priority,
      maxCost: context.budget,
    })

    const alternatives = primary 
      ? this.configManager.getFallbackModels(primary.id).slice(0, 3)
      : []

    const reasoning = this.generateReasoning(context, primary, priority)

    return { primary, alternatives, reasoning }
  }

  private generateReasoning(
    context: any,
    selectedModel: AIModel | null,
    priority: string
  ): string {
    if (!selectedModel) {
      return 'No suitable model found for the given constraints.'
    }

    let reasoning = `Selected ${selectedModel.name} based on ${priority} priority. `

    if (priority === 'speed') {
      reasoning += `This model offers ${selectedModel.performance.speed} response times. `
    } else if (priority === 'quality') {
      reasoning += `This model provides ${selectedModel.performance.quality} quality outputs. `
    } else if (priority === 'cost') {
      reasoning += `This model is cost-effective at $${selectedModel.pricing.input}/1k input tokens. `
    }

    reasoning += `It supports ${selectedModel.capabilities.join(', ')} and has a ${selectedModel.limits.contextWindow} token context window.`

    return reasoning
  }
}

export const modelRecommendation = new ModelRecommendationEngine(aiConfig)