import { NextResponse } from 'next/server'
import { getSettings, saveSettings } from '@/lib/bot/db'

export async function GET() {
  const settings = await getSettings()
  return NextResponse.json({ settings })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const settings = await saveSettings(body)
    return NextResponse.json({ settings })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
