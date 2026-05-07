import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ connected: false })

  const { data: user } = await getSupabaseAdmin()
    .from('users')
    .select('dropbox_access_token')
    .eq('email', session.user.email)
    .single()

  return NextResponse.json({ connected: !!user?.dropbox_access_token })
}
