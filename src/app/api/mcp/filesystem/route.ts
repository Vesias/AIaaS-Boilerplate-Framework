/**
 * MCP File System Server
 * Provides secure file operations through Model Context Protocol
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { promises as fs } from 'fs'
import path from 'path'
import { z } from 'zod'

// Types for MCP protocol
interface MCPRequest {
  jsonrpc: '2.0'
  id: string | number
  method: string
  params?: any
}

interface MCPResponse {
  jsonrpc: '2.0'
  id: string | number
  result?: any
  error?: {
    code: number
    message: string
    data?: any
  }
}

// Validation schemas
const ReadFileSchema = z.object({
  path: z.string().min(1),
})

const WriteFileSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
})

const ListFilesSchema = z.object({
  path: z.string().min(1),
  pattern: z.string().optional(),
})

// Safe path validation to prevent directory traversal
function validatePath(filePath: string): string {
  const safePath = path.normalize(filePath)
  
  // Ensure we're staying within allowed directories
  const allowedPaths = [
    '/tmp/roomicor',
    '/app/data/user-files',
    './user-uploads',
  ]
  
  let isAllowed = false
  for (const allowed of allowedPaths) {
    if (safePath.startsWith(allowed)) {
      isAllowed = true
      break
    }
  }
  
  if (!isAllowed) {
    throw new Error('Access denied: Path not allowed')
  }
  
  return safePath
}

// MCP tool definitions
const TOOLS = [
  {
    name: 'read_file',
    description: 'Read the contents of a file',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file to read',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Write content to a file',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file to write',
        },
        content: {
          type: 'string',
          description: 'Content to write to the file',
        },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'list_files',
    description: 'List files in a directory',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Directory path to list',
        },
        pattern: {
          type: 'string',
          description: 'Optional glob pattern to filter files',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'create_directory',
    description: 'Create a directory',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Directory path to create',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'delete_file',
    description: 'Delete a file or directory',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file or directory to delete',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'file_info',
    description: 'Get information about a file or directory',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to get information about',
        },
      },
      required: ['path'],
    },
  },
]

// Handle MCP requests
async function handleMCPRequest(request: MCPRequest): Promise<MCPResponse> {
  try {
    // Verify authentication
    const { userId } = await auth()
    if (!userId) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32603,
          message: 'Authentication required',
        },
      }
    }

    switch (request.method) {
      case 'initialize':
        return {
          jsonrpc: '2.0',
          id: request.id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {},
            },
            serverInfo: {
              name: 'Roomicor File System MCP Server',
              version: '1.0.0',
            },
          },
        }

      case 'tools/list':
        return {
          jsonrpc: '2.0',
          id: request.id,
          result: {
            tools: TOOLS,
          },
        }

      case 'tools/call':
        return await handleToolCall(request.id, request.params)

      default:
        return {
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: -32601,
            message: `Method not found: ${request.method}`,
          },
        }
    }
  } catch (error: any) {
    return {
      jsonrpc: '2.0',
      id: request.id,
      error: {
        code: -32603,
        message: error.message || 'Internal error',
      },
    }
  }
}

// Handle tool calls
async function handleToolCall(id: string | number, params: any): Promise<MCPResponse> {
  const { name, arguments: args } = params

  try {
    switch (name) {
      case 'read_file': {
        const { path: filePath } = ReadFileSchema.parse(args)
        const safePath = validatePath(filePath)
        
        const content = await fs.readFile(safePath, 'utf-8')
        
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: content,
            mimeType: 'text/plain',
            size: Buffer.byteLength(content, 'utf-8'),
          },
        }
      }

      case 'write_file': {
        const { path: filePath, content } = WriteFileSchema.parse(args)
        const safePath = validatePath(filePath)
        
        // Ensure directory exists
        const dir = path.dirname(safePath)
        await fs.mkdir(dir, { recursive: true })
        
        await fs.writeFile(safePath, content, 'utf-8')
        
        return {
          jsonrpc: '2.0',
          id,
          result: {
            success: true,
            path: safePath,
            size: Buffer.byteLength(content, 'utf-8'),
          },
        }
      }

      case 'list_files': {
        const { path: dirPath, pattern } = ListFilesSchema.parse(args)
        const safePath = validatePath(dirPath)
        
        const entries = await fs.readdir(safePath, { withFileTypes: true })
        
        let files = entries.map(entry => ({
          name: entry.name,
          path: path.join(safePath, entry.name),
          type: entry.isDirectory() ? 'directory' : 'file',
          isDirectory: entry.isDirectory(),
          isFile: entry.isFile(),
        }))
        
        // Apply pattern filter if provided
        if (pattern) {
          const regex = new RegExp(pattern.replace(/\*/g, '.*'))
          files = files.filter(file => regex.test(file.name))
        }
        
        return {
          jsonrpc: '2.0',
          id,
          result: {
            files,
            count: files.length,
          },
        }
      }

      case 'create_directory': {
        const { path: dirPath } = z.object({ path: z.string() }).parse(args)
        const safePath = validatePath(dirPath)
        
        await fs.mkdir(safePath, { recursive: true })
        
        return {
          jsonrpc: '2.0',
          id,
          result: {
            success: true,
            path: safePath,
          },
        }
      }

      case 'delete_file': {
        const { path: filePath } = z.object({ path: z.string() }).parse(args)
        const safePath = validatePath(filePath)
        
        const stats = await fs.stat(safePath)
        
        if (stats.isDirectory()) {
          await fs.rmdir(safePath, { recursive: true })
        } else {
          await fs.unlink(safePath)
        }
        
        return {
          jsonrpc: '2.0',
          id,
          result: {
            success: true,
            path: safePath,
            type: stats.isDirectory() ? 'directory' : 'file',
          },
        }
      }

      case 'file_info': {
        const { path: filePath } = z.object({ path: z.string() }).parse(args)
        const safePath = validatePath(filePath)
        
        const stats = await fs.stat(safePath)
        
        return {
          jsonrpc: '2.0',
          id,
          result: {
            path: safePath,
            size: stats.size,
            type: stats.isDirectory() ? 'directory' : 'file',
            isDirectory: stats.isDirectory(),
            isFile: stats.isFile(),
            created: stats.birthtime.toISOString(),
            modified: stats.mtime.toISOString(),
            accessed: stats.atime.toISOString(),
            permissions: stats.mode,
          },
        }
      }

      default:
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32601,
            message: `Tool not found: ${name}`,
          },
        }
    }
  } catch (error: any) {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: -32603,
        message: error.message || 'Tool execution failed',
        data: {
          tool: name,
          arguments: args,
        },
      },
    }
  }
}

// HTTP handlers
export async function GET(request: NextRequest) {
  return NextResponse.json({
    name: 'Roomicor File System MCP Server',
    version: '1.0.0',
    description: 'Secure file system operations for AI agents',
    capabilities: ['tools'],
    tools: TOOLS.map(tool => ({
      name: tool.name,
      description: tool.description,
    })),
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Handle single request
    if (body.jsonrpc) {
      const response = await handleMCPRequest(body)
      return NextResponse.json(response)
    }
    
    // Handle batch requests
    if (Array.isArray(body)) {
      const responses = await Promise.all(
        body.map(req => handleMCPRequest(req))
      )
      return NextResponse.json(responses)
    }
    
    return NextResponse.json({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32600,
        message: 'Invalid request format',
      },
    }, { status: 400 })
    
  } catch (error: any) {
    return NextResponse.json({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32700,
        message: 'Parse error',
        data: error.message,
      },
    }, { status: 400 })
  }
}