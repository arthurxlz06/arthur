'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Check, X, Clock, Film, TrendingUp, ChevronRight, Zap } from 'lucide-react'

interface Metrics {
  total_jobs: number
  done_jobs: number
  failed_jobs: number
  pending_jobs: number
  total_videos: number
  success_rate: number
}

interface RecentJob {
  id: string
  status: string
  queued_at: string
  videos: { filename: string } | null
  ad_accounts: { name: string } | null
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `há ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `há ${hours}h`
  return `há ${Math.floor(hours / 24)}d`
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

function formatDate(): string {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  }).format(new Date())
}

function fmt(n: number): string {
  return new Intl.NumberFormat('pt-BR').format(n)
}

function JobStatusIcon({ status }: { status: string }) {
  if (status === 'done') return <Check size={13} color="var(--status-success)" strokeWidth={2.5} />
  if (status === 'failed') return <X size={13} color="var(--status-error)" strokeWidth={2.5} />
  return (
    <div
      style={{
        width: '7px',
        height: '7px',
        borderRadius: '50%',
        background: 'var(--accent)',
        flexShrink: 0,
      }}
    />
  )
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard')
      .then((r) => r.json())
      .then((data: { metrics?: Metrics; recent_jobs?: RecentJob[] }) => {
        if (data.metrics) setMetrics(data.metrics)
        setRecentJobs(data.recent_jobs ?? [])
        setLoading(false)
      })
  }, [])

  const firstName = session?.user?.name?.split(' ')[0] ?? ''

  const cards = [
    { label: 'Total', value: metrics?.total_jobs ?? 0, Icon: TrendingUp, color: 'var(--accent)' },
    { label: 'Concluídos', value: metrics?.done_jobs ?? 0, Icon: Check, color: 'var(--status-success)' },
    { label: 'Falhas', value: metrics?.failed_jobs ?? 0, Icon: X, color: 'var(--status-error)' },
    { label: 'Na Fila', value: metrics?.pending_jobs ?? 0, Icon: Clock, color: 'var(--status-warning)' },
  ]

  const rate = metrics?.success_rate ?? 0
  const rateColor =
    rate >= 90 ? 'var(--status-success)' : rate >= 70 ? 'var(--status-warning)' : 'var(--status-error)'

  return (
    <div className="page-enter">
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: '28px',
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
            {greeting()}
            {firstName ? `, ${firstName}` : ''}
          </h1>
          <p
            style={{
              color: 'var(--text-secondary)',
              fontSize: '14px',
              textTransform: 'capitalize',
            }}
          >
            {formatDate()}
          </p>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 10px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-surface)',
            border: '1px solid var(--bg-border)',
          }}
        >
          <Zap size={12} color="var(--accent)" />
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>68Prêmios</span>
        </div>
      </div>

      {/* Metric cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))',
          gap: '10px',
          marginBottom: '16px',
        }}
      >
        {cards.map(({ label, value, Icon, color }) => (
          <div
            key={label}
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--bg-border)',
              borderRadius: 'var(--radius-md)',
              padding: '18px 20px',
              transition: 'border-color 200ms ease',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '14px',
              }}
            >
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {label}
              </span>
              <div
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '6px',
                  background: `${color}18`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon size={13} color={color} />
              </div>
            </div>
            <p
              style={{
                fontSize: '30px',
                fontWeight: '700',
                color: 'var(--text-primary)',
                letterSpacing: '-0.05em',
                lineHeight: 1,
              }}
            >
              {loading ? '—' : fmt(value)}
            </p>
          </div>
        ))}
      </div>

      {/* Success rate */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--bg-border)',
          borderRadius: 'var(--radius-md)',
          padding: '18px 20px',
          marginBottom: '16px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '10px',
          }}
        >
          <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)' }}>
            Taxa de sucesso
          </span>
          <span
            style={{
              fontSize: '22px',
              fontWeight: '700',
              color: rateColor,
              letterSpacing: '-0.04em',
            }}
          >
            {loading ? '—' : `${rate}%`}
          </span>
        </div>
        <div
          style={{
            background: 'var(--bg-elevated)',
            borderRadius: '4px',
            height: '5px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              background: rateColor,
              borderRadius: '4px',
              height: '100%',
              width: loading ? '0%' : `${rate}%`,
              transition: 'width 800ms ease',
            }}
          />
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: '8px',
          }}
        >
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {fmt(metrics?.total_videos ?? 0)} vídeos na biblioteca
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {fmt(metrics?.total_jobs ?? 0)} uploads totais
          </span>
        </div>
      </div>

      {/* Recent activity */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--bg-border)',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            borderBottom: '1px solid var(--bg-border)',
          }}
        >
          <span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)' }}>
            Atividade recente
          </span>
          <Link
            href="/history"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              fontSize: '12px',
              color: 'var(--accent)',
              textDecoration: 'none',
            }}
          >
            Ver tudo <ChevronRight size={12} />
          </Link>
        </div>

        {loading ? (
          <div
            style={{
              padding: '24px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '13px',
            }}
          >
            Carregando...
          </div>
        ) : recentJobs.length === 0 ? (
          <div
            style={{
              padding: '48px 24px',
              textAlign: 'center',
            }}
          >
            <Film
              size={28}
              color="var(--text-muted)"
              style={{ margin: '0 auto 12px', display: 'block' }}
            />
            <p
              style={{
                fontSize: '14px',
                color: 'var(--text-secondary)',
                marginBottom: '4px',
              }}
            >
              Nenhuma atividade ainda
            </p>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Publique vídeos para ver o histórico aqui
            </p>
          </div>
        ) : (
          recentJobs.map((job, i) => (
            <div
              key={job.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '11px 20px',
                borderBottom:
                  i < recentJobs.length - 1 ? '1px solid var(--bg-border)' : 'none',
              }}
            >
              <JobStatusIcon status={job.status} />
              <span
                style={{
                  fontSize: '13px',
                  color: 'var(--text-primary)',
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {job.videos?.filename ?? '—'}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>→</span>
              <span
                style={{
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '130px',
                  flexShrink: 0,
                }}
              >
                {job.ad_accounts?.name ?? '—'}
              </span>
              <span
                style={{
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  flexShrink: 0,
                  minWidth: '60px',
                  textAlign: 'right',
                }}
              >
                {timeAgo(job.queued_at)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
