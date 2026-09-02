import { NextResponse } from 'next/server'
import { getCampaigns, toTargetData } from '@/lib/bot/meta'
import { getRules, getCooldownState } from '@/lib/bot/db'
import { evaluate } from '@/lib/bot/engine'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const days = parseInt(searchParams.get('days') || '7', 10)

    const [campaigns, allRules, cooldownState] = await Promise.all([
      getCampaigns(days),
      getRules(),
      getCooldownState(),
    ])

    // Só avalia regras de nível campanha nesta aba
    const rules = allRules.filter(r => (r.filter_level ?? 'campaign') === 'campaign')
    const targets = campaigns.map(c => toTargetData(c, 'campaign'))
    const planned = evaluate(targets, rules, cooldownState)

    const result = campaigns.map(c => {
      const action = planned.find(a => a.target.item_id === c.campaign_id)
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
