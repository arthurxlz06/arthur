'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Activity, AlertCircle, Check, Loader,
  Pause, Play, Scissors, Sparkles, TrendingUp,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

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

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, d = 1) { return n.toFixed(d) }

function fmtTime(s: number) {
  if (!isFinite(s) || s < 0) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

// ── CreativeCard ─────────────────────────────────────────────────────────────

function CreativeCard({
  creative, rank, isSelected, isSuggested, metricLabel, metricValue, onClick,
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
        border: `2px solid ${isSelected ? 'var(--accent)' : hovered ? 'var(--bg-border)' : 'transparent'}`,
        background: isSelected ? 'rgba(91,110,245,0.06)' : hovered ? 'var(--bg-elevated)' : 'var(--bg-surface)',
        borderRadius: '10px', padding: '12px', cursor: 'pointer',
        transition: 'all 150ms', display: 'flex', gap: '12px', alignItems: 'flex-start',
      }}
    >
      <div style={{ flexShrink: 0, width: '22px', height: '22px', borderRadius: '50%', background: rank === 1 ? 'var(--accent)' : 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '2px' }}>
        <span style={{ fontSize: '11px', fontWeight: '700', color: rank === 1 ? 'white' : 'var(--text-muted)' }}>{rank}</span>
      </div>
      <div style={{ flexShrink: 0, width: '60px', height: '60px', borderRadius: '8px', overflow: 'hidden', background: 'var(--bg-elevated)' }}>
        <video
          src={creative.dropbox_direct_url}
          muted preload="metadata"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onMouseEnter={(e) => (e.currentTarget as HTMLVideoElement).play().catch(() => null)}
          onMouseLeave={(e) => { const v = e.currentTarget as HTMLVideoElement; v.pause(); v.currentTime = 0 }}
        />
      </div>
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

// ── Panel ────────────────────────────────────────────────────────────────────

function Panel({
  title, icon, creatives, selected, onSelect, metricLabel, formatMetric,
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

// ── VideoTrimmer ──────────────────────────────────────────────────────────────

function VideoTrimmer({
  url,
  mode,
  cutSeconds,
  onCutChange,
}: {
  url: string
  mode: 'hook' | 'body'
  cutSeconds: number
  onCutChange: (s: number) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [videoError, setVideoError] = useState(false)

  const accent = mode === 'hook' ? 'var(--accent)' : '#f59e0b'
  const cutPct = duration > 0 ? (cutSeconds / duration) * 100 : 0
  const playPct = duration > 0 ? (currentTime / duration) * 100 : 0

  const togglePlay = () => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) { v.play().catch(() => null); setPlaying(true) }
    else { v.pause(); setPlaying(false) }
  }

  const handleMetadata = () => {
    const d = videoRef.current?.duration ?? 0
    if (!isFinite(d) || d <= 0) return
    setDuration(d)
    const clamped = Math.min(Math.max(cutSeconds, 0.5), d - 0.5)
    if (Math.abs(clamped - cutSeconds) > 0.01) onCutChange(clamped)
  }

  const seek = (t: number) => {
    if (!videoRef.current) return
    videoRef.current.currentTime = t
    setCurrentTime(t)
  }

  return (
    <div style={{ flex: 1, minWidth: '260px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* Label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '11px', fontWeight: '700', color: accent, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {mode === 'hook' ? 'Hook' : 'Body'}
        </span>
        {duration > 0 && (
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {mode === 'hook'
              ? `usando primeiros ${fmt(cutSeconds)}s de ${fmt(duration)}s`
              : `usando a partir de ${fmt(cutSeconds)}s (${fmt(duration - cutSeconds)}s restantes)`}
          </span>
        )}
      </div>

      {/* Video player */}
      {videoError ? (
        <div style={{ height: '180px', background: 'var(--bg-elevated)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
          Não foi possível carregar o vídeo
        </div>
      ) : (
        <div style={{ position: 'relative', background: '#000', borderRadius: '10px', overflow: 'hidden', height: '190px' }}>
          <video
            ref={videoRef}
            src={url}
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
            preload="metadata"
            playsInline
            onLoadedMetadata={handleMetadata}
            onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime ?? 0)}
            onEnded={() => setPlaying(false)}
            onError={() => setVideoError(true)}
          />
          {/* Play/Pause overlay */}
          <button
            onClick={togglePlay}
            style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%,-50%)',
              background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: '50%',
              width: '44px', height: '44px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
            }}
          >
            {playing ? <Pause size={18} /> : <Play size={18} />}
          </button>
          {/* Time badge */}
          <span style={{
            position: 'absolute', bottom: '6px', right: '8px',
            fontSize: '11px', color: 'white', background: 'rgba(0,0,0,0.55)',
            padding: '2px 6px', borderRadius: '4px',
          }}>
            {fmtTime(currentTime)} / {fmtTime(duration)}
          </span>
        </div>
      )}

      {duration > 0 && (
        <>
          {/* Seek scrubber */}
          <input
            type="range"
            min={0}
            max={duration}
            step={0.1}
            value={currentTime}
            onChange={(e) => seek(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#666', cursor: 'pointer', margin: 0 }}
          />

          {/* Visual timeline */}
          <div style={{ position: 'relative', height: '28px', background: 'var(--bg-elevated)', borderRadius: '6px', overflow: 'hidden', userSelect: 'none', cursor: 'pointer' }}
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect()
              seek(((e.clientX - r.left) / r.width) * duration)
            }}
          >
            {/* Active region */}
            <div style={{
              position: 'absolute', top: 0, bottom: 0,
              left: mode === 'hook' ? 0 : `${cutPct}%`,
              width: mode === 'hook' ? `${cutPct}%` : `${100 - cutPct}%`,
              background: `${accent}33`,
            }} />
            {/* Cut line */}
            <div style={{
              position: 'absolute', top: 0, bottom: 0,
              left: `${cutPct}%`, width: '3px',
              background: accent, transform: 'translateX(-50%)',
            }} />
            {/* Playhead */}
            <div style={{
              position: 'absolute', top: 0, bottom: 0,
              left: `${playPct}%`, width: '2px',
              background: 'rgba(255,255,255,0.65)', transform: 'translateX(-50%)',
            }} />
            {/* Region label */}
            <span style={{
              position: 'absolute',
              left: mode === 'hook' ? '6px' : `calc(${cutPct}% + 6px)`,
              top: '7px', fontSize: '10px', fontWeight: '700', color: accent,
            }}>
              {mode === 'hook' ? 'HOOK' : 'BODY'}
            </span>
          </div>

          {/* Cut point slider */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {mode === 'hook' ? 'Hook termina em:' : 'Body começa em:'}
              </span>
              <span style={{ fontSize: '14px', fontWeight: '700', color: accent }}>{fmt(cutSeconds)}s</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={Math.max(duration - 0.5, 0.5)}
              step={0.1}
              value={cutSeconds}
              onChange={(e) => onCutChange(Number(e.target.value))}
              style={{ width: '100%', accentColor: accent, cursor: 'pointer', margin: 0 }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3px' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>0s</span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{fmtTime(duration)}</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── StatusCard ────────────────────────────────────────────────────────────────

function StatusCard({ job }: { job: JobStatus }) {
  const cfg = {
    queued:     { color: 'var(--text-muted)',     bg: 'var(--bg-elevated)',     label: 'Na fila...',           icon: <Loader size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> },
    processing: { color: '#f59e0b',               bg: 'rgba(245,158,11,0.08)', label: 'Processando FFmpeg...', icon: <Loader size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> },
    done:       { color: 'var(--status-success)', bg: 'rgba(34,197,94,0.08)',  label: 'Concluído!',            icon: <Check size={14} /> },
    failed:     { color: 'var(--status-error)',   bg: 'rgba(239,68,68,0.08)', label: 'Falhou',               icon: <AlertCircle size={14} /> },
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

// ── Main Page ────────────────────────────────────────────────────────────────

export default function FrankensteinPage() {
  const [rankings, setRankings] = useState<Rankings | null>(null)
  const [loading, setLoading] = useState(true)
  const [hook, setHook] = useState<RankedCreative | null>(null)
  const [body, setBody] = useState<RankedCreative | null>(null)
  const [hookCut, setHookCut] = useState(3)
  const [bodyCut, setBodyCut] = useState(3)
  const [generating, setGenerating] = useState(false)
  const [job, setJob] = useState<JobStatus | null>(null)
  const [genError, setGenError] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const editorRef = useRef<HTMLDivElement>(null)

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

  // Reset cut points when selected video changes
  useEffect(() => { setHookCut(3) }, [hook?.ad_name])
  useEffect(() => { setBodyCut(3) }, [body?.ad_name])

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

    try {
      const res = await fetch('/api/frankenstein', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hook_url: hook.dropbox_direct_url,
          hook_ad_name: hook.ad_name,
          body_url: body.dropbox_direct_url,
          body_ad_name: body.ad_name,
          hook_end: hookCut,
          body_start: bodyCut,
        }),
      })

      // Safely parse JSON — server may return HTML on crash
      const text = await res.text()
      let data: { id?: string; error?: string }
      try { data = JSON.parse(text) }
      catch { throw new Error(`Erro do servidor: ${text.slice(0, 120)}`) }

      if (data.error || !data.id) {
        setGenError(data.error ?? 'Erro desconhecido')
        setGenerating(false)
        return
      }

      setJob({ id: data.id, status: 'queued', output_path: null, error_msg: null, hook_ad_name: hook.ad_name, body_ad_name: body.ad_name })
      setGenerating(false)
      startPolling(data.id)
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Erro de conexão')
      setGenerating(false)
    }
  }

  const canGenerate = !!hook && !!body && !generating && (!job || job.status === 'failed')

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <Scissors size={20} color="var(--accent)" />
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: 0 }}>Frankenstein</h1>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>
          Selecione o hook e o body, edite os pontos de corte e gere o criativo.
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

          {/* Selection panels */}
          <div style={{ display: 'flex', gap: '24px', marginBottom: '32px', flexWrap: 'wrap' }}>
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

          {/* Editor */}
          {hook && body && (
            <div ref={editorRef} style={{ marginBottom: '24px', padding: '20px', background: 'var(--bg-surface)', border: '1px solid var(--bg-border)', borderRadius: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                <Scissors size={15} color="var(--text-muted)" />
                <h2 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>
                  Editor de corte
                </h2>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '4px' }}>
                  Hook usa <strong style={{ color: 'var(--accent)' }}>{fmt(hookCut)}s</strong>
                  {' · '}
                  Body começa em <strong style={{ color: '#f59e0b' }}>{fmt(bodyCut)}s</strong>
                </span>
              </div>

              <div style={{ display: 'flex', gap: '28px', flexWrap: 'wrap' }}>
                <VideoTrimmer
                  url={hook.dropbox_direct_url}
                  mode="hook"
                  cutSeconds={hookCut}
                  onCutChange={setHookCut}
                />
                <VideoTrimmer
                  url={body.dropbox_direct_url}
                  mode="body"
                  cutSeconds={bodyCut}
                  onCutChange={setBodyCut}
                />
              </div>
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
              onClick={() => setJob(null)}
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
