import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: user } = await getSupabaseAdmin()
    .from('users')
    .select('facebook_access_token')
    .eq('email', session.user.email)
    .single()

  return NextResponse.json({ connected: !!user?.facebook_access_token })
}
