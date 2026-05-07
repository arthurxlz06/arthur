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
  cpp?: string
  actions?: MetaAction[]
  action_values?: MetaAction[]
  video_p25_watched_actions?: MetaAction[]
  video_p50_watched_actions?: MetaAction[]
  video_p75_watched_actions?: MetaAction[]
  video_p95_watched_actions?: MetaAction[]
  video_p100_watched_actions?: MetaAction[]
  video_30_sec_watched_actions?: MetaAction[]
  video_avg_time_watched_actions?: MetaAction[]
  outbound_clicks?: MetaAction[]
}

interface MetaAd {
  id: string
  name: string
  insights?: { data?: MetaInsights[] }
}

function getAction(actions: MetaAction[], type: string): number {
  return parseFloat(actions.find((a) => a.action_type === type)?.value ?? '0')
}

function getVideo(arr: MetaAction[] | undefined, type: string): number {
  return parseFloat(arr?.find((a) => a.action_type === type)?.value ?? '0')
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
    'actions',
    'action_values',
    'ctr',
    'cpm',
    'cpp',
    'cost_per_action_type',
    'video_p25_watched_actions',
    'video_p50_watched_actions',
    'video_p75_watched_actions',
    'video_p95_watched_actions',
    'video_p100_watched_actions',
    'video_30_sec_watched_actions',
    'video_avg_time_watched_actions',
    'landing_page_view_rate',
    'outbound_clicks',
  ].join(',')

  const url =
    `https://graph.facebook.com/${process.env.META_API_VERSION}/${accountId}/ads?` +
    `fields=name,insights.time_range({"since":"${since}","until":"${until}"}){${fields}}` +
    `&access_token=${user.facebook_access_token}` +
    `&limit=200`

  const res = await fetch(url)
  const data = await res.json() as { data?: MetaAd[]; error?: { message: string } }

  if (data.error) {
    return NextResponse.json({ error: data.error.message }, { status: 500 })
  }

  const ads = (data.data ?? []).map((ad) => {
    const insights: MetaInsights = ad.insights?.data?.[0] ?? {}
    const actions = insights.actions ?? []
    const actionValues = insights.action_values ?? []

    const spend = parseFloat(insights.spend ?? '0')
    const impressions = parseInt(insights.impressions ?? '0')
    const clicks = parseInt(insights.clicks ?? '0')
    const lpViews = getAction(actions, 'landing_page_view')
    const purchases = getAction(actions, 'purchase')
    const revenue = getAction(actionValues, 'purchase')
    const video3s = getAction(actions, 'video_view')
    const video15s = getVideo(insights.video_avg_time_watched_actions, 'video_view')

    const hookRate = impressions > 0 ? (video3s / impressions) * 100 : 0
    const bodyRate = video3s > 0 ? (video15s / video3s) * 100 : 0
    const roas = spend > 0 ? revenue / spend : 0
    const cpa = purchases > 0 ? spend / purchases : 0
    const avgTicket = purchases > 0 ? revenue / purchases : 0
    const convRate = clicks > 0 ? (purchases / clicks) * 100 : 0

    return {
      ad_id: ad.id,
      ad_name: ad.name,
      spend,
      clicks,
      impressions,
      lp_views: lpViews,
      video_views: video3s,
      ctr: parseFloat(insights.ctr ?? '0'),
      hook_rate: hookRate,
      body_rate: bodyRate,
      cpm: parseFloat(insights.cpm ?? '0'),
      cpc: clicks > 0 ? spend / clicks : 0,
      cpa,
      purchases,
      revenue,
      roas,
      avg_ticket: avgTicket,
      conv_rate: convRate,
      video_3s: video3s,
      video_15s: video15s,
      video_25pct: getVideo(insights.video_p25_watched_actions, 'video_view'),
      video_30s: getVideo(insights.video_30_sec_watched_actions, 'video_view'),
      video_50pct: getVideo(insights.video_p50_watched_actions, 'video_view'),
      video_75pct: getVideo(insights.video_p75_watched_actions, 'video_view'),
      video_95pct: getVideo(insights.video_p95_watched_actions, 'video_view'),
      video_100pct: getVideo(insights.video_p100_watched_actions, 'video_view'),
    }
  })

  return NextResponse.json({ ads })
}
