import { NextResponse } from 'next/server'
import { getLogs, clearLogs } from '@/lib/bot/db'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const limit = parseInt(searchParams.get('limit') || '100', 10)
  const logs = await getLogs(limit)
  return NextResponse.json({ logs })
}

export async function DELETE() {
  await clearLogs()
  return NextResponse.json({ success: true })
}
