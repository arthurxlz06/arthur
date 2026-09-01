import 'server-only'
import { getSupabaseAdmin } from '@/lib/supabase'

const API_VERSION = process.env.META_API_VERSION || 'v21.0'
const BASE = `https://graph.facebook.com/${API_VERSION}`
const RATE_LIMIT_CODES = new Set([17, 32, 80000, 80003, 80004])
const MAX_RETRIES = 4

async function getToken(): Promise<string> {
  if (process.env.META_ACCESS_TOKEN) return process.env.META_ACCESS_TOKEN
  const { data } = await getSupabaseAdmin()
    .from('users').select('facebook_access_token')
    .not('facebook_access_token', 'is', null).limit(1).single()
  if (data?.facebook_access_token) return data.facebook_access_token as string
  throw new Error('Token Meta não encontrado. Defina META_ACCESS_TOKEN no .env.local ou conecte sua conta Meta nas Configurações.')
}

async function getAccountId(): Promise<string> {
  if (process.env.META_AD_ACCOUNT_ID) {
    const id = process.env.META_AD_ACCOUNT_ID
    return id.startsWith('act_') ? id : `act_${id}`
  }
  // Lê a conta selecionada no painel de configurações
  const { data } = await getSupabaseAdmin()
    .from('ad_accounts')
    .select('meta_account_id')
    .eq('is_selected', true)
    .limit(1)
    .single()
  if (!data?.meta_account_id) {
    throw new Error('Nenhuma conta de anúncio selecionada. Vá em Configurações → selecione uma conta.')
  }
  const id = data.meta_account_id as string
  return id.startsWith('act_') ? id : `act_${id}`
}

async function call(path: string, opts: RequestInit = {}, attempt = 1): Promise<unknown> {
  const token = await getToken()
  const url = new URL(`${BASE}/${path}`)
  url.searchParams.set('access_token', token)
  const resp = await fetch(url.toString(), { ...opts, cache: 'no-store' })
  const data = await resp.json() as { error?: { code: number; message: string } }
  if (data?.error) {
    const { code, message } = data.error
    if (RATE_LIMIT_CODES.has(code) && attempt < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, 2000 * Math.pow(2, attempt - 1)))
      return call(path, opts, attempt + 1)
    }
    throw new Error(`Meta API ${code}: ${message}`)
  }
  return data
}

async function paginate(path: string, params: Record<string, string>): Promise<unknown[]> {
  const results: unknown[] = []
  let cursor: string | undefined
  do {
    const qs = new URLSearchParams(params)
    if (cursor) qs.set('after', cursor)
    const data = await call(`${path}?${qs}`) as { data?: unknown[]; paging?: { cursors?: { after?: string } } }
    results.push(...(data.data ?? []))
    cursor = data.paging?.cursors?.after
  } while (cursor)
  return results
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface CampaignData {
  campaign_id: string; campaign_name: string
  // Métricas de performance
  spend: number
  purchase_roas: number
  cpc: number            // custo por clique (todos os cliques)
  cpm: number            // custo por mil impressões
  ctr: number            // taxa de cliques (%)
  impressions: number
  clicks: number
  reach: number
  frequency: number
  cost_per_purchase: number   // custo por compra
  cost_per_link_click: number // custo por clique no link
  // Orçamento
  daily_budget: number        // centavos (uso interno para chamadas de API)
  budget_reais: number        // R$ (para comparações nas condições)
  effective_status: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseRoas(field: unknown): number {
  if (!field || !Array.isArray(field)) return 0
  type E = { action_type: string; value: string }
  const map = new Map((field as E[]).map(e => [e.action_type, parseFloat(e.value)]))
  return map.get('omni_purchase') ?? map.get('offsite_conversion.fb_pixel_purchase') ?? Array.from(map.values())[0] ?? 0
}

function parseCostPerAction(field: unknown, ...types: string[]): number {
  if (!field || !Array.isArray(field)) return 0
  type E = { action_type: string; value: string }
  const map = new Map((field as E[]).map(e => [e.action_type, parseFloat(e.value)]))
  for (const t of types) { const v = map.get(t); if (v) return v }
  return 0
}

// ─── Funções públicas ─────────────────────────────────────────────────────────

export async function getCampaigns(dateWindowDays = 7): Promise<CampaignData[]> {
  const accountId = await getAccountId()
  const end = new Date(); const start = new Date(end)
  start.setDate(start.getDate() - (dateWindowDays - 1))
  const fmt = (d: Date) => d.toISOString().split('T')[0]

  type RC = { id: string; name: string; daily_budget?: string; effective_status: string }
  type RI = {
    campaign_id: string; campaign_name: string; spend: string
    purchase_roas?: unknown; cpc?: string; cpm?: string; ctr?: string
    impressions?: string; clicks?: string; reach?: string; frequency?: string
    cost_per_action_type?: unknown
  }

  const [rawCamps, rawIns] = await Promise.all([
    paginate(`${accountId}/campaigns`, {
      effective_status: '["ACTIVE"]',
      fields: 'id,name,daily_budget,effective_status',
      limit: '100',
    }),
    paginate(`${accountId}/insights`, {
      level: 'campaign',
      fields: 'campaign_id,campaign_name,spend,purchase_roas,cpc,cpm,ctr,impressions,clicks,reach,frequency,cost_per_action_type',
      time_range: JSON.stringify({ since: fmt(start), until: fmt(end) }),
      limit: '100',
    }),
  ])

  const campMap = new Map((rawCamps as RC[]).map(c => [c.id, c]))

  return (rawIns as RI[]).map(ins => {
    const camp = campMap.get(ins.campaign_id)
    const daily_budget = parseInt(camp?.daily_budget ?? '0', 10)
    return {
      campaign_id: ins.campaign_id,
      campaign_name: ins.campaign_name || camp?.name || '',
      spend: parseFloat(ins.spend || '0'),
      purchase_roas: parseRoas(ins.purchase_roas),
      cpc: parseFloat(ins.cpc || '0'),
      cpm: parseFloat(ins.cpm || '0'),
      ctr: parseFloat(ins.ctr || '0'),
      impressions: parseInt(ins.impressions || '0', 10),
      clicks: parseInt(ins.clicks || '0', 10),
      reach: parseInt(ins.reach || '0', 10),
      frequency: parseFloat(ins.frequency || '0'),
      cost_per_purchase: parseCostPerAction(ins.cost_per_action_type, 'omni_purchase', 'offsite_conversion.fb_pixel_purchase'),
      cost_per_link_click: parseCostPerAction(ins.cost_per_action_type, 'link_click'),
      daily_budget,
      budget_reais: daily_budget / 100,
      effective_status: camp?.effective_status ?? 'ACTIVE',
    }
  })
}

// Busca rápida: só id + nome (sem insights, sem métricas)
export async function getCampaignNames(): Promise<{ id: string; name: string }[]> {
  const accountId = await getAccountId()
  type RC = { id: string; name: string }
  const raw = await paginate(`${accountId}/campaigns`, {
    effective_status: '["ACTIVE"]',
    fields: 'id,name',
    limit: '200',
  })
  return (raw as RC[]).map(c => ({ id: c.id, name: c.name }))
}

export async function updateBudget(campaignId: string, newBudgetCents: number): Promise<void> {
  const token = await getToken()
  const resp = await fetch(`${BASE}/${campaignId}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ daily_budget: newBudgetCents, access_token: token }),
  })
  const data = await resp.json() as { error?: { message: string } }
  if (data?.error) throw new Error(data.error.message)
}

export async function copyCampaign(campaignId: string): Promise<string> {
  const token = await getToken()
  const resp = await fetch(`${BASE}/${campaignId}/copies`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deep_copy: true, status_option: 'PAUSED', access_token: token }),
  })
  const data = await resp.json() as { error?: { message: string }; copied_campaign_id?: string; id?: string }
  if (data?.error) throw new Error(data.error.message)
  return data.copied_campaign_id ?? data.id ?? 'desconhecido'
}
