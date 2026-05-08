import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function POST() {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  await getSupabaseAdmin()
    .from('users')
    .update({ facebook_access_token: null })
    .eq('email', session.user.email)

  return NextResponse.json({ ok: true })
}
