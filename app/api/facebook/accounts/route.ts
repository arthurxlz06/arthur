import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getAdAccountsByBM, getClientAdAccounts, getPersonalAdAccounts, getActiveCampaignCount } from '@/lib/facebook'

export const dynamic = 'force-dynamic'

export async function GET() {
  const userEmail = process.env.AUTH_EMAIL!

  const { data: user } = await getSupabaseAdmin()
    .from('users')
    .select('id, facebook_access_token')
    .eq('email', userEmail)
    .single()

  if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

  const { data: bms } = await getSupabaseAdmin()
    .from('business_managers')
    .select('id, name, meta_bm_id, ad_accounts(*)')
    .eq('user_id', user.id)

  const token = user.facebook_access_token as string | null
  if (token && bms && bms.length > 0) {
    await refreshAccountStatuses(bms, token).catch(() => {})

    const { data: freshBms } = await getSupabaseAdmin()
      .from('business_managers')
      .select('id, name, meta_bm_id, ad_accounts(*)')
      .eq('user_id', user.id)
    return NextResponse.json({ bms: freshBms ?? [] })
  }

  return NextResponse.json({ bms: bms ?? [] })
}

async function refreshAccountStatuses(
  bms: { id: string; meta_bm_id: string }[],
  token: string
) {
  for (const bm of bms) {
    try {
      let accounts: { id: string; name: string; account_status: number; account_id: string }[]

      if (bm.meta_bm_id === 'personal') {
        accounts = await getPersonalAdAccounts(token)
      } else {
        const [owned, client] = await Promise.all([
          getAdAccountsByBM(bm.meta_bm_id, token).catch(() => []),
          getClientAdAccounts(bm.meta_bm_id, token).catch(() => []),
        ])
        accounts = Array.from(new Map([...owned, ...client].map((a) => [a.id, a])).values())
      }

      // Checa campanhas ativas em paralelo para cada conta
      await Promise.all(accounts.map(async (acc) => {
        const count = await getActiveCampaignCount(acc.id, token)
        const status = count > 0 ? 'active' : 'disabled'
        await getSupabaseAdmin()
          .from('ad_accounts')
          .update({ status, name: acc.name, active_campaign_count: count })
          .eq('bm_id', bm.id)
          .eq('meta_account_id', acc.id)
      }))
    } catch {
      // Não falha a request inteira se uma BM der erro
    }
  }
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
