# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

### Development
```bash
pnpm dev                 # Start development server (uses --turbopack)
pnpm build              # Build for production
pnpm start              # Start production server
pnpm lint               # Run ESLint
pnpm type-check         # Run TypeScript checks
```

### Docker Development
```bash
pnpm docker:dev         # Start development environment with docker-compose
pnpm docker:prod        # Start production environment
pnpm docker:build       # Build Docker image
pnpm docker:run         # Run Docker container
```

### Testing and Quality
```bash
pnpm test               # Run tests (placeholder - no tests specified yet)
```

## Architecture Overview

This is a modern AIaaS (AI-as-a-Service) boilerplate built with Next.js 15, featuring:

### Core Stack
- **Framework**: Next.js 15 with App Router and Turbopack
- **Language**: TypeScript with strict configuration
- **Authentication**: Clerk with Supabase sync via webhooks
- **Database**: Supabase (PostgreSQL) with Row Level Security
- **Payments**: Stripe with European VAT compliance
- **Styling**: Tailwind CSS with shadcn/ui components

### AI & Automation Integrations
- **CopilotKit**: AI chat assistant with custom actions (`src/lib/copilot.ts`)
- **AG-UI Protocol**: Official @ag-ui/client implementation (`src/types/ag-ui.ts`, API at `/api/agui/protocol`)
- **Model Context Protocol (MCP)**: Advanced AI tool execution
- **Google A2A Protocol**: Agent-to-agent communication
- **n8n Integration**: Visual workflow automation (`src/lib/n8n.ts`)
- **Make.com Integration**: Advanced scenario automation

### Key Architecture Patterns

#### Authentication Flow
- Clerk handles frontend auth, webhooks sync to Supabase
- Middleware (`middleware.ts`) protects routes and checks subscription status
- User profiles stored in `profiles` table with Clerk user ID as primary key

#### Database Layer
- `src/lib/database.ts` provides a DatabaseService class with typed methods
- All database operations use Supabase client with RLS policies
- Schema defined in `supabase/schema.sql` with proper foreign key relationships

#### Payment Processing
- Stripe integration in `src/lib/stripe.ts` with server/client split
- Webhooks handle subscription lifecycle at `/api/webhooks/stripe`
- Invoice generation with custom PDF support

#### AI Protocol Implementation
- AG-UI: Real protocol implementation using @ag-ui/client SDK
- Streaming responses via Server-Sent Events
- Session management with threadId/runId tracking
- Multiple agent templates (chat-assistant, task-manager, workflow-builder, invoice-specialist)

## Project Structure

### Key Directories
- `src/app/` - Next.js app router pages and API routes
- `src/components/` - React components (UI components in `ui/` subfolder)
- `src/lib/` - Core business logic and integrations
- `src/types/` - TypeScript type definitions
- `src/hooks/` - Custom React hooks
- `src/providers/` - React context providers

### Important Files
- `middleware.ts` - Route protection and subscription checking
- `src/lib/database.ts` - Database service layer with typed operations
- `src/lib/stripe.ts` - Payment processing utilities
- `src/types/ag-ui.ts` - AG-UI protocol types and implementations
- `supabase/schema.sql` - Database schema with RLS policies

## Environment Configuration

Required environment variables are documented in the README. Key categories:
- **App**: NEXT_PUBLIC_APP_URL, NODE_ENV
- **Auth**: Clerk keys and webhook secrets
- **Database**: Supabase URLs and keys
- **Payments**: Stripe keys and webhook secrets
- **AI**: OpenAI API key, CopilotKit runtime URL
- **Automation**: n8n and Make.com configuration

## Development Workflow

### Webhook Setup
Configure these webhook endpoints in service dashboards:
- Clerk: `/api/webhooks/clerk`
- Stripe: `/api/webhooks/stripe`
- n8n: `/api/webhooks/n8n`
- Make.com: `/api/webhooks/make`

### AI Integration Development
- AG-UI protocol follows official @ag-ui/client specification
- CopilotKit actions are defined in `src/lib/copilot.ts` with proper typing
- Stream responses use Server-Sent Events for real-time interaction
- Custom agents can be added to AgentTemplates in `src/types/ag-ui.ts`

### Database Operations
- Use DatabaseService class methods instead of raw queries
- All operations return typed results or null on error
- Error handling is built into service methods
- RLS policies ensure data isolation between users

## Security Considerations

- Row Level Security (RLS) enabled on all user data tables
- Webhook signature validation for all external services
- User authentication required for all protected routes
- Middleware enforces subscription status for dashboard access
- API routes validate user ownership of resources

## Deployment

- Supports Docker deployment with multi-stage builds
- Production configuration in `next.config.ts`
- Vercel deployment ready with proper environment variable setup
- Health check endpoint at `/api/health`

## Common Patterns

### Adding a New AI Action
1. Define action in `src/lib/copilot.ts` using registerAction()
2. Include proper parameter validation and error handling
3. Return structured response with success/error status
4. Emit events for tracking and analytics

### Adding Database Operations
1. Define TypeScript interface in `src/lib/database.ts`
2. Add method to DatabaseService class with proper error handling
3. Use typed return values (T | null pattern)
4. Include appropriate database indexes for performance

### Integrating External Services
1. Create client library in `src/lib/`
2. Add webhook handler in `src/app/api/webhooks/`
3. Define types in `src/types/`
4. Add environment variables and validation

## Testing Strategy

Currently no test framework is configured. When implementing tests:
- Use the existing TypeScript configuration
- Test API routes with proper authentication
- Mock external service calls (Stripe, n8n, etc.)
- Test database operations with test data isolation