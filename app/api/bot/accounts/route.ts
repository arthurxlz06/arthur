import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const userEmail = process.env.AUTH_EMAIL!

  const { data: user } = await getSupabaseAdmin()
    .from('users')
    .select('id')
    .eq('email', userEmail)
    .single()

  if (!user) return NextResponse.json({ accounts: [] })

  const { data: rows } = await getSupabaseAdmin()
    .from('ad_accounts')
    .select('id, name, meta_account_id, status, is_selected, active_campaign_count')
    .in(
      'bm_id',
      (
        await getSupabaseAdmin()
          .from('business_managers')
          .select('id')
          .eq('user_id', user.id)
      ).data?.map((b) => b.id) ?? []
    )
    .order('name')

  return NextResponse.json({ accounts: rows ?? [] })
}
