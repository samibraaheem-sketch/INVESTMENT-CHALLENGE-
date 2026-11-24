import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
// Supabase's newer "publishable key" is the renamed successor to the old
// "anon key" — same purpose (safe to ship to the browser, every access
// still goes through RLS), just a different naming/format from Supabase.
// It must never be the service_role / secret key.
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

export const supabaseConfigured = Boolean(url && publishableKey)

if (!supabaseConfigured) {
  // eslint-disable-next-line no-console
  console.warn(
    'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (see .env.example). ' +
      'The game will still run, but no score can be saved and the leaderboard will stay empty.'
  )
}

export const supabase = createClient(
  url ?? 'https://placeholder.supabase.co',
  publishableKey ?? 'placeholder-publishable-key',
  {
    auth: { persistSession: false },
  }
)
