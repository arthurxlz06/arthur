'use client'

import { useEffect, useState, useRef } from 'react'
import { Scissors, Check, AlertCircle, Loader, Sparkles, TrendingUp, Activity } from 'lucide-react'

interface RankedCreative {
  ad_name: string
  hook_rate: number
  body_rate: number
  video_3s: number
  video_15s: number
  cpa: number
  ctr: number
  impressions: number
  dropbox_direct_url: string
}

interface Rankings {
  hooks: RankedCreative[]
  bodies: RankedCreative[]
  no_cache?: boolean
  no_links?: boolean
}

interface JobStatus {
  id: string
  status: 'queued' | 'processing' | 'done' | 'failed'
  output_path: string | null
  error_msg: string | null
  hook_ad_name?: string
  body_ad_name?: string
}

function fmt(n: number, decimals = 1) {
  return n.toFixed(decimals)
}

function CreativeCard({
  creative,
  rank,
  isSelected,
  isSuggested,
  metricLabel,
  metricValue,
  onClick,
}: {
  creative: RankedCreative
  rank: number
  isSelected: boolean
  isSuggested: boolean
  metricLabel: string
  metricValue: string
  onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        border: `2px solid ${isSelected ? 'var(--accent)' : hovered ? 'var(--bg-border)' : 'transparent'}`,
        background: isSelected ? 'rgba(91,110,245,0.06)' : hovered ? 'var(--bg-elevated)' : 'var(--bg-surface)',
        borderRadius: '10px',
        padding: '12px',
        cursor: 'pointer',
        transition: 'all 150ms',
        display: 'flex',
        gap: '12px',
        alignItems: 'flex-start',
      }}
    >
      {/* Rank badge */}
      <div style={{ flexShrink: 0, width: '22px', height: '22px', borderRadius: '50%', background: rank === 1 ? 'var(--accent)' : 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '2px' }}>
        <span style={{ fontSize: '11px', fontWeight: '700', color: rank === 1 ? 'white' : 'var(--text-muted)' }}>{rank}</span>
      </div>

      {/* Thumbnail / video preview */}
      <div style={{ flexShrink: 0, width: '72px', height: '72px', borderRadius: '8px', overflow: 'hidden', background: 'var(--bg-elevated)', position: 'relative' }}>
        <video
          src={creative.dropbox_direct_url}
          muted
          preload="metadata"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onMouseEnter={(e) => (e.currentTarget as HTMLVideoElement).play()}
          onMouseLeave={(e) => { const v = e.currentTarget as HTMLVideoElement; v.pause(); v.currentTime = 0 }}
        />
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px', flexWrap: 'wrap' }}>
          {isSuggested && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px', fontWeight: '600', color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '1px 6px', borderRadius: '999px' }}>
              <Sparkles size={9} /> Sugestão
            </span>
          )}
          {isSelected && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px', fontWeight: '600', color: 'var(--accent)', background: 'rgba(91,110,245,0.1)', padding: '1px 6px', borderRadius: '999px' }}>
              <Check size={9} /> Selecionado
            </span>
          )}
        </div>
        <p style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-primary)', margin: '0 0 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {creative.ad_name}
        </p>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--accent)' }}>{metricValue}</span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{metricLabel}</span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{creative.impressions.toLocaleString('pt-BR')} impr.</span>
        </div>
      </div>
    </div>
  )
}

function Panel({
  title,
  icon,
  creatives,
  selected,
  onSelect,
  metricLabel,
  formatMetric,
}: {
  title: string
  icon: React.ReactNode
  creatives: RankedCreative[]
  selected: RankedCreative | null
  onSelect: (c: RankedCreative) => void
  metricKey: keyof RankedCreative
  metricLabel: string
  formatMetric: (c: RankedCreative) => string
}) {
  return (
    <div style={{ flex: 1, minWidth: '280px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        {icon}
        <h2 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>{title}</h2>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 'auto' }}>Top {creatives.length}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {creatives.map((c, i) => (
          <CreativeCard
            key={c.ad_name}
            creative={c}
            rank={i + 1}
            isSelected={selected?.ad_name === c.ad_name}
            isSuggested={i === 0}
            metricLabel={metricLabel}
            metricValue={formatMetric(c)}
            onClick={() => onSelect(c)}
          />
        ))}
      </div>
    </div>
  )
}

function StatusCard({ job }: { job: JobStatus }) {
  const cfg = {
    queued:     { color: 'var(--text-muted)',    bg: 'var(--bg-elevated)',    label: 'Na fila...',          icon: <Loader size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> },
    processing: { color: '#f59e0b',              bg: 'rgba(245,158,11,0.08)', label: 'Processando FFmpeg...', icon: <Loader size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> },
    done:       { color: 'var(--status-success)', bg: 'rgba(34,197,94,0.08)', label: 'Concluído!',           icon: <Check size={14} /> },
    failed:     { color: 'var(--status-error)',   bg: 'rgba(239,68,68,0.08)', label: 'Falhou',              icon: <AlertCircle size={14} /> },
  }[job.status]

  return (
    <div style={{ padding: '16px 20px', background: cfg.bg, border: `1px solid ${cfg.color}44`, borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: cfg.color, fontWeight: '600', fontSize: '14px' }}>
        {cfg.icon} {cfg.label}
      </div>
      {job.hook_ad_name && job.body_ad_name && (
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
          Hook: <strong>{job.hook_ad_name}</strong> · Body: <strong>{job.body_ad_name}</strong>
        </p>
      )}
      {job.output_path && (
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
          Salvo em: <span style={{ color: 'var(--accent)', fontFamily: 'monospace' }}>{job.output_path}</span>
        </p>
      )}
      {job.error_msg && (
        <p style={{ fontSize: '12px', color: 'var(--status-error)', margin: 0, fontFamily: 'monospace' }}>{job.error_msg}</p>
      )}
    </div>
  )
}

export default function FrankensteinPage() {
  const [rankings, setRankings] = useState<Rankings | null>(null)
  const [loading, setLoading] = useState(true)
  const [hook, setHook] = useState<RankedCreative | null>(null)
  const [body, setBody] = useState<RankedCreative | null>(null)
  const [generating, setGenerating] = useState(false)
  const [job, setJob] = useState<JobStatus | null>(null)
  const [genError, setGenError] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    fetch('/api/frankenstein/rankings')
      .then((r) => r.json())
      .then((data: Rankings) => {
        setRankings(data)
        if (data.hooks[0]) setHook(data.hooks[0])
        if (data.bodies[0]) setBody(data.bodies[0])
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  const startPolling = (id: string) => {
    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/frankenstein/${id}`)
      const data = await res.json() as JobStatus
      setJob(data)
      if (data.status === 'done' || data.status === 'failed') {
        clearInterval(pollRef.current!)
        pollRef.current = null
      }
    }, 3000)
  }

  const generate = async () => {
    if (!hook || !body) return
    setGenerating(true)
    setGenError('')
    setJob(null)
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }

    const res = await fetch('/api/frankenstein', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hook_url: hook.dropbox_direct_url,
        hook_ad_name: hook.ad_name,
        body_url: body.dropbox_direct_url,
        body_ad_name: body.ad_name,
      }),
    })
    const data = await res.json() as { id?: string; error?: string }

    if (data.error || !data.id) {
      setGenError(data.error ?? 'Erro desconhecido')
      setGenerating(false)
      return
    }

    setJob({ id: data.id, status: 'queued', output_path: null, error_msg: null, hook_ad_name: hook.ad_name, body_ad_name: body.ad_name })
    setGenerating(false)
    startPolling(data.id)
  }

  const canGenerate = !!hook && !!body && !generating && (!job || job.status === 'failed')

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <Scissors size={20} color="var(--accent)" />
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: 0 }}>Frankenstein</h1>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>
          Ranqueamento automático baseado nas métricas dos seus criativos. Selecione Hook e Body e gere um novo vídeo.
        </p>
      </div>

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted)', fontSize: '14px', padding: '40px 0' }}>
          <Loader size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> Carregando métricas...
        </div>
      )}

      {!loading && rankings?.no_cache && (
        <div style={{ padding: '20px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '10px', fontSize: '14px', color: 'var(--text-secondary)' }}>
          Nenhuma métrica em cache. Acesse <strong>Criativos</strong> e busque as métricas de uma conta primeiro.
        </div>
      )}

      {!loading && rankings?.no_links && !rankings?.no_cache && (
        <div style={{ padding: '20px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '10px', fontSize: '14px', color: 'var(--text-secondary)' }}>
          Nenhum criativo vinculado ao Dropbox. Acesse <strong>Criativos</strong> e sincronize os vídeos primeiro.
        </div>
      )}

      {!loading && rankings && !rankings.no_cache && !rankings.no_links && (
        <>
          {(rankings.hooks.length === 0 || rankings.bodies.length === 0) && (
            <div style={{ marginBottom: '16px', padding: '12px 16px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              {rankings.hooks.length === 0 && 'Nenhum Hook com dados suficientes (mín. 100 impressões). '}
              {rankings.bodies.length === 0 && 'Nenhum Body com dados suficientes (mín. 50 video views em 3s).'}
            </div>
          )}

          <div style={{ display: 'flex', gap: '24px', marginBottom: '24px', flexWrap: 'wrap' }}>
            {rankings.hooks.length > 0 && (
              <Panel
                title="Melhores Hooks"
                icon={<TrendingUp size={16} color="var(--accent)" />}
                creatives={rankings.hooks}
                selected={hook}
                onSelect={setHook}
                metricKey="hook_rate"
                metricLabel="Hook Rate"
                formatMetric={(c) => `${fmt(c.hook_rate)}%`}
              />
            )}

            {rankings.bodies.length > 0 && (
              <Panel
                title="Melhores Bodies"
                icon={<Activity size={16} color="#f59e0b" />}
                creatives={rankings.bodies}
                selected={body}
                onSelect={setBody}
                metricKey="body_rate"
                metricLabel="Body Rate"
                formatMetric={(c) => `${fmt(c.body_rate)}%`}
              />
            )}
          </div>

          {hook && body && (
            <div style={{ marginBottom: '16px', padding: '12px 16px', background: 'rgba(91,110,245,0.06)', border: '1px solid rgba(91,110,245,0.2)', borderRadius: '8px', fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <Sparkles size={13} color="var(--accent)" />
              <span>Combinação: <strong style={{ color: 'var(--text-primary)' }}>{hook.ad_name}</strong> (Hook {fmt(hook.hook_rate)}%) + <strong style={{ color: 'var(--text-primary)' }}>{body.ad_name}</strong> (Body {fmt(body.body_rate)}%)</span>
            </div>
          )}

          {genError && (
            <div style={{ marginBottom: '16px', padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', color: 'var(--status-error)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={14} /> {genError}
            </div>
          )}

          <button
            onClick={generate}
            disabled={!canGenerate}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 24px', borderRadius: '10px', background: canGenerate ? 'var(--accent)' : 'var(--bg-elevated)', color: canGenerate ? 'white' : 'var(--text-muted)', border: 'none', cursor: canGenerate ? 'pointer' : 'not-allowed', fontSize: '14px', fontWeight: '600', marginBottom: '20px', transition: 'all 200ms' }}
          >
            {generating
              ? <><Loader size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> Enfileirando...</>
              : <><Scissors size={16} /> Gerar Criativo</>}
          </button>

          {job && <StatusCard job={job} />}

          {job?.status === 'done' && (
            <button
              onClick={() => { setJob(null) }}
              style={{ display: 'block', marginTop: '12px', padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--bg-border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px' }}
            >
              Gerar outro
            </button>
          )}
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
