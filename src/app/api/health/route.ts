/**
 * Health Check API Endpoint
 * Provides application health status for monitoring and Docker health checks
 */

import { NextResponse } from 'next/server'
import { createDatabaseService } from '@/lib/database'

export async function GET() {
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    services: {} as Record<string, any>
  }

  try {
    // Check database connection
    try {
      const db = await createDatabaseService()
      const { data, error } = await db.supabase
        .from('profiles')
        .select('id')
        .limit(1)
      
      healthData.services.database = {
        status: error ? 'unhealthy' : 'healthy',
        latency: Date.now(),
        error: error?.message
      }
    } catch (error) {
      healthData.services.database = {
        status: 'unhealthy',
        error: error.message
      }
    }

    // Check authentication service (Clerk)
    try {
      const clerkStatus = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? 'configured' : 'not_configured'
      healthData.services.authentication = {
        status: clerkStatus === 'configured' ? 'healthy' : 'unhealthy',
        provider: 'clerk',
        configured: clerkStatus === 'configured'
      }
    } catch (error) {
      healthData.services.authentication = {
        status: 'unhealthy',
        error: error.message
      }
    }

    // Check payment service (Stripe)
    try {
      const stripeStatus = process.env.STRIPE_SECRET_KEY ? 'configured' : 'not_configured'
      healthData.services.payments = {
        status: stripeStatus === 'configured' ? 'healthy' : 'unhealthy',
        provider: 'stripe',
        configured: stripeStatus === 'configured'
      }
    } catch (error) {
      healthData.services.payments = {
        status: 'unhealthy',
        error: error.message
      }
    }

    // Check automation services
    healthData.services.automation = {
      n8n: {
        status: process.env.N8N_API_KEY ? 'configured' : 'not_configured',
        configured: !!process.env.N8N_API_KEY
      },
      make: {
        status: process.env.MAKE_WEBHOOK_TOKEN ? 'configured' : 'not_configured',
        configured: !!process.env.MAKE_WEBHOOK_TOKEN
      }
    }

    // Check AI services
    healthData.services.ai = {
      openai: {
        status: process.env.OPENAI_API_KEY ? 'configured' : 'not_configured',
        configured: !!process.env.OPENAI_API_KEY
      },
      copilotkit: {
        status: 'healthy',
        configured: true
      },
      mcp: {
        status: process.env.MCP_API_KEY ? 'configured' : 'not_configured',
        configured: !!process.env.MCP_API_KEY
      },
      agui: {
        status: process.env.AGUI_API_KEY ? 'configured' : 'not_configured',
        configured: !!process.env.AGUI_API_KEY
      }
    }

    // Check WordPress integration
    healthData.services.cms = {
      wordpress: {
        status: process.env.WORDPRESS_API_URL ? 'configured' : 'not_configured',
        configured: !!process.env.WORDPRESS_API_URL
      }
    }

    // Determine overall status
    const serviceStatuses = Object.values(healthData.services).flat()
    const hasUnhealthyServices = JSON.stringify(serviceStatuses).includes('unhealthy')
    
    healthData.status = hasUnhealthyServices ? 'degraded' : 'healthy'

    return NextResponse.json(healthData, {
      status: hasUnhealthyServices ? 503 : 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
      services: healthData.services
    }, {
      status: 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  }
}

// Support HEAD requests for simple health checks
export async function HEAD() {
  try {
    // Quick database ping
    const db = await createDatabaseService()
    const { error } = await db.supabase
      .from('profiles')
      .select('id')
      .limit(1)
    
    return new NextResponse(null, {
      status: error ? 503 : 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })
  } catch (error) {
    return new NextResponse(null, {
      status: 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })
  }
}