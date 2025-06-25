# Integration Implementation Queries for AIaaS Boilerplate

[GitHub Repository](https://github.com/Vesias/AIaaS-Boilerplate-Framework)

## Overview
This document provides step-by-step implementation queries and patterns for integrating UX-enhancing services with the current AIaaS stack (Next.js 15, Clerk, Supabase, Stripe, CopilotKit).

## Core Integration Patterns

### Authentication Flow Integration with Clerk

#### Pattern 1: OAuth Scope Extension
**Implementation Queries:**
- How to extend Clerk OAuth scopes for third-party service authorization?
- What webhook events should trigger user data synchronization?
- How to handle OAuth token refresh and storage securely?
- Which Clerk metadata fields to use for service-specific user data?

**Code Pattern:**
```typescript
// lib/clerk-integration.ts
export async function synchronizeUserWithService(userId: string, serviceData: any) {
  const clerkUser = await clerkClient.users.updateUser(userId, {
    publicMetadata: {
      ...existingMetadata,
      [serviceName]: serviceData
    }
  });
  
  // Sync with Supabase
  await supabase
    .from('user_integrations')
    .upsert({
      user_id: userId,
      service: serviceName,
      service_data: serviceData,
      updated_at: new Date().toISOString()
    });
}
```

#### Pattern 2: Service Authentication Headers
**Implementation Queries:**
- How to pass Clerk JWT tokens to third-party service APIs?
- What middleware pattern to use for service API authentication?
- How to handle service-specific authentication errors gracefully?

### Database Schema Extensions for Integrations

#### Supabase Table Modifications
**Implementation Queries:**
- What columns to add to existing tables for service integrations?
- How to design notification_preferences table for real-time services?
- What indexes to create for efficient service data queries?
- How to handle service-specific data validation and constraints?

**Schema Patterns:**
```sql
-- User integrations tracking
CREATE TABLE user_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  service TEXT NOT NULL,
  service_user_id TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  service_data JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Real-time notifications
CREATE TABLE user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  data JSONB,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- File uploads tracking
CREATE TABLE user_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  service_file_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  file_url TEXT NOT NULL,
  thumbnail_url TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Service-Specific Implementation Patterns

### 1. Real-Time Notifications (Pusher Integration)

#### Setup Queries:
- How to configure Pusher channels with Clerk user authentication?
- What event naming conventions to use for different notification types?
- How to handle presence channels for user online status?
- What rate limiting to implement for real-time events?

**Implementation Pattern:**
```typescript
// lib/pusher-server.ts
import Pusher from 'pusher';

export const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true,
});

// app/api/pusher/auth/route.ts
export async function POST(req: Request) {
  const { socket_id, channel_name } = await req.json();
  const { userId } = auth();
  
  if (!userId) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  const authData = pusher.authenticate(socket_id, channel_name, {
    user_id: userId,
    user_info: {
      id: userId,
      // Additional user data from Clerk
    }
  });
  
  return Response.json(authData);
}

// hooks/use-pusher.ts
export function usePusher(channelName: string) {
  const { userId } = useAuth();
  const [pusherClient, setPusherClient] = useState<Pusher | null>(null);
  
  useEffect(() => {
    if (!userId) return;
    
    const client = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      authEndpoint: '/api/pusher/auth',
    });
    
    setPusherClient(client);
    
    return () => {
      client.disconnect();
    };
  }, [userId]);
  
  return pusherClient;
}
```

### 2. Error Tracking (Sentry Integration)

#### Setup Queries:
- How to configure Sentry with Clerk user context?
- What custom tags to add for SaaS-specific error categorization?
- How to filter out non-critical errors from alerting?
- What performance metrics to track for user experience?

**Implementation Pattern:**
```typescript
// sentry.client.config.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  integrations: [
    new Sentry.BrowserTracing({
      tracePropagationTargets: ['localhost', /^https:\/\/yourapp\.com\/api/],
    }),
  ],
  tracesSampleRate: 1.0,
  beforeSend(event, hint) {
    // Filter out known non-critical errors
    if (event.exception) {
      const error = hint.originalException;
      if (error instanceof Error && error.message.includes('Non-critical')) {
        return null;
      }
    }
    return event;
  },
});

// lib/sentry-utils.ts
export function setUserContext(user: any) {
  Sentry.setUser({
    id: user.id,
    email: user.emailAddresses[0]?.emailAddress,
    subscription: user.publicMetadata?.subscription,
  });
}

export function captureUserAction(action: string, data?: any) {
  Sentry.addBreadcrumb({
    message: action,
    data,
    level: 'info',
    category: 'user-action',
  });
}
```

### 3. File Management (Cloudinary Integration)

#### Setup Queries:
- How to configure upload widgets with Clerk user context?
- What folder structure to use for multi-tenant file organization?
- How to implement secure direct uploads with signed URLs?
- What image transformation presets to create for optimal UX?

**Implementation Pattern:**
```typescript
// lib/cloudinary.ts
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// app/api/cloudinary/signature/route.ts
export async function POST(req: Request) {
  const { userId } = auth();
  if (!userId) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  const timestamp = Math.round(new Date().getTime() / 1000);
  const signature = cloudinary.utils.api_sign_request(
    {
      timestamp,
      folder: `users/${userId}`,
      upload_preset: 'user_uploads',
    },
    process.env.CLOUDINARY_API_SECRET!
  );
  
  return Response.json({ signature, timestamp });
}

// components/file-upload.tsx
export function FileUpload({ onUpload }: { onUpload: (url: string) => void }) {
  const { userId } = useAuth();
  
  const uploadWidget = cloudinary.createUploadWidget(
    {
      cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
      uploadPreset: 'user_uploads',
      folder: `users/${userId}`,
      maxFileSize: 10000000, // 10MB
      allowedFormats: ['jpg', 'png', 'gif', 'pdf'],
    },
    (error, result) => {
      if (!error && result && result.event === 'success') {
        onUpload(result.info.secure_url);
        // Save to Supabase
        saveFileRecord(result.info);
      }
    }
  );
  
  return (
    <button onClick={() => uploadWidget.open()}>
      Upload File
    </button>
  );
}
```

### 4. Customer Support (Crisp Integration)

#### Setup Queries:
- How to configure Crisp widget with Clerk user data?
- What custom data to pass for personalized support context?
- How to trigger automated support flows based on user actions?
- What webhook events to handle for support ticket synchronization?

**Implementation Pattern:**
```typescript
// components/support-chat.tsx
export function SupportChat() {
  const { user } = useAuth();
  
  useEffect(() => {
    if (typeof window !== 'undefined' && user) {
      window.$crisp = [];
      window.CRISP_WEBSITE_ID = process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID;
      
      // Configure user data
      window.$crisp.push(['set', 'user:email', user.emailAddresses[0]?.emailAddress]);
      window.$crisp.push(['set', 'user:nickname', user.fullName]);
      window.$crisp.push(['set', 'session:data', {
        userId: user.id,
        subscription: user.publicMetadata?.subscription,
        signupDate: user.createdAt,
      }]);
      
      // Load Crisp script
      const script = document.createElement('script');
      script.src = 'https://client.crisp.chat/l.js';
      script.async = true;
      document.head.appendChild(script);
    }
  }, [user]);
  
  return null;
}
```

## API Rate Limiting and Caching Strategies

### Implementation Queries:
- How to implement Redis-based rate limiting for service APIs?
- What caching strategies to use for third-party API responses?
- How to handle rate limit exceeded scenarios gracefully?
- What retry patterns to implement for failed service calls?

**Pattern Implementation:**
```typescript
// lib/rate-limiter.ts
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export async function rateLimit(
  identifier: string,
  limit: number,
  window: number
) {
  const key = `rate_limit:${identifier}`;
  const current = await redis.incr(key);
  
  if (current === 1) {
    await redis.expire(key, window);
  }
  
  return {
    success: current <= limit,
    limit,
    remaining: Math.max(0, limit - current),
    reset: new Date(Date.now() + window * 1000),
  };
}

// middleware/rate-limit.ts
export async function withRateLimit(
  req: Request,
  limit: number = 100,
  window: number = 3600
) {
  const { userId } = auth();
  const identifier = userId || req.headers.get('x-forwarded-for') || 'anonymous';
  
  const result = await rateLimit(identifier, limit, window);
  
  if (!result.success) {
    return new Response('Rate limit exceeded', {
      status: 429,
      headers: {
        'X-RateLimit-Limit': limit.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': result.reset.toISOString(),
      },
    });
  }
  
  return null; // Continue processing
}
```

## Error Handling and Fallback Patterns

### Implementation Queries:
- How to implement circuit breaker patterns for service integrations?
- What fallback UX to provide when services are unavailable?
- How to handle partial service degradation gracefully?
- What monitoring to implement for service health checking?

**Pattern Implementation:**
```typescript
// lib/circuit-breaker.ts
class CircuitBreaker {
  private failures = 0;
  private lastFailTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  constructor(
    private threshold: number = 5,
    private timeout: number = 60000
  ) {}
  
  async execute<T>(operation: () => Promise<T>, fallback?: () => T): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailTime > this.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        if (fallback) return fallback();
        throw new Error('Circuit breaker is open');
      }
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      if (fallback) return fallback();
      throw error;
    }
  }
  
  private onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }
  
  private onFailure() {
    this.failures++;
    this.lastFailTime = Date.now();
    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
    }
  }
}

// Usage example
const searchService = new CircuitBreaker(3, 30000);

export async function searchWithFallback(query: string) {
  return await searchService.execute(
    () => algolia.search(query),
    () => basicLocalSearch(query) // Fallback to simple search
  );
}
```

## Monitoring and Observability Setup

### Implementation Queries:
- How to implement health check endpoints for all integrations?
- What metrics to track for integration performance and reliability?
- How to set up alerting for integration failures?
- What logging patterns to use for debugging integration issues?

**Pattern Implementation:**
```typescript
// app/api/health/integrations/route.ts
export async function GET() {
  const services = [
    { name: 'pusher', check: () => checkPusherHealth() },
    { name: 'sentry', check: () => checkSentryHealth() },
    { name: 'cloudinary', check: () => checkCloudinaryHealth() },
    { name: 'crisp', check: () => checkCrispHealth() },
  ];
  
  const results = await Promise.allSettled(
    services.map(async (service) => ({
      name: service.name,
      status: await service.check(),
    }))
  );
  
  const health = results.map((result, index) => ({
    service: services[index].name,
    healthy: result.status === 'fulfilled' && result.value.status === 'ok',
    details: result.status === 'fulfilled' ? result.value : result.reason,
  }));
  
  const overallHealthy = health.every(h => h.healthy);
  
  return Response.json(
    { healthy: overallHealthy, services: health },
    { status: overallHealthy ? 200 : 503 }
  );
}
```

## Deployment Considerations

### Environment Configuration
**Implementation Queries:**
- What environment variables to add for each integration?
- How to handle different API keys for staging vs production?
- What secrets rotation strategy to implement?
- How to validate integration configurations on startup?

### Performance Monitoring
**Implementation Queries:**
- What Core Web Vitals impact to expect from each integration?
- How to implement lazy loading for non-critical integration scripts?
- What bundle size impact to monitor for client-side integrations?
- How to measure and optimize integration-specific performance metrics?
