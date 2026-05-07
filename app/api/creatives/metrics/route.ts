import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabaseAdmin } from '@/lib/supabase'

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
  video_p25_watched_actions?: MetaAction[]
  video_p50_watched_actions?: MetaAction[]
  video_p75_watched_actions?: MetaAction[]
  video_p95_watched_actions?: MetaAction[]
  video_p100_watched_actions?: MetaAction[]
  video_30_sec_watched_actions?: MetaAction[]
  video_thruplay_watched_actions?: MetaAction[]
  outbound_clicks?: MetaAction[]
}

interface InsightsPagedResponse {
  data?: InsightRecord[]
  paging?: { next?: string }
  error?: { message: string }
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
    'ad_id',
    'ad_name',
    'spend',
    'clicks',
    'impressions',
    'ctr',
    'cpm',
    'actions',
    'action_values',
    'video_play_actions',
    'video_p25_watched_actions',
    'video_p50_watched_actions',
    'video_p75_watched_actions',
    'video_p95_watched_actions',
    'video_p100_watched_actions',
    'video_30_sec_watched_actions',
    'video_thruplay_watched_actions',
    'outbound_clicks',
  ].join(',')

  const timeRange = encodeURIComponent(JSON.stringify({ since, until }))

  // Insights API com level=ad — retorna todos os ads que tiveram gasto no período
  const allRecords: InsightRecord[] = []
  let nextUrl: string | undefined =
    `https://graph.facebook.com/${process.env.META_API_VERSION}/${accountId}/insights` +
    `?level=ad` +
    `&fields=${fields}` +
    `&time_range=${timeRange}` +
    `&access_token=${user.facebook_access_token}` +
    `&limit=100`

  while (nextUrl) {
    const res = await fetch(nextUrl)
    const page = await res.json() as InsightsPagedResponse

    if (page.error) {
      return NextResponse.json({ error: page.error.message }, { status: 500 })
    }

    allRecords.push(...(page.data ?? []))
    nextUrl = page.paging?.next
  }

  const getAction = (arr: MetaAction[] | undefined, type: string) =>
    parseFloat(arr?.find((a) => a.action_type === type)?.value ?? '0')

  const getVideoField = (arr: MetaAction[] | undefined, type = 'video_view') =>
    parseFloat(arr?.find((a) => a.action_type === type)?.value ?? '0')

  const ads = allRecords.map((r) => {
    const spend       = parseFloat(r.spend ?? '0')
    const impressions = parseInt(r.impressions ?? '0')
    const clicks      = parseInt(r.clicks ?? '0')
    const ctr         = parseFloat(r.ctr ?? '0')
    const cpm         = parseFloat(r.cpm ?? '0')

    const outboundClicks = getAction(r.outbound_clicks, 'outbound_click')
    const lpViews        = getAction(r.actions, 'landing_page_view')
    const purchases      = getAction(r.actions, 'purchase') || getAction(r.actions, 'omni_purchase')
    const revenue        = getAction(r.action_values, 'purchase') || getAction(r.action_values, 'omni_purchase')

    const video3s    = getVideoField(r.video_play_actions)
    const video15s   = getVideoField(r.video_thruplay_watched_actions)
    const video25pct = getVideoField(r.video_p25_watched_actions)
    const video30s   = getVideoField(r.video_30_sec_watched_actions)
    const video50pct = getVideoField(r.video_p50_watched_actions)
    const video75pct = getVideoField(r.video_p75_watched_actions)
    const video95pct = getVideoField(r.video_p95_watched_actions)
    const video100pct = getVideoField(r.video_p100_watched_actions)

    const hookRate  = impressions > 0 ? (video3s / impressions) * 100 : 0
    const bodyRate  = video3s > 0 ? (video15s / video3s) * 100 : 0
    const roas      = spend > 0 ? revenue / spend : 0
    const cpa       = purchases > 0 ? spend / purchases : 0
    const effectiveClicks = outboundClicks || clicks
    const cpc       = effectiveClicks > 0 ? spend / effectiveClicks : 0
    const avgTicket = purchases > 0 ? revenue / purchases : 0
    const convRate  = effectiveClicks > 0 ? (purchases / effectiveClicks) * 100 : 0

    return {
      ad_id:        r.ad_id,
      ad_name:      r.ad_name,
      spend,
      clicks:       effectiveClicks,
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

  return NextResponse.json({ ads })
}
