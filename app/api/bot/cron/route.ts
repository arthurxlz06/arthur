/**
 * Endpoint para acionar o bot via cron externo (macOS launchd, crontab, etc.).
 *
 * Exemplo de uso com crontab (1x/dia às 08:00):
 *   0 8 * * * curl -s -X POST http://localhost:3000/api/bot/cron
 */
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

// GET também funciona para facilitar teste no browser
export async function GET() {
  return POST()
}
