import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getAdAccountsByBM, getClientAdAccounts, getPersonalAdAccounts, getActiveCampaignCount } from '@/lib/facebook'

export async function GET() {
  const userEmail = process.env.AUTH_EMAIL!

  const { data: user } = await getSupabaseAdmin()
    .from('users')
    .select('id, facebook_access_token')
    .eq('email', userEmail)
    .single()

  if (!user) return NextResponse.json({ accounts: [] })

  const { data: bms } = await getSupabaseAdmin()
    .from('business_managers')
    .select('id, name, meta_bm_id, ad_accounts(id, name, meta_account_id, is_selected)')
    .eq('user_id', user.id)

  if (!bms || bms.length === 0) return NextResponse.json({ accounts: [] })

  const token = user.facebook_access_token as string | null

  // Busca nomes/IDs ao vivo da Meta e conta campanhas ativas por conta
  const allAccounts: {
    id: string; name: string; meta_account_id: string
    is_selected: boolean; status: 'active' | 'disabled'; active_campaign_count: number
  }[] = []

  for (const bm of bms) {
    let liveAccounts: { id: string; name: string; account_status: number; account_id: string }[] = []

    if (token) {
      try {
        if (bm.meta_bm_id === 'personal') {
          liveAccounts = await getPersonalAdAccounts(token)
        } else {
          const [owned, client] = await Promise.all([
            getAdAccountsByBM(bm.meta_bm_id, token).catch(() => []),
            getClientAdAccounts(bm.meta_bm_id, token).catch(() => []),
          ])
          liveAccounts = Array.from(new Map([...owned, ...client].map(a => [a.id, a])).values())
        }
      } catch { /* usa dados do DB */ }
    }

    const dbAccounts = (bm.ad_accounts ?? []) as { id: string; name: string; meta_account_id: string; is_selected: boolean }[]

    // Merge: usa lista do DB como base, enriquece com dados ao vivo
    const liveMap = new Map(liveAccounts.map(a => [a.id, a]))

    const withCounts = await Promise.all(dbAccounts.map(async (acc) => {
      const liveId = acc.meta_account_id.startsWith('act_') ? acc.meta_account_id : `act_${acc.meta_account_id}`
      let count = 0
      if (token) {
        count = await getActiveCampaignCount(liveId, token).catch(() => 0)
      }
      const liveName = liveMap.get(liveId)?.name ?? liveMap.get(acc.meta_account_id)?.name ?? acc.name
      return {
        id: acc.id,
        name: liveName,
        meta_account_id: acc.meta_account_id,
        is_selected: acc.is_selected,
        status: (count > 0 ? 'active' : 'disabled') as 'active' | 'disabled',
        active_campaign_count: count,
      }
    }))

    allAccounts.push(...withCounts)
  }

  allAccounts.sort((a, b) => a.name.localeCompare(b.name))
  return NextResponse.json({ accounts: allAccounts })
}
