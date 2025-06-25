import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'

export interface MCPClientConfig {
  serverUrl: string
  authToken?: string
  timeout?: number
}

export interface MCPToolCall {
  name: string
  arguments: Record<string, any>
}

export interface MCPToolResult {
  content: Array<{
    type: 'text'
    text: string
  }>
  isError?: boolean
}

export interface MCPResource {
  uri: string
  name: string
  description: string
  mimeType: string
}

export interface MCPPrompt {
  name: string
  description: string
  arguments: Array<{
    name: string
    description: string
    required: boolean
  }>
}

export class MCPClient {
  private client: Client | null = null
  private transport: SSEClientTransport | null = null
  private config: MCPClientConfig

  constructor(config: MCPClientConfig) {
    this.config = config
  }

  async connect(): Promise<void> {
    if (this.client) {
      await this.disconnect()
    }

    try {
      // Create SSE transport
      this.transport = new SSEClientTransport({
        url: this.config.serverUrl,
        headers: {
          ...(this.config.authToken && {
            'Authorization': `Bearer ${this.config.authToken}`
          }),
        },
      })

      // Create client
      this.client = new Client({
        name: 'roomicor-mcp-client',
        version: '1.0.0',
      }, {
        capabilities: {
          roots: {
            listChanged: true,
          },
          sampling: {},
        },
      })

      // Connect to the MCP server
      await this.client.connect(this.transport)
    } catch (error: any) {
      throw new Error(`Failed to connect to MCP server: ${error.message}`)
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.close()
      } catch (error) {
        console.warn('Error closing MCP client:', error)
      }
      this.client = null
    }
    
    if (this.transport) {
      try {
        await this.transport.close()
      } catch (error) {
        console.warn('Error closing MCP transport:', error)
      }
      this.transport = null
    }
  }

  private ensureConnected(): void {
    if (!this.client) {
      throw new Error('MCP client is not connected. Call connect() first.')
    }
  }

  async listTools(): Promise<any[]> {
    this.ensureConnected()
    
    try {
      const response = await this.client!.request('tools/list', {})
      return response.tools || []
    } catch (error: any) {
      throw new Error(`Failed to list tools: ${error.message}`)
    }
  }

  async callTool(name: string, arguments_: Record<string, any>): Promise<MCPToolResult> {
    this.ensureConnected()
    
    try {
      const response = await this.client!.request('tools/call', {
        name,
        arguments: arguments_,
      })
      
      return {
        content: response.content || [],
        isError: response.isError || false,
      }
    } catch (error: any) {
      throw new Error(`Failed to call tool "${name}": ${error.message}`)
    }
  }

  async listResources(): Promise<MCPResource[]> {
    this.ensureConnected()
    
    try {
      const response = await this.client!.request('resources/list', {})
      return response.resources || []
    } catch (error: any) {
      throw new Error(`Failed to list resources: ${error.message}`)
    }
  }

  async readResource(uri: string): Promise<any> {
    this.ensureConnected()
    
    try {
      const response = await this.client!.request('resources/read', { uri })
      return response.contents || []
    } catch (error: any) {
      throw new Error(`Failed to read resource "${uri}": ${error.message}`)
    }
  }

  async listPrompts(): Promise<MCPPrompt[]> {
    this.ensureConnected()
    
    try {
      const response = await this.client!.request('prompts/list', {})
      return response.prompts || []
    } catch (error: any) {
      throw new Error(`Failed to list prompts: ${error.message}`)
    }
  }

  async getPrompt(name: string, arguments_: Record<string, any>): Promise<any> {
    this.ensureConnected()
    
    try {
      const response = await this.client!.request('prompts/get', {
        name,
        arguments: arguments_,
      })
      return response
    } catch (error: any) {
      throw new Error(`Failed to get prompt "${name}": ${error.message}`)
    }
  }

  isConnected(): boolean {
    return this.client !== null
  }
}

// Factory function to create MCP client
export async function createMCPClient(config: MCPClientConfig): Promise<MCPClient> {
  const client = new MCPClient(config)
  await client.connect()
  return client
}

// Utility functions for common operations
export async function quickToolCall(
  serverUrl: string, 
  toolName: string, 
  arguments_: Record<string, any>,
  authToken?: string
): Promise<MCPToolResult> {
  const client = await createMCPClient({ serverUrl, authToken })
  
  try {
    return await client.callTool(toolName, arguments_)
  } finally {
    await client.disconnect()
  }
}

export async function quickResourceRead(
  serverUrl: string,
  uri: string,
  authToken?: string
): Promise<any> {
  const client = await createMCPClient({ serverUrl, authToken })
  
  try {
    return await client.readResource(uri)
  } finally {
    await client.disconnect()
  }
}

export async function quickPromptGet(
  serverUrl: string,
  promptName: string,
  arguments_: Record<string, any>,
  authToken?: string
): Promise<any> {
  const client = await createMCPClient({ serverUrl, authToken })
  
  try {
    return await client.getPrompt(promptName, arguments_)
  } finally {
    await client.disconnect()
  }
}

// Pre-configured client for local development
export function createLocalMCPClient(): Promise<MCPClient> {
  const serverUrl = process.env.NEXT_PUBLIC_APP_URL 
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api/mcp/sse`
    : 'http://localhost:3000/api/mcp/sse'
    
  return createMCPClient({
    serverUrl,
    authToken: process.env.MCP_AUTH_TOKEN,
  })
}

// Error handling utilities
export class MCPError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: any
  ) {
    super(message)
    this.name = 'MCPError'
  }
}

export function isMCPError(error: any): error is MCPError {
  return error instanceof MCPError
}

// Connection pool for managing multiple clients
export class MCPClientPool {
  private clients: Map<string, MCPClient> = new Map()
  
  async getClient(config: MCPClientConfig): Promise<MCPClient> {
    const key = `${config.serverUrl}:${config.authToken || 'none'}`
    
    if (this.clients.has(key)) {
      const client = this.clients.get(key)!
      if (client.isConnected()) {
        return client
      } else {
        // Reconnect if disconnected
        await client.connect()
        return client
      }
    }
    
    const client = await createMCPClient(config)
    this.clients.set(key, client)
    return client
  }
  
  async closeAll(): Promise<void> {
    const promises = Array.from(this.clients.values()).map(client => 
      client.disconnect().catch(console.warn)
    )
    
    await Promise.all(promises)
    this.clients.clear()
  }
  
  async closeClient(config: MCPClientConfig): Promise<void> {
    const key = `${config.serverUrl}:${config.authToken || 'none'}`
    const client = this.clients.get(key)
    
    if (client) {
      await client.disconnect()
      this.clients.delete(key)
    }
  }
}

// Global client pool instance
export const globalMCPClientPool = new MCPClientPool()

// Cleanup on process exit
if (typeof process !== 'undefined') {
  process.on('exit', () => {
    globalMCPClientPool.closeAll().catch(console.warn)
  })
  
  process.on('SIGINT', () => {
    globalMCPClientPool.closeAll().catch(console.warn)
    process.exit()
  })
}