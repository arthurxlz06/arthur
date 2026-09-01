import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function POST() {
  const userEmail = process.env.AUTH_EMAIL!

  await getSupabaseAdmin()
    .from('users')
    .update({ facebook_access_token: null })
    .eq('email', userEmail)

  return NextResponse.json({ ok: true })
}
