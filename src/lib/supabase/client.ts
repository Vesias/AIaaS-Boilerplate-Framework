'use client'

import { createClient } from '@supabase/supabase-js'
import { useAuth } from '@clerk/nextjs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export function useSupabaseClient() {
  const { getToken } = useAuth()
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: async (url, options = {}) => {
        const clerkToken = await getToken({ template: 'agentland1' })
        
        // Insert the Clerk Supabase JWT into the headers
        const headers = new Headers(options?.headers)
        if (clerkToken) {
          headers.set('Authorization', `Bearer ${clerkToken}`)
        }
        
        // Call the default fetch
        return fetch(url, { ...options, headers })
      },
    },
  })
  
  return supabase
}