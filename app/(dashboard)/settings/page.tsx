'use client'

import { useEffect, useState } from 'react'
import { signIn } from 'next-auth/react'
import { Check, AlertCircle, Loader } from 'lucide-react'

type Status = 'loading' | 'connected' | 'disconnected'

function ConnectionCard({
  logo,
  name,
  description,
  status,
  onConnect,
  onDisconnect,
  connecting,
  disconnecting,
}: {
  logo: React.ReactNode
  name: string
  description: string
  status: Status
  onConnect: () => void
  onDisconnect: () => void
  connecting: boolean
  disconnecting: boolean
}) {
  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--bg-border)',
        borderRadius: 'var(--radius-md)',
        padding: '20px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: '200px' }}>
        <div style={{ flexShrink: 0 }}>{logo}</div>
        <div>
          <p style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '3px' }}>{name}</p>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{description}</p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
        {status === 'loading' && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-muted)' }}>
            <Loader size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> Verificando...
          </span>
        )}

        {status === 'connected' && (
          <>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: 'var(--status-success)', fontWeight: '500' }}>
              <Check size={14} /> Conectado
            </span>
            <button
              onClick={onDisconnect}
              disabled={disconnecting}
              style={{
                padding: '7px 14px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid rgba(239,68,68,0.4)',
                background: 'rgba(239,68,68,0.06)',
                color: 'var(--status-error)',
                cursor: disconnecting ? 'wait' : 'pointer',
                fontSize: '13px',
                fontWeight: '500',
                opacity: disconnecting ? 0.6 : 1,
              }}
            >
              {disconnecting ? 'Desconectando...' : 'Desconectar'}
            </button>
          </>
        )}

        {status === 'disconnected' && (
          <>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: 'var(--text-muted)' }}>
              <AlertCircle size={14} /> Não conectado
            </span>
            <button
              onClick={onConnect}
              disabled={connecting}
              style={{
                padding: '7px 14px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: 'var(--accent)',
                color: 'white',
                cursor: connecting ? 'wait' : 'pointer',
                fontSize: '13px',
                fontWeight: '500',
                opacity: connecting ? 0.7 : 1,
              }}
            >
              {connecting ? 'Conectando...' : 'Conectar'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const [metaStatus, setMetaStatus] = useState<Status>('loading')
  const [dropboxStatus, setDropboxStatus] = useState<Status>('loading')
  const [metaDisconnecting, setMetaDisconnecting] = useState(false)
  const [dropboxDisconnecting, setDropboxDisconnecting] = useState(false)

  useEffect(() => {
    fetch('/api/meta/status')
      .then((r) => r.json())
      .then((d: { connected?: boolean }) => setMetaStatus(d.connected ? 'connected' : 'disconnected'))
      .catch(() => setMetaStatus('disconnected'))

    fetch('/api/dropbox/status')
      .then((r) => r.json())
      .then((d: { connected?: boolean }) => setDropboxStatus(d.connected ? 'connected' : 'disconnected'))
      .catch(() => setDropboxStatus('disconnected'))
  }, [])

  const handleMetaConnect = () => signIn('facebook')

  const handleMetaDisconnect = async () => {
    setMetaDisconnecting(true)
    await fetch('/api/meta/disconnect', { method: 'POST' })
    setMetaStatus('disconnected')
    setMetaDisconnecting(false)
  }

  const handleDropboxConnect = () => {
    window.location.href = '/api/dropbox/auth'
  }

  const handleDropboxDisconnect = async () => {
    setDropboxDisconnecting(true)
    await fetch('/api/dropbox/disconnect', { method: 'POST' })
    setDropboxStatus('disconnected')
    setDropboxDisconnecting(false)
  }

  return (
    <div>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '600', color: 'var(--text-primary)', letterSpacing: '-0.03em', marginBottom: '4px' }}>
          Configurações
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Gerencie as conexões com serviços externos
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '720px' }}>
        <ConnectionCard
          logo={
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="6" fill="#1877F2"/>
              <path d="M22 16C22 12.686 19.314 10 16 10C12.686 10 10 12.686 10 16C10 18.994 12.024 21.516 14.75 22.258V18H13V16H14.75V14.5C14.75 12.776 15.776 11.75 17.35 11.75C18.104 11.75 18.875 11.875 18.875 11.875V13.562H18.023C17.186 13.562 16.938 14.063 16.938 14.578V16H18.8L18.513 18H16.938V22.258C19.664 21.516 22 18.994 22 16Z" fill="white"/>
            </svg>
          }
          name="Meta (Facebook Ads)"
          description="Necessário para puxar métricas das campanhas e criativos"
          status={metaStatus}
          onConnect={handleMetaConnect}
          onDisconnect={handleMetaDisconnect}
          connecting={false}
          disconnecting={metaDisconnecting}
        />

        <ConnectionCard
          logo={
            <svg width="28" height="28" viewBox="0 0 40 40" fill="none">
              <path d="M10 4L20 10.5L10 17L0 10.5L10 4Z" fill="#0061FF"/>
              <path d="M30 4L40 10.5L30 17L20 10.5L30 4Z" fill="#0061FF"/>
              <path d="M0 23.5L10 17L20 23.5L10 30L0 23.5Z" fill="#0061FF"/>
              <path d="M20 23.5L30 17L40 23.5L30 30L20 23.5Z" fill="#0061FF"/>
              <path d="M10 31.5L20 25L30 31.5L20 38L10 31.5Z" fill="#0061FF"/>
            </svg>
          }
          name="Dropbox"
          description="Usado para vincular vídeos dos criativos automaticamente"
          status={dropboxStatus}
          onConnect={handleDropboxConnect}
          onDisconnect={handleDropboxDisconnect}
          connecting={false}
          disconnecting={dropboxDisconnecting}
        />
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
