import { NextResponse } from 'next/server'
import { getCampaignNames, getAdSetNames, getAdNames } from '@/lib/bot/meta'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const level = searchParams.get('level') ?? 'campaign'

    if (level === 'adset') {
      const items = await getAdSetNames()
      return NextResponse.json({ items })
    }
    if (level === 'ad') {
      const items = await getAdNames()
      return NextResponse.json({ items })
    }
    const items = await getCampaignNames()
    return NextResponse.json({ items })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
