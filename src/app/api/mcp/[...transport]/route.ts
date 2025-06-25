import { createMCPRouter } from '@vercel/mcp-adapter'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { NextRequest } from 'next/server'

// Create the MCP server with proper capabilities
const server = new Server({
  name: 'roomicor-mcp-server',
  version: '1.0.0',
}, {
  capabilities: {
    tools: {},
    resources: {},
    prompts: {},
  },
})

// Authentication middleware
function authenticate(req: NextRequest): boolean {
  if (!process.env.MCP_AUTH_TOKEN) {
    return true // Allow access if no auth token is configured
  }
  
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  
  return token === process.env.MCP_AUTH_TOKEN
}

// Define available tools
server.setRequestHandler('tools/list', async () => {
  return {
    tools: [
      {
        name: 'calculate',
        description: 'Perform basic mathematical calculations',
        inputSchema: {
          type: 'object',
          properties: {
            operation: {
              type: 'string',
              enum: ['add', 'subtract', 'multiply', 'divide', 'power', 'sqrt'],
              description: 'The mathematical operation to perform',
            },
            a: { 
              type: 'number',
              description: 'First operand',
            },
            b: { 
              type: 'number',
              description: 'Second operand (not required for sqrt)',
            },
          },
          required: ['operation', 'a'],
        },
      },
      {
        name: 'get_user_info',
        description: 'Get user information from the database',
        inputSchema: {
          type: 'object',
          properties: {
            userId: {
              type: 'string',
              description: 'The user ID to fetch information for',
            },
          },
          required: ['userId'],
        },
      },
      {
        name: 'format_text',
        description: 'Format text with various transformations',
        inputSchema: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'The text to format',
            },
            format: {
              type: 'string',
              enum: ['uppercase', 'lowercase', 'capitalize', 'reverse', 'snake_case', 'camelCase'],
              description: 'The formatting operation to apply',
            },
          },
          required: ['text', 'format'],
        },
      },
      {
        name: 'generate_uuid',
        description: 'Generate a UUID v4',
        inputSchema: {
          type: 'object',
          properties: {
            count: {
              type: 'number',
              description: 'Number of UUIDs to generate (default: 1)',
              minimum: 1,
              maximum: 10,
            },
          },
          required: [],
        },
      },
      {
        name: 'validate_email',
        description: 'Validate an email address format',
        inputSchema: {
          type: 'object',
          properties: {
            email: {
              type: 'string',
              description: 'The email address to validate',
            },
          },
          required: ['email'],
        },
      },
      {
        name: 'get_timestamp',
        description: 'Get current timestamp in various formats',
        inputSchema: {
          type: 'object',
          properties: {
            format: {
              type: 'string',
              enum: ['iso', 'unix', 'readable', 'utc'],
              description: 'The timestamp format to return',
            },
            timezone: {
              type: 'string',
              description: 'Timezone for readable format (e.g., "America/New_York")',
            },
          },
          required: ['format'],
        },
      },
    ],
  }
})

// Handle tool calls
server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params

  try {
    switch (name) {
      case 'calculate': {
        const { operation, a, b } = args
        let result: number
        
        switch (operation) {
          case 'add':
            if (b === undefined) throw new Error('Second operand required for addition')
            result = a + b
            break
          case 'subtract':
            if (b === undefined) throw new Error('Second operand required for subtraction')
            result = a - b
            break
          case 'multiply':
            if (b === undefined) throw new Error('Second operand required for multiplication')
            result = a * b
            break
          case 'divide':
            if (b === undefined) throw new Error('Second operand required for division')
            if (b === 0) throw new Error('Division by zero is not allowed')
            result = a / b
            break
          case 'power':
            if (b === undefined) throw new Error('Second operand required for power operation')
            result = Math.pow(a, b)
            break
          case 'sqrt':
            if (a < 0) throw new Error('Cannot calculate square root of negative number')
            result = Math.sqrt(a)
            break
          default:
            throw new Error(`Unknown operation: ${operation}`)
        }
        
        return {
          content: [
            {
              type: 'text',
              text: `Result: ${result}`,
            },
          ],
        }
      }
      
      case 'get_user_info': {
        const { userId } = args
        
        // Mock user data - in real app, fetch from database
        const mockUsers: Record<string, any> = {
          'user_1': {
            id: 'user_1',
            name: 'John Doe',
            email: 'john@example.com',
            role: 'admin',
            createdAt: '2024-01-01T00:00:00Z',
          },
          'user_2': {
            id: 'user_2',
            name: 'Jane Smith',
            email: 'jane@example.com',
            role: 'user',
            createdAt: '2024-01-15T00:00:00Z',
          },
        }
        
        const user = mockUsers[userId]
        if (!user) {
          throw new Error(`User not found: ${userId}`)
        }
        
        return {
          content: [
            {
              type: 'text',
              text: `User Information:\nID: ${user.id}\nName: ${user.name}\nEmail: ${user.email}\nRole: ${user.role}\nCreated: ${user.createdAt}`,
            },
          ],
        }
      }
      
      case 'format_text': {
        const { text, format } = args
        let result: string
        
        switch (format) {
          case 'uppercase':
            result = text.toUpperCase()
            break
          case 'lowercase':
            result = text.toLowerCase()
            break
          case 'capitalize':
            result = text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
            break
          case 'reverse':
            result = text.split('').reverse().join('')
            break
          case 'snake_case':
            result = text.toLowerCase().replace(/\s+/g, '_')
            break
          case 'camelCase':
            result = text.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
              return index === 0 ? word.toLowerCase() : word.toUpperCase()
            }).replace(/\s+/g, '')
            break
          default:
            throw new Error(`Unknown format: ${format}`)
        }
        
        return {
          content: [
            {
              type: 'text',
              text: `Formatted text (${format}): ${result}`,
            },
          ],
        }
      }
      
      case 'generate_uuid': {
        const count = args.count || 1
        const uuids: string[] = []
        
        for (let i = 0; i < count; i++) {
          // Simple UUID v4 generation
          const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0
            const v = c === 'x' ? r : (r & 0x3 | 0x8)
            return v.toString(16)
          })
          uuids.push(uuid)
        }
        
        return {
          content: [
            {
              type: 'text',
              text: `Generated UUID${count > 1 ? 's' : ''}:\n${uuids.join('\n')}`,
            },
          ],
        }
      }
      
      case 'validate_email': {
        const { email } = args
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        const isValid = emailRegex.test(email)
        
        return {
          content: [
            {
              type: 'text',
              text: `Email "${email}" is ${isValid ? 'valid' : 'invalid'}`,
            },
          ],
        }
      }
      
      case 'get_timestamp': {
        const { format, timezone } = args
        const now = new Date()
        let result: string
        
        switch (format) {
          case 'iso':
            result = now.toISOString()
            break
          case 'unix':
            result = Math.floor(now.getTime() / 1000).toString()
            break
          case 'readable':
            result = timezone 
              ? now.toLocaleString('en-US', { timeZone: timezone })
              : now.toLocaleString()
            break
          case 'utc':
            result = now.toUTCString()
            break
          default:
            throw new Error(`Unknown format: ${format}`)
        }
        
        return {
          content: [
            {
              type: 'text',
              text: `Timestamp (${format}): ${result}`,
            },
          ],
        }
      }
      
      default:
        throw new Error(`Unknown tool: ${name}`)
    }
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    }
  }
})

// Define available resources
server.setRequestHandler('resources/list', async () => {
  return {
    resources: [
      {
        uri: 'file:///app-config.json',
        name: 'Application Configuration',
        description: 'Current application configuration and settings',
        mimeType: 'application/json',
      },
      {
        uri: 'file:///user-stats.json',
        name: 'User Statistics',
        description: 'Current user statistics and metrics',
        mimeType: 'application/json',
      },
      {
        uri: 'file:///api-docs.md',
        name: 'API Documentation',
        description: 'API endpoint documentation',
        mimeType: 'text/markdown',
      },
      {
        uri: 'file:///system-status.json',
        name: 'System Status',
        description: 'Current system health and status',
        mimeType: 'application/json',
      },
    ],
  }
})

// Handle resource reads
server.setRequestHandler('resources/read', async (request) => {
  const { uri } = request.params
  
  try {
    switch (uri) {
      case 'file:///app-config.json':
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                appName: 'Roomicor',
                version: '1.0.0',
                environment: process.env.NODE_ENV || 'development',
                features: ['authentication', 'payments', 'automation', 'mcp'],
                integrations: {
                  clerk: true,
                  stripe: true,
                  supabase: true,
                  make: true,
                  n8n: true,
                  mcp: true,
                },
                lastUpdated: new Date().toISOString(),
              }, null, 2),
            },
          ],
        }
      
      case 'file:///user-stats.json':
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                totalUsers: 1250,
                activeUsers: 890,
                newUsersToday: 25,
                premiumUsers: 340,
                lastUpdated: new Date().toISOString(),
                breakdown: {
                  adminUsers: 5,
                  regularUsers: 1245,
                },
              }, null, 2),
            },
          ],
        }
      
      case 'file:///api-docs.md':
        return {
          contents: [
            {
              uri,
              mimeType: 'text/markdown',
              text: `# Roomicor API Documentation

## Available Endpoints

### Authentication
- \`POST /api/auth/sign-in\` - Sign in user
- \`POST /api/auth/sign-up\` - Sign up new user
- \`POST /api/auth/sign-out\` - Sign out user

### Payments
- \`POST /api/checkout\` - Create checkout session
- \`POST /api/webhooks/stripe\` - Handle Stripe webhooks

### Automation
- \`POST /api/make/webhook\` - Make.com webhook endpoint
- \`GET /api/make/data\` - Data API for Make.com
- \`POST /api/n8n/webhook\` - n8n webhook endpoint

### MCP
- \`GET/POST /api/mcp/[...transport]\` - Model Context Protocol server

## Usage Examples

\`\`\`bash
# Test MCP tools
curl -X POST http://localhost:3000/api/mcp/http \\
  -H "Content-Type: application/json" \\
  -d '{"method": "tools/call", "params": {"name": "calculate", "arguments": {"operation": "add", "a": 5, "b": 3}}}'
\`\`\`

Last updated: ${new Date().toISOString()}
`,
            },
          ],
        }
      
      case 'file:///system-status.json':
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                status: 'healthy',
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                services: {
                  database: 'connected',
                  authentication: 'active',
                  payments: 'active',
                  automation: 'active',
                  mcp: 'active',
                },
                lastCheck: new Date().toISOString(),
              }, null, 2),
            },
          ],
        }
      
      default:
        throw new Error(`Resource not found: ${uri}`)
    }
  } catch (error: any) {
    throw new Error(`Failed to read resource ${uri}: ${error.message}`)
  }
})

// Define available prompts
server.setRequestHandler('prompts/list', async () => {
  return {
    prompts: [
      {
        name: 'code_review',
        description: 'Review code for best practices and potential issues',
        arguments: [
          {
            name: 'language',
            description: 'Programming language (e.g., typescript, javascript, python)',
            required: true,
          },
          {
            name: 'code',
            description: 'Code to review',
            required: true,
          },
          {
            name: 'focus',
            description: 'Specific areas to focus on (security, performance, style, etc.)',
            required: false,
          },
        ],
      },
      {
        name: 'api_design',
        description: 'Design REST API endpoints',
        arguments: [
          {
            name: 'resource',
            description: 'The resource/entity to design API for',
            required: true,
          },
          {
            name: 'operations',
            description: 'Comma-separated list of operations (GET, POST, PUT, DELETE)',
            required: true,
          },
          {
            name: 'authentication',
            description: 'Authentication method (jwt, oauth, apikey, none)',
            required: false,
          },
        ],
      },
      {
        name: 'database_schema',
        description: 'Design database schema',
        arguments: [
          {
            name: 'entities',
            description: 'Comma-separated list of entities',
            required: true,
          },
          {
            name: 'relationships',
            description: 'Description of relationships between entities',
            required: false,
          },
          {
            name: 'database_type',
            description: 'Database type (postgresql, mysql, mongodb, etc.)',
            required: false,
          },
        ],
      },
    ],
  }
})

// Handle prompt generation
server.setRequestHandler('prompts/get', async (request) => {
  const { name, arguments: args } = request.params
  
  try {
    switch (name) {
      case 'code_review': {
        const { language, code, focus } = args
        const focusText = focus ? ` with special attention to ${focus}` : ''
        
        return {
          description: `Review ${language} code for best practices`,
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `Please review this ${language} code for best practices, potential issues, and improvements${focusText}:

\`\`\`${language}
${code}
\`\`\`

Please provide:
1. Overall code quality assessment
2. Specific issues found (if any)
3. Suggestions for improvement
4. Security considerations
5. Performance implications`,
              },
            },
          ],
        }
      }
      
      case 'api_design': {
        const { resource, operations, authentication } = args
        const authText = authentication ? ` using ${authentication} authentication` : ''
        
        return {
          description: `Design REST API for ${resource}`,
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `Design a REST API for the resource "${resource}" with the following operations: ${operations}${authText}.

Please provide:
1. Endpoint URLs and HTTP methods
2. Request/response payload structures
3. HTTP status codes for each endpoint
4. Error handling patterns
5. Authentication/authorization details
6. Rate limiting considerations
7. API documentation example`,
              },
            },
          ],
        }
      }
      
      case 'database_schema': {
        const { entities, relationships, database_type } = args
        const dbText = database_type ? ` for ${database_type}` : ''
        const relText = relationships ? `\n\nRelationships: ${relationships}` : ''
        
        return {
          description: `Design database schema for ${entities}`,
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `Design a database schema${dbText} for the following entities: ${entities}${relText}

Please provide:
1. Table structures with column definitions
2. Primary and foreign keys
3. Indexes for performance
4. Constraints and validations
5. Sample SQL DDL statements
6. Migration considerations
7. Performance optimization suggestions`,
              },
            },
          ],
        }
      }
      
      default:
        throw new Error(`Unknown prompt: ${name}`)
    }
  } catch (error: any) {
    throw new Error(`Failed to generate prompt ${name}: ${error.message}`)
  }
})

// Create the MCP router with authentication
export const { GET, POST } = createMCPRouter(server, {
  middleware: async (req: NextRequest) => {
    if (!authenticate(req)) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }
    return null // Continue to MCP handler
  }
})