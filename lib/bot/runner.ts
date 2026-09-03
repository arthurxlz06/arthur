import 'server-only'
import { getCampaigns, getAdSets, getAds, toTargetData, updateBudget, updateAdSetBudget, copyCampaign, copyAdSet, copyAd } from './meta'
import { evaluate } from './engine'
import { getRules, getSettings, saveSettings, appendLog, getCooldownState, saveCooldownState } from './db'
import type { FilterLevel } from './db'
import type { TargetData } from './meta'

export interface RunResult {
  dry_run: boolean; campaigns_analyzed: number
  actions_taken: number; errors: number
  started_at: string; finished_at: string
}

const ACTION_LABELS: Record<string, string> = {
  scale_pct: 'Escalar %', scale_fixed: 'Escalar R$',
  set_budget: 'Definir Orçamento', duplicate: 'Duplicar',
}

function cooldownKey(itemId: string, ruleId: string) {
  return `${itemId}::${ruleId}`
}

function windowToRange(days: number): { since: string; until: string } {
  const until = new Date()
  const since = new Date(until)
  since.setDate(since.getDate() - (days - 1))
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  return { since: fmt(since), until: fmt(until) }
}

async function fetchTargets(level: FilterLevel, dateWindowDays: number): Promise<TargetData[]> {
  const { since, until } = windowToRange(dateWindowDays)
  if (level === 'adset') {
    const adsets = await getAdSets(since, until)
    return adsets.map(s => toTargetData(s, 'adset'))
  }
  if (level === 'ad') {
    const ads = await getAds(since, until)
    return ads.map(a => toTargetData(a, 'ad'))
  }
  const campaigns = await getCampaigns(since, until)
  return campaigns.map(c => toTargetData(c, 'campaign'))
}

async function executeAction(
  target: TargetData,
  level: FilterLevel,
  actionType: string,
  newBudgetCents?: number,
): Promise<void> {
  if (actionType === 'duplicate') {
    if (level === 'adset') await copyAdSet(target.item_id)
    else if (level === 'ad') await copyAd(target.item_id)
    else await copyCampaign(target.item_id)
  } else if (newBudgetCents != null) {
    if (level === 'adset') await updateAdSetBudget(target.item_id, newBudgetCents)
    else await updateBudget(target.item_id, newBudgetCents)
  }
}

export async function runBot(): Promise<RunResult> {
  const started_at = new Date().toISOString()
  const now = new Date()
  const settings = await getSettings()
  const { dry_run, date_window_days } = settings
  await saveSettings({ last_run: started_at })

  const [allRules, cooldownState] = await Promise.all([getRules(), getCooldownState()])
  const activeRules = allRules.filter(r => r.active)

  // Agrupa regras por nível, busca dados só dos níveis que têm regras ativas
  const levelsSet = new Set(activeRules.map(r => r.filter_level ?? 'campaign'))
  const levels = Array.from(levelsSet) as FilterLevel[]
  if (levels.length === 0) levels.push('campaign')

  let totalAnalyzed = 0, actions_taken = 0, errors = 0

  // Mesmos status que o engine considera "ativos" — campanhas PAUSED, ARCHIVED, etc. são ignoradas
  const RUNNER_ACTIVE = new Set(['ACTIVE', 'PENDING_REVIEW', 'IN_PROCESS', 'PENDING_BILLING_INFO', 'WITH_ISSUES'])

  for (const level of levels) {
    const rulesForLevel = activeRules.filter(r => (r.filter_level ?? 'campaign') === level)
    const allTargets = await fetchTargets(level, date_window_days)
    const targets = allTargets.filter(t => RUNNER_ACTIVE.has(t.effective_status))
    const planned = evaluate(targets, rulesForLevel, cooldownState, now)
    totalAnalyzed += targets.length

    for (const action of planned) {
      if (action.type === 'no_action') continue

      let success = true, error: string | null = null
      try {
        if (!dry_run) {
          await executeAction(action.target, level, action.type, action.new_budget_cents)
        }

        if (action.rule) {
          const key = cooldownKey(action.target.item_id, action.rule.id)
          cooldownState.last_executed[key] = now.toISOString()
          if (action.type === 'duplicate') {
            cooldownState.duplicate_counts[key] = (cooldownState.duplicate_counts[key] ?? 0) + 1
          }
        }
        actions_taken++
      } catch (err) {
        success = false; error = err instanceof Error ? err.message : String(err); errors++
      }

      const levelLabel = level === 'adset' ? 'Conjunto' : level === 'ad' ? 'Anúncio' : 'Campanha'
      const oldBudget = `R$${(action.target.daily_budget / 100).toFixed(2)}`
      const newBudget = action.new_budget_cents != null ? `R$${(action.new_budget_cents / 100).toFixed(2)}` : ''
      const details = action.type === 'duplicate'
        ? `[${levelLabel}] ${action.target.item_name} duplicado (pausado) | ${action.reason}`
        : `[${levelLabel}] ${action.target.item_name} | Orçamento: ${oldBudget} → ${newBudget} | ${action.reason}`

      await appendLog({
        campaign_id: action.target.item_id,
        campaign_name: action.target.item_name,
        rule_name: action.rule?.name ?? null,
        action: ACTION_LABELS[action.type] ?? action.type,
        details, dry_run, success, error,
      })
    }
  }

  await saveCooldownState(cooldownState)

  return {
    dry_run, campaigns_analyzed: totalAnalyzed,
    actions_taken, errors,
    started_at, finished_at: new Date().toISOString(),
  }
}
