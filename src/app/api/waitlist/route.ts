/**
 * Waitlist API Endpoint
 * Handles waitlist signups and management
 */

import { NextRequest, NextResponse } from 'next/server'
import { createDatabaseService } from '@/lib/database'
import { z } from 'zod'

// Validation schema
const waitlistSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  company: z.string().optional(),
  message: z.string().max(500, 'Message must be less than 500 characters').optional(),
  useCase: z.string().optional()
})

// POST - Add to waitlist
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    
    // Validate input
    const validatedData = waitlistSchema.parse(body)
    
    const db = await createDatabaseService()
    
    // Check if email already exists
    const existingEntry = await db.getWaitlistEntry(validatedData.email)
    if (existingEntry) {
      return NextResponse.json(
        { error: 'Email is already on the waitlist' },
        { status: 400 }
      )
    }
    
    // Add to waitlist
    const waitlistEntry = await db.addToWaitlist({
      email: validatedData.email,
      name: validatedData.name,
      company: validatedData.company || null,
      message: validatedData.message || null
    })
    
    if (!waitlistEntry) {
      return NextResponse.json(
        { error: 'Failed to add to waitlist' },
        { status: 500 }
      )
    }

    // TODO: Send welcome email
    // TODO: Notify admin about new waitlist entry
    // TODO: Add to email marketing list

    return NextResponse.json({
      success: true,
      message: 'Successfully added to waitlist',
      entry: {
        id: waitlistEntry.id,
        email: waitlistEntry.email,
        name: waitlistEntry.name,
        position: await getWaitlistPosition(waitlistEntry.email)
      }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    
    console.error('Waitlist signup error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET - Check waitlist status
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const email = searchParams.get('email')
    
    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter is required' },
        { status: 400 }
      )
    }
    
    const db = await createDatabaseService()
    const entry = await db.getWaitlistEntry(email)
    
    if (!entry) {
      return NextResponse.json(
        { error: 'Email not found on waitlist' },
        { status: 404 }
      )
    }
    
    const position = await getWaitlistPosition(email)
    const stats = await getWaitlistStats()
    
    return NextResponse.json({
      entry: {
        id: entry.id,
        email: entry.email,
        name: entry.name,
        approved: entry.approved,
        approvedAt: entry.approved_at,
        createdAt: entry.created_at,
        position
      },
      stats
    })
  } catch (error) {
    console.error('Waitlist check error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper function to get waitlist position
async function getWaitlistPosition(email: string): Promise<number> {
  try {
    const db = await createDatabaseService()
    // This is a simplified calculation - in production you might want to cache this
    const entry = await db.getWaitlistEntry(email)
    if (!entry) return -1
    
    // Count entries created before this one that are not approved
    const { data, error } = await db.supabase
      .from('waitlist_entries')
      .select('*', { count: 'exact', head: true })
      .eq('approved', false)
      .lt('created_at', entry.created_at)
    
    if (error) throw error
    
    return (data?.length || 0) + 1
  } catch (error) {
    console.error('Error calculating waitlist position:', error)
    return -1
  }
}

// Helper function to get waitlist statistics
async function getWaitlistStats(): Promise<{
  total: number
  approved: number
  pending: number
}> {
  try {
    const db = await createDatabaseService()
    
    const [totalResult, approvedResult] = await Promise.all([
      db.supabase
        .from('waitlist_entries')
        .select('*', { count: 'exact', head: true }),
      db.supabase
        .from('waitlist_entries')
        .select('*', { count: 'exact', head: true })
        .eq('approved', true)
    ])
    
    const total = totalResult.count || 0
    const approved = approvedResult.count || 0
    const pending = total - approved
    
    return { total, approved, pending }
  } catch (error) {
    console.error('Error getting waitlist stats:', error)
    return { total: 0, approved: 0, pending: 0 }
  }
}