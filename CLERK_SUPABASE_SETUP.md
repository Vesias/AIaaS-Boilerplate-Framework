# Clerk + Supabase Integration Setup Guide

## 1. JWT Template Configuration (REQUIRED)

Before using Supabase with Clerk, you **must** configure a JWT template in your Clerk Dashboard:

### Steps:
1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Navigate to **JWT Templates** in the sidebar
3. Click **+ New template**
4. Name it: `agentland1`
5. Add these claims:

```json
{
  "aud": "authenticated",
  "role": "authenticated",
  "email": "{{user.primary_email_address}}",
  "user_id": "{{user.id}}",
  "user_metadata": {
    "name": "{{user.full_name}}",
    "email": "{{user.primary_email_address}}"
  }
}
```

6. Set **Token lifetime** to 60 seconds (recommended)
7. Click **Save**

## 2. Environment Variables

Update your `.env.local` with your Supabase credentials:

```bash
# Supabase (replace with your actual values)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## 3. Supabase Database Setup

### Create tables with RLS policies:

```sql
-- Example: profiles table
CREATE TABLE profiles (
  id TEXT PRIMARY KEY, -- This will be Clerk's user ID
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies (IMPORTANT: Use auth.jwt() ->> 'user_id' for Clerk integration)
CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT
  USING (auth.jwt() ->> 'user_id' = id);

CREATE POLICY "Users can insert own profile" ON profiles  
  FOR INSERT
  WITH CHECK (auth.jwt() ->> 'user_id' = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE  
  USING (auth.jwt() ->> 'user_id' = id)
  WITH CHECK (auth.jwt() ->> 'user_id' = id);
```

## 4. Usage Examples

### Client Component:
```typescript
'use client'

import { useSupabaseClient } from '@/lib/supabase/client'
import { useUser } from '@clerk/nextjs'

export function UserProfile() {
  const { user } = useUser()
  const supabase = useSupabaseClient()
  
  // Use supabase client here...
}
```

### Server Component:
```typescript
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { auth } from '@clerk/nextjs/server'

export default async function Page() {
  const { userId } = await auth()
  
  if (!userId) {
    return <div>Please sign in</div>
  }

  const supabase = await createServerSupabaseClient()
  
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
    
  // Use data...
}
```

## 5. Important Notes

- ✅ **Always** use the JWT template named 'agentland1'
- ✅ **Always** use `auth.jwt() ->> 'user_id'` in RLS policies
- ✅ **Never** mix Supabase Auth with Clerk
- ✅ User ID from Clerk becomes the primary key in Supabase tables
- ⚠️ JWT tokens expire - the client handles refresh automatically

## 6. Troubleshooting

### Common Issues:
1. **"JWT token is invalid"** - Check JWT template configuration
2. **"Row Level Security policy violation"** - Verify RLS policies use `auth.jwt() ->> 'user_id'`
3. **"No token available"** - User might not be signed in or JWT template not configured

### Testing RLS Policies:
```sql
-- Test if your RLS policy works (run as authenticated user)
SELECT auth.jwt() ->> 'user_id' as user_id;
```