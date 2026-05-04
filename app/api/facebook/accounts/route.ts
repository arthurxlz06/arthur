import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { data: user } = await getSupabaseAdmin()
    .from('users')
    .select('id')
    .eq('email', session.user.email)
    .single()

  if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

  const { data: bms } = await getSupabaseAdmin()
    .from('business_managers')
    .select('id, name, meta_bm_id, ad_accounts(*)')
    .eq('user_id', user.id)

  return NextResponse.json({ bms: bms ?? [] })
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { account_id, is_selected } = await req.json()

  const { error } = await getSupabaseAdmin()
    .from('ad_accounts')
    .update({ is_selected })
    .eq('id', account_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
