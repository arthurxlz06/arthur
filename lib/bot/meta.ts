import 'server-only'
import { getSupabaseAdmin } from '@/lib/supabase'

const API_VERSION = process.env.META_API_VERSION || 'v21.0'
const BASE = `https://graph.facebook.com/${API_VERSION}`
const RATE_LIMIT_CODES = new Set([17, 32, 80000, 80003, 80004])
const MAX_RETRIES = 4

async function getToken(): Promise<string> {
  if (process.env.META_ACCESS_TOKEN) return process.env.META_ACCESS_TOKEN

  const { data } = await getSupabaseAdmin()
    .from('users')
    .select('facebook_access_token, token_expires_at')
    .not('facebook_access_token', 'is', null)
    .limit(1)
    .single()

  if (!data?.facebook_access_token) {
    throw new Error('Token Meta não encontrado. Conecte sua conta Meta nas Configurações.')
  }

  const token = data.facebook_access_token as string
  const expiresAt = data.token_expires_at as string | null

  // Auto-renova se faltar menos de 7 dias para expirar
  if (expiresAt) {
    const daysLeft = (new Date(expiresAt).getTime() - Date.now()) / 86400000
    if (daysLeft < 7) {
      try {
        const res = await fetch(
          `https://graph.facebook.com/v21.0/oauth/access_token?` +
          `grant_type=fb_exchange_token` +
          `&client_id=${process.env.FACEBOOK_CLIENT_ID}` +
          `&client_secret=${process.env.FACEBOOK_CLIENT_SECRET}` +
          `&fb_exchange_token=${token}`
        )
        const refreshed = await res.json() as { access_token?: string; expires_in?: number }
        if (refreshed.access_token) {
          const newExpiry = new Date(Date.now() + (refreshed.expires_in ?? 5184000) * 1000).toISOString()
          await getSupabaseAdmin()
            .from('users')
            .update({ facebook_access_token: refreshed.access_token, token_expires_at: newExpiry })
            .not('facebook_access_token', 'is', null)
          return refreshed.access_token
        }
      } catch {
        // Se o refresh falhar, usa o token atual
      }
    }
  }

  return token
}

async function getAccountId(): Promise<string> {
  // DB tem prioridade — a seleção no painel de Configurações é o que vale
  const { data } = await getSupabaseAdmin()
    .from('ad_accounts')
    .select('meta_account_id')
    .eq('is_selected', true)
    .limit(1)
    .single()
  if (data?.meta_account_id) {
    const id = data.meta_account_id as string
    return id.startsWith('act_') ? id : `act_${id}`
  }
  // Fallback para variável de ambiente se nada selecionado no painel
  if (process.env.META_AD_ACCOUNT_ID) {
    const id = process.env.META_AD_ACCOUNT_ID
    return id.startsWith('act_') ? id : `act_${id}`
  }
  throw new Error('Nenhuma conta de anúncio selecionada. Vá em Configurações → selecione uma conta.')
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
  // currentPath começa com o path original + params; após a primeira página pode ser
  // substituído pelo path relativo extraído de paging.next (usado pelo endpoint /insights)
  let currentPath: string | null = `${path}?${new URLSearchParams(params)}`

  while (currentPath) {
    const data = await call(currentPath) as {
      data?: unknown[]
      paging?: { cursors?: { after?: string }; next?: string }
    }
    results.push(...(data.data ?? []))

    const after = data.paging?.cursors?.after
    if (after) {
      // Cursor explícito: adiciona ao path original para manter os demais params
      const p = new URLSearchParams(params)
      p.set('after', after)
      currentPath = `${path}?${p}`
    } else if (data.paging?.next) {
      // paging.next é uma URL completa; extrai o path relativo a BASE para call()
      try {
        const nextUrl = new URL(data.paging.next)
        const prefix = `/${API_VERSION}/`
        currentPath = nextUrl.pathname.startsWith(prefix)
          ? nextUrl.pathname.slice(prefix.length) + nextUrl.search
          : null
      } catch { currentPath = null }
    } else {
      currentPath = null
    }
  }
  return results
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

// Tipo genérico usado pelo engine — campaings, conjuntos e anúncios todos mapeiam pra este
export interface TargetData {
  item_id: string
  item_name: string
  effective_status: string
  daily_budget: number
  budget_reais: number
  spend: number; purchase_roas: number; cpc: number; cpm: number; ctr: number
  impressions: number; clicks: number; reach: number; frequency: number
  cost_per_purchase: number; cost_per_link_click: number
}

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

export interface AdSetData {
  adset_id: string; adset_name: string
  campaign_id: string; campaign_name: string
  spend: number; purchase_roas: number; cpc: number; cpm: number; ctr: number
  impressions: number; clicks: number; reach: number; frequency: number
  cost_per_purchase: number; cost_per_link_click: number
  daily_budget: number; budget_reais: number; effective_status: string
}

export interface AdData {
  ad_id: string; ad_name: string
  adset_id: string; campaign_id: string
  spend: number; purchase_roas: number; cpc: number; cpm: number; ctr: number
  impressions: number; clicks: number; reach: number; frequency: number
  cost_per_purchase: number; cost_per_link_click: number
  effective_status: string
}

export function toTargetData(item: CampaignData | AdSetData | AdData, level: 'campaign' | 'adset' | 'ad'): TargetData {
  const base = { spend: item.spend, purchase_roas: item.purchase_roas, cpc: item.cpc, cpm: item.cpm, ctr: item.ctr, impressions: item.impressions, clicks: item.clicks, reach: item.reach, frequency: item.frequency, cost_per_purchase: item.cost_per_purchase, cost_per_link_click: item.cost_per_link_click }
  if (level === 'campaign') {
    const c = item as CampaignData
    return { item_id: c.campaign_id, item_name: c.campaign_name, effective_status: c.effective_status, daily_budget: c.daily_budget, budget_reais: c.budget_reais, ...base }
  }
  if (level === 'adset') {
    const s = item as AdSetData
    return { item_id: s.adset_id, item_name: s.adset_name, effective_status: s.effective_status, daily_budget: s.daily_budget, budget_reais: s.budget_reais, ...base }
  }
  const a = item as AdData
  return { item_id: a.ad_id, item_name: a.ad_name, effective_status: a.effective_status, daily_budget: 0, budget_reais: 0, ...base }
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

export async function getCampaigns(since: string, until: string): Promise<CampaignData[]> {
  const accountId = await getAccountId()

  type RC = { id: string; name: string; daily_budget?: string; effective_status: string }
  type RI = {
    campaign_id: string; campaign_name: string; spend: string
    purchase_roas?: unknown; cpc?: string; cpm?: string; ctr?: string
    impressions?: string; clicks?: string; reach?: string; frequency?: string
    cost_per_action_type?: unknown
  }

  const [rawCamps, rawIns] = await Promise.all([
    // Sem filtro de status — buscamos TODOS os estados para ter o effective_status correto.
    // Filtrar aqui por ["ACTIVE","PAUSED"] exclui CAMPAIGN_PAUSED, WITH_ISSUES, etc. e
    // causa o bug onde campMap.get() retorna undefined e o fallback 'ACTIVE' é usado.
    paginate(`${accountId}/campaigns`, {
      fields: 'id,name,daily_budget,effective_status',
      limit: '200',
    }),
    paginate(`${accountId}/insights`, {
      level: 'campaign',
      fields: 'campaign_id,campaign_name,spend,purchase_roas,cpc,cpm,ctr,impressions,clicks,reach,frequency,cost_per_action_type',
      time_range: JSON.stringify({ since, until }),
      limit: '200',
    }),
  ])

  const campMap = new Map((rawCamps as RC[]).map(c => [c.id, c]))

  // Só exibe campanhas que estão em estado "ativo" para o bot — exclui pausadas, deletadas, arquivadas
  const STATUS_ATIVO = new Set(['ACTIVE', 'IN_PROCESS', 'WITH_ISSUES', 'PENDING_REVIEW'])
  return (rawIns as RI[]).filter(ins => {
    const camp = campMap.get(ins.campaign_id)
    return camp && STATUS_ATIVO.has(camp.effective_status)
  }).map(ins => {
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
      effective_status: camp?.effective_status ?? 'PAUSED',
    }
  })
}

// Busca rápida: id + nome + status (ativas e pausadas)
export async function getCampaignNames(): Promise<{ id: string; name: string; effective_status: string }[]> {
  const accountId = await getAccountId()
  type RC = { id: string; name: string; effective_status: string }
  const raw = await paginate(`${accountId}/campaigns`, {
    effective_status: '["ACTIVE","PAUSED"]',
    fields: 'id,name,effective_status',
    limit: '200',
  })
  return (raw as RC[]).map(c => ({ id: c.id, name: c.name, effective_status: c.effective_status }))
}

export async function getAdSetNames(): Promise<{ id: string; name: string; effective_status: string }[]> {
  const accountId = await getAccountId()
  type RS = { id: string; name: string; effective_status: string }
  const raw = await paginate(`${accountId}/adsets`, {
    effective_status: '["ACTIVE","PAUSED"]',
    fields: 'id,name,effective_status',
    limit: '200',
  })
  return (raw as RS[]).map(s => ({ id: s.id, name: s.name, effective_status: s.effective_status }))
}

export async function getAdNames(): Promise<{ id: string; name: string; effective_status: string }[]> {
  const accountId = await getAccountId()
  type RA = { id: string; name: string; effective_status: string }
  const raw = await paginate(`${accountId}/ads`, {
    effective_status: '["ACTIVE","PAUSED"]',
    fields: 'id,name,effective_status',
    limit: '200',
  })
  return (raw as RA[]).map(a => ({ id: a.id, name: a.name, effective_status: a.effective_status }))
}

export async function getAdSets(since: string, until: string): Promise<AdSetData[]> {
  const accountId = await getAccountId()

  type RS = { id: string; name: string; campaign_id: string; daily_budget?: string; effective_status: string }
  type RI = {
    adset_id: string; adset_name: string; campaign_id: string; campaign_name: string; spend: string
    purchase_roas?: unknown; cpc?: string; cpm?: string; ctr?: string
    impressions?: string; clicks?: string; reach?: string; frequency?: string
    cost_per_action_type?: unknown
  }

  const [rawAdSets, rawIns] = await Promise.all([
    paginate(`${accountId}/adsets`, {
      effective_status: '["ACTIVE"]', fields: 'id,name,campaign_id,daily_budget,effective_status', limit: '200',
    }),
    paginate(`${accountId}/insights`, {
      level: 'adset',
      fields: 'adset_id,adset_name,campaign_id,campaign_name,spend,purchase_roas,cpc,cpm,ctr,impressions,clicks,reach,frequency,cost_per_action_type',
      time_range: JSON.stringify({ since, until }),
      limit: '200',
    }),
  ])

  const adsetMap = new Map((rawAdSets as RS[]).map(s => [s.id, s]))
  return (rawIns as RI[]).map(ins => {
    const s = adsetMap.get(ins.adset_id)
    const daily_budget = parseInt(s?.daily_budget ?? '0', 10)
    return {
      adset_id: ins.adset_id, adset_name: ins.adset_name || s?.name || '',
      campaign_id: ins.campaign_id, campaign_name: ins.campaign_name,
      spend: parseFloat(ins.spend || '0'),
      purchase_roas: parseRoas(ins.purchase_roas),
      cpc: parseFloat(ins.cpc || '0'), cpm: parseFloat(ins.cpm || '0'), ctr: parseFloat(ins.ctr || '0'),
      impressions: parseInt(ins.impressions || '0', 10), clicks: parseInt(ins.clicks || '0', 10),
      reach: parseInt(ins.reach || '0', 10), frequency: parseFloat(ins.frequency || '0'),
      cost_per_purchase: parseCostPerAction(ins.cost_per_action_type, 'omni_purchase', 'offsite_conversion.fb_pixel_purchase'),
      cost_per_link_click: parseCostPerAction(ins.cost_per_action_type, 'link_click'),
      daily_budget, budget_reais: daily_budget / 100,
      effective_status: s?.effective_status ?? 'PAUSED',
    }
  })
}

export async function getAds(since: string, until: string): Promise<AdData[]> {
  const accountId = await getAccountId()

  type RA = { id: string; name: string; adset_id: string; effective_status: string }
  type RI = {
    ad_id: string; ad_name: string; adset_id: string; campaign_id: string; spend: string
    purchase_roas?: unknown; cpc?: string; cpm?: string; ctr?: string
    impressions?: string; clicks?: string; reach?: string; frequency?: string
    cost_per_action_type?: unknown
  }

  const [rawAds, rawIns] = await Promise.all([
    paginate(`${accountId}/ads`, {
      effective_status: '["ACTIVE"]', fields: 'id,name,adset_id,effective_status', limit: '200',
    }),
    paginate(`${accountId}/insights`, {
      level: 'ad',
      fields: 'ad_id,ad_name,adset_id,campaign_id,spend,purchase_roas,cpc,cpm,ctr,impressions,clicks,reach,frequency,cost_per_action_type',
      time_range: JSON.stringify({ since, until }),
      limit: '200',
    }),
  ])

  const adMap = new Map((rawAds as RA[]).map(a => [a.id, a]))
  return (rawIns as RI[]).map(ins => {
    const a = adMap.get(ins.ad_id)
    return {
      ad_id: ins.ad_id, ad_name: ins.ad_name || a?.name || '',
      adset_id: ins.adset_id, campaign_id: ins.campaign_id,
      spend: parseFloat(ins.spend || '0'),
      purchase_roas: parseRoas(ins.purchase_roas),
      cpc: parseFloat(ins.cpc || '0'), cpm: parseFloat(ins.cpm || '0'), ctr: parseFloat(ins.ctr || '0'),
      impressions: parseInt(ins.impressions || '0', 10), clicks: parseInt(ins.clicks || '0', 10),
      reach: parseInt(ins.reach || '0', 10), frequency: parseFloat(ins.frequency || '0'),
      cost_per_purchase: parseCostPerAction(ins.cost_per_action_type, 'omni_purchase', 'offsite_conversion.fb_pixel_purchase'),
      cost_per_link_click: parseCostPerAction(ins.cost_per_action_type, 'link_click'),
      effective_status: a?.effective_status ?? 'PAUSED',
    }
  })
}

export async function updateAdSetBudget(adsetId: string, newBudgetCents: number): Promise<void> {
  const token = await getToken()
  const resp = await fetch(`${BASE}/${adsetId}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ daily_budget: newBudgetCents, access_token: token }),
  })
  const data = await resp.json() as { error?: { message: string } }
  if (data?.error) throw new Error(data.error.message)
}

export async function copyAdSet(adsetId: string): Promise<string> {
  const token = await getToken()
  const resp = await fetch(`${BASE}/${adsetId}/copies`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deep_copy: true, status_option: 'PAUSED', access_token: token }),
  })
  const data = await resp.json() as { error?: { message: string }; copied_adset_id?: string; id?: string }
  if (data?.error) throw new Error(data.error.message)
  return data.copied_adset_id ?? data.id ?? 'desconhecido'
}

export async function copyAd(adId: string): Promise<string> {
  const token = await getToken()
  const resp = await fetch(`${BASE}/${adId}/copies`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status_option: 'PAUSED', access_token: token }),
  })
  const data = await resp.json() as { error?: { message: string }; copied_ad_id?: string; id?: string }
  if (data?.error) throw new Error(data.error.message)
  return data.copied_ad_id ?? data.id ?? 'desconhecido'
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
