'use client'

import { useUser } from '@clerk/nextjs'
import { useEffect, useState } from 'react'
import { useSupabaseClient } from '@/lib/supabase/client'

interface Profile {
  id: string
  email: string
  full_name: string
  created_at: string
}

export function UserProfile() {
  const { user, isLoaded } = useUser()
  const supabase = useSupabaseClient()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadProfile() {
      if (!user) return

      try {
        setError(null)
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        if (error && error.code === 'PGRST116') {
          // Profile doesn't exist, create it
          const { data: newProfile, error: insertError } = await supabase
            .from('profiles')
            .insert({
              id: user.id,
              email: user.primaryEmailAddress?.emailAddress,
              full_name: user.fullName,
            })
            .select()
            .single()

          if (insertError) {
            setError(`Failed to create profile: ${insertError.message}`)
          } else {
            setProfile(newProfile)
          }
        } else if (error) {
          setError(`Failed to load profile: ${error.message}`)
        } else if (data) {
          setProfile(data)
        }
      } catch (error) {
        console.error('Error loading profile:', error)
        setError('An unexpected error occurred')
      } finally {
        setLoading(false)
      }
    }

    if (isLoaded && user) {
      loadProfile()
    } else if (isLoaded && !user) {
      setLoading(false)
    }
  }, [user, isLoaded, supabase])

  if (!isLoaded || loading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="text-center p-4">
        <p className="text-gray-600">Please sign in to view your profile</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-600">Error: {error}</p>
        <p className="text-sm text-red-500 mt-1">
          Make sure you've configured the JWT template in Clerk Dashboard
        </p>
      </div>
    )
  }

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
      <h2 className="text-xl font-semibold mb-4">Profile Information</h2>
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700">Clerk User ID</label>
          <p className="text-sm text-gray-900 font-mono">{user.id}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <p className="text-sm text-gray-900">{profile?.email || 'Not available'}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Full Name</label>
          <p className="text-sm text-gray-900">{profile?.full_name || 'Not available'}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Member Since</label>
          <p className="text-sm text-gray-900">
            {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'Not available'}
          </p>
        </div>
      </div>
    </div>
  )
}