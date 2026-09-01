import { NextResponse } from 'next/server'
import { getCampaigns } from '@/lib/bot/meta'
import { getRules, getCooldownState } from '@/lib/bot/db'
import { evaluate } from '@/lib/bot/engine'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const days = parseInt(searchParams.get('days') || '7', 10)

    const [campaigns, rules, cooldownState] = await Promise.all([
      getCampaigns(days),
      getRules(),
      getCooldownState(),
    ])
    const planned = evaluate(campaigns, rules, cooldownState)

    const result = campaigns.map(c => {
      const action = planned.find(a => a.campaign.campaign_id === c.campaign_id)
      return {
        ...c,
        planned_action: action?.type ?? 'no_action',
        planned_rule: action?.rule?.name ?? null,
        planned_new_budget: action?.new_budget_cents ?? null,
        skipped_rules: action?.skipped_rules ?? [],
      }
    })

    return NextResponse.json({ campaigns: result })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
