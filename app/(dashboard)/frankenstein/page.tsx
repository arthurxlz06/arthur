'use client'

import { useEffect, useState, useRef } from 'react'
import { Scissors, Film, Check, AlertCircle, Loader, RefreshCw } from 'lucide-react'

interface DropboxFile {
  name: string
  path: string
}

interface JobStatus {
  id: string
  status: 'queued' | 'processing' | 'done' | 'failed'
  output_path: string | null
  error_msg: string | null
}

function FileSelector({
  label,
  tag,
  selected,
  onSelect,
}: {
  label: string
  tag: string
  selected: DropboxFile | null
  onSelect: (f: DropboxFile) => void
}) {
  const [folder, setFolder] = useState('')
  const [files, setFiles] = useState<DropboxFile[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const listFiles = async () => {
    if (!folder.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/dropbox/link?path=${encodeURIComponent(folder.trim())}`)
      const data = await res.json() as { files?: DropboxFile[]; error?: string }
      if (data.error) { setError(data.error); setFiles([]) }
      else setFiles(data.files ?? [])
    } catch {
      setError('Erro ao listar pasta')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ flex: 1, minWidth: 0, background: 'var(--bg-surface)', border: `2px solid ${selected ? 'var(--accent)' : 'var(--bg-border)'}`, borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: '11px', fontWeight: '700', color: 'white' }}>{tag}</span>
        </div>
        <div>
          <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>{label}</p>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
            {tag === 'H' ? 'Primeiros 3s' : 'A partir dos 3s'}
          </p>
        </div>
      </div>

      {selected && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: 'rgba(91,110,245,0.08)', border: '1px solid rgba(91,110,245,0.2)', borderRadius: '8px' }}>
          <Film size={14} color="var(--accent)" />
          <span style={{ fontSize: '13px', color: 'var(--accent)', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected.name}</span>
          <Check size={13} color="var(--accent)" style={{ flexShrink: 0, marginLeft: 'auto' }} />
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          value={folder}
          onChange={e => setFolder(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && listFiles()}
          placeholder="/pasta/no/dropbox"
          style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--bg-border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
        />
        <button
          onClick={listFiles}
          disabled={loading || !folder.trim()}
          style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--bg-border)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', cursor: loading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center' }}
        >
          {loading ? <Loader size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : <RefreshCw size={14} />}
        </button>
      </div>

      {error && (
        <p style={{ fontSize: '12px', color: 'var(--status-error)', margin: 0, display: 'flex', alignItems: 'center', gap: '5px' }}>
          <AlertCircle size={12} /> {error}
        </p>
      )}

      {files.length > 0 && (
        <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {files.map(f => (
            <button
              key={f.path}
              onClick={() => onSelect(f)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '6px', border: 'none', background: selected?.path === f.path ? 'rgba(91,110,245,0.1)' : 'transparent', color: selected?.path === f.path ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer', textAlign: 'left', fontSize: '13px', transition: 'background 150ms' }}
            >
              <Film size={13} style={{ flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
              {selected?.path === f.path && <Check size={12} style={{ marginLeft: 'auto', flexShrink: 0 }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function StatusCard({ job }: { job: JobStatus }) {
  const statusConfig = {
    queued:     { color: 'var(--text-muted)',    bg: 'var(--bg-elevated)',          label: 'Na fila...', icon: <Loader size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> },
    processing: { color: '#f59e0b',               bg: 'rgba(245,158,11,0.08)',       label: 'Processando FFmpeg...', icon: <Loader size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> },
    done:       { color: 'var(--status-success)', bg: 'rgba(34,197,94,0.08)',        label: 'Concluído!', icon: <Check size={14} /> },
    failed:     { color: 'var(--status-error)',   bg: 'rgba(239,68,68,0.08)',        label: 'Falhou', icon: <AlertCircle size={14} /> },
  }
  const cfg = statusConfig[job.status]

  return (
    <div style={{ padding: '16px 20px', background: cfg.bg, border: `1px solid ${cfg.color}33`, borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: cfg.color, fontWeight: '600', fontSize: '14px' }}>
        {cfg.icon} {cfg.label}
      </div>
      {job.output_path && (
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
          Arquivo gerado: <span style={{ color: 'var(--accent)', fontFamily: 'monospace' }}>{job.output_path}</span>
        </p>
      )}
      {job.error_msg && (
        <p style={{ fontSize: '12px', color: 'var(--status-error)', margin: 0, fontFamily: 'monospace' }}>{job.error_msg}</p>
      )}
    </div>
  )
}

export default function FrankensteinPage() {
  const [hook, setHook] = useState<DropboxFile | null>(null)
  const [body, setBody] = useState<DropboxFile | null>(null)
  const [generating, setGenerating] = useState(false)
  const [job, setJob] = useState<JobStatus | null>(null)
  const [error, setError] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }

  useEffect(() => () => stopPolling(), [])

  const pollJob = (id: string) => {
    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/frankenstein/${id}`)
      const data = await res.json() as JobStatus
      setJob(data)
      if (data.status === 'done' || data.status === 'failed') stopPolling()
    }, 3000)
  }

  const generate = async () => {
    if (!hook || !body) return
    setGenerating(true)
    setError('')
    setJob(null)
    stopPolling()

    const res = await fetch('/api/frankenstein', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hook_path: hook.path, body_path: body.path }),
    })
    const data = await res.json() as { id?: string; error?: string }

    if (data.error || !data.id) {
      setError(data.error ?? 'Erro desconhecido')
      setGenerating(false)
      return
    }

    setJob({ id: data.id, status: 'queued', output_path: null, error_msg: null })
    setGenerating(false)
    pollJob(data.id)
  }

  const canGenerate = !!hook && !!body && !generating && (!job || job.status === 'failed')

  return (
    <div>
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <Scissors size={20} color="var(--accent)" />
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: 0 }}>Frankenstein</h1>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>
          Combina o Hook (0–3s) de um vídeo com o Body (3s+) de outro usando FFmpeg.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <FileSelector label="Hook" tag="H" selected={hook} onSelect={setHook} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '16px', color: 'var(--text-muted)' }}>+</span>
          </div>
        </div>

        <FileSelector label="Body" tag="B" selected={body} onSelect={setBody} />
      </div>

      {error && (
        <div style={{ marginBottom: '16px', padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', color: 'var(--status-error)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}

      <button
        onClick={generate}
        disabled={!canGenerate}
        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', borderRadius: '10px', background: canGenerate ? 'var(--accent)' : 'var(--bg-elevated)', color: canGenerate ? 'white' : 'var(--text-muted)', border: 'none', cursor: canGenerate ? 'pointer' : 'not-allowed', fontSize: '14px', fontWeight: '600', marginBottom: '20px', transition: 'all 200ms' }}
      >
        {generating ? <><Loader size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> Enfileirando...</> : <><Scissors size={16} /> Gerar Criativo</>}
      </button>

      {job && <StatusCard job={job} />}

      {job?.status === 'done' && (
        <button
          onClick={() => { setJob(null); setHook(null); setBody(null) }}
          style={{ marginTop: '12px', padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--bg-border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px' }}
        >
          Gerar outro
        </button>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
