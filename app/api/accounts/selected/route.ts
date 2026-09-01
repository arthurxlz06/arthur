import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const userEmail = process.env.AUTH_EMAIL!

  const supabase = getSupabaseAdmin()

  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('email', userEmail)
    .single()

  if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

  const { data: accounts } = await supabase
    .from('ad_accounts')
    .select('id, meta_account_id, name, business_managers!inner(user_id)')
    .eq('is_selected', true)
    .eq('business_managers.user_id', user.id)

  return NextResponse.json({
    accounts: (accounts ?? []).map((a) => ({
      id: a.id,
      meta_account_id: a.meta_account_id,
      name: a.name,
    })),
  })
}
