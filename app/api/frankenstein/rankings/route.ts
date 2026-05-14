import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabaseAdmin } from '@/lib/supabase'

interface AdMetrics {
  ad_id: string
  ad_name: string
  hook_rate: number
  body_rate: number
  video_3s: number
  video_15s: number
  cpa: number
  ctr: number
  impressions: number
  spend: number
}

export interface RankedCreative {
  ad_name: string
  hook_rate: number
  body_rate: number
  video_3s: number
  video_15s: number
  cpa: number
  ctr: number
  impressions: number
  dropbox_direct_url: string
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const supabase = getSupabaseAdmin()
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('email', session.user.email)
    .single()

  if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

  // Latest cache entry (most recently fetched, any account/range)
  const { data: caches } = await supabase
    .from('creative_metrics_cache')
    .select('ads_json, account_id, since, until, fetched_at')
    .eq('user_id', user.id)
    .order('fetched_at', { ascending: false })
    .limit(20)

  if (!caches || caches.length === 0) {
    return NextResponse.json({ hooks: [], bodies: [], no_cache: true })
  }

  // Merge ads across all recent caches, keeping latest entry per ad_name
  const adMap = new Map<string, AdMetrics>()
  // Process oldest first so newest overwrites
  for (const cache of [...caches].reverse()) {
    for (const ad of (cache.ads_json as AdMetrics[])) {
      adMap.set(ad.ad_name.trim(), ad)
    }
  }

  const allAds = Array.from(adMap.values())

  // Fetch creative links
  const { data: links } = await supabase
    .from('creative_links')
    .select('ad_name, dropbox_direct_url')
    .eq('user_id', user.id)

  if (!links || links.length === 0) {
    return NextResponse.json({ hooks: [], bodies: [], no_links: true })
  }

  const linkMap = new Map(links.map((l) => [l.ad_name as string, l.dropbox_direct_url as string]))

  // Only keep ads that have a Dropbox link
  const adsWithLinks = allAds
    .filter((ad) => linkMap.has(ad.ad_name))
    .map((ad) => ({ ...ad, dropbox_direct_url: linkMap.get(ad.ad_name)! }))

  // Top 5 Hooks — ranked by hook_rate DESC, tiebreak video_3s DESC
  const hooks: RankedCreative[] = [...adsWithLinks]
    .filter((ad) => ad.hook_rate > 0 && ad.impressions >= 100)
    .sort((a, b) => b.hook_rate - a.hook_rate || b.video_3s - a.video_3s)
    .slice(0, 5)

  // Top 5 Bodies — ranked by body_rate DESC, tiebreak cpa ASC (0 treated as no purchase data → last)
  const bodies: RankedCreative[] = [...adsWithLinks]
    .filter((ad) => ad.body_rate > 0 && ad.video_3s >= 50)
    .sort((a, b) => {
      if (Math.abs(b.body_rate - a.body_rate) > 0.01) return b.body_rate - a.body_rate
      const cpaA = a.cpa > 0 ? a.cpa : Infinity
      const cpaB = b.cpa > 0 ? b.cpa : Infinity
      return cpaA - cpaB
    })
    .slice(0, 5)

  return NextResponse.json({ hooks, bodies })
}
