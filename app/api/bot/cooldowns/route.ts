import { NextResponse } from 'next/server'
import { getCooldownState, resetDuplicateCounts, resetAllCooldowns } from '@/lib/bot/db'

export async function GET() {
  return NextResponse.json({ state: await getCooldownState() })
}

// DELETE ?type=duplicates  → só zera contadores de duplicação
// DELETE                   → zera tudo (cooldowns + contadores)
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  if (searchParams.get('type') === 'duplicates') {
    await resetDuplicateCounts()
    return NextResponse.json({ reset: 'duplicate_counts' })
  }
  await resetAllCooldowns()
  return NextResponse.json({ reset: 'all' })
}
