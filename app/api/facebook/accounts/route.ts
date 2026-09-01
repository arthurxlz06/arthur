import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const userEmail = process.env.AUTH_EMAIL!

  const { data: user } = await getSupabaseAdmin()
    .from('users')
    .select('id')
    .eq('email', userEmail)
    .single()

  if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

  const { data: bms } = await getSupabaseAdmin()
    .from('business_managers')
    .select('id, name, meta_bm_id, ad_accounts(*)')
    .eq('user_id', user.id)

  return NextResponse.json({ bms: bms ?? [] })
}

export async function PATCH(req: Request) {
  const { account_id, is_selected } = await req.json()

  const { error } = await getSupabaseAdmin()
    .from('ad_accounts')
    .update({ is_selected })
    .eq('id', account_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
