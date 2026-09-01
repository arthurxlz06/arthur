import 'server-only'
import type { Rule, RuleCondition, CooldownState } from './db'
import type { CampaignData } from './meta'

export type ActionType = 'scale_pct' | 'scale_fixed' | 'set_budget' | 'duplicate' | 'no_action'

export interface SkipReason {
  rule_name: string
  reason: 'cooldown' | 'allowed_hours' | 'max_duplicates' | 'duplicate_until'
  detail: string
}

export interface PlannedAction {
  campaign: CampaignData
  rule: Rule | null
  type: ActionType
  new_budget_cents?: number
  reason: string
  skipped_rules: SkipReason[]  // regras que matcharam mas foram bloqueadas
}

function getMetric(campaign: CampaignData, metric: string): number {
  return (campaign as unknown as Record<string, number>)[metric] ?? 0
}

function checkCondition(campaign: CampaignData, cond: RuleCondition): boolean {
  const v = getMetric(campaign, cond.metric)
  switch (cond.operator) {
    case '>':  return v > cond.value
    case '>=': return v >= cond.value
    case '<':  return v < cond.value
    case '<=': return v <= cond.value
    case '==': return v === cond.value
    case '!=': return v !== cond.value
    default:   return false
  }
}

function campaignMatchesFilter(campaign: CampaignData, rule: Rule): boolean {
  if (rule.campaign_filter === 'name_contains') {
    const text = rule.campaign_filter_text?.toLowerCase().trim()
    return text ? campaign.campaign_name.toLowerCase().includes(text) : true
  }
  if (rule.campaign_filter === 'specific') {
    return rule.campaign_filter_ids?.includes(campaign.campaign_id) ?? false
  }
  return true // 'all'
}

function cooldownKey(campaignId: string, ruleId: string) {
  return `${campaignId}::${ruleId}`
}

// Retorna null se pode executar, ou string com motivo do bloqueio
function checkRuleConstraints(
  campaign: CampaignData,
  rule: Rule,
  state: CooldownState,
  now: Date,
): string | null {
  const nowHour = now.getHours()
  const key = cooldownKey(campaign.campaign_id, rule.id)

  // Verificar horários permitidos
  if (rule.allowed_hours.length > 0 && !rule.allowed_hours.includes(nowHour)) {
    const lista = rule.allowed_hours.map(h => `${h}h`).join(', ')
    return `Fora do horário permitido (${lista}). Hora atual: ${nowHour}h`
  }

  // Verificar intervalo mínimo entre execuções
  if (rule.cooldown_hours > 0 && state.last_executed[key]) {
    const last = new Date(state.last_executed[key]).getTime()
    const diffHours = (now.getTime() - last) / 3600000
    if (diffHours < rule.cooldown_hours) {
      const restante = (rule.cooldown_hours - diffHours).toFixed(1)
      return `Intervalo mínimo: ${rule.cooldown_hours}h. Faltam ${restante}h para próxima execução.`
    }
  }

  // Verificações específicas de duplicação
  if (rule.action === 'duplicate') {
    // Verificar horário limite
    if (rule.duplicate_until) {
      const [limitH, limitM] = rule.duplicate_until.split(':').map(Number)
      const limitMinutes = limitH * 60 + (limitM || 0)
      const nowMinutes = now.getHours() * 60 + now.getMinutes()
      if (nowMinutes > limitMinutes) {
        return `Duplicação bloqueada após ${rule.duplicate_until}. Hora atual: ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`
      }
    }

    // Verificar máximo de duplicações
    if (rule.max_duplicates > 0) {
      const count = state.duplicate_counts[key] ?? 0
      if (count >= rule.max_duplicates) {
        return `Limite de ${rule.max_duplicates} duplicação(ões) atingido (realizadas: ${count}). Resete os contadores para permitir novas.`
      }
    }
  }

  return null
}

export function evaluate(
  campaigns: CampaignData[],
  rules: Rule[],
  cooldownState: CooldownState,
  now = new Date(),
): PlannedAction[] {
  const active = [...rules.filter(r => r.active)].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  return campaigns.map(campaign => {
    const skipped_rules: SkipReason[] = []

    for (const rule of active) {
      if (!campaignMatchesFilter(campaign, rule)) continue
      if (!rule.conditions.every(c => checkCondition(campaign, c))) continue

      // Condições batem — verificar restrições de intervalo/horário/limite
      const bloqueio = checkRuleConstraints(campaign, rule, cooldownState, now)
      if (bloqueio) {
        skipped_rules.push({ rule_name: rule.name, reason: 'cooldown', detail: bloqueio })
        continue
      }

      const reason = rule.conditions.map(c => {
        const v = getMetric(campaign, c.metric)
        return `${c.metric}=${v.toFixed(2)} ${c.operator} ${c.value}`
      }).join(' · ')

      if (rule.action === 'scale_pct') {
        const new_budget_cents = Math.round(campaign.daily_budget * (1 + rule.action_value / 100))
        return { campaign, rule, type: 'scale_pct' as ActionType, new_budget_cents, reason, skipped_rules }
      }
      if (rule.action === 'scale_fixed') {
        const new_budget_cents = campaign.daily_budget + Math.round(rule.action_value * 100)
        return { campaign, rule, type: 'scale_fixed' as ActionType, new_budget_cents, reason, skipped_rules }
      }
      if (rule.action === 'set_budget') {
        const new_budget_cents = Math.round(rule.action_value * 100)
        return { campaign, rule, type: 'set_budget' as ActionType, new_budget_cents, reason, skipped_rules }
      }
      if (rule.action === 'duplicate') {
        return { campaign, rule, type: 'duplicate' as ActionType, reason, skipped_rules }
      }
    }

    return { campaign, rule: null, type: 'no_action' as ActionType, reason: 'Nenhuma regra disparou', skipped_rules }
  })
}
