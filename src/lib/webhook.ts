/**
 * Webhook Handling Utilities
 * Secure webhook processing with signature verification, retry logic, and event routing
 */

import crypto from 'crypto'
import { EventEmitter } from 'events'
import { createDatabaseService } from './database'

// Types for webhook handling
export interface WebhookConfig {
  endpoint: string
  secret: string
  signatureHeader: string
  signaturePrefix?: string
  algorithm: 'sha256' | 'sha1' | 'md5'
  encoding: 'hex' | 'base64'
  timeout: number
  retries: {
    maxAttempts: number
    delay: number
    backoffMultiplier: number
    maxDelay: number
  }
  security: {
    allowedIPs?: string[]
    requireHTTPS: boolean
    verifySignature: boolean
    validateTimestamp: boolean
    timestampTolerance: number // seconds
  }
}

export interface WebhookPayload {
  id: string
  event: string
  timestamp: Date
  data: any
  headers: Record<string, string>
  rawBody: string
  signature?: string
  metadata?: Record<string, any>
}

export interface WebhookHandler {
  event: string
  handler: (payload: WebhookPayload) => Promise<WebhookResponse>
  config?: {
    async?: boolean
    timeout?: number
    retryOnFailure?: boolean
  }
}

export interface WebhookResponse {
  success: boolean
  message?: string
  data?: any
  statusCode?: number
  headers?: Record<string, string>
}

export interface WebhookAttempt {
  id: string
  webhookId: string
  attempt: number
  timestamp: Date
  success: boolean
  responseTime: number
  statusCode?: number
  error?: string
  response?: any
}

export interface WebhookDelivery {
  id: string
  endpoint: string
  payload: WebhookPayload
  attempts: WebhookAttempt[]
  status: 'pending' | 'delivered' | 'failed' | 'cancelled'
  createdAt: Date
  updatedAt: Date
  nextRetryAt?: Date
  metadata?: Record<string, any>
}

export interface WebhookEvent {
  id: string
  name: string
  description: string
  schema?: {
    type: 'object'
    properties: Record<string, any>
    required?: string[]
  }
  examples?: any[]
}

/**
 * Webhook Handler
 * Processes incoming webhooks with signature verification and event routing
 */
export class WebhookHandler extends EventEmitter {
  private config: WebhookConfig
  private db: Awaited<ReturnType<typeof createDatabaseService>>
  private handlers: Map<string, WebhookHandler> = new Map()
  private pendingDeliveries: Map<string, WebhookDelivery> = new Map()
  private retryQueue: WebhookDelivery[] = []
  private retryTimer?: NodeJS.Timeout

  constructor(
    config: WebhookConfig,
    db: Awaited<ReturnType<typeof createDatabaseService>>
  ) {
    super()
    this.config = config
    this.db = db

    this.startRetryProcessor()
  }

  /**
   * Process incoming webhook
   */
  async processWebhook(
    rawBody: string,
    headers: Record<string, string>,
    sourceIP?: string
  ): Promise<WebhookResponse> {
    try {
      // Security checks
      await this.performSecurityChecks(rawBody, headers, sourceIP)

      // Parse payload
      const payload = await this.parseWebhookPayload(rawBody, headers)

      // Validate payload
      this.validatePayload(payload)

      // Route to appropriate handler
      const response = await this.routeToHandler(payload)

      // Log successful processing
      await this.logWebhookAttempt(payload, response, true)

      this.emit('webhookProcessed', { payload, response })
      
      return response
    } catch (error: any) {
      const errorResponse: WebhookResponse = {
        success: false,
        message: error.message,
        statusCode: error.statusCode || 400,
      }

      // Log failed processing
      await this.logWebhookAttempt(null, errorResponse, false, error.message)

      this.emit('webhookFailed', { error, rawBody, headers })
      
      return errorResponse
    }
  }

  /**
   * Send webhook to external endpoint
   */
  async sendWebhook(
    endpoint: string,
    payload: WebhookPayload,
    config?: Partial<WebhookConfig>
  ): Promise<WebhookDelivery> {
    const deliveryConfig = { ...this.config, ...config }
    
    const delivery: WebhookDelivery = {
      id: this.generateDeliveryId(),
      endpoint,
      payload,
      attempts: [],
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    this.pendingDeliveries.set(delivery.id, delivery)

    // Attempt delivery
    await this.attemptDelivery(delivery, deliveryConfig)

    return delivery
  }

  /**
   * Register webhook handler
   */
  registerHandler(handler: WebhookHandler): void {
    this.handlers.set(handler.event, handler)
    this.emit('handlerRegistered', handler.event)
  }

  /**
   * Unregister webhook handler
   */
  unregisterHandler(event: string): void {
    this.handlers.delete(event)
    this.emit('handlerUnregistered', event)
  }

  /**
   * Perform security checks
   */
  private async performSecurityChecks(
    rawBody: string,
    headers: Record<string, string>,
    sourceIP?: string
  ): Promise<void> {
    // IP whitelist check
    if (this.config.security.allowedIPs && sourceIP) {
      if (!this.config.security.allowedIPs.includes(sourceIP)) {
        throw new WebhookError(`IP ${sourceIP} not allowed`, 403)
      }
    }

    // HTTPS requirement
    if (this.config.security.requireHTTPS) {
      const protocol = headers['x-forwarded-proto'] || headers['x-scheme'] || 'http'
      if (protocol !== 'https') {
        throw new WebhookError('HTTPS required', 400)
      }
    }

    // Signature verification
    if (this.config.security.verifySignature) {
      await this.verifySignature(rawBody, headers)
    }

    // Timestamp validation
    if (this.config.security.validateTimestamp) {
      await this.validateTimestamp(headers)
    }
  }

  /**
   * Verify webhook signature
   */
  private async verifySignature(rawBody: string, headers: Record<string, string>): Promise<void> {
    const signature = headers[this.config.signatureHeader.toLowerCase()]
    
    if (!signature) {
      throw new WebhookError(`Missing signature header: ${this.config.signatureHeader}`, 401)
    }

    // Remove prefix if present
    const cleanSignature = this.config.signaturePrefix 
      ? signature.replace(this.config.signaturePrefix, '')
      : signature

    // Calculate expected signature
    const expectedSignature = crypto
      .createHmac(this.config.algorithm, this.config.secret)
      .update(rawBody, 'utf8')
      .digest(this.config.encoding)

    // Compare signatures
    if (!crypto.timingSafeEqual(
      Buffer.from(cleanSignature),
      Buffer.from(expectedSignature)
    )) {
      throw new WebhookError('Invalid signature', 401)
    }
  }

  /**
   * Validate timestamp
   */
  private async validateTimestamp(headers: Record<string, string>): Promise<void> {
    const timestampHeader = headers['x-timestamp'] || headers['timestamp']
    
    if (!timestampHeader) {
      throw new WebhookError('Missing timestamp header', 400)
    }

    const timestamp = parseInt(timestampHeader, 10)
    const now = Math.floor(Date.now() / 1000)
    const difference = Math.abs(now - timestamp)

    if (difference > this.config.security.timestampTolerance) {
      throw new WebhookError('Timestamp too old or too far in future', 400)
    }
  }

  /**
   * Parse webhook payload
   */
  private async parseWebhookPayload(
    rawBody: string,
    headers: Record<string, string>
  ): Promise<WebhookPayload> {
    let data: any

    try {
      // Try to parse as JSON
      data = JSON.parse(rawBody)
    } catch (error) {
      // If not JSON, try form data
      if (headers['content-type']?.includes('application/x-www-form-urlencoded')) {
        data = this.parseFormData(rawBody)
      } else {
        // Keep as raw string
        data = rawBody
      }
    }

    return {
      id: this.generatePayloadId(),
      event: this.extractEventName(data, headers),
      timestamp: new Date(),
      data,
      headers,
      rawBody,
      signature: headers[this.config.signatureHeader.toLowerCase()],
    }
  }

  /**
   * Parse form data
   */
  private parseFormData(body: string): Record<string, any> {
    const params = new URLSearchParams(body)
    const result: Record<string, any> = {}
    
    for (const [key, value] of params.entries()) {
      result[key] = value
    }
    
    return result
  }

  /**
   * Extract event name from payload
   */
  private extractEventName(data: any, headers: Record<string, string>): string {
    // Try various common event fields
    if (data && typeof data === 'object') {
      return data.event || data.type || data.event_type || data.action || 'unknown'
    }
    
    // Try header
    return headers['x-event-type'] || headers['event-type'] || 'unknown'
  }

  /**
   * Validate payload
   */
  private validatePayload(payload: WebhookPayload): void {
    if (!payload.event) {
      throw new WebhookError('Missing event type', 400)
    }

    if (!payload.data) {
      throw new WebhookError('Missing payload data', 400)
    }
  }

  /**
   * Route payload to appropriate handler
   */
  private async routeToHandler(payload: WebhookPayload): Promise<WebhookResponse> {
    // Try exact event match first
    let handler = this.handlers.get(payload.event)
    
    // Try wildcard handler
    if (!handler) {
      handler = this.handlers.get('*')
    }

    if (!handler) {
      throw new WebhookError(`No handler found for event: ${payload.event}`, 404)
    }

    // Execute handler
    try {
      const startTime = Date.now()
      
      if (handler.config?.async) {
        // Execute asynchronously
        this.executeHandlerAsync(handler, payload)
        return {
          success: true,
          message: 'Webhook queued for processing',
          statusCode: 202,
        }
      } else {
        // Execute synchronously with timeout
        const response = await this.executeHandlerWithTimeout(handler, payload)
        const processingTime = Date.now() - startTime
        
        this.emit('handlerExecuted', {
          event: payload.event,
          processingTime,
          success: response.success,
        })
        
        return response
      }
    } catch (error: any) {
      throw new WebhookError(`Handler execution failed: ${error.message}`, 500)
    }
  }

  /**
   * Execute handler with timeout
   */
  private async executeHandlerWithTimeout(
    handler: WebhookHandler,
    payload: WebhookPayload
  ): Promise<WebhookResponse> {
    const timeout = handler.config?.timeout || this.config.timeout

    return Promise.race([
      handler.handler(payload),
      new Promise<WebhookResponse>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Handler timeout'))
        }, timeout)
      }),
    ])
  }

  /**
   * Execute handler asynchronously
   */
  private async executeHandlerAsync(
    handler: WebhookHandler,
    payload: WebhookPayload
  ): Promise<void> {
    try {
      const response = await handler.handler(payload)
      this.emit('asyncHandlerCompleted', {
        event: payload.event,
        response,
      })
    } catch (error: any) {
      this.emit('asyncHandlerFailed', {
        event: payload.event,
        error: error.message,
      })

      // Retry if configured
      if (handler.config?.retryOnFailure) {
        // Add to retry queue
        // Implementation would go here
      }
    }
  }

  /**
   * Attempt webhook delivery
   */
  private async attemptDelivery(
    delivery: WebhookDelivery,
    config: WebhookConfig
  ): Promise<void> {
    const attempt: WebhookAttempt = {
      id: this.generateAttemptId(),
      webhookId: delivery.id,
      attempt: delivery.attempts.length + 1,
      timestamp: new Date(),
      success: false,
      responseTime: 0,
    }

    const startTime = Date.now()

    try {
      // Prepare request
      const body = JSON.stringify(delivery.payload.data)
      const signature = this.generateSignature(body, config.secret, config.algorithm)
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'Roomicor-Webhook/1.0',
        'X-Webhook-ID': delivery.id,
        'X-Webhook-Attempt': attempt.attempt.toString(),
        'X-Timestamp': Math.floor(Date.now() / 1000).toString(),
      }

      if (config.signatureHeader) {
        headers[config.signatureHeader] = config.signaturePrefix 
          ? `${config.signaturePrefix}${signature}`
          : signature
      }

      // Send request
      const response = await fetch(delivery.endpoint, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(config.timeout),
      })

      attempt.responseTime = Date.now() - startTime
      attempt.statusCode = response.status
      attempt.success = response.ok

      if (response.ok) {
        delivery.status = 'delivered'
        attempt.response = await response.text()
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

    } catch (error: any) {
      attempt.responseTime = Date.now() - startTime
      attempt.error = error.message
      attempt.success = false

      // Schedule retry if not max attempts
      if (delivery.attempts.length < config.retries.maxAttempts - 1) {
        delivery.status = 'pending'
        delivery.nextRetryAt = this.calculateNextRetry(
          delivery.attempts.length + 1,
          config.retries
        )
        this.scheduleRetry(delivery)
      } else {
        delivery.status = 'failed'
      }
    }

    delivery.attempts.push(attempt)
    delivery.updatedAt = new Date()

    // Store delivery record
    await this.storeDeliveryRecord(delivery)
  }

  /**
   * Generate signature for outgoing webhook
   */
  private generateSignature(body: string, secret: string, algorithm: string): string {
    return crypto
      .createHmac(algorithm, secret)
      .update(body, 'utf8')
      .digest('hex')
  }

  /**
   * Calculate next retry time
   */
  private calculateNextRetry(
    attempt: number,
    retryConfig: WebhookConfig['retries']
  ): Date {
    const delay = Math.min(
      retryConfig.delay * Math.pow(retryConfig.backoffMultiplier, attempt - 1),
      retryConfig.maxDelay
    )
    
    return new Date(Date.now() + delay)
  }

  /**
   * Schedule retry
   */
  private scheduleRetry(delivery: WebhookDelivery): void {
    if (!this.retryQueue.includes(delivery)) {
      this.retryQueue.push(delivery)
    }
  }

  /**
   * Start retry processor
   */
  private startRetryProcessor(): void {
    this.retryTimer = setInterval(() => {
      this.processRetryQueue()
    }, 60000) // Check every minute
  }

  /**
   * Process retry queue
   */
  private async processRetryQueue(): Promise<void> {
    const now = new Date()
    const readyForRetry = this.retryQueue.filter(
      delivery => delivery.nextRetryAt && delivery.nextRetryAt <= now
    )

    for (const delivery of readyForRetry) {
      this.retryQueue = this.retryQueue.filter(d => d.id !== delivery.id)
      await this.attemptDelivery(delivery, this.config)
    }
  }

  /**
   * Log webhook attempt
   */
  private async logWebhookAttempt(
    payload: WebhookPayload | null,
    response: WebhookResponse,
    success: boolean,
    error?: string
  ): Promise<void> {
    try {
      // In a real implementation, this would log to database
      const logEntry = {
        timestamp: new Date(),
        event: payload?.event || 'unknown',
        success,
        statusCode: response.statusCode || 200,
        error,
        responseTime: 0, // Would be calculated
      }

      console.log('Webhook Log:', logEntry)
    } catch (logError) {
      console.warn('Failed to log webhook attempt:', logError)
    }
  }

  /**
   * Store delivery record
   */
  private async storeDeliveryRecord(delivery: WebhookDelivery): Promise<void> {
    try {
      // In a real implementation, this would store in database
      // For now, just emit event
      this.emit('deliveryRecorded', delivery)
    } catch (error) {
      console.warn('Failed to store delivery record:', error)
    }
  }

  /**
   * Utility methods
   */
  private generatePayloadId(): string {
    return `wh_payload_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  private generateDeliveryId(): string {
    return `wh_delivery_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  private generateAttemptId(): string {
    return `wh_attempt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  /**
   * Public methods
   */
  getHandlers(): string[] {
    return Array.from(this.handlers.keys())
  }

  getPendingDeliveries(): WebhookDelivery[] {
    return Array.from(this.pendingDeliveries.values())
  }

  getRetryQueue(): WebhookDelivery[] {
    return [...this.retryQueue]
  }

  cancelDelivery(deliveryId: string): void {
    const delivery = this.pendingDeliveries.get(deliveryId)
    if (delivery) {
      delivery.status = 'cancelled'
      this.pendingDeliveries.delete(deliveryId)
      this.retryQueue = this.retryQueue.filter(d => d.id !== deliveryId)
    }
  }

  cleanup(): void {
    if (this.retryTimer) {
      clearInterval(this.retryTimer)
    }
    this.pendingDeliveries.clear()
    this.retryQueue = []
    this.handlers.clear()
  }
}

/**
 * Webhook Error class
 */
export class WebhookError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public code?: string
  ) {
    super(message)
    this.name = 'WebhookError'
  }
}

/**
 * Webhook Router
 * Routes webhooks to different handlers based on source
 */
export class WebhookRouter extends EventEmitter {
  private routes: Map<string, WebhookHandler> = new Map()

  /**
   * Add route for specific source
   */
  addRoute(source: string, handler: WebhookHandler): void {
    this.routes.set(source, handler)
    this.emit('routeAdded', source)
  }

  /**
   * Remove route
   */
  removeRoute(source: string): void {
    this.routes.delete(source)
    this.emit('routeRemoved', source)
  }

  /**
   * Route webhook to appropriate handler
   */
  async route(source: string, ...args: Parameters<WebhookHandler['processWebhook']>): Promise<WebhookResponse> {
    const handler = this.routes.get(source)
    
    if (!handler) {
      throw new WebhookError(`No route found for source: ${source}`, 404)
    }

    return handler.processWebhook(...args)
  }

  /**
   * Get available routes
   */
  getRoutes(): string[] {
    return Array.from(this.routes.keys())
  }
}

/**
 * Factory functions
 */
export async function createWebhookHandler(config: WebhookConfig): Promise<WebhookHandler> {
  const db = await createDatabaseService()
  return new WebhookHandler(config, db)
}

export function createWebhookRouter(): WebhookRouter {
  return new WebhookRouter()
}

/**
 * Default configurations
 */
export const defaultWebhookConfig: WebhookConfig = {
  endpoint: '',
  secret: '',
  signatureHeader: 'x-hub-signature-256',
  signaturePrefix: 'sha256=',
  algorithm: 'sha256',
  encoding: 'hex',
  timeout: 30000,
  retries: {
    maxAttempts: 3,
    delay: 1000,
    backoffMultiplier: 2,
    maxDelay: 60000,
  },
  security: {
    requireHTTPS: true,
    verifySignature: true,
    validateTimestamp: false,
    timestampTolerance: 300, // 5 minutes
  },
}

/**
 * Common webhook configurations
 */
export const WebhookConfigs = {
  stripe: (secret: string): WebhookConfig => ({
    ...defaultWebhookConfig,
    secret,
    signatureHeader: 'stripe-signature',
    signaturePrefix: 't=',
    security: {
      ...defaultWebhookConfig.security,
      validateTimestamp: true,
    },
  }),

  github: (secret: string): WebhookConfig => ({
    ...defaultWebhookConfig,
    secret,
    signatureHeader: 'x-hub-signature-256',
    signaturePrefix: 'sha256=',
  }),

  shopify: (secret: string): WebhookConfig => ({
    ...defaultWebhookConfig,
    secret,
    signatureHeader: 'x-shopify-hmac-sha256',
    signaturePrefix: '',
    encoding: 'base64',
  }),

  slack: (secret: string): WebhookConfig => ({
    ...defaultWebhookConfig,
    secret,
    signatureHeader: 'x-slack-signature',
    signaturePrefix: 'v0=',
    security: {
      ...defaultWebhookConfig.security,
      validateTimestamp: true,
      timestampTolerance: 300,
    },
  }),
}

// Export types
export type {
  WebhookConfig,
  WebhookPayload,
  WebhookHandler as WebhookHandlerConfig,
  WebhookResponse,
  WebhookAttempt,
  WebhookDelivery,
  WebhookEvent,
}