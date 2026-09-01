import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function POST() {
  const userEmail = process.env.AUTH_EMAIL!

  await getSupabaseAdmin()
    .from('users')
    .update({ dropbox_access_token: null, dropbox_refresh_token: null })
    .eq('email', userEmail)

  return NextResponse.json({ ok: true })
}
