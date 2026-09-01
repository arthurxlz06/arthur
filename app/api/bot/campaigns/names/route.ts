import { NextResponse } from 'next/server'
import { getCampaignNames } from '@/lib/bot/meta'

export async function GET() {
  try {
    const campaigns = await getCampaignNames()
    return NextResponse.json({ campaigns })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
