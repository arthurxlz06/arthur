import 'server-only'
import { getSupabaseAdmin } from '@/lib/supabase'

// ─── Regras ───────────────────────────────────────────────────────────────────

export type ConditionOperator = '>' | '>=' | '<' | '<=' | '==' | '!='

export interface RuleCondition {
  metric: string
  operator: ConditionOperator
  value: number
}

export type RuleAction = 'scale_pct' | 'scale_fixed' | 'set_budget' | 'duplicate'

export type FilterLevel = 'campaign' | 'adset' | 'ad'

export interface Rule {
  id: string
  name: string
  active: boolean
  conditions: RuleCondition[]
  action: RuleAction
  action_value: number

  // Nível de filtro: campanha, conjunto ou anúncio
  filter_level: FilterLevel

  // Filtro de itens no nível selecionado
  campaign_filter: 'all' | 'name_contains' | 'specific'
  campaign_filter_text: string
  campaign_filter_ids: string[]

  // Controle de intervalo / horário
  cooldown_hours: number
  allowed_hours: number[]

  // Controle específico para duplicar
  max_duplicates: number
  duplicate_until: string

  created_at: string
}

const RULE_DEFAULTS = {
  filter_level: 'campaign' as FilterLevel,
  campaign_filter: 'all' as const,
  campaign_filter_text: '',
  campaign_filter_ids: [] as string[],
  cooldown_hours: 0,
  allowed_hours: [] as number[],
  max_duplicates: 0,
  duplicate_until: '',
}

function rowToRule(row: Record<string, unknown>): Rule {
  return {
    ...RULE_DEFAULTS,
    id: row.id as string,
    name: row.name as string,
    active: row.active as boolean,
    conditions: (row.conditions as RuleCondition[]) ?? [],
    action: row.action as RuleAction,
    action_value: Number(row.action_value),
    filter_level: (row.filter_level as FilterLevel) ?? 'campaign',
    campaign_filter: (row.campaign_filter as Rule['campaign_filter']) ?? 'all',
    campaign_filter_text: (row.campaign_filter_text as string) ?? '',
    campaign_filter_ids: (row.campaign_filter_ids as string[]) ?? [],
    cooldown_hours: Number(row.cooldown_hours ?? 0),
    allowed_hours: (row.allowed_hours as number[]) ?? [],
    max_duplicates: Number(row.max_duplicates ?? 0),
    duplicate_until: (row.duplicate_until as string) ?? '',
    created_at: row.created_at as string,
  }
}

export async function getRules(): Promise<Rule[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('bot_rules')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToRule)
}

export async function createRule(data: Omit<Rule, 'id' | 'created_at'>): Promise<Rule> {
  const { data: row, error } = await getSupabaseAdmin()
    .from('bot_rules')
    .insert({
      name: data.name,
      active: data.active,
      conditions: data.conditions,
      action: data.action,
      action_value: data.action_value,
      filter_level: data.filter_level,
      campaign_filter: data.campaign_filter,
      campaign_filter_text: data.campaign_filter_text,
      campaign_filter_ids: data.campaign_filter_ids,
      cooldown_hours: data.cooldown_hours,
      allowed_hours: data.allowed_hours,
      max_duplicates: data.max_duplicates,
      duplicate_until: data.duplicate_until,
    })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return rowToRule(row as Record<string, unknown>)
}

export async function updateRule(id: string, patch: Partial<Rule>): Promise<Rule | null> {
  const { data: row, error } = await getSupabaseAdmin()
    .from('bot_rules')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) return null
  return rowToRule(row as Record<string, unknown>)
}

export async function deleteRule(id: string): Promise<boolean> {
  const { error } = await getSupabaseAdmin().from('bot_rules').delete().eq('id', id)
  return !error
}

// ─── Estado de cooldowns e contagem de duplicações ────────────────────────────

export interface CooldownState {
  last_executed: Record<string, string>
  duplicate_counts: Record<string, number>
}

const DEFAULT_COOLDOWN: CooldownState = { last_executed: {}, duplicate_counts: {} }

export async function getCooldownState(): Promise<CooldownState> {
  const { data } = await getSupabaseAdmin()
    .from('bot_cooldowns')
    .select('last_executed, duplicate_counts')
    .eq('id', 1)
    .single()
  if (!data) return DEFAULT_COOLDOWN
  return {
    last_executed: (data.last_executed as Record<string, string>) ?? {},
    duplicate_counts: (data.duplicate_counts as Record<string, number>) ?? {},
  }
}

export async function saveCooldownState(state: CooldownState): Promise<void> {
  await getSupabaseAdmin()
    .from('bot_cooldowns')
    .upsert({ id: 1, ...state })
}

export async function resetDuplicateCounts(): Promise<void> {
  const state = await getCooldownState()
  state.duplicate_counts = {}
  await saveCooldownState(state)
}

export async function resetAllCooldowns(): Promise<void> {
  await saveCooldownState(DEFAULT_COOLDOWN)
}

// ─── Logs ─────────────────────────────────────────────────────────────────────

export interface LogEntry {
  id: string; timestamp: string; campaign_id: string; campaign_name: string
  rule_name: string | null; action: string; details: string
  dry_run: boolean; success: boolean; error: string | null
}

export async function getLogs(limit = 200): Promise<LogEntry[]> {
  const { data } = await getSupabaseAdmin()
    .from('bot_logs')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(limit)
  return (data ?? []) as LogEntry[]
}

export async function appendLog(entry: Omit<LogEntry, 'id' | 'timestamp'>): Promise<void> {
  await getSupabaseAdmin().from('bot_logs').insert(entry)
}

export async function clearLogs(): Promise<void> {
  await getSupabaseAdmin().from('bot_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000')
}

// ─── Configurações ────────────────────────────────────────────────────────────

export interface BotSettings {
  schedule: string; dry_run: boolean; date_window_days: number
  last_run: string | null; next_run: string | null
}

const DEFAULT_SETTINGS: BotSettings = {
  schedule: '0 8 * * *', dry_run: true, date_window_days: 7,
  last_run: null, next_run: null,
}

export async function getSettings(): Promise<BotSettings> {
  const { data } = await getSupabaseAdmin()
    .from('bot_settings')
    .select('*')
    .eq('id', 1)
    .single()
  if (!data) return DEFAULT_SETTINGS
  return {
    schedule: (data.schedule as string) ?? DEFAULT_SETTINGS.schedule,
    dry_run: (data.dry_run as boolean) ?? DEFAULT_SETTINGS.dry_run,
    date_window_days: Number(data.date_window_days ?? DEFAULT_SETTINGS.date_window_days),
    last_run: (data.last_run as string | null) ?? null,
    next_run: (data.next_run as string | null) ?? null,
  }
}

export async function saveSettings(patch: Partial<BotSettings>): Promise<BotSettings> {
  const current = await getSettings()
  const updated = { ...current, ...patch }
  await getSupabaseAdmin()
    .from('bot_settings')
    .upsert({ id: 1, ...updated })
  return updated
}
