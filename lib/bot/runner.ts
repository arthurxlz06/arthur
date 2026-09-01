import 'server-only'
import { getCampaigns, updateBudget, copyCampaign } from './meta'
import { evaluate } from './engine'
import { getRules, getSettings, saveSettings, appendLog, getCooldownState, saveCooldownState } from './db'

export interface RunResult {
  dry_run: boolean; campaigns_analyzed: number
  actions_taken: number; errors: number
  started_at: string; finished_at: string
}

const ACTION_LABELS: Record<string, string> = {
  scale_pct: 'Escalar %', scale_fixed: 'Escalar R$',
  set_budget: 'Definir Orçamento', duplicate: 'Duplicar',
}

function cooldownKey(campaignId: string, ruleId: string) {
  return `${campaignId}::${ruleId}`
}

export async function runBot(): Promise<RunResult> {
  const started_at = new Date().toISOString()
  const now = new Date()
  const settings = await getSettings()
  const { dry_run, date_window_days } = settings
  await saveSettings({ last_run: started_at })

  const [campaigns, rules, cooldownState] = await Promise.all([
    getCampaigns(date_window_days),
    getRules(),
    getCooldownState(),
  ])

  const planned = evaluate(campaigns, rules, cooldownState, now)
  let actions_taken = 0, errors = 0

  for (const action of planned) {
    if (action.type === 'no_action') continue

    let success = true, error: string | null = null
    try {
      if (!dry_run) {
        if (action.type !== 'duplicate' && action.new_budget_cents != null) {
          await updateBudget(action.campaign.campaign_id, action.new_budget_cents)
        } else if (action.type === 'duplicate') {
          await copyCampaign(action.campaign.campaign_id)
        }
      }

      // Atualizar estado de cooldown
      if (action.rule) {
        const key = cooldownKey(action.campaign.campaign_id, action.rule.id)
        cooldownState.last_executed[key] = now.toISOString()
        if (action.type === 'duplicate') {
          cooldownState.duplicate_counts[key] = (cooldownState.duplicate_counts[key] ?? 0) + 1
        }
      }

      actions_taken++
    } catch (err) {
      success = false; error = err instanceof Error ? err.message : String(err); errors++
    }

    const oldBudget = `R$${(action.campaign.daily_budget / 100).toFixed(2)}`
    const newBudget = action.new_budget_cents != null ? `R$${(action.new_budget_cents / 100).toFixed(2)}` : ''
    const details = action.type === 'duplicate'
      ? `Campanha duplicada (pausada) | ${action.reason}`
      : `Orçamento: ${oldBudget} → ${newBudget} | ${action.reason}`

    await appendLog({
      campaign_id: action.campaign.campaign_id,
      campaign_name: action.campaign.campaign_name,
      rule_name: action.rule?.name ?? null,
      action: ACTION_LABELS[action.type] ?? action.type,
      details, dry_run, success, error,
    })
  }

  // Persistir cooldowns atualizados
  await saveCooldownState(cooldownState)

  return {
    dry_run, campaigns_analyzed: campaigns.length,
    actions_taken, errors,
    started_at, finished_at: new Date().toISOString(),
  }
}
