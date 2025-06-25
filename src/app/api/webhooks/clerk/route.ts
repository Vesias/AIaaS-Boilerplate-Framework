import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { WebhookEvent } from '@clerk/nextjs/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const webhookSecret = process.env.CLERK_WEBHOOK_SECRET

if (!webhookSecret) {
  throw new Error('Please add CLERK_WEBHOOK_SECRET to your environment variables')
}

export async function POST(req: Request) {
  // Get the headers
  const headerPayload = headers()
  const svix_id = headerPayload.get('svix-id')
  const svix_timestamp = headerPayload.get('svix-timestamp')
  const svix_signature = headerPayload.get('svix-signature')

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new NextResponse('Error occurred -- no svix headers', {
      status: 400,
    })
  }

  // Get the body
  const payload = await req.json()
  const body = JSON.stringify(payload)

  // Create a new Svix instance with your secret.
  const wh = new Webhook(webhookSecret)

  let evt: WebhookEvent

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent
  } catch (err) {
    console.error('Error verifying webhook:', err)
    return new NextResponse('Error occurred', {
      status: 400,
    })
  }

  // Handle the webhook
  const eventType = evt.type
  console.log(`Received webhook: ${eventType}`)

  try {
    const supabase = await createServerSupabaseClient()

    switch (eventType) {
      case 'user.created':
        await handleUserCreated(supabase, evt)
        break
      case 'user.updated':
        await handleUserUpdated(supabase, evt)
        break
      case 'user.deleted':
        await handleUserDeleted(supabase, evt)
        break
      default:
        console.log(`Unhandled webhook event: ${eventType}`)
    }

    return new NextResponse('Success', { status: 200 })
  } catch (error) {
    console.error('Error handling webhook:', error)
    return new NextResponse('Error occurred', { status: 500 })
  }
}

async function handleUserCreated(supabase: any, evt: WebhookEvent) {
  const { id, email_addresses, first_name, last_name, image_url } = evt.data

  if (!email_addresses || email_addresses.length === 0) {
    console.error('No email addresses found for user:', id)
    return
  }

  const primaryEmail = email_addresses.find((email: any) => email.id === evt.data.primary_email_address_id)
  const email = primaryEmail?.email_address || email_addresses[0]?.email_address

  if (!email) {
    console.error('No valid email found for user:', id)
    return
  }

  try {
    const { error } = await supabase
      .from('profiles')
      .insert({
        id,
        email,
        first_name: first_name || null,
        last_name: last_name || null,
        image_url: image_url || null,
      })

    if (error) {
      console.error('Error creating user profile:', error)
    } else {
      console.log('User profile created successfully:', id)
    }
  } catch (error) {
    console.error('Error in handleUserCreated:', error)
  }
}

async function handleUserUpdated(supabase: any, evt: WebhookEvent) {
  const { id, email_addresses, first_name, last_name, image_url } = evt.data

  if (!email_addresses || email_addresses.length === 0) {
    console.error('No email addresses found for user:', id)
    return
  }

  const primaryEmail = email_addresses.find((email: any) => email.id === evt.data.primary_email_address_id)
  const email = primaryEmail?.email_address || email_addresses[0]?.email_address

  if (!email) {
    console.error('No valid email found for user:', id)
    return
  }

  try {
    const { error } = await supabase
      .from('profiles')
      .upsert({
        id,
        email,
        first_name: first_name || null,
        last_name: last_name || null,
        image_url: image_url || null,
        updated_at: new Date().toISOString(),
      })

    if (error) {
      console.error('Error updating user profile:', error)
    } else {
      console.log('User profile updated successfully:', id)
    }
  } catch (error) {
    console.error('Error in handleUserUpdated:', error)
  }
}

async function handleUserDeleted(supabase: any, evt: WebhookEvent) {
  const { id } = evt.data

  try {
    // Delete user profile (this will cascade to other related records)
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting user profile:', error)
    } else {
      console.log('User profile deleted successfully:', id)
    }
  } catch (error) {
    console.error('Error in handleUserDeleted:', error)
  }
}