import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const userEmail = process.env.AUTH_EMAIL!

  const { data: user } = await getSupabaseAdmin()
    .from('users')
    .select('facebook_access_token, token_expires_at')
    .eq('email', userEmail)
    .single()

  const connected = !!user?.facebook_access_token
  const expiresAt = user?.token_expires_at as string | null
  const daysLeft = connected && expiresAt
    ? Math.floor((new Date(expiresAt).getTime() - Date.now()) / 86400000)
    : null

  return NextResponse.json({ connected, expires_at: expiresAt, days_left: daysLeft })
}
