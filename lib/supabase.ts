import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _supabase: SupabaseClient | null = null
let _supabaseAdmin: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    // NEXT_PUBLIC_ vars são necessárias para client-side
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    _supabase = createClient(url, key)
  }
  return _supabase
}

// Server-side only — never call in client components
export function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    // Prefere vars da integração Vercel-Supabase (mais recentes)
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!
    const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
    _supabaseAdmin = createClient(url, key)
  }
  return _supabaseAdmin
}
