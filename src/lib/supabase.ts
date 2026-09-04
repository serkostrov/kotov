import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { getPublicEnv } from '@/lib/env'

const { VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: anonKey } = getPublicEnv()

export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase = createClient<Database>(
  url || 'https://unavailable.local',
  anonKey || 'public-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)
