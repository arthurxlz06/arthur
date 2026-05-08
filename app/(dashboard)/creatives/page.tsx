'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  PlaySquare,
  ChevronDown,
  ChevronUp,
  Link2,
  X,
  Check,
  Upload,
  ArrowUpDown,
  Filter,
  Bookmark,
  Trash2,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface AdAccount {
  id: string
  meta_account_id: string
  name: string
}

interface AdMetrics {
  ad_id: string
  ad_name: string
  spend: number
  clicks: number
  impressions: number
  lp_views: number
  video_views: number
  ctr: number
  hook_rate: number
  body_rate: number
  cpm: number
  cpc: number
  cpa: number
  purchases: number
  revenue: number
  roas: number
  avg_ticket: number
  conv_rate: number
  video_3s: number
  video_15s: number
  video_30s: number
}

interface CreativeLink {
  id: string
  ad_name: string
  dropbox_url: string
  dropbox_direct_url: string
}

interface Creative extends AdMetrics {
  link: CreativeLink | null
}

type SortField = keyof AdMetrics
type SortDir = 'asc' | 'desc'

interface Filters {
  search: string
  roas_min: string
  roas_max: string
  spend_min: string
  spend_max: string
  revenue_min: string
  revenue_max: string
  cpa_min: string
  cpa_max: string
  ctr_min: string
  ctr_max: string
  hook_rate_min: string
  hook_rate_max: string
}

// ─── Formatters ──────────────────────────────────────────────────────────────

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function fmtBRL(n: number) {
  return brl.format(n)
}

function fmtPct(n: number) {
  return `${n.toFixed(1)}%`
}

function fmtROAS(n: number) {
  return `${n.toFixed(2)}x`
}

function fmtInt(n: number) {
  return new Intl.NumberFormat('pt-BR').format(Math.round(n))
}

// ─── Spinner ─────────────────────────────────────────────────────────────────

function Spinner({ size = 16 }: { size?: number }) {
  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        border: '2px solid var(--bg-border)',
        borderTopColor: 'var(--accent)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
        flexShrink: 0,
      }}
    />
  )
}

// ─── Video Player ─────────────────────────────────────────────────────────────

function VideoPlayer({
  src,
  adName,
  onLink,
}: {
  src: string | null
  adName: string
  onLink: () => void
}) {
  if (!src) {
    return (
      <div
        style={{
          aspectRatio: '9/16',
          background: 'var(--bg-elevated)',
          border: '1px dashed var(--bg-border)',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          cursor: 'pointer',
        }}
        onClick={onLink}
        title={`Vincular vídeo para "${adName}"`}
      >
        <PlaySquare size={28} color="var(--text-muted)" />
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', padding: '0 8px' }}>
          + Vincular vídeo
        </span>
      </div>
    )
  }

  return (
    <video
      src={src}
      controls
      preload="metadata"
      style={{ width: '100%', borderRadius: '8px', aspectRatio: '9/16', background: '#000', display: 'block' }}
    />
  )
}

// ─── Creative Card ────────────────────────────────────────────────────────────

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0' }}>
      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-primary)' }}>{value}</span>
    </div>
  )
}

function CreativeCard({
  creative,
  onLink,
}: {
  creative: Creative
  onLink: (adName: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--bg-border)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Video */}
      <div style={{ padding: '12px 12px 0' }}>
        <VideoPlayer
          src={creative.link?.dropbox_direct_url ?? null}
          adName={creative.ad_name}
          onLink={() => onLink(creative.ad_name)}
        />
      </div>

      {/* Content */}
      <div style={{ padding: '12px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Ad name */}
        <p
          style={{
            fontSize: '12px',
            fontWeight: '600',
            color: 'var(--text-primary)',
            marginBottom: '10px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={creative.ad_name}
        >
          {creative.ad_name}
        </p>

        {/* Primary metrics */}
        <div style={{ borderTop: '1px solid var(--bg-border)', paddingTop: '8px' }}>
          <MetricRow label="ROAS" value={fmtROAS(creative.roas)} />
          <MetricRow label="Gasto" value={fmtBRL(creative.spend)} />
          <MetricRow label="Receita" value={fmtBRL(creative.revenue)} />
          <MetricRow label="CPA" value={creative.cpa > 0 ? fmtBRL(creative.cpa) : '—'} />
          <MetricRow label="CTR" value={fmtPct(creative.ctr)} />
          <MetricRow label="Hook Rate" value={fmtPct(creative.hook_rate)} />
          <MetricRow label="Body Rate" value={fmtPct(creative.body_rate)} />
          <MetricRow label="CPM" value={fmtBRL(creative.cpm)} />
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded((v) => !v)}
          style={{
            marginTop: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            width: '100%',
            padding: '5px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--bg-border)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: '11px',
          }}
        >
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {expanded ? 'Menos métricas' : 'Ver mais métricas'}
        </button>

        {/* Expanded metrics */}
        {expanded && (
          <div style={{ borderTop: '1px solid var(--bg-border)', marginTop: '10px', paddingTop: '8px' }}>
            <MetricRow label="Cliques" value={fmtInt(creative.clicks)} />
            <MetricRow label="Impressões" value={fmtInt(creative.impressions)} />
            <MetricRow label="LP Views" value={fmtInt(creative.lp_views)} />
            <MetricRow label="Video Views" value={fmtInt(creative.video_views)} />
            <MetricRow label="CPC" value={creative.cpc > 0 ? fmtBRL(creative.cpc) : '—'} />
            <MetricRow label="Vendas" value={fmtInt(creative.purchases)} />
            <MetricRow label="Ticket Médio" value={creative.avg_ticket > 0 ? fmtBRL(creative.avg_ticket) : '—'} />
            <MetricRow label="Tx Conversão" value={fmtPct(creative.conv_rate)} />
            <div style={{ borderTop: '1px solid var(--bg-border)', margin: '6px 0' }} />
            <MetricRow label="3S VV" value={fmtInt(creative.video_3s)} />
            <MetricRow label="15S VV" value={fmtInt(creative.video_15s)} />
            <MetricRow label="30S VV" value={fmtInt(creative.video_30s)} />
          </div>
        )}

        {/* Link button if no video */}
        {!creative.link && (
          <button
            onClick={() => onLink(creative.ad_name)}
            style={{
              marginTop: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '5px',
              width: '100%',
              padding: '7px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--accent)',
              background: 'rgba(91,110,245,0.08)',
              color: 'var(--accent)',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '500',
            }}
          >
            <Link2 size={12} />
            Vincular vídeo
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Link Modal ───────────────────────────────────────────────────────────────

function LinkModal({
  adName,
  onClose,
  onSave,
}: {
  adName: string
  onClose: () => void
  onSave: (adName: string, url: string) => Promise<void>
}) {
  const [url, setUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!url.trim()) { setError('Cole o link do Dropbox'); return }
    if (!url.includes('dropbox.com') && !url.includes('dropboxusercontent.com')) {
      setError('Use um link do Dropbox')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSave(adName, url.trim())
      onClose()
    } catch {
      setError('Erro ao salvar o link')
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(3px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--bg-border)',
          borderRadius: 'var(--radius-md)',
          padding: '24px',
          width: '100%',
          maxWidth: '480px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Vincular vídeo
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px' }}>
            <X size={18} />
          </button>
        </div>

        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Ad:</p>
        <p
          style={{
            fontSize: '13px',
            fontWeight: '500',
            color: 'var(--text-primary)',
            marginBottom: '16px',
            padding: '8px 10px',
            background: 'var(--bg-elevated)',
            borderRadius: 'var(--radius-sm)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {adName}
        </p>

        <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
          Link do Dropbox
        </label>
        <input
          type="url"
          autoFocus
          placeholder="https://www.dropbox.com/s/..."
          value={url}
          onChange={(e) => { setUrl(e.target.value); setError('') }}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
          style={{
            width: '100%',
            padding: '9px 12px',
            fontSize: '13px',
            borderRadius: 'var(--radius-sm)',
            border: `1px solid ${error ? 'rgba(239,68,68,0.5)' : 'var(--bg-border)'}`,
            background: 'var(--bg-elevated)',
            color: 'var(--text-primary)',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        {error && <p style={{ fontSize: '11px', color: 'var(--status-error)', marginTop: '5px' }}>{error}</p>}

        <div style={{ display: 'flex', gap: '8px', marginTop: '16px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--bg-border)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '8px 16px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: 'var(--accent)',
              color: 'white',
              cursor: saving ? 'wait' : 'pointer',
              fontSize: '13px',
              fontWeight: '500',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? <Spinner size={12} /> : <Check size={14} />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── CSV Import Modal ─────────────────────────────────────────────────────────

function CsvImportModal({
  onClose,
  onImport,
}: {
  onClose: () => void
  onImport: (batch: { ad_name: string; dropbox_url: string }[]) => Promise<void>
}) {
  const [csv, setCsv] = useState('')
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const parseAndImport = async (raw: string) => {
    const lines = raw.trim().split('\n').filter(Boolean)
    const header = lines[0].toLowerCase()
    const dataLines = header.includes('ad_name') ? lines.slice(1) : lines

    const batch = dataLines.map((line) => {
      const commaIdx = line.indexOf(',')
      if (commaIdx === -1) return null
      return {
        ad_name: line.slice(0, commaIdx).trim(),
        dropbox_url: line.slice(commaIdx + 1).trim(),
      }
    }).filter((r): r is { ad_name: string; dropbox_url: string } => r !== null && r.ad_name.length > 0 && r.dropbox_url.length > 0)

    if (batch.length === 0) {
      setError('Nenhuma linha válida encontrada. Formato esperado: ad_name,dropbox_url')
      return
    }

    setImporting(true)
    setError('')
    try {
      await onImport(batch)
      onClose()
    } catch {
      setError('Erro ao importar')
      setImporting(false)
    }
  }

  const handleFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      setCsv(text)
    }
    reader.readAsText(file)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(3px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--bg-border)',
          borderRadius: 'var(--radius-md)',
          padding: '24px',
          width: '100%',
          maxWidth: '520px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Importar CSV
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px' }}>
            <X size={18} />
          </button>
        </div>

        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
          Formato esperado — duas colunas: <code style={{ background: 'var(--bg-elevated)', padding: '1px 4px', borderRadius: '3px' }}>ad_name,dropbox_url</code>
        </p>

        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          style={{ display: 'none' }}
          onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }}
        />

        <button
          onClick={() => fileRef.current?.click()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--bg-border)',
            background: 'var(--bg-elevated)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: '12px',
            marginBottom: '12px',
          }}
        >
          <Upload size={13} /> Selecionar arquivo CSV
        </button>

        <textarea
          placeholder={'ad_name,dropbox_url\nVideo Oferta Julho,https://www.dropbox.com/s/xxx/video.mp4?dl=0\nVideo Prova Social,https://www.dropbox.com/s/yyy/prova.mp4?dl=0'}
          value={csv}
          onChange={(e) => { setCsv(e.target.value); setError('') }}
          rows={7}
          style={{
            width: '100%',
            padding: '10px 12px',
            fontSize: '12px',
            fontFamily: 'monospace',
            borderRadius: 'var(--radius-sm)',
            border: `1px solid ${error ? 'rgba(239,68,68,0.5)' : 'var(--bg-border)'}`,
            background: 'var(--bg-elevated)',
            color: 'var(--text-primary)',
            outline: 'none',
            resize: 'vertical',
            boxSizing: 'border-box',
          }}
        />
        {error && <p style={{ fontSize: '11px', color: 'var(--status-error)', marginTop: '5px' }}>{error}</p>}

        <div style={{ display: 'flex', gap: '8px', marginTop: '16px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--bg-border)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={() => parseAndImport(csv)}
            disabled={importing || !csv.trim()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '8px 16px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: 'var(--accent)',
              color: 'white',
              cursor: importing || !csv.trim() ? 'not-allowed' : 'pointer',
              fontSize: '13px',
              fontWeight: '500',
              opacity: importing || !csv.trim() ? 0.6 : 1,
            }}
          >
            {importing ? <Spinner size={12} /> : <Check size={14} />}
            Importar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Filter Row ───────────────────────────────────────────────────────────────

function FilterRow({
  label,
  minKey,
  maxKey,
  filters,
  onChange,
  placeholder = '',
}: {
  label: string
  minKey: keyof Filters
  maxKey: keyof Filters
  filters: Filters
  onChange: (k: keyof Filters, v: string) => void
  placeholder?: string
}) {
  const active = filters[minKey] !== '' || filters[maxKey] !== ''
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '110px 1fr 1fr',
        alignItems: 'center',
        gap: '10px',
        padding: '8px 12px',
        borderRadius: 'var(--radius-sm)',
        background: active ? 'rgba(91,110,245,0.05)' : 'transparent',
        border: `1px solid ${active ? 'rgba(91,110,245,0.2)' : 'transparent'}`,
        transition: 'all 150ms ease',
      }}
    >
      <span style={{
        fontSize: '12px',
        fontWeight: '500',
        color: active ? 'var(--accent)' : 'var(--text-secondary)',
      }}>
        {label}
      </span>
      <div style={{ position: 'relative' }}>
        <span style={rangeSymbolStyle}>≥</span>
        <input
          type="number"
          placeholder={`Mínimo${placeholder ? ` ${placeholder}` : ''}`}
          value={filters[minKey]}
          onChange={(e) => onChange(minKey, e.target.value)}
          style={rangeInputStyle}
        />
        {filters[minKey] !== '' && (
          <button onClick={() => onChange(minKey, '')} style={clearBtnStyle}>
            <X size={10} />
          </button>
        )}
      </div>
      <div style={{ position: 'relative' }}>
        <span style={rangeSymbolStyle}>≤</span>
        <input
          type="number"
          placeholder={`Máximo${placeholder ? ` ${placeholder}` : ''}`}
          value={filters[maxKey]}
          onChange={(e) => onChange(maxKey, e.target.value)}
          style={rangeInputStyle}
        />
        {filters[maxKey] !== '' && (
          <button onClick={() => onChange(maxKey, '')} style={clearBtnStyle}>
            <X size={10} />
          </button>
        )}
      </div>
    </div>
  )
}

const rangeInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 28px 7px 26px',
  fontSize: '13px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--bg-border)',
  background: 'var(--bg-elevated)',
  color: 'var(--text-primary)',
  outline: 'none',
  boxSizing: 'border-box',
}

const rangeSymbolStyle: React.CSSProperties = {
  position: 'absolute',
  left: '9px',
  top: '50%',
  transform: 'translateY(-50%)',
  fontSize: '13px',
  color: 'var(--text-muted)',
  pointerEvents: 'none',
  userSelect: 'none',
}

const clearBtnStyle: React.CSSProperties = {
  position: 'absolute',
  right: '7px',
  top: '50%',
  transform: 'translateY(-50%)',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--text-muted)',
  display: 'flex',
  padding: '2px',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'roas', label: 'ROAS' },
  { value: 'spend', label: 'Gasto' },
  { value: 'revenue', label: 'Receita' },
  { value: 'cpa', label: 'CPA' },
  { value: 'ctr', label: 'CTR' },
  { value: 'hook_rate', label: 'Hook Rate' },
  { value: 'body_rate', label: 'Body Rate' },
  { value: 'cpm', label: 'CPM' },
  { value: 'purchases', label: 'Vendas' },
  { value: 'impressions', label: 'Impressões' },
]

interface SavedFilterSet {
  name: string
  filters: Filters
  sortField: SortField
  sortDir: SortDir
}

const LS_KEY = 'creatives_saved_filters'
const QUERY_KEY = 'creatives_query'
const adsCache = (accountId: string, since: string, until: string) =>
  `creatives_data_${accountId}_${since}_${until}`

const DEFAULT_FILTERS: Filters = {
  search: '',
  roas_min: '', roas_max: '',
  spend_min: '', spend_max: '',
  revenue_min: '', revenue_max: '',
  cpa_min: '', cpa_max: '',
  ctr_min: '', ctr_max: '',
  hook_rate_min: '', hook_rate_max: '',
}

export default function CreativesPage() {
  const [accounts, setAccounts] = useState<AdAccount[]>([])
  const [selectedAccount, setSelectedAccount] = useState('')
  const [since, setSince] = useState(() => {
    try {
      const q = JSON.parse(localStorage.getItem(QUERY_KEY) ?? '{}') as { since?: string }
      if (q.since) return q.since
    } catch {}
    const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10)
  })
  const [until, setUntil] = useState(() => {
    try {
      const q = JSON.parse(localStorage.getItem(QUERY_KEY) ?? '{}') as { until?: string }
      if (q.until) return q.until
    } catch {}
    return new Date().toISOString().slice(0, 10)
  })

  const [ads, setAds] = useState<AdMetrics[]>([])
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null)
  const [links, setLinks] = useState<CreativeLink[]>([])
  const [loadingAds, setLoadingAds] = useState(false)
  const [adsError, setAdsError] = useState('')

  const [filters, setFilters] = useState<Filters>(() => {
    try { return JSON.parse(localStorage.getItem('creatives_ui') ?? '{}').filters ?? DEFAULT_FILTERS }
    catch { return DEFAULT_FILTERS }
  })
  const [showFilters, setShowFilters] = useState(false)
  const [sortField, setSortField] = useState<SortField>(() => {
    try { return JSON.parse(localStorage.getItem('creatives_ui') ?? '{}').sortField ?? 'roas' }
    catch { return 'roas' }
  })
  const [sortDir, setSortDir] = useState<SortDir>(() => {
    try { return JSON.parse(localStorage.getItem('creatives_ui') ?? '{}').sortDir ?? 'desc' }
    catch { return 'desc' }
  })

  const [savedFilterSets, setSavedFilterSets] = useState<SavedFilterSet[]>([])
  const [saveFilterName, setSaveFilterName] = useState('')
  const [showSaveInput, setShowSaveInput] = useState(false)

  const [linkModal, setLinkModal] = useState<string | null>(null)
  const [showCsvModal, setShowCsvModal] = useState(false)

  // Dropbox
  const [dropboxConnected, setDropboxConnected] = useState<boolean | null>(null)
  const [dropboxFolders, setDropboxFolders] = useState<{ name: string; path: string }[]>([])
  const [dropboxBrowsePath, setDropboxBrowsePath] = useState(() => {
    try { return JSON.parse(localStorage.getItem('creatives_dropbox') ?? '{}').browsePath ?? '' }
    catch { return '' }
  })
  const [dropboxBrowseLoading, setDropboxBrowseLoading] = useState(false)
  const [dropboxFolder, setDropboxFolder] = useState(() => {
    try { return JSON.parse(localStorage.getItem('creatives_dropbox') ?? '{}').folder ?? '' }
    catch { return '' }
  })
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ matched: number; total: number } | null>(null)
  const [syncError, setSyncError] = useState('')

  // Persiste filtros + sort sempre que mudam
  useEffect(() => {
    localStorage.setItem('creatives_ui', JSON.stringify({ filters, sortField, sortDir }))
  }, [filters, sortField, sortDir])

  // Persiste pasta Dropbox sempre que muda
  useEffect(() => {
    localStorage.setItem('creatives_dropbox', JSON.stringify({ folder: dropboxFolder, browsePath: dropboxBrowsePath }))
  }, [dropboxFolder, dropboxBrowsePath])

  // Load saved filter sets from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (raw) setSavedFilterSets(JSON.parse(raw) as SavedFilterSet[])
    } catch {}
  }, [])

  const persistSavedSets = (sets: SavedFilterSet[]) => {
    setSavedFilterSets(sets)
    localStorage.setItem(LS_KEY, JSON.stringify(sets))
  }

  const handleSaveFilterSet = () => {
    const name = saveFilterName.trim()
    if (!name) return
    const newSet: SavedFilterSet = { name, filters, sortField, sortDir }
    const updated = [...savedFilterSets.filter((s) => s.name !== name), newSet]
    persistSavedSets(updated)
    setSaveFilterName('')
    setShowSaveInput(false)
  }

  const handleApplyFilterSet = (set: SavedFilterSet) => {
    setFilters(set.filters)
    setSortField(set.sortField)
    setSortDir(set.sortDir)
  }

  const handleDeleteFilterSet = (name: string) => {
    persistSavedSets(savedFilterSets.filter((s) => s.name !== name))
  }

  const [dropboxBrowseError, setDropboxBrowseError] = useState('')

  const browseDropbox = useCallback(async (path: string) => {
    setDropboxBrowseLoading(true)
    setDropboxBrowseError('')
    try {
      const res = await fetch(`/api/dropbox/sync?path=${encodeURIComponent(path)}`)
      const data = await res.json() as { folders?: { name: string; path: string }[]; error?: string }
      if (data.error) {
        setDropboxBrowseError(data.error)
        setDropboxFolders([])
      } else {
        setDropboxFolders(data.folders ?? [])
        setDropboxBrowsePath(path)
      }
    } catch {
      setDropboxBrowseError('Erro ao listar pastas')
      setDropboxFolders([])
    } finally {
      setDropboxBrowseLoading(false)
    }
  }, [])

  // Check Dropbox connection — restaura o browse path salvo
  useEffect(() => {
    const savedPath = (() => {
      try { return JSON.parse(localStorage.getItem('creatives_dropbox') ?? '{}').browsePath ?? '' }
      catch { return '' }
    })()
    fetch('/api/dropbox/status')
      .then((r) => r.json())
      .then((d: { connected?: boolean }) => {
        setDropboxConnected(d.connected ?? false)
        if (d.connected) browseDropbox(savedPath)
      })
      .catch(() => setDropboxConnected(false))
  }, [browseDropbox])

  // Handle ?dropbox=connected query param after OAuth callback
  useEffect(() => {
    if (typeof window === 'undefined') return
    const p = new URLSearchParams(window.location.search)
    if (p.get('dropbox') === 'connected') {
      setDropboxConnected(true)
      window.history.replaceState({}, '', '/creatives')
    }
  }, [])

  const handleSync = async () => {
    if (!dropboxFolder || ads.length === 0) return
    setSyncing(true)
    setSyncResult(null)
    setSyncError('')
    try {
      const res = await fetch('/api/dropbox/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folder_path: dropboxFolder,
          ad_names: ads.map((a) => a.ad_name),
        }),
      })
      const text = await res.text()
      let data: { matched?: number; total_files?: number; error?: string }
      try { data = JSON.parse(text) } catch { setSyncError(`Resposta inválida (${res.status}): ${text.slice(0, 200)}`); setSyncing(false); return }
      if (data.error) {
        setSyncError(data.error)
      } else {
        setSyncResult({ matched: data.matched ?? 0, total: data.total_files ?? 0 })
        await fetchLinks()
      }
    } catch {
      setSyncError('Erro ao sincronizar')
    } finally {
      setSyncing(false)
    }
  }

  const loadFromCache = useCallback((accountId: string, s: string, u: string) => {
    try {
      const raw = localStorage.getItem(adsCache(accountId, s, u))
      if (!raw) { setAds([]); setLastFetchedAt(null); return false }
      const { ads: cached, fetchedAt } = JSON.parse(raw) as { ads: AdMetrics[]; fetchedAt: string }
      setAds(cached)
      setLastFetchedAt(fetchedAt)
      return true
    } catch { return false }
  }, [])

  // Load selected ad accounts — restore saved account + cache on mount
  useEffect(() => {
    fetch('/api/accounts/selected')
      .then((r) => r.json())
      .then((data: { accounts?: AdAccount[] }) => {
        const list = data.accounts ?? []
        setAccounts(list)
        if (list.length === 0) return
        try {
          const q = JSON.parse(localStorage.getItem(QUERY_KEY) ?? '{}') as { accountId?: string; since?: string; until?: string }
          const savedAccount = q.accountId && list.find((a) => a.meta_account_id === q.accountId)
            ? q.accountId
            : list[0].meta_account_id
          setSelectedAccount(savedAccount)
          const s = q.since ?? since
          const u = q.until ?? until
          setSince(s)
          setUntil(u)
          loadFromCache(savedAccount, s, u)
        } catch {
          setSelectedAccount(list[0].meta_account_id)
        }
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load Dropbox links
  const fetchLinks = useCallback(async () => {
    const res = await fetch('/api/creatives/links')
    const data = await res.json() as { links?: CreativeLink[] }
    setLinks(data.links ?? [])
  }, [])

  useEffect(() => { fetchLinks() }, [fetchLinks])

  const handleAccountChange = (accountId: string) => {
    setSelectedAccount(accountId)
    loadFromCache(accountId, since, until)
  }

  const handleSinceChange = (val: string) => {
    setSince(val)
    loadFromCache(selectedAccount, val, until)
  }

  const handleUntilChange = (val: string) => {
    setUntil(val)
    loadFromCache(selectedAccount, since, val)
  }

  // Fetch ads — salva no cache após buscar
  const fetchAds = useCallback(async () => {
    if (!selectedAccount) return
    setLoadingAds(true)
    setAdsError('')
    try {
      const params = new URLSearchParams({ account_id: selectedAccount, since, until })
      const res = await fetch(`/api/creatives/metrics?${params}`)
      const data = await res.json() as { ads?: AdMetrics[]; error?: string }
      if (data.error) {
        setAdsError(data.error)
      } else {
        const fetched = data.ads ?? []
        const fetchedAt = new Date().toISOString()
        setAds(fetched)
        setLastFetchedAt(fetchedAt)
        localStorage.setItem(adsCache(selectedAccount, since, until), JSON.stringify({ ads: fetched, fetchedAt }))
        localStorage.setItem(QUERY_KEY, JSON.stringify({ accountId: selectedAccount, since, until }))
      }
    } catch {
      setAdsError('Erro ao buscar métricas')
    } finally {
      setLoadingAds(false)
    }
  }, [selectedAccount, since, until])

  // Build creatives = merge ads + links
  const creatives: Creative[] = ads.map((ad) => ({
    ...ad,
    link: links.find((l) => l.ad_name === ad.ad_name) ?? null,
  }))

  // Client-side filter + sort
  const f = (v: string) => parseFloat(v)
  const filtered = creatives
    .filter((c) => c.ad_name.toLowerCase().includes(filters.search.toLowerCase()))
    .filter((c) => filters.roas_min ? c.roas >= f(filters.roas_min) : true)
    .filter((c) => filters.roas_max ? c.roas <= f(filters.roas_max) : true)
    .filter((c) => filters.spend_min ? c.spend >= f(filters.spend_min) : true)
    .filter((c) => filters.spend_max ? c.spend <= f(filters.spend_max) : true)
    .filter((c) => filters.revenue_min ? c.revenue >= f(filters.revenue_min) : true)
    .filter((c) => filters.revenue_max ? c.revenue <= f(filters.revenue_max) : true)
    .filter((c) => filters.cpa_min ? c.cpa >= f(filters.cpa_min) : true)
    .filter((c) => filters.cpa_max ? c.cpa <= f(filters.cpa_max) : true)
    .filter((c) => filters.ctr_min ? c.ctr >= f(filters.ctr_min) : true)
    .filter((c) => filters.ctr_max ? c.ctr <= f(filters.ctr_max) : true)
    .filter((c) => filters.hook_rate_min ? c.hook_rate >= f(filters.hook_rate_min) : true)
    .filter((c) => filters.hook_rate_max ? c.hook_rate <= f(filters.hook_rate_max) : true)

  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortField] as number
    const bv = b[sortField] as number
    return sortDir === 'desc' ? bv - av : av - bv
  })

  const setFilter = (k: keyof Filters, v: string) => setFilters((prev) => ({ ...prev, [k]: v }))

  const handleSaveLink = async (adName: string, url: string) => {
    await fetch('/api/creatives/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ad_name: adName, dropbox_url: url }),
    })
    await fetchLinks()
  }

  const handleCsvImport = async (batch: { ad_name: string; dropbox_url: string }[]) => {
    await fetch('/api/creatives/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batch }),
    })
    await fetchLinks()
  }

  const activeFiltersCount = Object.entries(filters).filter(([k, v]) => k !== 'search' && v !== '').length

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '24px',
              fontWeight: '600',
              color: 'var(--text-primary)',
              letterSpacing: '-0.03em',
              marginBottom: '4px',
            }}
          >
            Criativos
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            {ads.length > 0
              ? `${sorted.length} de ${ads.length} criativos`
              : 'Selecione uma conta e período para carregar'}
          </p>
        </div>
        <button
          onClick={() => setShowCsvModal(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--bg-border)',
            background: 'var(--bg-surface)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: '13px',
          }}
        >
          <Upload size={13} />
          Importar CSV
        </button>
      </div>

      {/* Dropbox panel */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--bg-border)',
          borderRadius: 'var(--radius-md)',
          padding: '14px 16px',
          marginBottom: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="16" height="16" viewBox="0 0 40 40" fill="none">
            <path d="M10 4L20 10.5L10 17L0 10.5L10 4Z" fill="#0061FF"/>
            <path d="M30 4L40 10.5L30 17L20 10.5L30 4Z" fill="#0061FF"/>
            <path d="M0 23.5L10 17L20 23.5L10 30L0 23.5Z" fill="#0061FF"/>
            <path d="M20 23.5L30 17L40 23.5L30 30L20 23.5Z" fill="#0061FF"/>
            <path d="M10 31.5L20 25L30 31.5L20 38L10 31.5Z" fill="#0061FF"/>
          </svg>
          <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)' }}>Dropbox</span>
        </div>

        {dropboxConnected === null && (
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Verificando...</span>
        )}

        {dropboxConnected === false && (
          <a
            href="/api/dropbox/auth"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              padding: '6px 12px', borderRadius: 'var(--radius-sm)',
              background: '#0061FF', color: 'white', textDecoration: 'none',
              fontSize: '12px', fontWeight: '500',
            }}
          >
            Conectar Dropbox
          </a>
        )}

        {dropboxConnected === true && (
          <>
            <span style={{ fontSize: '12px', color: 'var(--status-success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Check size={12} /> Conectado
            </span>

            {/* Folder browser */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Breadcrumb */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => browseDropbox('')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: dropboxBrowsePath === '' ? 'var(--text-primary)' : 'var(--accent)', padding: 0, fontWeight: '500' }}
                >
                  Raiz
                </button>
                {dropboxBrowsePath.split('/').filter(Boolean).map((segment: string, i: number, arr: string[]) => {
                  const path = '/' + arr.slice(0, i + 1).join('/')
                  return (
                    <span key={path} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>/</span>
                      <button
                        onClick={() => browseDropbox(path)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: i === arr.length - 1 ? 'var(--text-primary)' : 'var(--accent)', padding: 0, fontWeight: i === arr.length - 1 ? '500' : '400' }}
                      >
                        {segment}
                      </button>
                    </span>
                  )
                })}
                {dropboxBrowseLoading && <Spinner size={12} />}
              </div>

              {/* Folder list */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                {dropboxBrowsePath !== '' && (
                  <button
                    onClick={() => {
                      const parent = dropboxBrowsePath.split('/').slice(0, -1).join('/') || ''
                      browseDropbox(parent)
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--bg-border)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px' }}
                  >
                    ← Voltar
                  </button>
                )}
                {dropboxFolders.map((f) => (
                  <button
                    key={f.path}
                    onClick={() => browseDropbox(f.path)}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--bg-border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '12px' }}
                  >
                    📁 {f.name}
                  </button>
                ))}
                {!dropboxBrowseLoading && dropboxFolders.length === 0 && !dropboxBrowseError && (
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Sem subpastas</span>
                )}
                {dropboxBrowseError && (
                  <span style={{ fontSize: '12px', color: 'var(--status-error)' }}>{dropboxBrowseError}</span>
                )}
              </div>

              {/* Select + sync current path */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setDropboxFolder(dropboxBrowsePath)}
                  style={{ padding: '5px 10px', borderRadius: 'var(--radius-sm)', border: `1px solid ${dropboxFolder === dropboxBrowsePath ? 'var(--accent)' : 'var(--bg-border)'}`, background: dropboxFolder === dropboxBrowsePath ? 'rgba(91,110,245,0.1)' : 'transparent', color: dropboxFolder === dropboxBrowsePath ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px', fontWeight: '500' }}
                >
                  {dropboxFolder === dropboxBrowsePath ? '✓ Pasta selecionada' : 'Usar esta pasta'}
                </button>

                {dropboxFolder !== '' && (
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {dropboxFolder === '' ? 'Raiz' : dropboxFolder}
                  </span>
                )}

                <button
                  onClick={handleSync}
                  disabled={syncing || ads.length === 0 || dropboxFolder === ''}
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--accent)', color: 'white', cursor: syncing || ads.length === 0 || dropboxFolder === '' ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: '500', opacity: ads.length === 0 || dropboxFolder === '' ? 0.5 : 1 }}
                >
                  {syncing ? <Spinner size={11} /> : <PlaySquare size={12} />}
                  {syncing ? 'Sincronizando...' : 'Sincronizar vídeos'}
                </button>

                {syncResult && (
                  <span style={{ fontSize: '12px', color: 'var(--status-success)' }}>
                    {syncResult.matched} de {syncResult.total} vinculados
                  </span>
                )}
                {syncError && (
                  <span style={{ fontSize: '12px', color: 'var(--status-error)' }}>{syncError}</span>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Controls bar */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--bg-border)',
          borderRadius: 'var(--radius-md)',
          padding: '14px 16px',
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'flex-end',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        {/* Account selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '500' }}>Conta</label>
          <select
            value={selectedAccount}
            onChange={(e) => handleAccountChange(e.target.value)}
            style={selectStyle}
          >
            {accounts.length === 0 && <option value="">Nenhuma conta selecionada</option>}
            {accounts.map((a) => (
              <option key={a.id} value={a.meta_account_id}>{a.name}</option>
            ))}
          </select>
        </div>

        {/* Date range */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '500' }}>De</label>
          <input
            type="date"
            value={since}
            onChange={(e) => handleSinceChange(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '500' }}>Até</label>
          <input
            type="date"
            value={until}
            onChange={(e) => handleUntilChange(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <button
            onClick={fetchAds}
            disabled={loadingAds || !selectedAccount}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '8px 16px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: 'var(--accent)',
              color: 'white',
              cursor: loadingAds || !selectedAccount ? 'not-allowed' : 'pointer',
              fontSize: '13px',
              fontWeight: '500',
              opacity: !selectedAccount ? 0.5 : 1,
            }}
          >
            {loadingAds ? <Spinner size={12} /> : null}
            {ads.length > 0 ? 'Atualizar' : 'Buscar'}
          </button>
          {lastFetchedAt && (
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center' }}>
              {new Date(lastFetchedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>

      {/* Search bar — filtro por nome do anúncio */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 14px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--bg-border)',
          borderRadius: 'var(--radius-md)',
          marginBottom: '8px',
        }}
      >
        <Filter size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
        <input
          type="text"
          placeholder="Filtrar anúncios por nome..."
          value={filters.search}
          onChange={(e) => setFilter('search', e.target.value)}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: '14px',
            color: 'var(--text-primary)',
          }}
        />
        {filters.search && (
          <button onClick={() => setFilter('search', '')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
            <X size={14} />
          </button>
        )}
      </div>

      {/* Sort + Filter bar */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--bg-border)',
          borderRadius: 'var(--radius-md)',
          marginBottom: '12px',
          overflow: 'hidden',
        }}
      >
        {/* Controls row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', flexWrap: 'wrap' }}>
          <ArrowUpDown size={13} color="var(--text-muted)" />
          <select
            value={sortField}
            onChange={(e) => setSortField(e.target.value as SortField)}
            style={{ ...selectStyle, fontSize: '12px', padding: '5px 8px' }}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button
            onClick={() => setSortDir((d) => d === 'desc' ? 'asc' : 'desc')}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '5px 10px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--bg-border)', background: 'transparent',
              color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px',
            }}
          >
            {sortDir === 'desc' ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
            {sortDir === 'desc' ? 'Decrescente' : 'Crescente'}
          </button>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px', alignItems: 'center' }}>
            {activeFiltersCount > 0 && (
              <button
                onClick={() => setFilters(DEFAULT_FILTERS)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  padding: '5px 10px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--bg-border)', background: 'transparent',
                  color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px',
                }}
              >
                <X size={11} /> Limpar filtros
              </button>
            )}
            <button
              onClick={() => setShowFilters((v) => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '5px 12px', borderRadius: 'var(--radius-sm)',
                border: `1px solid ${activeFiltersCount > 0 ? 'var(--accent)' : 'var(--bg-border)'}`,
                background: activeFiltersCount > 0 ? 'rgba(91,110,245,0.08)' : 'transparent',
                color: activeFiltersCount > 0 ? 'var(--accent)' : 'var(--text-secondary)',
                cursor: 'pointer', fontSize: '12px', fontWeight: activeFiltersCount > 0 ? '500' : '400',
              }}
            >
              <Filter size={12} />
              {showFilters ? 'Fechar filtros' : 'Filtros'}
              {activeFiltersCount > 0 && (
                <span style={{
                  background: 'var(--accent)', color: 'white',
                  borderRadius: '10px', padding: '1px 6px',
                  fontSize: '10px', fontWeight: '600',
                }}>
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--bg-border)',
            borderRadius: 'var(--radius-md)',
            padding: '8px',
            marginBottom: '12px',
          }}
        >
          {/* Filter rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <FilterRow label="ROAS" minKey="roas_min" maxKey="roas_max" filters={filters} onChange={setFilter} />
            <FilterRow label="Gasto" minKey="spend_min" maxKey="spend_max" filters={filters} onChange={setFilter} placeholder="R$" />
            <FilterRow label="Receita" minKey="revenue_min" maxKey="revenue_max" filters={filters} onChange={setFilter} placeholder="R$" />
            <FilterRow label="CPA" minKey="cpa_min" maxKey="cpa_max" filters={filters} onChange={setFilter} placeholder="R$" />
            <FilterRow label="CTR" minKey="ctr_min" maxKey="ctr_max" filters={filters} onChange={setFilter} placeholder="%" />
            <FilterRow label="Hook Rate" minKey="hook_rate_min" maxKey="hook_rate_max" filters={filters} onChange={setFilter} placeholder="%" />
          </div>

          {/* Saved filter sets */}
          <div style={{ borderTop: '1px solid var(--bg-border)', marginTop: '8px', paddingTop: '12px', padding: '12px 12px 4px' }}>
            {savedFilterSets.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                {savedFilterSets.map((set) => (
                  <div
                    key={set.name}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '4px',
                      padding: '3px 8px 3px 10px', borderRadius: '20px',
                      border: '1px solid var(--bg-border)', background: 'var(--bg-elevated)',
                      fontSize: '12px',
                    }}
                  >
                    <button
                      onClick={() => handleApplyFilterSet(set)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '12px', padding: 0 }}
                    >
                      {set.name}
                    </button>
                    <button
                      onClick={() => handleDeleteFilterSet(set.name)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: '1px' }}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Save current filters */}
            {showSaveInput ? (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <input
                  autoFocus
                  type="text"
                  placeholder="Nome do filtro..."
                  value={saveFilterName}
                  onChange={(e) => setSaveFilterName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveFilterSet()
                    if (e.key === 'Escape') { setShowSaveInput(false); setSaveFilterName('') }
                  }}
                  style={{ ...rangeInputStyle, width: '180px', paddingLeft: '10px' }}
                />
                <button
                  onClick={handleSaveFilterSet}
                  disabled={!saveFilterName.trim()}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '4px',
                    padding: '5px 10px', borderRadius: 'var(--radius-sm)',
                    border: 'none', background: 'var(--accent)', color: 'white',
                    cursor: saveFilterName.trim() ? 'pointer' : 'not-allowed',
                    fontSize: '12px', opacity: saveFilterName.trim() ? 1 : 0.5,
                  }}
                >
                  <Check size={12} /> Salvar
                </button>
                <button
                  onClick={() => { setShowSaveInput(false); setSaveFilterName('') }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowSaveInput(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '5px 10px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--bg-border)', background: 'transparent',
                  color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px',
                }}
              >
                <Bookmark size={12} /> Salvar filtros atuais
              </button>
            )}
          </div>
        </div>
      )}

      {/* Error */}
      {adsError && (
        <div
          style={{
            padding: '12px 16px',
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--status-error)',
            fontSize: '13px',
            marginBottom: '16px',
          }}
        >
          {adsError}
        </div>
      )}

      {/* Loading */}
      {loadingAds && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '32px 0', color: 'var(--text-secondary)', fontSize: '14px' }}>
          <Spinner size={16} /> Carregando criativos...
        </div>
      )}

      {/* Empty state */}
      {!loadingAds && ads.length === 0 && !adsError && (
        <div
          style={{
            textAlign: 'center',
            padding: '64px 32px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--bg-border)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <PlaySquare size={32} color="var(--text-muted)" style={{ margin: '0 auto 16px', display: 'block' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: '15px', marginBottom: '8px' }}>
            Nenhum criativo carregado
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            Selecione uma conta, defina o período e clique em Buscar
          </p>
        </div>
      )}

      {/* Grid */}
      {!loadingAds && sorted.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '12px',
          }}
        >
          {sorted.map((c) => (
            <CreativeCard
              key={c.ad_id}
              creative={c}
              onLink={(adName) => setLinkModal(adName)}
            />
          ))}
        </div>
      )}

      {/* No results after filter */}
      {!loadingAds && ads.length > 0 && sorted.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: '40px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--bg-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-muted)',
            fontSize: '13px',
          }}
        >
          Nenhum criativo corresponde aos filtros aplicados.
        </div>
      )}

      {/* Link modal */}
      {linkModal !== null && (
        <LinkModal
          adName={linkModal}
          onClose={() => setLinkModal(null)}
          onSave={handleSaveLink}
        />
      )}

      {/* CSV modal */}
      {showCsvModal && (
        <CsvImportModal
          onClose={() => setShowCsvModal(false)}
          onImport={handleCsvImport}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

const selectStyle: React.CSSProperties = {
  padding: '7px 10px',
  fontSize: '13px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--bg-border)',
  background: 'var(--bg-elevated)',
  color: 'var(--text-primary)',
  outline: 'none',
  cursor: 'pointer',
}

const inputStyle: React.CSSProperties = {
  padding: '7px 10px',
  fontSize: '13px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--bg-border)',
  background: 'var(--bg-elevated)',
  color: 'var(--text-primary)',
  outline: 'none',
}
