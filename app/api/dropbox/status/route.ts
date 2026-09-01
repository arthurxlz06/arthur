import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const userEmail = process.env.AUTH_EMAIL!

  const { data: user } = await getSupabaseAdmin()
    .from('users')
    .select('dropbox_access_token')
    .eq('email', userEmail)
    .single()

  return NextResponse.json({ connected: !!user?.dropbox_access_token })
}
