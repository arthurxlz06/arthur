import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabaseAdmin } from '@/lib/supabase'

const CACHE_TTL_HOURS = 1

interface MetaAction {
  action_type: string
  value: string
}

interface InsightRecord {
  ad_id: string
  ad_name: string
  spend?: string
  clicks?: string
  impressions?: string
  ctr?: string
  cpm?: string
  actions?: MetaAction[]
  action_values?: MetaAction[]
  video_play_actions?: MetaAction[]
  video_30_sec_watched_actions?: MetaAction[]
  video_thruplay_watched_actions?: MetaAction[]
}

interface InsightsPagedResponse {
  data?: InsightRecord[]
  paging?: { next?: string }
  error?: { message: string; code?: number }
}

function buildAds(allRecords: InsightRecord[]) {
  const getAction = (arr: MetaAction[] | undefined, type: string) =>
    parseFloat(arr?.find((a) => a.action_type === type)?.value ?? '0')

  const getVideoField = (arr: MetaAction[] | undefined, type = 'video_view') =>
    parseFloat(arr?.find((a) => a.action_type === type)?.value ?? '0')

  const raw = allRecords.map((r) => {
    const spend       = parseFloat(r.spend ?? '0')
    const impressions = parseInt(r.impressions ?? '0')
    const clicks      = parseInt(r.clicks ?? '0')
    const ctr         = parseFloat(r.ctr ?? '0')
    const cpm         = parseFloat(r.cpm ?? '0')

    const outboundClicks = getAction(r.actions, 'outbound_click')
    const lpViews        = getAction(r.actions, 'landing_page_view')
    const purchases      = getAction(r.actions, 'purchase') || getAction(r.actions, 'omni_purchase')
    const revenue        = getAction(r.action_values, 'purchase') || getAction(r.action_values, 'omni_purchase')
    const video3s        = getVideoField(r.video_play_actions)
    const video15s       = getVideoField(r.video_thruplay_watched_actions)
    const video30s       = getVideoField(r.video_30_sec_watched_actions)
    const effectiveClicks = outboundClicks || clicks

    return {
      ad_id: r.ad_id, ad_name: r.ad_name,
      spend, clicks: effectiveClicks, impressions, lp_views: lpViews,
      video_views: video3s, ctr, hook_rate: 0, body_rate: 0, cpm, cpc: 0,
      cpa: 0, purchases, revenue, roas: 0, avg_ticket: 0, conv_rate: 0,
      video_3s: video3s, video_15s: video15s, video_30s: video30s,
    }
  })

  // Agrupar por nome exato
  const grouped = new Map<string, typeof raw[0]>()
  for (const ad of raw) {
    const key = ad.ad_name.trim()
    const ex = grouped.get(key)
    if (!ex) { grouped.set(key, { ...ad }); continue }
    ex.spend += ad.spend; ex.clicks += ad.clicks; ex.impressions += ad.impressions
    ex.lp_views += ad.lp_views; ex.video_views += ad.video_views
    ex.purchases += ad.purchases; ex.revenue += ad.revenue
    ex.video_3s += ad.video_3s; ex.video_15s += ad.video_15s; ex.video_30s += ad.video_30s
  }

  return Array.from(grouped.values()).map((ad) => ({
    ...ad,
    ctr:        ad.impressions > 0 ? (ad.clicks / ad.impressions) * 100   : 0,
    hook_rate:  ad.impressions > 0 ? (ad.video_3s / ad.impressions) * 100 : 0,
    body_rate:  ad.video_3s > 0    ? (ad.video_15s / ad.video_3s) * 100   : 0,
    cpm:        ad.impressions > 0 ? (ad.spend / ad.impressions) * 1000   : 0,
    cpc:        ad.clicks > 0      ? ad.spend / ad.clicks                 : 0,
    cpa:        ad.purchases > 0   ? ad.spend / ad.purchases              : 0,
    roas:       ad.spend > 0       ? ad.revenue / ad.spend                : 0,
    avg_ticket: ad.purchases > 0   ? ad.revenue / ad.purchases            : 0,
    conv_rate:  ad.clicks > 0      ? (ad.purchases / ad.clicks) * 100     : 0,
  }))
}

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const supabase = getSupabaseAdmin()
  const { data: user } = await supabase
    .from('users')
    .select('id, facebook_access_token')
    .eq('email', session.user.email)
    .single()

  if (!user?.facebook_access_token) {
    return NextResponse.json({ error: 'Token não encontrado' }, { status: 400 })
  }

  const { searchParams } = new URL(req.url)
  const accountId   = searchParams.get('account_id')
  const since       = searchParams.get('since')
  const until       = searchParams.get('until')
  const forceRefresh = searchParams.get('refresh') === '1'

  if (!accountId || !since || !until) {
    return NextResponse.json({ error: 'account_id, since e until são obrigatórios' }, { status: 400 })
  }

  // Verificar cache no Supabase (a menos que forçar refresh)
  if (!forceRefresh) {
    const { data: cached } = await supabase
      .from('creative_metrics_cache')
      .select('ads_json, fetched_at')
      .eq('user_id', user.id)
      .eq('account_id', accountId)
      .eq('since', since)
      .eq('until', until)
      .single()

    if (cached) {
      const ageHours = (Date.now() - new Date(cached.fetched_at).getTime()) / 3600000
      if (ageHours < CACHE_TTL_HOURS) {
        return NextResponse.json({ ads: cached.ads_json, from_cache: true, cached_at: cached.fetched_at })
      }
    }
  }

  // Buscar da Meta API
  const fields = [
    'ad_id', 'ad_name', 'spend', 'clicks', 'impressions', 'ctr', 'cpm',
    'actions', 'action_values', 'video_play_actions',
    'video_30_sec_watched_actions', 'video_thruplay_watched_actions',
  ].join(',')

  const timeRange = encodeURIComponent(JSON.stringify({ since, until }))
  const allRecords: InsightRecord[] = []
  let nextUrl: string | undefined =
    `https://graph.facebook.com/${process.env.META_API_VERSION}/${accountId}/insights` +
    `?level=ad&fields=${fields}&time_range=${timeRange}` +
    `&access_token=${user.facebook_access_token}&limit=100`

  while (nextUrl) {
    const res = await fetch(nextUrl)
    const page = await res.json() as InsightsPagedResponse

    if (page.error) {
      // Se rate limit, tentar retornar cache antigo em vez de falhar
      if (page.error.code === 4 || page.error.code === 17 || page.error.code === 32) {
        const { data: staleCache } = await supabase
          .from('creative_metrics_cache')
          .select('ads_json, fetched_at')
          .eq('user_id', user.id)
          .eq('account_id', accountId)
          .eq('since', since)
          .eq('until', until)
          .single()

        if (staleCache) {
          return NextResponse.json({
            ads: staleCache.ads_json,
            from_cache: true,
            cached_at: staleCache.fetched_at,
            warning: 'Limite da API Meta atingido — exibindo dados do cache. Tente atualizar em alguns minutos.',
          })
        }
        return NextResponse.json({ error: 'Limite de requisições da Meta API atingido. Aguarde alguns minutos e tente novamente.' }, { status: 429 })
      }
      return NextResponse.json({ error: page.error.message }, { status: 500 })
    }

    allRecords.push(...(page.data ?? []))
    nextUrl = page.paging?.next
  }

  const ads = buildAds(allRecords)

  // Salvar no cache do Supabase
  await supabase
    .from('creative_metrics_cache')
    .upsert({ user_id: user.id, account_id: accountId, since, until, ads_json: ads, fetched_at: new Date().toISOString() },
      { onConflict: 'user_id,account_id,since,until' })

  return NextResponse.json({ ads })
}
