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

interface MetaPagedResponse {
  data?: MetaAd[]
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

  // Busca todas as páginas — sem filtro de status para incluir todos os criativos do período
  const allAds: MetaAd[] = []
  let nextUrl: string | undefined =
    `https://graph.facebook.com/${process.env.META_API_VERSION}/${accountId}/ads` +
    `?fields=id,name,insights.time_range({"since":"${since}","until":"${until}"}){${fields}}` +
    `&access_token=${user.facebook_access_token}` +
    `&limit=500`

  while (nextUrl) {
    const res = await fetch(nextUrl)
    const page = await res.json() as MetaPagedResponse

    if (page.error) {
      return NextResponse.json({ error: page.error.message }, { status: 500 })
    }

    allAds.push(...(page.data ?? []))
    nextUrl = page.paging?.next
  }

  const getAction = (arr: MetaAction[], type: string) =>
    parseFloat(arr.find((a) => a.action_type === type)?.value ?? '0')

  const getActionValue = (arr: MetaAction[], type: string) =>
    parseFloat(arr.find((a) => a.action_type === type)?.value ?? '0')

  const getVideoField = (arr: MetaAction[] | undefined, type = 'video_view') =>
    parseFloat(arr?.find((a) => a.action_type === type)?.value ?? '0')

  // Deduplica por ad_id
  const seenIds = new Set<string>()
  const uniqueAds = allAds.filter((ad) => {
    if (seenIds.has(ad.id)) return false
    seenIds.add(ad.id)
    return true
  })

  const ads = uniqueAds.map((ad) => {
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

  return NextResponse.json({ ads })
}
