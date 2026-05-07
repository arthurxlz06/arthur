import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabaseAdmin } from '@/lib/supabase'

interface MetaAction {
  action_type: string
  value: string
}

interface MetaInsights {
  spend?: string
  clicks?: string
  impressions?: string
  ctr?: string
  cpm?: string
  actions?: MetaAction[]
  action_values?: MetaAction[]
  cost_per_action_type?: MetaAction[]
  video_play_actions?: MetaAction[]
  video_p25_watched_actions?: MetaAction[]
  video_p50_watched_actions?: MetaAction[]
  video_p75_watched_actions?: MetaAction[]
  video_p95_watched_actions?: MetaAction[]
  video_p100_watched_actions?: MetaAction[]
  video_30_sec_watched_actions?: MetaAction[]
  video_thruplay_watched_actions?: MetaAction[]
  outbound_clicks?: MetaAction[]
  website_ctr?: MetaAction[]
}

interface MetaAd {
  id: string
  name: string
  insights?: { data?: MetaInsights[] }
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
  const accountId = searchParams.get('account_id')
  const since = searchParams.get('since')
  const until = searchParams.get('until')

  if (!accountId || !since || !until) {
    return NextResponse.json({ error: 'account_id, since e until são obrigatórios' }, { status: 400 })
  }

  const fields = [
    'ad_name',
    'spend',
    'clicks',
    'impressions',
    'ctr',
    'cpm',
    'actions',
    'action_values',
    'cost_per_action_type',
    'video_play_actions',
    'video_p25_watched_actions',
    'video_p50_watched_actions',
    'video_p75_watched_actions',
    'video_p95_watched_actions',
    'video_p100_watched_actions',
    'video_30_sec_watched_actions',
    'video_thruplay_watched_actions',
    'outbound_clicks',
    'website_ctr',
  ].join(',')

  const url =
    `https://graph.facebook.com/${process.env.META_API_VERSION}/${accountId}/ads` +
    `?fields=id,name,insights.time_range({"since":"${since}","until":"${until}"}){${fields}}` +
    `&filtering=[{"field":"ad.effective_status","operator":"IN","value":["ACTIVE","PAUSED"]}]` +
    `&access_token=${user.facebook_access_token}` +
    `&limit=200`

  const res = await fetch(url)
  const data = await res.json() as { data?: MetaAd[]; error?: { message: string } }

  if (data.error) {
    return NextResponse.json({ error: data.error.message }, { status: 500 })
  }

  const getAction = (arr: MetaAction[], type: string) =>
    parseFloat(arr.find((a) => a.action_type === type)?.value ?? '0')

  const getActionValue = (arr: MetaAction[], type: string) =>
    parseFloat(arr.find((a) => a.action_type === type)?.value ?? '0')

  const getVideoField = (arr: MetaAction[] | undefined, type = 'video_view') =>
    parseFloat(arr?.find((a) => a.action_type === type)?.value ?? '0')

  const ads = (data.data ?? []).map((ad) => {
    const insights: MetaInsights = ad.insights?.data?.[0] ?? {}
    const actions: MetaAction[] = insights.actions ?? []
    const actionValues: MetaAction[] = insights.action_values ?? []

    const spend       = parseFloat(insights.spend ?? '0')
    const impressions = parseInt(insights.impressions ?? '0')
    const clicks      = parseInt(insights.clicks ?? '0')
    const ctr         = parseFloat(insights.ctr ?? '0')
    const cpm         = parseFloat(insights.cpm ?? '0')

    const purchases = getAction(actions, 'purchase') || getAction(actions, 'omni_purchase')
    const revenue   = getActionValue(actionValues, 'purchase') || getActionValue(actionValues, 'omni_purchase')

    const outboundClicks = getAction(actions, 'outbound_click')
    const lpViews        = getAction(actions, 'landing_page_view')

    // 3S VV — video_play_actions conta reproduções iniciadas (padrão Meta = 3s)
    const video3s    = getVideoField(insights.video_play_actions)
    // 15S VV — ThruPlay: assistiu 15s ou até o final se menor que 15s
    const video15s   = getVideoField(insights.video_thruplay_watched_actions)
    const video25pct = getVideoField(insights.video_p25_watched_actions)
    const video30s   = getVideoField(insights.video_30_sec_watched_actions)
    const video50pct = getVideoField(insights.video_p50_watched_actions)
    const video75pct = getVideoField(insights.video_p75_watched_actions)
    const video95pct = getVideoField(insights.video_p95_watched_actions)
    const video100pct = getVideoField(insights.video_p100_watched_actions)

    // Hook Rate = Views 3s / Impressões
    const hookRate = impressions > 0 ? (video3s / impressions) * 100 : 0
    // Body Rate = Views 15s / Views 3s
    const bodyRate = video3s > 0 ? (video15s / video3s) * 100 : 0
    const roas      = spend > 0 ? revenue / spend : 0
    const cpa       = purchases > 0 ? spend / purchases : 0
    const cpc       = outboundClicks > 0 ? spend / outboundClicks : (clicks > 0 ? spend / clicks : 0)
    const avgTicket = purchases > 0 ? revenue / purchases : 0
    const convRate  = outboundClicks > 0 ? (purchases / outboundClicks) * 100 : 0

    return {
      ad_id:        ad.id,
      ad_name:      ad.name,
      spend,
      clicks:       outboundClicks || clicks,
      impressions,
      lp_views:     lpViews,
      video_views:  video3s,
      ctr,
      hook_rate:    hookRate,
      body_rate:    bodyRate,
      cpm,
      cpc,
      cpa,
      purchases,
      revenue,
      roas,
      avg_ticket:   avgTicket,
      conv_rate:    convRate,
      video_3s:     video3s,
      video_15s:    video15s,
      video_25pct:  video25pct,
      video_30s:    video30s,
      video_50pct:  video50pct,
      video_75pct:  video75pct,
      video_95pct:  video95pct,
      video_100pct: video100pct,
    }
  })

  // Agrupar por nome e somar métricas acumuláveis
  const grouped = new Map<string, typeof ads[0]>()

  for (const ad of ads) {
    const key = ad.ad_name.trim()
    const existing = grouped.get(key)

    if (!existing) {
      grouped.set(key, { ...ad })
      continue
    }

    existing.spend        += ad.spend
    existing.clicks       += ad.clicks
    existing.impressions  += ad.impressions
    existing.lp_views     += ad.lp_views
    existing.video_views  += ad.video_views
    existing.purchases    += ad.purchases
    existing.revenue      += ad.revenue
    existing.video_3s     += ad.video_3s
    existing.video_15s    += ad.video_15s
    existing.video_25pct  += ad.video_25pct
    existing.video_30s    += ad.video_30s
    existing.video_50pct  += ad.video_50pct
    existing.video_75pct  += ad.video_75pct
    existing.video_95pct  += ad.video_95pct
    existing.video_100pct += ad.video_100pct
  }

  // Recalcular taxas a partir dos totais — nunca somar percentuais
  const aggregated = Array.from(grouped.values()).map((ad) => ({
    ...ad,
    ctr:        ad.impressions > 0 ? (ad.clicks / ad.impressions) * 100    : 0,
    hook_rate:  ad.impressions > 0 ? (ad.video_3s / ad.impressions) * 100  : 0,
    body_rate:  ad.video_3s > 0    ? (ad.video_15s / ad.video_3s) * 100    : 0,
    cpm:        ad.impressions > 0 ? (ad.spend / ad.impressions) * 1000    : 0,
    cpc:        ad.clicks > 0      ? ad.spend / ad.clicks                  : 0,
    cpa:        ad.purchases > 0   ? ad.spend / ad.purchases               : 0,
    roas:       ad.spend > 0       ? ad.revenue / ad.spend                 : 0,
    avg_ticket: ad.purchases > 0   ? ad.revenue / ad.purchases             : 0,
    conv_rate:  ad.clicks > 0      ? (ad.purchases / ad.clicks) * 100      : 0,
  }))

  return NextResponse.json({ ads: aggregated })
}
