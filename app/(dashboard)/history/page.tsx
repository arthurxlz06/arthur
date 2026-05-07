'use client'

import { useEffect, useState, useCallback } from 'react'
import { Check, X, RefreshCw, ChevronDown, ChevronLeft, ChevronRight, AlertCircle, RotateCcw } from 'lucide-react'
import { useToast } from '@/contexts/toast'

// ─── Types ───────────────────────────────────────────────────────────────────

interface HistoryFolder {
  name: string
}

interface HistoryVideo {
  id: string
  filename: string
  order_number: number | null
  folders: HistoryFolder | null
}

interface HistoryAccount {
  id: string
  name: string
  meta_account_id: string
}

interface HistoryJob {
  id: string
  status: string
  meta_video_id: string | null
  error_message: string | null
  queued_at: string
  finished_at: string | null
  videos: HistoryVideo | null
  ad_accounts: HistoryAccount | null
}

interface FilterAccount {
  id: string
  name: string
  meta_account_id: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDateTime(dateStr: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr))
}

function fmt(n: number): string {
  return new Intl.NumberFormat('pt-BR').format(n)
}

type Period = '' | 'today' | 'week' | 'month'

function periodToFrom(period: Period): string | null {
  if (!period) return null
  const now = new Date()
  if (period === 'today') {
    now.setHours(0, 0, 0, 0)
    return now.toISOString()
  }
  if (period === 'week') {
    now.setDate(now.getDate() - 7)
    return now.toISOString()
  }
  if (period === 'month') {
    now.setDate(now.getDate() - 30)
    return now.toISOString()
  }
  return null
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; bg: string; color: string; icon: React.ReactNode }> = {
    done: {
      label: 'Concluído',
      bg: 'rgba(34,197,94,0.1)',
      color: 'var(--status-success)',
      icon: <Check size={11} strokeWidth={2.5} />,
    },
    failed: {
      label: 'Falha',
      bg: 'rgba(239,68,68,0.1)',
      color: 'var(--status-error)',
      icon: <X size={11} strokeWidth={2.5} />,
    },
    processing: {
      label: 'Processando',
      bg: 'rgba(245,158,11,0.1)',
      color: 'var(--status-warning)',
      icon: (
        <div
          className="status-processing"
          style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            background: 'var(--status-warning)',
          }}
        />
      ),
    },
    pending: {
      label: 'Na fila',
      bg: 'rgba(91,110,245,0.1)',
      color: 'var(--accent)',
      icon: (
        <div
          style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            background: 'var(--accent)',
          }}
        />
      ),
    },
  }
  const c = cfg[status] ?? { label: status, bg: 'var(--bg-elevated)', color: 'var(--text-muted)', icon: null }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '3px 8px',
        borderRadius: '5px',
        background: c.bg,
        color: c.color,
        fontSize: '11px',
        fontWeight: '500',
        whiteSpace: 'nowrap',
      }}
    >
      {c.icon}
      {c.label}
    </span>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const toast = useToast()

  const [jobs, setJobs] = useState<HistoryJob[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)

  const [filterStatus, setFilterStatus] = useState('')
  const [filterAccountId, setFilterAccountId] = useState('')
  const [filterPeriod, setFilterPeriod] = useState<Period>('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const [accounts, setAccounts] = useState<FilterAccount[]>([])
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set())

  // Load accounts for filter dropdown
  useEffect(() => {
    fetch('/api/facebook/accounts')
      .then((r) => r.json())
      .then((data: { bms?: { ad_accounts: FilterAccount[] }[] }) => {
        const flat = (data.bms ?? []).flatMap((bm) => bm.ad_accounts)
        setAccounts(flat)
      })
  }, [])

  const fetchJobs = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filterStatus) params.set('status', filterStatus)
    if (filterAccountId) params.set('account_id', filterAccountId)
    const from = periodToFrom(filterPeriod)
    if (from) params.set('from', from)
    params.set('page', String(page))

    const res = await fetch(`/api/history?${params}`)
    const data = (await res.json()) as {
      jobs?: HistoryJob[]
      total?: number
      total_pages?: number
    }
    setJobs(data.jobs ?? [])
    setTotal(data.total ?? 0)
    setTotalPages(data.total_pages ?? 1)
    setLoading(false)
  }, [filterStatus, filterAccountId, filterPeriod, page])

  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  // Reset page when filters change (but not page itself)
  useEffect(() => {
    setPage(1)
  }, [filterStatus, filterAccountId, filterPeriod])

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleRetry = async (jobId: string) => {
    setRetryingIds((prev) => new Set([...Array.from(prev), jobId]))
    const res = await fetch('/api/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: jobId }),
    })
    const data = (await res.json()) as { error?: string }
    if (data.error) {
      toast.error(data.error)
    } else {
      toast.success('Job reenviado para a fila')
      setJobs((prev) =>
        prev.map((j) =>
          j.id === jobId ? { ...j, status: 'pending', error_message: null } : j
        )
      )
    }
    setRetryingIds((prev) => {
      const next = new Set(prev)
      next.delete(jobId)
      return next
    })
  }

  const filteredJobs = search.trim()
    ? jobs.filter(
        (j) =>
          j.videos?.filename?.toLowerCase().includes(search.toLowerCase()) ||
          j.ad_accounts?.name?.toLowerCase().includes(search.toLowerCase())
      )
    : jobs

  const periods: { value: Period; label: string }[] = [
    { value: '', label: 'Todos os períodos' },
    { value: 'today', label: 'Hoje' },
    { value: 'week', label: 'Últimos 7 dias' },
    { value: 'month', label: 'Último mês' },
  ]

  const selectStyle: React.CSSProperties = {
    padding: '8px 12px',
    fontSize: '13px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--bg-border)',
    background: 'var(--bg-surface)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    outline: 'none',
  }

  return (
    <div className="page-enter">
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: '24px',
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
            Histórico
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            {loading ? '...' : `${fmt(total)} registro${total !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={fetchJobs}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-surface)',
            border: '1px solid var(--bg-border)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: '13px',
          }}
        >
          <RefreshCw size={13} /> Atualizar
        </button>
      </div>

      {/* Filter bar */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
          marginBottom: '16px',
        }}
      >
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={selectStyle}
        >
          <option value="">Todos os status</option>
          <option value="done">Concluído</option>
          <option value="failed">Falha</option>
          <option value="processing">Processando</option>
          <option value="pending">Na fila</option>
        </select>

        <select
          value={filterAccountId}
          onChange={(e) => setFilterAccountId(e.target.value)}
          style={selectStyle}
        >
          <option value="">Todas as contas</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>

        <select
          value={filterPeriod}
          onChange={(e) => setFilterPeriod(e.target.value as Period)}
          style={selectStyle}
        >
          {periods.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Buscar por arquivo ou conta..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            ...selectStyle,
            flex: 1,
            minWidth: '200px',
          }}
        />
      </div>

      {/* Table */}
      {loading ? (
        <div
          style={{
            padding: '48px',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: '13px',
          }}
        >
          Carregando...
        </div>
      ) : filteredJobs.length === 0 ? (
        <div
          style={{
            padding: '64px 32px',
            textAlign: 'center',
            background: 'var(--bg-surface)',
            border: '1px solid var(--bg-border)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <AlertCircle
            size={28}
            color="var(--text-muted)"
            style={{ margin: '0 auto 12px', display: 'block' }}
          />
          <p
            style={{
              fontSize: '15px',
              color: 'var(--text-secondary)',
              marginBottom: '4px',
            }}
          >
            Nenhum registro encontrado
          </p>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Tente ajustar os filtros ou publicar vídeos primeiro
          </p>
        </div>
      ) : (
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--bg-border)',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
          }}
        >
          {/* Table header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 120px 140px 80px',
              gap: '12px',
              padding: '10px 16px',
              borderBottom: '1px solid var(--bg-border)',
              background: 'var(--bg-elevated)',
            }}
          >
            {['Arquivo', 'Conta', 'Status', 'Data', 'Ação'].map((h) => (
              <span
                key={h}
                style={{
                  fontSize: '11px',
                  fontWeight: '600',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                {h}
              </span>
            ))}
          </div>

          {/* Rows */}
          {filteredJobs.map((job, i) => {
            const isExpanded = expandedRows.has(job.id)
            const isRetrying = retryingIds.has(job.id)

            return (
              <div
                key={job.id}
                style={{
                  borderBottom:
                    i < filteredJobs.length - 1 ? '1px solid var(--bg-border)' : 'none',
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 120px 140px 80px',
                    gap: '12px',
                    padding: '11px 16px',
                    alignItems: 'center',
                    cursor: job.status === 'failed' ? 'pointer' : 'default',
                    background:
                      job.status === 'failed' && isExpanded
                        ? 'rgba(239,68,68,0.03)'
                        : 'transparent',
                  }}
                  onClick={() => job.status === 'failed' && toggleRow(job.id)}
                >
                  {/* File */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    {job.status === 'failed' && (
                      <ChevronDown
                        size={13}
                        color="var(--text-muted)"
                        style={{
                          transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                          transition: 'transform 150ms ease',
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <div style={{ minWidth: 0 }}>
                      <p
                        style={{
                          fontSize: '13px',
                          color: 'var(--text-primary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={job.videos?.filename}
                      >
                        {job.videos?.filename ?? '—'}
                      </p>
                      {job.videos?.folders?.name && (
                        <p
                          style={{
                            fontSize: '11px',
                            color: 'var(--text-muted)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {job.videos.folders.name}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Account */}
                  <div style={{ minWidth: 0 }}>
                    <p
                      style={{
                        fontSize: '13px',
                        color: 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {job.ad_accounts?.name ?? '—'}
                    </p>
                    {job.ad_accounts?.meta_account_id && (
                      <p
                        style={{
                          fontSize: '10px',
                          color: 'var(--text-muted)',
                          fontFamily: 'monospace',
                        }}
                      >
                        {job.ad_accounts.meta_account_id}
                      </p>
                    )}
                  </div>

                  {/* Status */}
                  <StatusBadge status={job.status} />

                  {/* Date */}
                  <span
                    style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}
                  >
                    {formatDateTime(job.queued_at)}
                  </span>

                  {/* Action */}
                  <div onClick={(e) => e.stopPropagation()}>
                    {job.status === 'failed' && (
                      <button
                        onClick={() => handleRetry(job.id)}
                        disabled={isRetrying}
                        title="Reenviar"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '5px 10px',
                          borderRadius: 'var(--radius-sm)',
                          background: 'rgba(91,110,245,0.1)',
                          border: '1px solid rgba(91,110,245,0.2)',
                          color: 'var(--accent)',
                          cursor: isRetrying ? 'wait' : 'pointer',
                          fontSize: '12px',
                          fontWeight: '500',
                          opacity: isRetrying ? 0.6 : 1,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <RotateCcw size={11} />
                        {isRetrying ? '...' : 'Reenviar'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded error */}
                {isExpanded && job.error_message && (
                  <div
                    style={{
                      padding: '10px 16px 14px 40px',
                      borderTop: '1px solid rgba(239,68,68,0.15)',
                      background: 'rgba(239,68,68,0.04)',
                    }}
                  >
                    <p
                      style={{
                        fontSize: '11px',
                        color: 'var(--text-muted)',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        marginBottom: '4px',
                      }}
                    >
                      Detalhe do erro
                    </p>
                    <p
                      style={{
                        fontSize: '12px',
                        color: 'var(--status-error)',
                        fontFamily: 'monospace',
                        lineHeight: '1.5',
                        wordBreak: 'break-word',
                      }}
                    >
                      {job.error_message}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '16px',
          }}
        >
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Página {page} de {totalPages}
          </span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '7px 12px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-surface)',
                border: '1px solid var(--bg-border)',
                color: page === 1 ? 'var(--text-muted)' : 'var(--text-secondary)',
                cursor: page === 1 ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                opacity: page === 1 ? 0.5 : 1,
              }}
            >
              <ChevronLeft size={14} /> Anterior
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '7px 12px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-surface)',
                border: '1px solid var(--bg-border)',
                color: page === totalPages ? 'var(--text-muted)' : 'var(--text-secondary)',
                cursor: page === totalPages ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                opacity: page === totalPages ? 0.5 : 1,
              }}
            >
              Próximo <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
