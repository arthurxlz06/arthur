import 'server-only'
import type { Rule, RuleCondition, CooldownState } from './db'
import type { TargetData } from './meta'

export type ActionType = 'scale_pct' | 'scale_fixed' | 'set_budget' | 'duplicate' | 'no_action'

export interface SkipReason {
  rule_name: string
  reason: 'cooldown' | 'allowed_hours' | 'max_duplicates' | 'duplicate_until'
  detail: string
}

export interface PlannedAction {
  target: TargetData
  rule: Rule | null
  type: ActionType
  new_budget_cents?: number
  reason: string
  skipped_rules: SkipReason[]
}

function getMetric(target: TargetData, metric: string): number {
  return (target as unknown as Record<string, number>)[metric] ?? 0
}

function checkCondition(target: TargetData, cond: RuleCondition): boolean {
  const v = getMetric(target, cond.metric)
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

// Statuses considerados "ativos" para o filtro 'all'
// Campanhas PAUSED, DELETED, ARCHIVED, DISAPPROVED são ignoradas
const ACTIVE_STATUSES = new Set([
  'ACTIVE',
  'PENDING_REVIEW',
  'IN_PROCESS',
  'PENDING_BILLING_INFO',
  'WITH_ISSUES', // ativa mas com problemas — ainda conta
])

function itemMatchesFilter(target: TargetData, rule: Rule): boolean {
  if (rule.campaign_filter === 'name_contains') {
    const text = rule.campaign_filter_text?.toLowerCase().trim()
    if (!text) return true
    if (!target.item_name.toLowerCase().includes(text)) return false
    // Mesmo com nome correspondente, ignora inativas
    return ACTIVE_STATUSES.has(target.effective_status)
  }
  if (rule.campaign_filter === 'specific') {
    // Seleção manual respeita o que o usuário escolheu, sem filtrar por status
    return rule.campaign_filter_ids?.includes(target.item_id) ?? false
  }
  // 'all' → só ativas/pendentes/em análise
  return ACTIVE_STATUSES.has(target.effective_status)
}

function cooldownKey(itemId: string, ruleId: string) {
  return `${itemId}::${ruleId}`
}

function checkRuleConstraints(
  target: TargetData,
  rule: Rule,
  state: CooldownState,
  now: Date,
): string | null {
  const nowHour = now.getHours()
  const key = cooldownKey(target.item_id, rule.id)

  if (rule.allowed_hours.length > 0 && !rule.allowed_hours.includes(nowHour)) {
    const lista = rule.allowed_hours.map(h => `${h}h`).join(', ')
    return `Fora do horário permitido (${lista}). Hora atual: ${nowHour}h`
  }

  if (rule.cooldown_hours > 0 && state.last_executed[key]) {
    const last = new Date(state.last_executed[key]).getTime()
    const diffHours = (now.getTime() - last) / 3600000
    if (diffHours < rule.cooldown_hours) {
      const restante = (rule.cooldown_hours - diffHours).toFixed(1)
      return `Intervalo mínimo: ${rule.cooldown_hours}h. Faltam ${restante}h para próxima execução.`
    }
  }

  if (rule.action === 'duplicate') {
    if (rule.duplicate_until) {
      const [limitH, limitM] = rule.duplicate_until.split(':').map(Number)
      const limitMinutes = limitH * 60 + (limitM || 0)
      const nowMinutes = now.getHours() * 60 + now.getMinutes()
      if (nowMinutes > limitMinutes) {
        return `Duplicação bloqueada após ${rule.duplicate_until}. Hora atual: ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`
      }
    }
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
  targets: TargetData[],
  rules: Rule[],
  cooldownState: CooldownState,
  now = new Date(),
): PlannedAction[] {
  const active = [...rules.filter(r => r.active)].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  return targets.map(target => {
    const skipped_rules: SkipReason[] = []

    for (const rule of active) {
      if (!itemMatchesFilter(target, rule)) continue
      if (!rule.conditions.every(c => checkCondition(target, c))) continue

      const bloqueio = checkRuleConstraints(target, rule, cooldownState, now)
      if (bloqueio) {
        skipped_rules.push({ rule_name: rule.name, reason: 'cooldown', detail: bloqueio })
        continue
      }

      const reason = rule.conditions.map(c => {
        const v = getMetric(target, c.metric)
        return `${c.metric}=${v.toFixed(2)} ${c.operator} ${c.value}`
      }).join(' · ')

      if (rule.action === 'scale_pct') {
        const new_budget_cents = Math.round(target.daily_budget * (1 + rule.action_value / 100))
        return { target, rule, type: 'scale_pct' as ActionType, new_budget_cents, reason, skipped_rules }
      }
      if (rule.action === 'scale_fixed') {
        const new_budget_cents = target.daily_budget + Math.round(rule.action_value * 100)
        return { target, rule, type: 'scale_fixed' as ActionType, new_budget_cents, reason, skipped_rules }
      }
      if (rule.action === 'set_budget') {
        const new_budget_cents = Math.round(rule.action_value * 100)
        return { target, rule, type: 'set_budget' as ActionType, new_budget_cents, reason, skipped_rules }
      }
      if (rule.action === 'duplicate') {
        return { target, rule, type: 'duplicate' as ActionType, reason, skipped_rules }
      }
    }

    return { target, rule: null, type: 'no_action' as ActionType, reason: 'Nenhuma regra disparou', skipped_rules }
  })
}
