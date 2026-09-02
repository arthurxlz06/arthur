'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Bot, Play, Plus, Trash2, Edit2, Check, X, ToggleLeft, ToggleRight,
  RefreshCw, Clock, ShieldCheck, Zap, AlertTriangle, Info, RotateCcw, ExternalLink,
} from 'lucide-react'

// ─── Constantes ───────────────────────────────────────────────────────────────

const METRICAS = [
  { key: 'purchase_roas',       label: 'ROAS de Compras',              unidade: 'x'  },
  { key: 'spend',               label: 'Gasto (R$)',                   unidade: 'R$' },
  { key: 'cpc',                 label: 'CPC — Custo por Clique',       unidade: 'R$' },
  { key: 'cpm',                 label: 'CPM — Custo por Mil Impr.',    unidade: 'R$' },
  { key: 'ctr',                 label: 'CTR — Taxa de Cliques',        unidade: '%'  },
  { key: 'cost_per_purchase',   label: 'Custo por Compra',             unidade: 'R$' },
  { key: 'cost_per_link_click', label: 'Custo por Clique no Link',     unidade: 'R$' },
  { key: 'impressions',         label: 'Impressões',                   unidade: ''   },
  { key: 'clicks',              label: 'Cliques',                      unidade: ''   },
  { key: 'reach',               label: 'Alcance',                      unidade: ''   },
  { key: 'frequency',           label: 'Frequência',                   unidade: 'x'  },
  { key: 'budget_reais',        label: 'Orçamento Diário Atual (R$)',  unidade: 'R$' },
]

const OPERADORES = [
  { value: '>',  label: 'maior que ( > )'      },
  { value: '>=', label: 'maior ou igual ( ≥ )' },
  { value: '<',  label: 'menor que ( < )'      },
  { value: '<=', label: 'menor ou igual ( ≤ )' },
  { value: '==', label: 'igual a ( = )'        },
  { value: '!=', label: 'diferente de ( ≠ )'  },
]

const TIPOS_ACAO = [
  { value: 'scale_pct',   label: 'Escalar orçamento em %',       desc: 'Ex: 20 = +20%, -10 = -10%' },
  { value: 'scale_fixed', label: 'Escalar orçamento em R$',      desc: 'Ex: 50 = +R$50, -20 = -R$20' },
  { value: 'set_budget',  label: 'Definir orçamento para R$ X',  desc: 'Define valor exato independente do atual' },
  { value: 'duplicate',   label: 'Duplicar campanha',            desc: 'Cria cópia pausada da campanha' },
]

const ATALHOS_CRON = [
  { label: 'Todo dia às 08h',     expr: '0 8 * * *'    },
  { label: '2x/dia (08h e 20h)', expr: '0 8,20 * * *' },
  { label: 'A cada 6h',          expr: '0 */6 * * *'  },
  { label: 'A cada 12h',         expr: '0 */12 * * *' },
  { label: 'Toda segunda (08h)', expr: '0 8 * * 1'    },
]

const HORAS_DIA = Array.from({ length: 24 }, (_, i) => i)

// ─── Tipos ────────────────────────────────────────────────────────────────────

type FilterLevel = 'campaign' | 'adset' | 'ad'
interface RuleCondition { metric: string; operator: string; value: number }
interface Rule {
  id: string; name: string; active: boolean
  conditions: RuleCondition[]; action: string; action_value: number
  filter_level: FilterLevel
  campaign_filter: 'all' | 'name_contains' | 'specific'
  campaign_filter_text: string; campaign_filter_ids: string[]
  cooldown_hours: number; allowed_hours: number[]
  max_duplicates: number; duplicate_until: string
  created_at: string
}
interface SkipReason { rule_name: string; reason: string; detail: string }
interface Campaign {
  campaign_id: string; campaign_name: string
  spend: number; purchase_roas: number; cpc: number; cpm: number; ctr: number
  impressions: number; clicks: number; reach: number; frequency: number
  cost_per_purchase: number; cost_per_link_click: number
  daily_budget: number; budget_reais: number; effective_status: string
  planned_action: string; planned_rule: string | null
  planned_new_budget: number | null; skipped_rules: SkipReason[]
}
interface LogEntry {
  id: string; timestamp: string; campaign_id: string; campaign_name: string
  rule_name: string | null; action: string; details: string
  dry_run: boolean; success: boolean; error: string | null
}
interface Settings { schedule: string; dry_run: boolean; date_window_days: number; last_run: string | null }

// ─── Estilos ──────────────────────────────────────────────────────────────────

const sCard: React.CSSProperties = { background: 'var(--bg-surface)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', padding: '20px' }
const sLabel: React.CSSProperties = { fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px', display: 'block' }
const sInput: React.CSSProperties = { width: '100%', padding: '8px 11px', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }
const sSelect: React.CSSProperties = { ...sInput, appearance: 'none', cursor: 'pointer' }
const sBtn = (accent?: boolean, danger?: boolean): React.CSSProperties => ({
  padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '500',
  background: accent ? 'var(--accent)' : danger ? 'rgba(239,68,68,0.12)' : 'var(--bg-elevated)',
  color: accent ? '#fff' : danger ? 'var(--status-error)' : 'var(--text-secondary)',
  display: 'flex', alignItems: 'center', gap: '6px',
})
const sTh: React.CSSProperties = { padding: '9px 13px', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left', borderBottom: '1px solid var(--bg-border)', whiteSpace: 'nowrap', background: 'var(--bg-elevated)' }
const sTd: React.CSSProperties = { padding: '11px 13px', fontSize: '13px', color: 'var(--text-secondary)', borderBottom: '1px solid var(--bg-border)', whiteSpace: 'nowrap' }

function Spin() {
  return <span style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'inline-block' }} />
}
function labelAcao(a: string) { return { scale_pct: 'Escalar %', scale_fixed: 'Escalar R$', set_budget: 'Definir Orçamento', duplicate: 'Duplicar', no_action: '—' }[a] ?? a }
function corAcao(a: string) { return { scale_pct: 'var(--status-success)', scale_fixed: 'var(--status-success)', set_budget: 'var(--accent)', duplicate: 'var(--accent)', no_action: 'var(--text-muted)' }[a] ?? 'var(--text-muted)' }

// ─── Formulário de Regra ──────────────────────────────────────────────────────

const COND_VAZIA: RuleCondition = { metric: 'purchase_roas', operator: '>=', value: 3 }
const REGRA_VAZIA = {
  name: '', active: true,
  conditions: [{ ...COND_VAZIA }],
  action: 'scale_pct', action_value: 20,
  filter_level: 'campaign' as FilterLevel,
  campaign_filter: 'all' as 'all' | 'name_contains' | 'specific',
  campaign_filter_text: '', campaign_filter_ids: [] as string[],
  cooldown_hours: 0, allowed_hours: [] as number[],
  max_duplicates: 0, duplicate_until: '',
}

const NIVEL_LABELS: Record<FilterLevel, string> = {
  campaign: 'Campanha',
  adset: 'Conjunto de Anúncio',
  ad: 'Anúncio',
}

interface ItemNome { id: string; name: string; effective_status: string }

function FormularioRegra({ inicial, onSalvar, onCancelar }: {
  inicial?: Partial<Rule>
  onSalvar: (d: Omit<Rule, 'id' | 'created_at'>) => void
  onCancelar: () => void
}) {
  const [form, setForm] = useState({ ...REGRA_VAZIA, ...inicial })
  const [itensDisponiveis, setItensDisponiveis] = useState<ItemNome[]>([])
  const [carregandoItens, setCarregandoItens] = useState(false)
  const [erroItens, setErroItens] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [apenasAtivas, setApenasAtivas] = useState(true)

  const set = (k: string, v: unknown) => setForm(p => ({ ...p, [k]: v }))

  const setCond = (i: number, k: string, v: unknown) =>
    setForm(p => ({ ...p, conditions: p.conditions.map((c, idx) => idx === i ? { ...c, [k]: v } : c) }))
  const addCond = () => setForm(p => ({ ...p, conditions: [...p.conditions, { ...COND_VAZIA }] }))
  const removeCond = (i: number) => setForm(p => ({ ...p, conditions: p.conditions.filter((_, idx) => idx !== i) }))

  const toggleHora = (h: number) =>
    setForm(p => ({
      ...p,
      allowed_hours: p.allowed_hours.includes(h)
        ? p.allowed_hours.filter(x => x !== h)
        : [...p.allowed_hours, h].sort((a, b) => a - b),
    }))

  const toggleItemId = (id: string) =>
    setForm(p => ({
      ...p,
      campaign_filter_ids: p.campaign_filter_ids.includes(id)
        ? p.campaign_filter_ids.filter(x => x !== id)
        : [...p.campaign_filter_ids, id],
    }))

  // Recarrega itens quando muda nível ou quando muda para "specific"
  useEffect(() => {
    if (form.campaign_filter !== 'specific') return
    setCarregandoItens(true); setErroItens(null); setItensDisponiveis([])
    fetch(`/api/bot/campaigns/names?level=${form.filter_level}`)
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setItensDisponiveis(d.items ?? []) })
      .catch(e => setErroItens((e as Error).message))
      .finally(() => setCarregandoItens(false))
  }, [form.campaign_filter, form.filter_level])

  // Quando muda nível, limpa seleção anterior
  const setNivel = (level: FilterLevel) => {
    setForm(p => ({ ...p, filter_level: level, campaign_filter_ids: [] }))
    setItensDisponiveis([])
  }

  const isDuplicate = form.action === 'duplicate'
  const isAd = form.filter_level === 'ad'
  // Anúncios não têm orçamento próprio — só duplicar faz sentido
  const tiposAcaoDisponiveis = isAd ? TIPOS_ACAO.filter(t => t.value === 'duplicate') : TIPOS_ACAO
  const tipoAcao = tiposAcaoDisponiveis.find(t => t.value === form.action) ?? tiposAcaoDisponiveis[0]

  const itensFiltrados = itensDisponiveis
    .filter(i => !apenasAtivas || i.effective_status === 'ACTIVE')
    .filter(i => !busca.trim() || i.name.toLowerCase().includes(busca.toLowerCase()))

  return (
    <div style={{ padding: '20px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--bg-border)', display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Nome */}
      <div>
        <label style={sLabel}>Nome da regra</label>
        <input style={sInput} value={form.name} onChange={e => set('name', e.target.value)} placeholder="ex: Escalar ROAS alto" />
      </div>

      {/* Condições */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <label style={{ ...sLabel, marginBottom: 0 }}>
            Condições <span style={{ fontWeight: 400, textTransform: 'none', fontSize: '11px' }}>(todas verdadeiras = AND)</span>
          </label>
          <button onClick={addCond} style={{ ...sBtn(), fontSize: '12px', padding: '4px 10px' }}>
            <Plus size={12} /> Adicionar condição
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {form.conditions.map((cond, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 190px 110px 32px', gap: '8px', alignItems: 'center' }}>
              <div>
                {i === 0 && <label style={{ ...sLabel, fontSize: '10px', marginBottom: '3px' }}>Métrica</label>}
                <select style={sSelect} value={cond.metric} onChange={e => setCond(i, 'metric', e.target.value)}>
                  {METRICAS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                </select>
              </div>
              <div>
                {i === 0 && <label style={{ ...sLabel, fontSize: '10px', marginBottom: '3px' }}>Operador</label>}
                <select style={sSelect} value={cond.operator} onChange={e => setCond(i, 'operator', e.target.value)}>
                  {OPERADORES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                {i === 0 && <label style={{ ...sLabel, fontSize: '10px', marginBottom: '3px' }}>Valor</label>}
                <input type="number" style={sInput} value={cond.value}
                  onChange={e => setCond(i, 'value', parseFloat(e.target.value) || 0)} />
              </div>
              <button onClick={() => removeCond(i)} disabled={form.conditions.length === 1}
                style={{ background: 'none', border: 'none', cursor: form.conditions.length > 1 ? 'pointer' : 'not-allowed', color: 'var(--status-error)', opacity: form.conditions.length === 1 ? 0.3 : 1, marginTop: i === 0 ? '16px' : 0, padding: '4px', display: 'flex' }}>
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Filtro de nível + itens ─── */}
      <div style={{ borderTop: '1px solid var(--bg-border)', paddingTop: '16px' }}>
        <p style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '12px' }}>
          Filtro de itens
        </p>

        {/* Seletor de nível */}
        <div style={{ marginBottom: '12px' }}>
          <label style={{ ...sLabel, marginBottom: '6px' }}>Nível</label>
          <div style={{ display: 'flex', gap: '6px' }}>
            {(['campaign', 'adset', 'ad'] as FilterLevel[]).map(lvl => (
              <button key={lvl} onClick={() => setNivel(lvl)}
                style={{ padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: `1px solid ${form.filter_level === lvl ? 'var(--accent)' : 'var(--bg-border)'}`, background: form.filter_level === lvl ? 'rgba(91,110,245,0.12)' : 'var(--bg-elevated)', color: form.filter_level === lvl ? 'var(--accent)' : 'var(--text-muted)', fontSize: '12px', fontWeight: form.filter_level === lvl ? '600' : '400', cursor: 'pointer' }}>
                {NIVEL_LABELS[lvl]}
              </button>
            ))}
          </div>
          {isAd && <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '5px' }}>Anúncios não têm orçamento próprio — apenas a ação &quot;Duplicar&quot; está disponível.</p>}
        </div>

        {/* Tipo de filtro */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
          {[
            { v: 'all',           l: `Todos os ${form.filter_level === 'campaign' ? 'campanhas' : form.filter_level === 'adset' ? 'conjuntos' : 'anúncios'}` },
            { v: 'name_contains', l: 'Nome contém...' },
            { v: 'specific',      l: 'Selecionar manualmente' },
          ].map(opt => (
            <button key={opt.v} onClick={() => set('campaign_filter', opt.v)}
              style={{ padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: `1px solid ${form.campaign_filter === opt.v ? 'var(--accent)' : 'var(--bg-border)'}`, background: form.campaign_filter === opt.v ? 'rgba(91,110,245,0.12)' : 'var(--bg-elevated)', color: form.campaign_filter === opt.v ? 'var(--accent)' : 'var(--text-muted)', fontSize: '12px', fontWeight: form.campaign_filter === opt.v ? '600' : '400', cursor: 'pointer' }}>
              {opt.l}
            </button>
          ))}
        </div>

        {/* Filtro por texto */}
        {form.campaign_filter === 'name_contains' && (
          <div>
            <input style={sInput} value={form.campaign_filter_text}
              onChange={e => set('campaign_filter_text', e.target.value)}
              placeholder={`ex: aa-68premios`} />
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              A regra só será aplicada em {NIVEL_LABELS[form.filter_level].toLowerCase()}s cujo nome contenha esse texto (sem distinção de maiúsculas).
            </p>
          </div>
        )}

        {/* Filtro por seleção manual */}
        {form.campaign_filter === 'specific' && (
          <div>
            {carregandoItens && (
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Carregando {NIVEL_LABELS[form.filter_level].toLowerCase()}s...</p>
            )}
            {erroItens && (
              <p style={{ fontSize: '12px', color: 'var(--status-error)' }}>Erro: {erroItens}</p>
            )}
            {!carregandoItens && !erroItens && itensDisponiveis.length === 0 && (
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Nenhum item encontrado. Verifique o token Meta.</p>
            )}
            {itensDisponiveis.length > 0 && (
              <>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input style={{ ...sInput, flex: 1, minWidth: 160 }} value={busca}
                    onChange={e => setBusca(e.target.value)}
                    placeholder={`Buscar ${NIVEL_LABELS[form.filter_level].toLowerCase()}...`} />
                  <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--text-muted)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    <input type="checkbox" checked={apenasAtivas} onChange={e => setApenasAtivas(e.target.checked)}
                      style={{ accentColor: 'var(--accent)', cursor: 'pointer' }} />
                    Apenas ativas
                  </label>
                  {form.campaign_filter_ids.length > 0 && (
                    <span style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: '600', whiteSpace: 'nowrap' }}>
                      {form.campaign_filter_ids.length} selecionado(s)
                    </span>
                  )}
                </div>
                <div style={{ maxHeight: '240px', overflowY: 'auto', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface)' }}>
                  {itensFiltrados.length === 0 ? (
                    <p style={{ padding: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>Nenhum item com esse filtro.</p>
                  ) : itensFiltrados.map(item => {
                    const sel = form.campaign_filter_ids.includes(item.id)
                    const ativa = item.effective_status === 'ACTIVE'
                    return (
                      <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 13px', cursor: 'pointer', borderBottom: '1px solid var(--bg-border)', background: sel ? 'rgba(91,110,245,0.06)' : 'transparent' }}
                        onMouseEnter={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = sel ? 'rgba(91,110,245,0.06)' : 'transparent' }}>
                        <input type="checkbox" checked={sel} onChange={() => toggleItemId(item.id)}
                          style={{ width: '15px', height: '15px', accentColor: 'var(--accent)', cursor: 'pointer', flexShrink: 0 }} />
                        <span style={{ fontSize: '13px', color: sel ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: sel ? '500' : '400', lineHeight: 1.4, flex: 1 }}>
                          {item.name}
                        </span>
                        <span style={{ fontSize: '10px', fontWeight: '600', padding: '2px 7px', borderRadius: '10px', flexShrink: 0, background: ativa ? 'rgba(34,197,94,0.1)' : 'rgba(100,100,100,0.1)', color: ativa ? 'var(--status-success)' : 'var(--text-muted)' }}>
                          {ativa ? 'Ativa' : 'Pausada'}
                        </span>
                      </label>
                    )
                  })}
                </div>
                {form.campaign_filter_ids.length > 0 && (
                  <button onClick={() => set('campaign_filter_ids', [])}
                    style={{ ...sBtn(), fontSize: '11px', padding: '3px 8px', marginTop: '6px' }}>
                    <X size={10} /> Limpar seleção
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Ação */}
      <div>
        <label style={sLabel}>Ação</label>
        <select style={sSelect} value={isAd ? 'duplicate' : form.action}
          onChange={e => set('action', e.target.value)} disabled={isAd}>
          {tiposAcaoDisponiveis.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        {tipoAcao && <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{tipoAcao.desc}</p>}
      </div>

      {/* Valor da ação */}
      {!isDuplicate && (
        <div>
          <label style={sLabel}>
            {form.action === 'scale_pct' ? 'Percentual (+ aumentar / − diminuir)' :
             form.action === 'scale_fixed' ? 'Valor em R$ (+ aumentar / − diminuir)' :
             'Novo orçamento diário em R$'}
          </label>
          <div style={{ position: 'relative' }}>
            <input type="number" step={form.action === 'scale_pct' ? '1' : '0.01'} style={sInput}
              value={form.action_value}
              onChange={e => set('action_value', parseFloat(e.target.value) || 0)} />
            <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: 'var(--text-muted)', pointerEvents: 'none' }}>
              {form.action === 'scale_pct' ? '%' : 'R$'}
            </span>
          </div>
          {form.action === 'scale_pct' && form.action_value !== 0 && (
            <p style={{ fontSize: '11px', color: form.action_value > 0 ? 'var(--status-success)' : 'var(--status-error)', marginTop: '4px' }}>
              Exemplo: R$100 → R${(100 * (1 + form.action_value / 100)).toFixed(2)}
            </p>
          )}
        </div>
      )}

      {/* ─── SEÇÃO: Intervalo entre execuções ─── */}
      <div style={{ borderTop: '1px solid var(--bg-border)', paddingTop: '16px' }}>
        <p style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Clock size={13} /> Controle de intervalo e horário
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          {/* Intervalo mínimo */}
          <div>
            <label style={sLabel}>Intervalo mínimo entre execuções (horas)</label>
            <input type="number" min="0" step="0.5" style={sInput}
              value={form.cooldown_hours}
              onChange={e => set('cooldown_hours', parseFloat(e.target.value) || 0)} />
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {form.cooldown_hours === 0 ? 'Sem intervalo — executa toda vez que o bot rodar' :
               `Executa no máximo 1x a cada ${form.cooldown_hours}h por campanha`}
            </p>
          </div>

          {/* Duplicar: máximo de vezes */}
          {isDuplicate && (
            <div>
              <label style={sLabel}>Máximo de duplicações por campanha</label>
              <input type="number" min="0" style={sInput}
                value={form.max_duplicates}
                onChange={e => set('max_duplicates', parseInt(e.target.value) || 0)} />
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                {form.max_duplicates === 0 ? 'Ilimitado' : `Máximo de ${form.max_duplicates} duplicação(ões) por campanha`}
              </p>
            </div>
          )}

          {/* Duplicar: limite de horário */}
          {isDuplicate && (
            <div>
              <label style={sLabel}>Não duplicar após (HH:MM)</label>
              <input type="time" style={sInput}
                value={form.duplicate_until}
                onChange={e => set('duplicate_until', e.target.value)} />
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                {form.duplicate_until ? `Bloqueia duplicações após ${form.duplicate_until}` : 'Sem limite de horário'}
              </p>
            </div>
          )}
        </div>

        {/* Horários permitidos */}
        <div style={{ marginTop: '14px' }}>
          <label style={sLabel}>
            Horários permitidos para execução
            {form.allowed_hours.length > 0
              ? ` — selecionados: ${form.allowed_hours.map(h => `${h}h`).join(', ')}`
              : ' — nenhum = qualquer horário'}
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
            {HORAS_DIA.map(h => {
              const sel = form.allowed_hours.includes(h)
              return (
                <button key={h} onClick={() => toggleHora(h)} style={{
                  padding: '4px 8px', borderRadius: '5px', border: `1px solid ${sel ? 'var(--accent)' : 'var(--bg-border)'}`,
                  background: sel ? 'rgba(91,110,245,0.12)' : 'var(--bg-elevated)',
                  color: sel ? 'var(--accent)' : 'var(--text-muted)',
                  fontSize: '12px', fontWeight: sel ? '600' : '400', cursor: 'pointer',
                }}>
                  {h}h
                </button>
              )
            })}
          </div>
          {form.allowed_hours.length > 0 && (
            <button onClick={() => set('allowed_hours', [])} style={{ marginTop: '6px', ...sBtn(), fontSize: '11px', padding: '3px 8px' }}>
              <X size={10} /> Limpar seleção
            </button>
          )}
        </div>
      </div>

      {/* Ativo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button onClick={() => set('active', !form.active)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: form.active ? 'var(--status-success)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: 0 }}>
          {form.active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
          {form.active ? 'Ativa' : 'Inativa'}
        </button>
      </div>

      {/* Botões */}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button style={sBtn()} onClick={onCancelar}>Cancelar</button>
        <button style={sBtn(true)} onClick={() => form.name.trim() && onSalvar(form)}>
          <Check size={13} /> Salvar Regra
        </button>
      </div>
    </div>
  )
}

// ─── Página ───────────────────────────────────────────────────────────────────

const ABAS = ['Campanhas', 'Regras', 'Agendador', 'Histórico'] as const
type Aba = typeof ABAS[number]

interface BotAccount {
  id: string
  name: string
  meta_account_id: string
  status: 'active' | 'disabled'
  is_selected: boolean
  active_campaign_count: number
}

export default function BotPage() {
  const [aba, setAba] = useState<Aba>('Campanhas')
  const [campanhas, setCampanhas] = useState<Campaign[]>([])
  const [regras, setRegras] = useState<Rule[]>([])
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [config, setConfig] = useState<Settings | null>(null)
  const [carregando, setCarregando] = useState({ campanhas: false, executar: false, salvar: false })
  const [datePreset, setDatePreset] = useState<'today' | 'yesterday' | 'yesterday_today' | 'custom'>('today')
  const [customSince, setCustomSince] = useState(() => new Date().toISOString().split('T')[0])
  const [customUntil, setCustomUntil] = useState(() => new Date().toISOString().split('T')[0])
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editando, setEditando] = useState<Rule | null>(null)
  const [resultadoExec, setResultadoExec] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [cronInput, setCronInput] = useState('0 8 * * *')
  const [totalDuplicados, setTotalDuplicados] = useState<number | null>(null)
  const [contas, setContas] = useState<BotAccount[]>([])

  // ── Fetches ───────────────────────────────────────────────────────────────

  const getDateRange = useCallback(() => {
    const fmt = (d: Date) => d.toISOString().split('T')[0]
    const today = fmt(new Date())
    const yday = fmt(new Date(Date.now() - 86400000))
    if (datePreset === 'today') return { since: today, until: today }
    if (datePreset === 'yesterday') return { since: yday, until: yday }
    if (datePreset === 'yesterday_today') return { since: yday, until: today }
    return { since: customSince, until: customUntil }
  }, [datePreset, customSince, customUntil])

  const buscarCampanhas = useCallback(async () => {
    setCarregando(c => ({ ...c, campanhas: true })); setErro(null)
    try {
      const { since, until } = getDateRange()
      const r = await fetch(`/api/bot/campaigns?since=${since}&until=${until}`)
      const d = await r.json()
      if (d.error) throw new Error(d.error)
      setCampanhas(d.campaigns)
    } catch (e) { setErro((e as Error).message) }
    setCarregando(c => ({ ...c, campanhas: false }))
  }, [getDateRange])

  const buscarRegras   = async () => { const r = await fetch('/api/bot/rules');    const d = await r.json(); setRegras(d.rules ?? []) }
  const buscarLogs     = async () => { const r = await fetch('/api/bot/logs');     const d = await r.json(); setLogs(d.logs ?? []) }
  const buscarConfig   = async () => {
    const r = await fetch('/api/bot/settings'); const d = await r.json()
    setConfig(d.settings); setCronInput(d.settings?.schedule ?? '0 8 * * *')
  }
  const buscarCooldowns = async () => {
    const r = await fetch('/api/bot/cooldowns'); const d = await r.json()
    const counts = d.state?.duplicate_counts ?? {}
    setTotalDuplicados(Object.values(counts).reduce((s: number, v) => s + (v as number), 0))
  }
  const buscarContas = async () => {
    const r = await fetch('/api/bot/accounts'); const d = await r.json()
    setContas(d.accounts ?? [])
  }

  useEffect(() => { buscarRegras(); buscarConfig(); buscarCooldowns(); buscarContas() }, [])
  useEffect(() => { if (aba === 'Campanhas') buscarCampanhas() }, [aba, buscarCampanhas])
  useEffect(() => { if (aba === 'Campanhas') buscarCampanhas() }, [datePreset, customSince, customUntil]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (aba === 'Histórico') buscarLogs() }, [aba])

  // ── Toggle simulação ──────────────────────────────────────────────────────

  const toggleSimulacao = async () => {
    if (!config) return
    const novo = { ...config, dry_run: !config.dry_run }
    setConfig(novo)
    await fetch('/api/bot/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dry_run: novo.dry_run }) })
  }

  // ── Executar agora ────────────────────────────────────────────────────────

  const executarAgora = async () => {
    setCarregando(c => ({ ...c, executar: true })); setResultadoExec(null); setErro(null)
    try {
      const r = await fetch('/api/bot/run', { method: 'POST' }); const d = await r.json()
      if (d.error) throw new Error(d.error)
      setResultadoExec(`${d.actions_taken} ação(ões) ${d.dry_run ? '(simulação)' : 'executadas'} em ${d.campaigns_analyzed} campanhas`)
      if (aba === 'Histórico') buscarLogs()
      buscarConfig(); buscarCooldowns()
    } catch (e) { setErro((e as Error).message) }
    setCarregando(c => ({ ...c, executar: false }))
  }

  // ── CRUD Regras ───────────────────────────────────────────────────────────

  const salvarRegra = async (dados: Omit<Rule, 'id' | 'created_at'>) => {
    const url = editando ? `/api/bot/rules/${editando.id}` : '/api/bot/rules'
    const r = await fetch(url, { method: editando ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) })
    const d = await r.json()
    if (d.error) { setErro(`Erro ao salvar regra: ${d.error}`); return }
    setMostrarForm(false); setEditando(null); buscarRegras()
  }
  const toggleRegra = async (r: Rule) => {
    await fetch(`/api/bot/rules/${r.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !r.active }) })
    buscarRegras()
  }
  const apagarRegra = async (id: string) => {
    if (!confirm('Apagar esta regra?')) return
    await fetch(`/api/bot/rules/${id}`, { method: 'DELETE' }); buscarRegras()
  }

  // ── Agendador ─────────────────────────────────────────────────────────────

  const salvarAgendamento = async () => {
    setCarregando(c => ({ ...c, salvar: true }))
    const r = await fetch('/api/bot/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ schedule: cronInput, date_window_days: config?.date_window_days ?? 1 }) })
    const d = await r.json(); setConfig(d.settings)
    setCarregando(c => ({ ...c, salvar: false }))
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="page-enter" style={{ maxWidth: 1020 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } select { background: var(--bg-elevated); }`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Bot size={20} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: '600', color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>Bot de Escala</h1>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {config?.last_run ? `Última execução: ${new Date(config.last_run).toLocaleString('pt-BR')}` : 'Nenhuma execução ainda'}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={toggleSimulacao} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: 'var(--radius-sm)', border: `1px solid ${config?.dry_run ? 'var(--status-warning)' : 'var(--status-success)'}`, background: 'transparent', cursor: 'pointer', fontSize: '12px', fontWeight: '600', color: config?.dry_run ? 'var(--status-warning)' : 'var(--status-success)' }}>
            {config?.dry_run ? <ToggleLeft size={16} /> : <ToggleRight size={16} />}
            {config?.dry_run ? 'SIMULAÇÃO LIGADA' : 'MODO REAL ATIVO'}
          </button>
          <button onClick={executarAgora} disabled={carregando.executar} style={{ ...sBtn(true), opacity: carregando.executar ? 0.7 : 1 }}>
            {carregando.executar ? <Spin /> : <Play size={13} />} Executar Agora
          </button>
        </div>
      </div>

      {/* Alertas */}
      {config?.dry_run && (
        <div style={{ display: 'flex', gap: '8px', padding: '10px 14px', background: 'rgba(234,179,8,0.07)', border: '1px solid rgba(234,179,8,0.25)', borderRadius: 'var(--radius-sm)', marginBottom: '14px', alignItems: 'center' }}>
          <AlertTriangle size={14} color="var(--status-warning)" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '13px', color: 'var(--status-warning)' }}>Modo simulação ativo — o bot mostra o que faria mas não executa nada na Meta.</span>
        </div>
      )}
      {resultadoExec && (
        <div style={{ display: 'flex', gap: '8px', padding: '10px 14px', background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 'var(--radius-sm)', marginBottom: '14px', alignItems: 'center' }}>
          <ShieldCheck size={14} color="var(--status-success)" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '13px', color: 'var(--status-success)' }}>✓ {resultadoExec}</span>
        </div>
      )}
      {erro && (
        <div style={{ display: 'flex', gap: '8px', padding: '10px 14px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-sm)', marginBottom: '14px', alignItems: 'center' }}>
          <X size={14} color="var(--status-error)" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '13px', color: 'var(--status-error)' }}>{erro}</span>
        </div>
      )}

      {/* Painel de Contas */}
      <div style={{ marginBottom: '14px', ...sCard, padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Contas de Anúncio
          </span>
          <button onClick={buscarContas} style={{ ...sBtn(), padding: '4px 10px', fontSize: '11px' }}>
            <RefreshCw size={11} /> Atualizar
          </button>
        </div>
        {contas.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Nenhuma conta conectada. Vá em Configurações → adicione uma BM.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px' }}>
            {contas.map(acc => {
              const ativa = acc.status === 'active'
              return (
                <div key={acc.id} style={{
                  display: 'flex', flexDirection: 'column', gap: '4px',
                  padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${ativa ? 'rgba(34,197,94,0.25)' : 'rgba(100,100,100,0.2)'}`,
                  background: ativa ? 'rgba(34,197,94,0.04)' : 'var(--bg-elevated)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: ativa ? 'var(--status-success)' : 'rgba(150,150,150,0.5)' }} />
                    <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {acc.name}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingLeft: '15px' }}>
                    <span style={{ fontSize: '12px', color: ativa ? 'var(--status-success)' : 'var(--text-muted)' }}>
                      {ativa ? `${acc.active_campaign_count} campanha${acc.active_campaign_count !== 1 ? 's' : ''} ativa${acc.active_campaign_count !== 1 ? 's' : ''}` : 'Sem campanhas ativas'}
                    </span>
                  </div>
                  <div style={{ paddingLeft: '15px', marginTop: '2px' }}>
                    {acc.is_selected ? (
                      <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 7px', borderRadius: '8px', background: 'var(--accent)', color: '#fff' }}>
                        RODANDO REGRAS
                      </span>
                    ) : (
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>não selecionada</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', gap: '2px', borderBottom: '1px solid var(--bg-border)', marginBottom: '20px' }}>
        {ABAS.map(a => (
          <button key={a} onClick={() => setAba(a)} style={{ padding: '8px 18px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: aba === a ? '600' : '400', color: aba === a ? 'var(--text-primary)' : 'var(--text-muted)', borderBottom: aba === a ? '2px solid var(--accent)' : '2px solid transparent', marginBottom: '-1px' }}>
            {a}{a === 'Regras' && regras.length > 0 && <span style={{ marginLeft: 5, fontSize: '11px', background: 'var(--bg-elevated)', padding: '1px 6px', borderRadius: '10px' }}>{regras.length}</span>}
          </button>
        ))}
      </div>

      {/* ════════════ CAMPANHAS ════════════ */}
      {aba === 'Campanhas' && (
        <div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '14px', flexWrap: 'wrap' }}>
            {/* Seletor de período */}
            <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-elevated)', padding: '3px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--bg-border)' }}>
              {([
                { key: 'today',          label: 'Hoje'         },
                { key: 'yesterday',      label: 'Ontem'        },
                { key: 'yesterday_today',label: 'Ontem + Hoje' },
                { key: 'custom',         label: 'Personalizado'},
              ] as const).map(({ key, label }) => (
                <button key={key} onClick={() => setDatePreset(key)} style={{
                  padding: '5px 11px', borderRadius: '5px', border: 'none', cursor: 'pointer',
                  fontSize: '12px', fontWeight: datePreset === key ? '600' : '400',
                  background: datePreset === key ? 'var(--accent)' : 'transparent',
                  color: datePreset === key ? '#fff' : 'var(--text-muted)',
                  transition: 'all .15s',
                }}>
                  {label}
                </button>
              ))}
            </div>
            {datePreset === 'custom' && (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <input type="date" value={customSince} onChange={e => setCustomSince(e.target.value)}
                  style={{ ...sInput, width: 'auto', padding: '5px 9px', fontSize: '12px' }} />
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>até</span>
                <input type="date" value={customUntil} onChange={e => setCustomUntil(e.target.value)}
                  style={{ ...sInput, width: 'auto', padding: '5px 9px', fontSize: '12px' }} />
              </div>
            )}
            <button onClick={buscarCampanhas} style={sBtn()}>
              <RefreshCw size={13} style={{ animation: carregando.campanhas ? 'spin .7s linear infinite' : 'none' }} /> Atualizar
            </button>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', alignSelf: 'center' }}>{campanhas.length} campanhas</span>
          </div>
          <div style={{ ...sCard, padding: 0, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 940 }}>
              <thead>
                <tr>
                  {['Campanha', 'Gasto', 'ROAS', 'CPC', 'CPM', 'CTR', 'Custo/Compra', 'Orçamento', 'Ação Planejada', 'Regra / Bloqueio'].map(h => (
                    <th key={h} style={sTh}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {carregando.campanhas ? (
                  <tr><td colSpan={10} style={{ ...sTd, textAlign: 'center', padding: '32px' }}>Carregando...</td></tr>
                ) : campanhas.length === 0 ? (
                  <tr><td colSpan={10} style={{ ...sTd, textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    Nenhuma campanha. Verifique META_AD_ACCOUNT_ID no .env.local.
                  </td></tr>
                ) : campanhas.map(c => (
                  <tr key={c.campaign_id}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ ...sTd, fontWeight: '500', color: 'var(--text-primary)', maxWidth: 190, overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.campaign_name}</td>
                    <td style={sTd}>R${c.spend.toFixed(2)}</td>
                    <td style={{ ...sTd, color: c.purchase_roas >= 3 ? 'var(--status-success)' : 'var(--text-secondary)', fontWeight: '600' }}>{c.purchase_roas.toFixed(2)}</td>
                    <td style={sTd}>R${c.cpc.toFixed(2)}</td>
                    <td style={sTd}>R${c.cpm.toFixed(2)}</td>
                    <td style={sTd}>{c.ctr.toFixed(2)}%</td>
                    <td style={sTd}>{c.cost_per_purchase > 0 ? `R$${c.cost_per_purchase.toFixed(2)}` : '—'}</td>
                    <td style={sTd}>
                      R${c.budget_reais.toFixed(2)}
                      {c.planned_new_budget != null && (
                        <span style={{ marginLeft: 5, fontSize: '11px', color: 'var(--status-success)' }}>
                          → R${(c.planned_new_budget / 100).toFixed(2)}
                        </span>
                      )}
                    </td>
                    <td style={sTd}>
                      <span style={{ fontSize: '11px', fontWeight: '600', color: corAcao(c.planned_action), background: `${corAcao(c.planned_action)}18`, padding: '2px 8px', borderRadius: '10px' }}>
                        {labelAcao(c.planned_action)}
                      </span>
                    </td>
                    <td style={{ ...sTd, fontSize: '12px', maxWidth: 170 }}>
                      {c.planned_rule && <span style={{ color: 'var(--text-primary)' }}>{c.planned_rule}</span>}
                      {c.skipped_rules?.length > 0 && (
                        <div style={{ marginTop: 2 }}>
                          {c.skipped_rules.map((s, si) => (
                            <div key={si} title={s.detail} style={{ color: 'var(--status-warning)', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              ⏸ {s.rule_name}
                            </div>
                          ))}
                        </div>
                      )}
                      {!c.planned_rule && (!c.skipped_rules || c.skipped_rules.length === 0) && (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════════════ REGRAS ════════════ */}
      {aba === 'Regras' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Info + contador de duplicações */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, padding: '12px 14px', background: 'rgba(91,110,245,0.06)', border: '1px solid rgba(91,110,245,0.18)', borderRadius: 'var(--radius-sm)', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <Info size={14} color="var(--accent)" style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.7 }}>
                Regras avaliadas em ordem de criação (stop-first). Intervalo mínimo e horários são por campanha por regra.
              </p>
            </div>
            {totalDuplicados !== null && totalDuplicados > 0 && (
              <div style={{ padding: '12px 14px', background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                <div>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>DUPLICAÇÕES REALIZADAS</p>
                  <p style={{ fontSize: '20px', fontWeight: '700', color: 'var(--status-warning)' }}>{totalDuplicados}</p>
                </div>
                <button onClick={async () => { await fetch('/api/bot/cooldowns?type=duplicates', { method: 'DELETE' }); buscarCooldowns() }}
                  style={{ ...sBtn(false, false), fontSize: '12px' }}>
                  <RotateCcw size={12} /> Resetar
                </button>
              </div>
            )}
          </div>

          {regras.length === 0 && !mostrarForm && (
            <div style={{ ...sCard, textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
              Nenhuma regra criada. Clique em &quot;Nova Regra&quot; para começar.
            </div>
          )}

          {regras.map((regra, i) => {
            return (
              <div key={regra.id} style={{ ...sCard, opacity: regra.active ? 1 : 0.55 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--accent)', background: 'rgba(91,110,245,0.12)', padding: '1px 7px', borderRadius: '4px' }}>#{i + 1}</span>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>{regra.name}</span>
                      {!regra.active && <span style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '1px 7px', borderRadius: '4px' }}>Inativa</span>}
                    </div>

                    {/* Condições */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '8px' }}>
                      {regra.conditions.map((c, ci) => {
                        const met = METRICAS.find(x => x.key === c.metric)
                        const op = OPERADORES.find(x => x.value === c.operator)
                        return (
                          <span key={ci} style={{ fontSize: '12px', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', padding: '3px 9px', borderRadius: '6px', color: 'var(--text-secondary)' }}>
                            {met?.label ?? c.metric} {op?.value ?? c.operator} {c.value}{met?.unidade ? ` ${met.unidade}` : ''}
                          </span>
                        )
                      })}
                    </div>

                    {/* Ação */}
                    <div style={{ fontSize: '13px', color: corAcao(regra.action), fontWeight: '500', marginBottom: '6px' }}>
                      → {labelAcao(regra.action)}
                      {regra.action === 'scale_pct' && ` ${regra.action_value > 0 ? '+' : ''}${regra.action_value}%`}
                      {regra.action === 'scale_fixed' && ` ${regra.action_value > 0 ? '+' : ''}R$${regra.action_value}`}
                      {regra.action === 'set_budget' && ` R$${regra.action_value}`}
                    </div>

                    {/* Restrições resumidas */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      <span style={{ fontSize: '11px', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', padding: '2px 8px', borderRadius: '10px', color: 'var(--text-muted)' }}>
                        {NIVEL_LABELS[regra.filter_level ?? 'campaign']}
                      </span>
                      {regra.campaign_filter === 'name_contains' && regra.campaign_filter_text && (
                        <span style={{ fontSize: '11px', background: 'rgba(91,110,245,0.08)', border: '1px solid rgba(91,110,245,0.2)', padding: '2px 8px', borderRadius: '10px', color: 'var(--accent)' }}>
                          Nome contém: &quot;{regra.campaign_filter_text}&quot;
                        </span>
                      )}
                      {regra.campaign_filter === 'specific' && (
                        <span style={{ fontSize: '11px', background: 'rgba(91,110,245,0.08)', border: '1px solid rgba(91,110,245,0.2)', padding: '2px 8px', borderRadius: '10px', color: 'var(--accent)' }}>
                          {regra.campaign_filter_ids.length} {NIVEL_LABELS[regra.filter_level ?? 'campaign'].toLowerCase()}(s) específico(s)
                        </span>
                      )}
                      {regra.cooldown_hours > 0 && (
                        <span style={{ fontSize: '11px', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', padding: '2px 8px', borderRadius: '10px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={10} /> Intervalo: {regra.cooldown_hours}h
                        </span>
                      )}
                      {regra.allowed_hours.length > 0 && (
                        <span style={{ fontSize: '11px', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', padding: '2px 8px', borderRadius: '10px', color: 'var(--text-muted)' }}>
                          Horários: {regra.allowed_hours.map(h => `${h}h`).join(', ')}
                        </span>
                      )}
                      {regra.action === 'duplicate' && regra.max_duplicates > 0 && (
                        <span style={{ fontSize: '11px', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', padding: '2px 8px', borderRadius: '10px', color: 'var(--text-muted)' }}>
                          Máx. {regra.max_duplicates}x
                        </span>
                      )}
                      {regra.action === 'duplicate' && regra.duplicate_until && (
                        <span style={{ fontSize: '11px', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', padding: '2px 8px', borderRadius: '10px', color: 'var(--text-muted)' }}>
                          Até {regra.duplicate_until}
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                    <button onClick={() => toggleRegra(regra)} title={regra.active ? 'Desativar' : 'Ativar'} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: regra.active ? 'var(--status-success)' : 'var(--text-muted)' }}>
                      {regra.active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                    </button>
                    <button onClick={() => { setEditando(regra); setMostrarForm(true) }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--text-muted)' }}><Edit2 size={15} /></button>
                    <button onClick={() => apagarRegra(regra.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--status-error)' }}><Trash2 size={15} /></button>
                  </div>
                </div>
              </div>
            )
          })}

          {mostrarForm ? (
            <FormularioRegra
              inicial={editando ?? undefined}
              onSalvar={salvarRegra}
              onCancelar={() => { setMostrarForm(false); setEditando(null) }}
            />
          ) : (
            <button onClick={() => setMostrarForm(true)} style={{ ...sBtn(true), alignSelf: 'flex-start' }}>
              <Plus size={14} /> Nova Regra
            </button>
          )}
        </div>
      )}

      {/* ════════════ AGENDADOR ════════════ */}
      {aba === 'Agendador' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={sCard}>
            <h2 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={14} /> Horário de Execução Global
            </h2>

            <div style={{ marginBottom: '14px' }}>
              <label style={sLabel}>Expressão Cron (totalmente livre)</label>
              <input style={sInput} value={cronInput} onChange={e => setCronInput(e.target.value)} placeholder="0 8 * * *" />
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '5px' }}>
                Formato: <code style={{ background: 'var(--bg-elevated)', padding: '1px 4px', borderRadius: '3px' }}>minuto hora dia-mês mês dia-semana</code>
                &nbsp;·&nbsp;<a href="https://crontab.guru" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>crontab.guru</a>
              </p>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '18px' }}>
              {ATALHOS_CRON.map(a => (
                <button key={a.expr} onClick={() => setCronInput(a.expr)} style={{ ...sBtn(), fontSize: '12px', padding: '5px 10px', border: cronInput === a.expr ? '1px solid var(--accent)' : '1px solid var(--bg-border)', color: cronInput === a.expr ? 'var(--accent)' : 'var(--text-muted)' }}>
                  {a.label}
                </button>
              ))}
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={sLabel}>Janela de dados (dias anteriores para calcular métricas)</label>
              <input type="number" min={1} max={90} style={{ ...sInput, width: '120px' }}
                value={config?.date_window_days ?? 7}
                onChange={e => setConfig(p => p ? { ...p, date_window_days: parseInt(e.target.value) || 7 } : p)} />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={salvarAgendamento} style={sBtn(true)} disabled={carregando.salvar}>
                {carregando.salvar ? <Spin /> : <Check size={13} />} Salvar
              </button>
              <button onClick={executarAgora} disabled={carregando.executar} style={sBtn()}>
                {carregando.executar ? <Spin /> : <Zap size={13} />} Executar Agora
              </button>
            </div>
          </div>

          {/* Resetar todos os cooldowns */}
          <div style={{ ...sCard, background: 'var(--bg-elevated)' }}>
            <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' }}>Resetar todos os contadores e intervalos</p>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
              Zera os contadores de duplicação e os intervalos de cooldown de todas as regras. Use quando quiser que as regras possam disparar novamente imediatamente.
            </p>
            <button onClick={async () => { if (!confirm('Resetar todos os cooldowns e contadores de duplicação?')) return; await fetch('/api/bot/cooldowns', { method: 'DELETE' }); buscarCooldowns(); setResultadoExec('Cooldowns e contadores resetados.') }}
              style={sBtn(false, true)}>
              <RotateCcw size={13} /> Resetar Tudo
            </button>
          </div>

          <div style={{ ...sCard, background: 'var(--bg-elevated)' }}>
            <p style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>Execução automática via agendador externo</p>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.7 }}>
              Para agendamento externo (crontab, launchd, etc.):<br />
              <code style={{ background: 'var(--bg-border)', padding: '2px 6px', borderRadius: '3px', display: 'inline-block', marginTop: '4px' }}>
                curl -s -X POST http://localhost:3000/api/bot/cron
              </code>
            </p>
          </div>
        </div>
      )}

      {/* ════════════ HISTÓRICO ════════════ */}
      {aba === 'Histórico' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{logs.length} registros</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={buscarLogs} style={sBtn()}><RefreshCw size={13} /> Atualizar</button>
              <button onClick={async () => { if (!confirm('Apagar todo o histórico?')) return; await fetch('/api/bot/logs', { method: 'DELETE' }); setLogs([]) }} style={sBtn(false, true)}>
                <Trash2 size={13} /> Limpar
              </button>
            </div>
          </div>
          <div style={{ ...sCard, padding: 0, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
              <thead>
                <tr>
                  {['Data / Hora', 'Campanha', 'Regra', 'Ação', 'Detalhe', 'Status'].map(h => <th key={h} style={sTh}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr><td colSpan={6} style={{ ...sTd, textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Nenhum registro ainda.</td></tr>
                ) : logs.map(log => {
                  const selectedAcc = contas.find(c => c.is_selected)
                  const accountId = selectedAcc?.meta_account_id?.replace('act_', '') ?? ''
                  const adsManagerUrl = accountId && log.campaign_id
                    ? `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${accountId}&selected_campaign_ids=${log.campaign_id}`
                    : null
                  return (
                  <tr key={log.id}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ ...sTd, fontSize: '12px' }}>
                      {new Date(log.timestamp).toLocaleString('pt-BR')}
                      {log.dry_run && <span style={{ marginLeft: 5, fontSize: '10px', color: 'var(--status-warning)', background: 'rgba(234,179,8,0.1)', padding: '1px 5px', borderRadius: '3px' }}>SIMULAÇÃO</span>}
                    </td>
                    <td style={{ ...sTd, fontWeight: '500', color: 'var(--text-primary)', maxWidth: 160 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', overflow: 'hidden' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.campaign_name}</span>
                        {adsManagerUrl && (
                          <a href={adsManagerUrl} target="_blank" rel="noopener noreferrer"
                            style={{ color: 'var(--text-muted)', flexShrink: 0 }}
                            title="Abrir no Ads Manager">
                            <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                    </td>
                    <td style={{ ...sTd, fontSize: '12px', color: 'var(--text-muted)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>{log.rule_name ?? '—'}</td>
                    <td style={sTd}>
                      <span style={{ fontSize: '11px', fontWeight: '600', color: corAcao(log.action), background: `${corAcao(log.action)}18`, padding: '2px 8px', borderRadius: '10px' }}>{log.action}</span>
                    </td>
                    <td style={{ ...sTd, fontSize: '11px', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }} title={log.details}>{log.details}</td>
                    <td style={sTd}>
                      {log.success ? <Check size={14} color="var(--status-success)" /> : <span title={log.error ?? ''}><X size={14} color="var(--status-error)" /></span>}
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
