/**
 * AI Response Caching System
 * Intelligent caching for AI responses with TTL, compression, and smart invalidation
 */

import { toast } from 'sonner'

// Types for caching
export interface CacheEntry<T = any> {
  key: string
  value: T
  metadata: {
    modelId: string
    operation: string
    userId?: string
    inputHash: string
    timestamp: Date
    expiresAt: Date
    accessCount: number
    lastAccessed: Date
    compressed: boolean
    size: number
  }
}

export interface CacheConfig {
  maxSize: number // Maximum cache size in MB
  defaultTTL: number // Default TTL in milliseconds
  compressionThreshold: number // Compress entries larger than this (bytes)
  maxEntries: number // Maximum number of entries
  enableCompression: boolean
  enableMetrics: boolean
  cleanupInterval: number // Cleanup interval in milliseconds
}

export interface CacheMetrics {
  hits: number
  misses: number
  entries: number
  size: number // in bytes
  hitRate: number
  averageResponseTime: number
  compressionRatio: number
  evictions: number
}

export interface CacheQuery {
  modelId?: string
  operation?: string
  userId?: string
  inputHash?: string
  minTimestamp?: Date
  maxTimestamp?: Date
}

// Hash function for cache keys
function hashString(str: string): string {
  let hash = 0
  if (str.length === 0) return hash.toString()
  
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  
  return Math.abs(hash).toString(36)
}

// Compression utilities
function compress(data: string): string {
  // Simple LZ77-style compression simulation
  // In production, use a proper compression library
  const dict: Record<string, string> = {}
  let result = ''
  let dictSize = 256
  
  for (let i = 0; i < data.length; i++) {
    const char = data[i]
    const sequence = result + char
    
    if (dict[sequence]) {
      result = sequence
    } else {
      if (result.length > 0) {
        result += char
      } else {
        result = char
      }
      
      if (dictSize < 4096) {
        dict[sequence] = String.fromCharCode(dictSize++)
      }
    }
  }
  
  return btoa(result) // Base64 encode for storage
}

function decompress(data: string): string {
  // Simple decompression
  try {
    return atob(data)
  } catch {
    return data // Return as-is if not compressed
  }
}

// Smart cache implementation
export class AICache {
  private cache: Map<string, CacheEntry> = new Map()
  private config: CacheConfig
  private metrics: CacheMetrics
  private cleanupTimer: NodeJS.Timeout | null = null

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: 100, // 100MB
      defaultTTL: 60 * 60 * 1000, // 1 hour
      compressionThreshold: 1024, // 1KB
      maxEntries: 10000,
      enableCompression: true,
      enableMetrics: true,
      cleanupInterval: 5 * 60 * 1000, // 5 minutes
      ...config,
    }

    this.metrics = {
      hits: 0,
      misses: 0,
      entries: 0,
      size: 0,
      hitRate: 0,
      averageResponseTime: 0,
      compressionRatio: 0,
      evictions: 0,
    }

    this.startCleanupTimer()
    this.loadFromStorage()
  }

  /**
   * Generate cache key from input parameters
   */
  private generateKey(input: any, modelId: string, operation: string, userId?: string): string {
    const inputStr = typeof input === 'string' ? input : JSON.stringify(input)
    const inputHash = hashString(inputStr)
    const keyParts = [modelId, operation, inputHash]
    
    if (userId) {
      keyParts.push(userId)
    }
    
    return keyParts.join(':')
  }

  /**
   * Set cache entry
   */
  set<T>(
    input: any,
    value: T,
    modelId: string,
    operation: string,
    options: {
      ttl?: number
      userId?: string
      tags?: string[]
    } = {}
  ): void {
    const key = this.generateKey(input, modelId, operation, options.userId)
    const inputStr = typeof input === 'string' ? input : JSON.stringify(input)
    const valueStr = typeof value === 'string' ? value : JSON.stringify(value)
    
    // Check if we need to compress
    const shouldCompress = this.config.enableCompression && valueStr.length > this.config.compressionThreshold
    const compressedValue = shouldCompress ? compress(valueStr) : valueStr
    
    const entry: CacheEntry<T> = {
      key,
      value: shouldCompress ? compressedValue as T : value,
      metadata: {
        modelId,
        operation,
        userId: options.userId,
        inputHash: hashString(inputStr),
        timestamp: new Date(),
        expiresAt: new Date(Date.now() + (options.ttl || this.config.defaultTTL)),
        accessCount: 0,
        lastAccessed: new Date(),
        compressed: shouldCompress,
        size: compressedValue.length,
      },
    }

    // Check cache limits before adding
    if (this.cache.size >= this.config.maxEntries || this.getCurrentSize() + entry.metadata.size > this.config.maxSize * 1024 * 1024) {
      this.evictOldest()
    }

    this.cache.set(key, entry)
    this.updateMetrics()
    this.saveToStorage()
  }

  /**
   * Get cache entry
   */
  get<T>(input: any, modelId: string, operation: string, userId?: string): T | null {
    const key = this.generateKey(input, modelId, operation, userId)
    const entry = this.cache.get(key)

    if (!entry) {
      this.metrics.misses++
      this.updateMetrics()
      return null
    }

    // Check if expired
    if (entry.metadata.expiresAt < new Date()) {
      this.cache.delete(key)
      this.metrics.misses++
      this.updateMetrics()
      return null
    }

    // Update access info
    entry.metadata.accessCount++
    entry.metadata.lastAccessed = new Date()

    this.metrics.hits++
    this.updateMetrics()

    // Decompress if needed
    if (entry.metadata.compressed) {
      const decompressed = decompress(entry.value as string)
      try {
        return JSON.parse(decompressed) as T
      } catch {
        return decompressed as T
      }
    }

    return entry.value
  }

  /**
   * Check if entry exists and is valid
   */
  has(input: any, modelId: string, operation: string, userId?: string): boolean {
    const key = this.generateKey(input, modelId, operation, userId)
    const entry = this.cache.get(key)
    
    if (!entry) return false
    
    // Check if expired
    if (entry.metadata.expiresAt < new Date()) {
      this.cache.delete(key)
      return false
    }
    
    return true
  }

  /**
   * Delete specific entry
   */
  delete(input: any, modelId: string, operation: string, userId?: string): boolean {
    const key = this.generateKey(input, modelId, operation, userId)
    const deleted = this.cache.delete(key)
    
    if (deleted) {
      this.updateMetrics()
      this.saveToStorage()
    }
    
    return deleted
  }

  /**
   * Query cache entries
   */
  query(query: CacheQuery): CacheEntry[] {
    const results: CacheEntry[] = []
    
    for (const entry of this.cache.values()) {
      let matches = true
      
      if (query.modelId && entry.metadata.modelId !== query.modelId) {
        matches = false
      }
      
      if (query.operation && entry.metadata.operation !== query.operation) {
        matches = false
      }
      
      if (query.userId && entry.metadata.userId !== query.userId) {
        matches = false
      }
      
      if (query.inputHash && entry.metadata.inputHash !== query.inputHash) {
        matches = false
      }
      
      if (query.minTimestamp && entry.metadata.timestamp < query.minTimestamp) {
        matches = false
      }
      
      if (query.maxTimestamp && entry.metadata.timestamp > query.maxTimestamp) {
        matches = false
      }
      
      if (matches) {
        results.push(entry)
      }
    }
    
    return results.sort((a, b) => b.metadata.lastAccessed.getTime() - a.metadata.lastAccessed.getTime())
  }

  /**
   * Invalidate entries by pattern
   */
  invalidate(pattern: {
    modelId?: string
    operation?: string
    userId?: string
    olderThan?: Date
  }): number {
    let invalidated = 0
    
    for (const [key, entry] of this.cache.entries()) {
      let shouldInvalidate = false
      
      if (pattern.modelId && entry.metadata.modelId === pattern.modelId) {
        shouldInvalidate = true
      }
      
      if (pattern.operation && entry.metadata.operation === pattern.operation) {
        shouldInvalidate = true
      }
      
      if (pattern.userId && entry.metadata.userId === pattern.userId) {
        shouldInvalidate = true
      }
      
      if (pattern.olderThan && entry.metadata.timestamp < pattern.olderThan) {
        shouldInvalidate = true
      }
      
      if (shouldInvalidate) {
        this.cache.delete(key)
        invalidated++
      }
    }
    
    if (invalidated > 0) {
      this.updateMetrics()
      this.saveToStorage()
    }
    
    return invalidated
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear()
    this.metrics.evictions += this.metrics.entries
    this.updateMetrics()
    this.saveToStorage()
  }

  /**
   * Get cache statistics
   */
  getMetrics(): CacheMetrics {
    return { ...this.metrics }
  }

  /**
   * Get cache configuration
   */
  getConfig(): CacheConfig {
    return { ...this.config }
  }

  /**
   * Update cache configuration
   */
  updateConfig(updates: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...updates }
    
    // Restart cleanup timer if interval changed
    if (updates.cleanupInterval) {
      this.stopCleanupTimer()
      this.startCleanupTimer()
    }
    
    // Cleanup if size limits changed
    if (updates.maxSize || updates.maxEntries) {
      this.cleanup()
    }
  }

  /**
   * Get detailed cache status
   */
  getStatus(): {
    metrics: CacheMetrics
    config: CacheConfig
    topEntries: Array<{
      key: string
      modelId: string
      operation: string
      accessCount: number
      size: number
      age: number
    }>
    sizeBreadown: Record<string, number>
  } {
    const topEntries = Array.from(this.cache.values())
      .sort((a, b) => b.metadata.accessCount - a.metadata.accessCount)
      .slice(0, 10)
      .map(entry => ({
        key: entry.key,
        modelId: entry.metadata.modelId,
        operation: entry.metadata.operation,
        accessCount: entry.metadata.accessCount,
        size: entry.metadata.size,
        age: Date.now() - entry.metadata.timestamp.getTime(),
      }))

    const sizeBreadown: Record<string, number> = {}
    for (const entry of this.cache.values()) {
      const key = `${entry.metadata.modelId}:${entry.metadata.operation}`
      sizeBreadown[key] = (sizeBreadown[key] || 0) + entry.metadata.size
    }

    return {
      metrics: this.getMetrics(),
      config: this.getConfig(),
      topEntries,
      sizeBreadown,
    }
  }

  /**
   * Export cache data
   */
  export(): any {
    return {
      entries: Array.from(this.cache.entries()).map(([key, entry]) => [
        key,
        {
          ...entry,
          metadata: {
            ...entry.metadata,
            timestamp: entry.metadata.timestamp.toISOString(),
            expiresAt: entry.metadata.expiresAt.toISOString(),
            lastAccessed: entry.metadata.lastAccessed.toISOString(),
          },
        },
      ]),
      metrics: this.metrics,
      config: this.config,
      timestamp: new Date().toISOString(),
    }
  }

  /**
   * Import cache data
   */
  import(data: any): void {
    this.clear()
    
    if (data.entries) {
      for (const [key, entry] of data.entries) {
        this.cache.set(key, {
          ...entry,
          metadata: {
            ...entry.metadata,
            timestamp: new Date(entry.metadata.timestamp),
            expiresAt: new Date(entry.metadata.expiresAt),
            lastAccessed: new Date(entry.metadata.lastAccessed),
          },
        })
      }
    }
    
    if (data.metrics) {
      this.metrics = { ...this.metrics, ...data.metrics }
    }
    
    if (data.config) {
      this.updateConfig(data.config)
    }
    
    this.updateMetrics()
    this.saveToStorage()
  }

  // Private methods
  private updateMetrics(): void {
    this.metrics.entries = this.cache.size
    this.metrics.size = this.getCurrentSize()
    this.metrics.hitRate = this.metrics.hits + this.metrics.misses > 0
      ? (this.metrics.hits / (this.metrics.hits + this.metrics.misses)) * 100
      : 0

    // Calculate compression ratio
    let totalUncompressed = 0
    let totalCompressed = 0
    
    for (const entry of this.cache.values()) {
      if (entry.metadata.compressed) {
        totalCompressed += entry.metadata.size
        totalUncompressed += entry.metadata.size * 2 // Rough estimate
      }
    }
    
    this.metrics.compressionRatio = totalUncompressed > 0 
      ? (1 - totalCompressed / totalUncompressed) * 100
      : 0
  }

  private getCurrentSize(): number {
    let size = 0
    for (const entry of this.cache.values()) {
      size += entry.metadata.size
    }
    return size
  }

  private evictOldest(): void {
    // Find least recently used entry
    let oldestEntry: CacheEntry | null = null
    let oldestKey: string | null = null
    
    for (const [key, entry] of this.cache.entries()) {
      if (!oldestEntry || entry.metadata.lastAccessed < oldestEntry.metadata.lastAccessed) {
        oldestEntry = entry
        oldestKey = key
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey)
      this.metrics.evictions++
    }
  }

  private cleanup(): void {
    const now = new Date()
    const toDelete: string[] = []
    
    // Remove expired entries
    for (const [key, entry] of this.cache.entries()) {
      if (entry.metadata.expiresAt < now) {
        toDelete.push(key)
      }
    }
    
    for (const key of toDelete) {
      this.cache.delete(key)
    }
    
    // Evict if over limits
    while (this.cache.size > this.config.maxEntries || this.getCurrentSize() > this.config.maxSize * 1024 * 1024) {
      this.evictOldest()
    }
    
    if (toDelete.length > 0) {
      this.updateMetrics()
      this.saveToStorage()
    }
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup()
    }, this.config.cleanupInterval)
  }

  private stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
  }

  private saveToStorage(): void {
    if (typeof window !== 'undefined') {
      try {
        // Only save essential data to avoid localStorage limits
        const essentialData = {
          entries: Array.from(this.cache.entries()).slice(0, 100), // Limit to 100 entries
          metrics: this.metrics,
          timestamp: new Date().toISOString(),
        }
        
        localStorage.setItem('roomicor-ai-cache', JSON.stringify(essentialData))
      } catch (error) {
        console.error('Failed to save cache to storage:', error)
      }
    }
  }

  private loadFromStorage(): void {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('roomicor-ai-cache')
        if (stored) {
          const data = JSON.parse(stored)
          
          // Check if data is not too old (24 hours)
          if (data.timestamp && new Date(data.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000)) {
            if (data.entries) {
              for (const [key, entry] of data.entries) {
                // Validate entry before adding
                if (entry.metadata && entry.metadata.expiresAt) {
                  const expiresAt = new Date(entry.metadata.expiresAt)
                  if (expiresAt > new Date()) {
                    this.cache.set(key, {
                      ...entry,
                      metadata: {
                        ...entry.metadata,
                        timestamp: new Date(entry.metadata.timestamp),
                        expiresAt,
                        lastAccessed: new Date(entry.metadata.lastAccessed),
                      },
                    })
                  }
                }
              }
            }
            
            if (data.metrics) {
              this.metrics = { ...this.metrics, ...data.metrics }
            }
          }
        }
      } catch (error) {
        console.error('Failed to load cache from storage:', error)
      }
    }
  }
}

// Global cache instance
export const aiCache = new AICache({
  maxSize: 50, // 50MB
  defaultTTL: 30 * 60 * 1000, // 30 minutes
  enableCompression: true,
  enableMetrics: true,
})

// High-level caching utilities
export function cacheAIResponse<T>(
  input: any,
  response: T,
  modelId: string,
  operation: string,
  options?: {
    ttl?: number
    userId?: string
  }
): void {
  aiCache.set(input, response, modelId, operation, options)
}

export function getCachedAIResponse<T>(
  input: any,
  modelId: string,
  operation: string,
  userId?: string
): T | null {
  return aiCache.get<T>(input, modelId, operation, userId)
}

export function hasCachedResponse(
  input: any,
  modelId: string,
  operation: string,
  userId?: string
): boolean {
  return aiCache.has(input, modelId, operation, userId)
}

export function invalidateCache(pattern: {
  modelId?: string
  operation?: string
  userId?: string
  olderThan?: Date
}): number {
  return aiCache.invalidate(pattern)
}

export function getCacheMetrics(): CacheMetrics {
  return aiCache.getMetrics()
}

export function getCacheStatus() {
  return aiCache.getStatus()
}

// Cache decorator for functions
export function cached<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: {
    modelId: string
    operation: string
    ttl?: number
    keyGenerator?: (...args: Parameters<T>) => string
  }
): T {
  return (async (...args: Parameters<T>) => {
    const key = options.keyGenerator ? options.keyGenerator(...args) : JSON.stringify(args)
    
    // Check cache first
    const cached = getCachedAIResponse(key, options.modelId, options.operation)
    if (cached !== null) {
      return cached
    }
    
    // Execute function and cache result
    const result = await fn(...args)
    cacheAIResponse(key, result, options.modelId, options.operation, {
      ttl: options.ttl,
    })
    
    return result
  }) as T
}