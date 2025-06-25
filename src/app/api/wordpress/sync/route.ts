/**
 * WordPress Sync API Endpoint
 * Synchronizes content from WordPress CMS to local database
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createWordPressClient, syncWordPressToLocal } from '@/lib/wordpress'
import { createDatabaseService } from '@/lib/database'

// POST - Manual sync trigger
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has admin privileges (you can implement this check based on your needs)
    // For now, any authenticated user can trigger sync
    
    const db = await createDatabaseService()
    const result = await syncWordPressToLocal(db)

    return NextResponse.json({
      success: true,
      message: `Sync completed. ${result.synced} posts synchronized.`,
      synced: result.synced,
      errors: result.errors
    })
  } catch (error) {
    console.error('WordPress sync error:', error)
    return NextResponse.json(
      { error: 'Failed to sync WordPress content' },
      { status: 500 }
    )
  }
}

// GET - Sync status and WordPress health check
export async function GET() {
  try {
    const wp = createWordPressClient()
    const health = await wp.healthCheck()
    
    const db = await createDatabaseService()
    const localPosts = await db.getPublishedBlogPosts()

    return NextResponse.json({
      wordpress: {
        status: health.status,
        version: health.version,
        error: health.error
      },
      local: {
        totalPosts: localPosts.length,
        lastSync: localPosts.length > 0 ? localPosts[0].updated_at : null
      }
    })
  } catch (error) {
    console.error('WordPress status error:', error)
    return NextResponse.json(
      { error: 'Failed to get WordPress status' },
      { status: 500 }
    )
  }
}