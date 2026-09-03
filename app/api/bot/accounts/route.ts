import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getActiveCampaignCount } from '@/lib/facebook'

export const dynamic = 'force-dynamic'

// Timeout por conta — evita que uma conta lenta trave todas as outras
function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([p, new Promise<T>(res => setTimeout(() => res(fallback), ms))])
}

export async function GET() {
  const userEmail = process.env.AUTH_EMAIL!

  const { data: user } = await getSupabaseAdmin()
    .from('users')
    .select('id, facebook_access_token')
    .eq('email', userEmail)
    .single()

  if (!user) return NextResponse.json({ accounts: [] })

  // Lê todas as contas do DB (inclui is_selected e active_campaign_count cacheado)
  const { data: bms } = await getSupabaseAdmin()
    .from('business_managers')
    .select('id, name, meta_bm_id, ad_accounts(id, name, meta_account_id, is_selected, active_campaign_count, status)')
    .eq('user_id', user.id)

  if (!bms || bms.length === 0) return NextResponse.json({ accounts: [] })

  const token = user.facebook_access_token as string | null

  // Achata todas as contas de todas as BMs
  const allDbAccounts = bms.flatMap(bm =>
    ((bm.ad_accounts ?? []) as {
      id: string; name: string; meta_account_id: string
      is_selected: boolean; active_campaign_count: number | null; status: string | null
    }[]).map(acc => ({ ...acc, bm_id: bm.id }))
  )

  // Conta campanhas ativas para TODAS as contas em PARALELO com timeout de 10s por conta
  const results = await Promise.all(allDbAccounts.map(async (acc) => {
    const liveId = acc.meta_account_id.startsWith('act_') ? acc.meta_account_id : `act_${acc.meta_account_id}`
    let count = acc.active_campaign_count ?? 0 // fallback para valor cacheado no DB

    if (token) {
      const fresh = await withTimeout(
        getActiveCampaignCount(liveId, token),
        10_000,
        null // null = timeout, mantém valor cacheado
      ).catch(() => null)

      if (fresh !== null) {
        count = fresh
        // Persiste no DB para que a próxima carga seja rápida
        getSupabaseAdmin()
          .from('ad_accounts')
          .update({ active_campaign_count: fresh, status: fresh > 0 ? 'active' : 'disabled' })
          .eq('id', acc.id)
          .then(() => {}, () => {})
      }
    }

    return {
      id: acc.id,
      name: acc.name,
      meta_account_id: acc.meta_account_id,
      is_selected: acc.is_selected,
      status: (count > 0 ? 'active' : 'disabled') as 'active' | 'disabled',
      active_campaign_count: count,
    }
  }))

  results.sort((a, b) => a.name.localeCompare(b.name))
  return NextResponse.json({ accounts: results })
}
