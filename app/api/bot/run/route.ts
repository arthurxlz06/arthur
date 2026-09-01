import { NextResponse } from 'next/server'
import { runBot } from '@/lib/bot/runner'

export async function POST() {
  try {
    const result = await runBot()
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
