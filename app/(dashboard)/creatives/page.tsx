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
  RefreshCw,
  LayoutGrid,
  List,
  Play,
  SlidersHorizontal,
  FolderOpen,
  Eye,
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

// ─── Filter Modal ─────────────────────────────────────────────────────────────

function FilterModal({
  filters,
  onClose,
  onChange,
  onClear,
  savedFilterSets,
  onSaveFilterSet,
  onApplyFilterSet,
  onDeleteFilterSet,
}: {
  filters: Filters
  onClose: () => void
  onChange: (k: keyof Filters, v: string) => void
  onClear: () => void
  savedFilterSets: SavedFilterSet[]
  onSaveFilterSet: (name: string) => void
  onApplyFilterSet: (set: SavedFilterSet) => void
  onDeleteFilterSet: (name: string) => void
}) {
  const [saveName, setSaveName] = useState('')
  const [showSave, setShowSave] = useState(false)
  const activeCount = Object.entries(filters).filter(([k, v]) => k !== 'search' && v !== '').length

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', width: '100%', maxWidth: '520px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--bg-border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>Filtros</span>
            {activeCount > 0 && <span style={{ background: 'var(--accent)', color: 'white', borderRadius: '10px', padding: '1px 7px', fontSize: '11px', fontWeight: '600' }}>{activeCount} ativos</span>}
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {activeCount > 0 && (
              <button onClick={onClear} style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                Limpar todos
              </button>
            )}
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '0' }}>
          <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600', letterSpacing: '0.08em', marginBottom: '6px' }}>RESULTADO</p>
          <FilterRow label="ROAS" minKey="roas_min" maxKey="roas_max" filters={filters} onChange={onChange} />
          <FilterRow label="Receita" minKey="revenue_min" maxKey="revenue_max" filters={filters} onChange={onChange} placeholder="R$" />
          <FilterRow label="CPA" minKey="cpa_min" maxKey="cpa_max" filters={filters} onChange={onChange} placeholder="R$" />

          <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600', letterSpacing: '0.08em', marginBottom: '6px', marginTop: '16px' }}>INVESTIMENTO</p>
          <FilterRow label="Gasto" minKey="spend_min" maxKey="spend_max" filters={filters} onChange={onChange} placeholder="R$" />

          <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600', letterSpacing: '0.08em', marginBottom: '6px', marginTop: '16px' }}>ENGAJAMENTO</p>
          <FilterRow label="CTR" minKey="ctr_min" maxKey="ctr_max" filters={filters} onChange={onChange} placeholder="%" />
          <FilterRow label="Hook Rate" minKey="hook_rate_min" maxKey="hook_rate_max" filters={filters} onChange={onChange} placeholder="%" />
        </div>

        {/* Footer — saved sets */}
        <div style={{ borderTop: '1px solid var(--bg-border)', padding: '14px 20px', flexShrink: 0 }}>
          {savedFilterSets.length > 0 && (
            <>
              <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600', letterSpacing: '0.08em', marginBottom: '8px' }}>FILTROS SALVOS</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                {savedFilterSets.map((set) => (
                  <div key={set.name} style={{ display: 'flex', alignItems: 'center', gap: '0', borderRadius: '20px', border: '1px solid var(--bg-border)', background: 'var(--bg-elevated)', overflow: 'hidden' }}>
                    <button onClick={() => { onApplyFilterSet(set); onClose() }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '12px', padding: '4px 10px' }}>
                      {set.name}
                    </button>
                    <button onClick={() => onDeleteFilterSet(set.name)} style={{ background: 'none', border: 'none', borderLeft: '1px solid var(--bg-border)', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: '4px 8px' }}>
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
          {showSave ? (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input
                autoFocus type="text" placeholder="Nome do filtro..."
                value={saveName} onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && saveName.trim()) { onSaveFilterSet(saveName.trim()); setSaveName(''); setShowSave(false) }
                  if (e.key === 'Escape') setShowSave(false)
                }}
                style={{ flex: 1, padding: '7px 10px', fontSize: '13px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--bg-border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' as const }}
              />
              <button onClick={() => { if (saveName.trim()) { onSaveFilterSet(saveName.trim()); setSaveName(''); setShowSave(false) } }} disabled={!saveName.trim()} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '7px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--accent)', color: 'white', cursor: saveName.trim() ? 'pointer' : 'not-allowed', fontSize: '12px', opacity: saveName.trim() ? 1 : 0.5 }}>
                <Check size={12} /> Salvar
              </button>
              <button onClick={() => setShowSave(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><X size={14} /></button>
            </div>
          ) : (
            <button onClick={() => setShowSave(true)} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--bg-border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px' }}>
              <Bookmark size={12} /> Salvar filtros atuais
            </button>
          )}
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

// ─── Table View ───────────────────────────────────────────────────────────────

const ALL_TABLE_COLS = [
  { key: 'roas',        label: 'ROAS',        defaultWidth: 76,  defaultVisible: true,  fmt: (v: number) => `${v.toFixed(2)}x` },
  { key: 'spend',       label: 'Gasto',       defaultWidth: 96,  defaultVisible: true,  fmt: (v: number) => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v) },
  { key: 'revenue',     label: 'Receita',     defaultWidth: 96,  defaultVisible: true,  fmt: (v: number) => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v) },
  { key: 'purchases',   label: 'Vendas',      defaultWidth: 68,  defaultVisible: true,  fmt: (v: number) => new Intl.NumberFormat('pt-BR').format(Math.round(v)) },
  { key: 'cpa',         label: 'CPA',         defaultWidth: 86,  defaultVisible: true,  fmt: (v: number) => v > 0 ? new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v) : '—' },
  { key: 'ctr',         label: 'CTR',         defaultWidth: 66,  defaultVisible: true,  fmt: (v: number) => `${v.toFixed(1)}%` },
  { key: 'hook_rate',   label: 'Hook Rate',   defaultWidth: 86,  defaultVisible: true,  fmt: (v: number) => `${v.toFixed(1)}%` },
  { key: 'body_rate',   label: 'Body Rate',   defaultWidth: 86,  defaultVisible: false, fmt: (v: number) => `${v.toFixed(1)}%` },
  { key: 'cpm',         label: 'CPM',         defaultWidth: 86,  defaultVisible: false, fmt: (v: number) => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v) },
  { key: 'cpc',         label: 'CPC',         defaultWidth: 86,  defaultVisible: false, fmt: (v: number) => v > 0 ? new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v) : '—' },
  { key: 'impressions', label: 'Impressões',  defaultWidth: 96,  defaultVisible: false, fmt: (v: number) => new Intl.NumberFormat('pt-BR').format(Math.round(v)) },
  { key: 'clicks',      label: 'Cliques',     defaultWidth: 74,  defaultVisible: false, fmt: (v: number) => new Intl.NumberFormat('pt-BR').format(Math.round(v)) },
  { key: 'lp_views',    label: 'LP Views',    defaultWidth: 80,  defaultVisible: false, fmt: (v: number) => new Intl.NumberFormat('pt-BR').format(Math.round(v)) },
  { key: 'video_views', label: 'Video Views', defaultWidth: 90,  defaultVisible: false, fmt: (v: number) => new Intl.NumberFormat('pt-BR').format(Math.round(v)) },
  { key: 'avg_ticket',  label: 'Ticket Médio',defaultWidth: 100, defaultVisible: false, fmt: (v: number) => v > 0 ? new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v) : '—' },
  { key: 'conv_rate',   label: 'Tx Conv.',    defaultWidth: 74,  defaultVisible: false, fmt: (v: number) => `${v.toFixed(1)}%` },
  { key: 'video_3s',    label: '3s VV',       defaultWidth: 68,  defaultVisible: false, fmt: (v: number) => new Intl.NumberFormat('pt-BR').format(Math.round(v)) },
  { key: 'video_15s',   label: '15s VV',      defaultWidth: 68,  defaultVisible: false, fmt: (v: number) => new Intl.NumberFormat('pt-BR').format(Math.round(v)) },
  { key: 'video_30s',   label: '30s VV',      defaultWidth: 68,  defaultVisible: false, fmt: (v: number) => new Intl.NumberFormat('pt-BR').format(Math.round(v)) },
] as const

function TableView({ creatives, onLink }: { creatives: Creative[]; onLink: (adName: string) => void }) {
  const [visibleKeys, setVisibleKeys] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('table_visible_cols') ?? 'null') ?? ALL_TABLE_COLS.filter((c) => c.defaultVisible).map((c) => c.key) }
    catch { return ALL_TABLE_COLS.filter((c) => c.defaultVisible).map((c) => c.key) }
  })
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem('table_col_widths') ?? '{}') }
    catch { return {} }
  })
  const [showColPicker, setShowColPicker] = useState(false)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const resizingRef = useRef<{ key: string; startX: number; startWidth: number } | null>(null)
  const colPickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (colPickerRef.current && !colPickerRef.current.contains(e.target as Node)) setShowColPicker(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const visibleCols = ALL_TABLE_COLS.filter((c) => visibleKeys.includes(c.key))
  const getW = (key: string, def: number) => colWidths[key] ?? def

  const toggleCol = (key: string) => {
    setVisibleKeys((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
      localStorage.setItem('table_visible_cols', JSON.stringify(next))
      return next
    })
  }
  const showAll = () => {
    const all = ALL_TABLE_COLS.map((c) => c.key)
    setVisibleKeys(all as string[])
    localStorage.setItem('table_visible_cols', JSON.stringify(all))
  }

  const startResize = (key: string, startWidth: number, e: React.MouseEvent) => {
    e.preventDefault()
    resizingRef.current = { key, startX: e.clientX, startWidth }
    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return
      const { key: k, startX, startWidth: sw } = resizingRef.current
      const newW = Math.max(48, sw + ev.clientX - startX)
      setColWidths((prev) => {
        const next = { ...prev, [k]: newW }
        localStorage.setItem('table_col_widths', JSON.stringify(next))
        return next
      })
    }
    const onUp = () => {
      resizingRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const gridTemplate = `64px 1fr ${visibleCols.map((c) => `${getW(c.key, c.defaultWidth)}px`).join(' ')}`

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
      {/* Column picker toolbar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '7px 12px', borderBottom: '1px solid var(--bg-border)', background: 'var(--bg-elevated)', position: 'relative' }} ref={colPickerRef}>
        <button
          onClick={() => setShowColPicker((v) => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: 'var(--radius-sm)', border: `1px solid ${showColPicker ? 'var(--accent)' : 'var(--bg-border)'}`, background: showColPicker ? 'rgba(91,110,245,0.1)' : 'transparent', color: showColPicker ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px', fontWeight: showColPicker ? '500' : '400' }}
        >
          <Eye size={13} /> Colunas · {visibleKeys.length}
        </button>

        {showColPicker && (
          <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: '12px', background: 'var(--bg-surface)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', padding: '14px 16px', zIndex: 60, width: '300px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>Métricas visíveis</span>
              <button onClick={showAll} style={{ fontSize: '11px', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Mostrar todas</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px' }}>
              {ALL_TABLE_COLS.map((col) => {
                const active = visibleKeys.includes(col.key)
                return (
                  <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '6px 8px', borderRadius: '6px', cursor: 'pointer', background: active ? 'rgba(91,110,245,0.07)' : 'transparent', transition: 'background 100ms' }}>
                    <input type="checkbox" checked={active} onChange={() => toggleCol(col.key)} style={{ cursor: 'pointer', accentColor: 'var(--accent)', width: '13px', height: '13px', flexShrink: 0 }} />
                    <span style={{ fontSize: '12px', color: active ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{col.label}</span>
                  </label>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Scrollable table */}
      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: '560px' }}>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: gridTemplate, background: 'var(--bg-elevated)', borderBottom: '2px solid var(--bg-border)', position: 'sticky', top: 0, zIndex: 10 }}>
            <div style={{ padding: '9px 8px' }} />
            <div style={{ padding: '9px 10px', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>CRIATIVO</div>
            {visibleCols.map((col) => (
              <div key={col.key} style={{ position: 'relative', padding: '9px 10px', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', letterSpacing: '0.05em', textAlign: 'right', borderLeft: '1px solid var(--bg-border)', userSelect: 'none' }}>
                {col.label}
                <div
                  title="Arrastar para redimensionar"
                  style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '5px', cursor: 'col-resize', background: 'transparent' }}
                  onMouseDown={(e) => startResize(col.key, getW(col.key, col.defaultWidth), e)}
                />
              </div>
            ))}
          </div>

          {/* Rows */}
          {creatives.map((c) => {
            const isExpanded = expandedRow === c.ad_id
            return (
              <div key={c.ad_id} style={{ borderBottom: '1px solid var(--bg-border)' }}>
                <div
                  style={{ display: 'grid', gridTemplateColumns: gridTemplate, alignItems: 'center', cursor: 'pointer', transition: 'background 80ms' }}
                  onClick={() => setExpandedRow(isExpanded ? null : c.ad_id)}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  <div style={{ padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {c.link ? (
                      <div style={{ position: 'relative', width: '36px', height: '48px', borderRadius: '4px', overflow: 'hidden', background: '#000', flexShrink: 0 }}>
                        <video src={c.link.dropbox_direct_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} preload="metadata" muted />
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }}>
                          <Play size={11} color="white" fill="white" />
                        </div>
                      </div>
                    ) : (
                      <div style={{ width: '36px', height: '48px', borderRadius: '4px', border: '1px dashed var(--bg-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={(e) => { e.stopPropagation(); onLink(c.ad_name) }}>
                        <Link2 size={12} color="var(--text-muted)" />
                      </div>
                    )}
                  </div>
                  <div style={{ padding: '8px 10px 8px 4px', overflow: 'hidden' }}>
                    <p style={{ fontSize: '12px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.ad_name}>{c.ad_name}</p>
                  </div>
                  {visibleCols.map((col) => (
                    <div key={col.key} style={{ padding: '8px 10px', fontSize: '12px', color: 'var(--text-primary)', fontWeight: '500', textAlign: 'right', borderLeft: '1px solid var(--bg-border)' }}>
                      {col.fmt(c[col.key as keyof AdMetrics] as number)}
                    </div>
                  ))}
                </div>

                {/* Expanded panel */}
                {isExpanded && (
                  <div style={{ padding: '16px', borderTop: '1px solid var(--bg-border)', display: 'flex', gap: '20px', alignItems: 'flex-start', background: 'var(--bg-elevated)' }}>
                    {c.link ? (
                      <video src={c.link.dropbox_direct_url} controls autoPlay muted style={{ width: '108px', borderRadius: '8px', aspectRatio: '9/16', background: '#000', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: '108px', aspectRatio: '9/16', borderRadius: '8px', border: '1px dashed var(--bg-border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px', flexShrink: 0, cursor: 'pointer' }} onClick={() => onLink(c.ad_name)}>
                        <Link2 size={18} color="var(--text-muted)" />
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center', padding: '0 8px' }}>Vincular vídeo</span>
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.ad_name}>{c.ad_name}</p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '2px' }}>
                        {ALL_TABLE_COLS.map((col) => (
                          <div key={col.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 6px', borderRadius: '4px', background: visibleKeys.includes(col.key) ? 'rgba(91,110,245,0.05)' : 'transparent' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{col.label}</span>
                            <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-primary)' }}>{col.fmt(c[col.key as keyof AdMetrics] as number)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
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
  const [adsWarning, setAdsWarning] = useState('')
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
  const [showFolderBrowser, setShowFolderBrowser] = useState(() => {
    try { return !JSON.parse(localStorage.getItem('creatives_dropbox') ?? '{}').folder }
    catch { return true }
  })
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ matched: number; total: number } | null>(null)
  const [syncError, setSyncError] = useState('')
  const [syncDebug, setSyncDebug] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'table'>(() => {
    try { return (localStorage.getItem('creatives_view') as 'grid' | 'table') ?? 'grid' }
    catch { return 'grid' }
  })

  // Seletor manual de arquivo Dropbox por criativo
  const [pickingFor, setPickingFor] = useState<string | null>(null)
  const [dropboxFiles, setDropboxFiles] = useState<{ name: string; path: string }[]>([])
  const [dropboxFilesLoading, setDropboxFilesLoading] = useState(false)
  const [fileSearch, setFileSearch] = useState('')
  const [pickerError, setPickerError] = useState('')
  const [pickingFile, setPickingFile] = useState<string | null>(null)

  // Persiste filtros + sort sempre que mudam
  useEffect(() => {
    localStorage.setItem('creatives_ui', JSON.stringify({ filters, sortField, sortDir }))
  }, [filters, sortField, sortDir])

  // Persiste pasta Dropbox sempre que muda; reseta lista de arquivos
  useEffect(() => {
    localStorage.setItem('creatives_dropbox', JSON.stringify({ folder: dropboxFolder, browsePath: dropboxBrowsePath }))
    setDropboxFiles([])
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

  const handleSaveFilterSet = (name: string) => {
    if (!name) return
    const newSet: SavedFilterSet = { name, filters, sortField, sortDir }
    const updated = [...savedFilterSets.filter((s) => s.name !== name), newSet]
    persistSavedSets(updated)
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
          ad_names: filters.search.trim()
            ? ads.filter((a) => a.ad_name.toLowerCase().includes(filters.search.toLowerCase())).map((a) => a.ad_name)
            : ads.map((a) => a.ad_name),
          name_filter: filters.search.trim().toLowerCase(),
        }),
      })
      const text = await res.text()
      let data: {
        matched?: number; total_files?: number; total_ads?: number; name_matches?: number; link_fails?: number
        error?: string; upsert_error?: string; debug_files?: string[]; debug_ads?: string[]
        debug_no_match_ads?: string[]
      }
      try { data = JSON.parse(text) } catch { setSyncError(`Resposta inválida (${res.status}): ${text.slice(0, 200)}`); setSyncing(false); return }
      if (data.error) {
        setSyncError(data.error)
      } else if (data.upsert_error) {
        setSyncError(`Erro ao salvar no banco: ${data.upsert_error}`)
      } else {
        const matched = data.matched ?? 0
        const totalAds = data.total_ads ?? 0
        setSyncResult({ matched, total: totalAds })
        if (matched < totalAds) {
          const noMatch = (data.debug_no_match_ads ?? []).map((a) => `  "${a}"`).join('\n')
          const fileSample = (data.debug_files ?? []).join('\n  ')
          setSyncDebug(
            `${matched} de ${totalAds} anúncios vinculados\n` +
            `Arquivos Dropbox: ${data.total_files ?? 0} | Link fails: ${data.link_fails ?? 0}\n\n` +
            `=== ANÚNCIOS SEM ARQUIVO CORRESPONDENTE (amostra) ===\n${noMatch || '  (nenhum)'}\n\n` +
            `=== AMOSTRA ARQUIVOS DROPBOX ===\n  ${fileSample}`
          )
        } else {
          setSyncDebug(null)
        }
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
      if (!raw) { setAds([]); return false }
      const { ads: cached } = JSON.parse(raw) as { ads: AdMetrics[]; fetchedAt: string }
      setAds(cached)
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
    const res = await fetch('/api/creatives/links', { cache: 'no-store' })
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

  const fetchAds = useCallback(async (forceRefresh = false) => {
    if (!selectedAccount) return
    setLoadingAds(true)
    setAdsError('')
    setAdsWarning('')
    try {
      const params = new URLSearchParams({ account_id: selectedAccount, since, until })
      if (forceRefresh) params.set('refresh', '1')
      const res = await fetch(`/api/creatives/metrics?${params}`)
      const data = await res.json() as { ads?: AdMetrics[]; error?: string; warning?: string; cached_at?: string }
      if (data.error) {
        setAdsError(data.error)
      } else {
        const fetched = data.ads ?? []
        const fetchedAt = data.cached_at ?? new Date().toISOString()
        if (forceRefresh) {
          // Atualizar: mantém existentes, atualiza métricas, adiciona novos
          setAds((prev) => {
            const map = new Map(prev.map((a) => [a.ad_name, a]))
            for (const ad of fetched) map.set(ad.ad_name, ad)
            return Array.from(map.values())
          })
        } else {
          // Buscar: substitui tudo
          setAds(fetched)
        }
        if (data.warning) setAdsWarning(data.warning)
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

  const openPicker = async (adName: string) => {
    setPickingFor(adName)
    setFileSearch('')
    setPickerError('')
    setDropboxFiles([])
    if (!dropboxConnected || !dropboxFolder) return
    setDropboxFilesLoading(true)
    try {
      const res = await fetch(`/api/dropbox/link?path=${encodeURIComponent(dropboxFolder)}`)
      const data = await res.json() as { files?: { name: string; path: string }[]; error?: string }
      if (data.error) {
        setPickerError(`Erro ao carregar arquivos: ${data.error}`)
      } else {
        setDropboxFiles(data.files ?? [])
        if ((data.files ?? []).length === 0) setPickerError('Nenhum arquivo encontrado na pasta selecionada.')
      }
    } catch (err) {
      setPickerError(`Erro de conexão: ${String(err)}`)
    } finally {
      setDropboxFilesLoading(false)
    }
  }

  const handlePickFile = async (adName: string, filePath: string) => {
    setPickingFile(filePath)
    setPickerError('')
    try {
      const res = await fetch('/api/dropbox/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: filePath, ad_name: adName }),
      })
      const data = await res.json() as { error?: string; dropbox_direct_url?: string }
      if (data.error) {
        setPickerError(`Erro ao vincular: ${data.error}`)
        return
      }
      setPickingFor(null)
      await fetchLinks()
    } catch (err) {
      setPickerError(`Erro: ${String(err)}`)
    } finally {
      setPickingFile(null)
    }
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
      {/* ── Header ────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '600', color: 'var(--text-primary)', letterSpacing: '-0.03em', marginBottom: '2px' }}>
            Criativos
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            {ads.length > 0 ? `${sorted.length} de ${ads.length} criativos` : 'Selecione conta e período para carregar'}
          </p>
        </div>
        <button
          onClick={() => setShowCsvModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 13px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--bg-border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px' }}
        >
          <Upload size={12} /> Importar CSV
        </button>
      </div>

      {/* ── Query bar ─────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', flexWrap: 'wrap', background: 'var(--bg-surface)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: '10px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '500', letterSpacing: '0.02em' }}>Conta</label>
          <select value={selectedAccount} onChange={(e) => handleAccountChange(e.target.value)} style={selectStyle}>
            {accounts.length === 0 && <option value="">Nenhuma conta</option>}
            {accounts.map((a) => <option key={a.id} value={a.meta_account_id}>{a.name}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '500', letterSpacing: '0.02em' }}>De</label>
          <input type="date" value={since} onChange={(e) => handleSinceChange(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '500', letterSpacing: '0.02em' }}>Até</label>
          <input type="date" value={until} onChange={(e) => handleUntilChange(e.target.value)} style={inputStyle} />
        </div>
        <button
          onClick={() => fetchAds(false)}
          disabled={loadingAds || !selectedAccount}
          style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 18px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--accent)', color: 'white', cursor: loadingAds || !selectedAccount ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: '500', opacity: !selectedAccount ? 0.5 : 1 }}
        >
          {loadingAds && !ads.length ? <Spinner size={12} /> : null}
          Buscar
        </button>
        <div style={{ marginLeft: 'auto' }}>
          <button
            onClick={() => fetchAds(true)}
            disabled={loadingAds || !selectedAccount || ads.length === 0}
            title="Atualizar métricas sem substituir criativos existentes"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: 'var(--radius-sm)', border: 'none', background: ads.length === 0 ? 'var(--bg-elevated)' : 'var(--accent)', color: ads.length === 0 ? 'var(--text-muted)' : 'white', cursor: loadingAds || ads.length === 0 ? 'not-allowed' : 'pointer', opacity: ads.length === 0 ? 0.4 : 1 }}
          >
            <RefreshCw size={14} style={{ animation: loadingAds && ads.length > 0 ? 'spin 0.8s linear infinite' : 'none' }} />
          </button>
        </div>
      </div>

      {/* ── Dropbox bar ───────────────────────────────── */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', marginBottom: '10px', overflow: 'hidden' }}>
        {/* Main row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', flexWrap: 'wrap' }}>
          <svg width="14" height="14" viewBox="0 0 40 40" fill="none" style={{ flexShrink: 0 }}>
            <path d="M10 4L20 10.5L10 17L0 10.5L10 4Z" fill="#0061FF"/>
            <path d="M30 4L40 10.5L30 17L20 10.5L30 4Z" fill="#0061FF"/>
            <path d="M0 23.5L10 17L20 23.5L10 30L0 23.5Z" fill="#0061FF"/>
            <path d="M20 23.5L30 17L40 23.5L30 30L20 23.5Z" fill="#0061FF"/>
            <path d="M10 31.5L20 25L30 31.5L20 38L10 31.5Z" fill="#0061FF"/>
          </svg>

          {dropboxConnected === null && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Verificando...</span>}

          {dropboxConnected === false && (
            <a href="/api/dropbox/auth" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 12px', borderRadius: 'var(--radius-sm)', background: '#0061FF', color: 'white', textDecoration: 'none', fontSize: '12px', fontWeight: '500' }}>
              Conectar Dropbox
            </a>
          )}

          {dropboxConnected === true && (
            <>
              <Check size={12} color="var(--status-success)" />
              {dropboxFolder ? (
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{dropboxFolder}</span>
              ) : (
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Nenhuma pasta selecionada</span>
              )}
              <button
                onClick={() => setShowFolderBrowser((v) => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: '3px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: '12px', padding: '2px 4px' }}
              >
                {showFolderBrowser ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                {dropboxFolder ? 'Trocar pasta' : 'Selecionar pasta'}
              </button>

              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
                {syncResult && (
                  <span style={{ fontSize: '12px', color: syncResult.matched === syncResult.total ? 'var(--status-success)' : 'var(--text-secondary)' }}>
                    {syncResult.matched === syncResult.total ? '✓' : '⚠'} {syncResult.matched}/{syncResult.total} vinculados
                  </span>
                )}
                <button
                  onClick={handleSync}
                  disabled={syncing || ads.length === 0 || !dropboxFolder}
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--accent)', color: 'white', cursor: syncing || ads.length === 0 || !dropboxFolder ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: '500', opacity: !dropboxFolder || ads.length === 0 ? 0.5 : 1 }}
                >
                  {syncing ? <Spinner size={11} /> : <PlaySquare size={12} />}
                  {syncing ? 'Sincronizando...' : 'Sincronizar vídeos'}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Feedback rows */}
        {syncError && (
          <div style={{ padding: '8px 16px', borderTop: '1px solid var(--bg-border)', background: 'rgba(239,68,68,0.04)' }}>
            <pre style={{ fontSize: '11px', color: 'var(--status-error)', whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit' }}>{syncError}</pre>
          </div>
        )}
        {syncDebug && (
          <div style={{ padding: '8px 16px', borderTop: '1px solid var(--bg-border)' }}>
            <pre style={{ fontSize: '10px', color: 'var(--text-muted)', whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'monospace' }}>{syncDebug}</pre>
          </div>
        )}

        {/* Folder browser (collapsible) */}
        {dropboxConnected === true && showFolderBrowser && (
          <div style={{ borderTop: '1px solid var(--bg-border)' }}>
            {/* Breadcrumb nav */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0', padding: '10px 16px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--bg-border)', overflowX: 'auto' }}>
              <button onClick={() => browseDropbox('')} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: dropboxBrowsePath === '' ? 'rgba(91,110,245,0.1)' : 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: dropboxBrowsePath === '' ? 'var(--accent)' : 'var(--text-secondary)', padding: '4px 8px', borderRadius: '6px', fontWeight: '500', flexShrink: 0 }}>
                <FolderOpen size={13} />
                Raiz
              </button>
              {dropboxBrowsePath.split('/').filter(Boolean).map((segment: string, i: number, arr: string[]) => {
                const path = '/' + arr.slice(0, i + 1).join('/')
                const isLast = i === arr.length - 1
                return (
                  <span key={path} style={{ display: 'flex', alignItems: 'center', gap: '0', flexShrink: 0 }}>
                    <ChevronDown size={12} color="var(--text-muted)" style={{ transform: 'rotate(-90deg)', margin: '0 2px' }} />
                    <button onClick={() => browseDropbox(path)} style={{ background: isLast ? 'rgba(91,110,245,0.1)' : 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: isLast ? 'var(--accent)' : 'var(--text-secondary)', padding: '4px 8px', borderRadius: '6px', fontWeight: isLast ? '500' : '400' }}>
                      {segment}
                    </button>
                  </span>
                )
              })}
              {dropboxBrowseLoading && <Spinner size={12} />}
            </div>

            {/* Folder grid */}
            <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '8px', minHeight: '80px', background: 'var(--bg-surface)' }}>
              {dropboxBrowsePath !== '' && (
                <button
                  onClick={() => browseDropbox(dropboxBrowsePath.split('/').slice(0, -1).join('/') || '')}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--bg-border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px', textAlign: 'left' }}
                >
                  <ChevronUp size={14} />
                  Voltar
                </button>
              )}
              {dropboxFolders.map((f) => (
                <button
                  key={f.path}
                  onClick={() => browseDropbox(f.path)}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--bg-border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '12px', textAlign: 'left', transition: 'border-color 150ms' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--bg-border)' }}
                >
                  <FolderOpen size={14} color="#0061FF" style={{ flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                </button>
              ))}
              {!dropboxBrowseLoading && dropboxFolders.length === 0 && !dropboxBrowseError && (
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '10px 0', gridColumn: '1 / -1' }}>Sem subpastas neste diretório</span>
              )}
              {dropboxBrowseError && (
                <span style={{ fontSize: '12px', color: 'var(--status-error)', padding: '10px 0', gridColumn: '1 / -1' }}>{dropboxBrowseError}</span>
              )}
            </div>

            {/* Confirm selection */}
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--bg-border)', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {dropboxBrowsePath || '/'}
              </span>
              <button
                onClick={() => { setDropboxFolder(dropboxBrowsePath); setShowFolderBrowser(false) }}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 16px', borderRadius: 'var(--radius-sm)', border: 'none', background: dropboxFolder === dropboxBrowsePath ? 'rgba(91,110,245,0.15)' : 'var(--accent)', color: dropboxFolder === dropboxBrowsePath ? 'var(--accent)' : 'white', cursor: 'pointer', fontSize: '13px', fontWeight: '500', flexShrink: 0 }}
              >
                {dropboxFolder === dropboxBrowsePath ? <><Check size={13} /> Selecionada</> : 'Usar esta pasta'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Search + Sort + Filter bar ────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 14px', background: 'var(--bg-surface)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', marginBottom: '10px' }}>
        <Filter size={13} color="var(--text-muted)" style={{ flexShrink: 0 }} />
        <input
          type="text"
          placeholder="Filtrar por nome do anúncio..."
          value={filters.search}
          onChange={(e) => setFilter('search', e.target.value)}
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: '13px', color: 'var(--text-primary)', minWidth: 0 }}
        />
        {filters.search && (
          <button onClick={() => setFilter('search', '')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', flexShrink: 0 }}>
            <X size={13} />
          </button>
        )}

        <div style={{ width: '1px', height: '18px', background: 'var(--bg-border)', flexShrink: 0, margin: '0 4px' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <ArrowUpDown size={12} color="var(--text-muted)" />
          <select value={sortField} onChange={(e) => setSortField(e.target.value as SortField)} style={{ ...selectStyle, fontSize: '12px', padding: '4px 8px', border: 'none', background: 'transparent', color: 'var(--text-secondary)' }}>
            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button onClick={() => setSortDir((d) => d === 'desc' ? 'asc' : 'desc')} style={{ display: 'flex', alignItems: 'center', padding: '4px 6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--bg-border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            {sortDir === 'desc' ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
          </button>
        </div>

        <div style={{ width: '1px', height: '18px', background: 'var(--bg-border)', flexShrink: 0, margin: '0 4px' }} />

        {/* View mode toggle */}
        <div style={{ display: 'flex', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', flexShrink: 0 }}>
          <button
            onClick={() => { setViewMode('grid'); localStorage.setItem('creatives_view', 'grid') }}
            title="Visualização em grade"
            style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', border: 'none', background: viewMode === 'grid' ? 'var(--accent)' : 'transparent', color: viewMode === 'grid' ? 'white' : 'var(--text-muted)', cursor: 'pointer' }}
          >
            <LayoutGrid size={13} />
          </button>
          <button
            onClick={() => { setViewMode('table'); localStorage.setItem('creatives_view', 'table') }}
            title="Visualização em tabela"
            style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', border: 'none', borderLeft: '1px solid var(--bg-border)', background: viewMode === 'table' ? 'var(--accent)' : 'transparent', color: viewMode === 'table' ? 'white' : 'var(--text-muted)', cursor: 'pointer' }}
          >
            <List size={13} />
          </button>
        </div>

        <div style={{ width: '1px', height: '18px', background: 'var(--bg-border)', flexShrink: 0, margin: '0 4px' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {activeFiltersCount > 0 && (
            <button onClick={() => setFilters(DEFAULT_FILTERS)} style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '4px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--bg-border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '11px' }}>
              <X size={10} /> Limpar
            </button>
          )}
          <button
            onClick={() => setShowFilters(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 11px', borderRadius: 'var(--radius-sm)', border: `1px solid ${activeFiltersCount > 0 ? 'var(--accent)' : 'var(--bg-border)'}`, background: activeFiltersCount > 0 ? 'rgba(91,110,245,0.08)' : 'transparent', color: activeFiltersCount > 0 ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px', fontWeight: activeFiltersCount > 0 ? '500' : '400' }}
          >
            <SlidersHorizontal size={12} />
            Filtros
            {activeFiltersCount > 0 && (
              <span style={{ background: 'var(--accent)', color: 'white', borderRadius: '10px', padding: '1px 5px', fontSize: '10px', fontWeight: '600' }}>
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Filter Modal */}
      {showFilters && (
        <FilterModal
          filters={filters}
          onClose={() => setShowFilters(false)}
          onChange={setFilter}
          onClear={() => setFilters(DEFAULT_FILTERS)}
          savedFilterSets={savedFilterSets}
          onSaveFilterSet={handleSaveFilterSet}
          onApplyFilterSet={handleApplyFilterSet}
          onDeleteFilterSet={handleDeleteFilterSet}
        />
      )}

      {/* Warning (rate limit com fallback de cache) */}
      {adsWarning && (
        <div style={{ padding: '10px 16px', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: 'var(--radius-md)', color: '#b45309', fontSize: '13px', marginBottom: '12px' }}>
          {adsWarning}
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

      {/* Grid view */}
      {!loadingAds && sorted.length > 0 && viewMode === 'grid' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
          {sorted.map((c) => (
            <CreativeCard key={c.ad_id} creative={c} onLink={(adName) => openPicker(adName)} />
          ))}
        </div>
      )}

      {/* Table view */}
      {!loadingAds && sorted.length > 0 && viewMode === 'table' && (
        <TableView creatives={sorted} onLink={openPicker} />
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

      {/* Dropbox file picker */}
      {pickingFor !== null && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setPickingFor(null)}
        >
          <div
            style={{
              background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--bg-border)', width: '480px', maxWidth: '95vw',
              maxHeight: '70vh', display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--bg-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>Selecionar vídeo do Dropbox</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', maxWidth: '360px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pickingFor}</div>
              </div>
              <button onClick={() => setPickingFor(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                <X size={16} />
              </button>
            </div>

            {/* Search */}
            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--bg-border)' }}>
              <input
                autoFocus
                type="text"
                placeholder="Buscar arquivo..."
                value={fileSearch}
                onChange={(e) => setFileSearch(e.target.value)}
                style={{
                  width: '100%', padding: '7px 10px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--bg-border)', background: 'var(--bg-elevated)',
                  color: 'var(--text-primary)', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Error */}
            {pickerError && (
              <div style={{ padding: '10px 16px', background: 'rgba(239,68,68,0.08)', borderBottom: '1px solid rgba(239,68,68,0.2)', color: 'var(--status-error)', fontSize: '12px' }}>
                {pickerError}
              </div>
            )}

            {/* File list */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {dropboxFilesLoading && (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <Spinner size={14} /> Carregando arquivos...
                </div>
              )}
              {!dropboxFilesLoading && dropboxFiles.length === 0 && !pickerError && (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  {!dropboxConnected
                    ? 'Conecte o Dropbox no painel acima para vincular vídeos.'
                    : !dropboxFolder
                    ? 'Selecione uma pasta no painel do Dropbox acima antes de vincular.'
                    : 'Nenhum arquivo encontrado na pasta selecionada.'}
                </div>
              )}
              {!dropboxFilesLoading && dropboxFiles
                .filter((f) => f.name.toLowerCase().includes(fileSearch.toLowerCase()))
                .map((f) => (
                  <button
                    key={f.path}
                    onClick={() => handlePickFile(pickingFor!, f.path)}
                    disabled={pickingFile !== null}
                    style={{
                      width: '100%', textAlign: 'left', padding: '10px 16px',
                      background: pickingFile === f.path ? 'var(--bg-elevated)' : 'none',
                      border: 'none', borderBottom: '1px solid var(--bg-border)',
                      cursor: pickingFile !== null ? 'wait' : 'pointer',
                      fontSize: '13px', color: 'var(--text-primary)',
                      display: 'flex', alignItems: 'center', gap: '8px',
                    }}
                    onMouseEnter={(e) => { if (!pickingFile) e.currentTarget.style.background = 'var(--bg-elevated)' }}
                    onMouseLeave={(e) => { if (pickingFile !== f.path) e.currentTarget.style.background = 'none' }}
                  >
                    {pickingFile === f.path && <Spinner size={12} />}
                    {f.name}
                  </button>
                ))
              }
            </div>
          </div>
        </div>
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
