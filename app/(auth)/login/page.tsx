'use client'

import { signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function LoginPage() {
  const { status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/dashboard')
    }
  }, [status, router])

  const handleLogin = async () => {
    setLoading(true)
    await signIn('facebook', { callbackUrl: '/dashboard' })
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-base)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background glow */}
      <div
        style={{
          position: 'absolute',
          width: '600px',
          height: '600px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(91,110,245,0.08) 0%, transparent 70%)',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
        }}
      />

      {/* Login card */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--bg-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '48px',
          width: '100%',
          maxWidth: '420px',
          position: 'relative',
          boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
        }}
      >
        {/* Logo */}
        <div style={{ marginBottom: '40px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '8px',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M2 4L8 1L14 4V8C14 11.5 11 14 8 15C5 14 2 11.5 2 8V4Z"
                  stroke="white"
                  strokeWidth="1.5"
                  fill="none"
                />
                <path
                  d="M6 8L7.5 9.5L10.5 6.5"
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span
              style={{
                fontSize: '18px',
                fontWeight: '700',
                color: 'var(--text-primary)',
                letterSpacing: '-0.03em',
              }}
            >
              AdUploader
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            Plataforma de publicação de anúncios
          </p>
        </div>

        {/* Heading */}
        <div style={{ marginBottom: '32px' }}>
          <h1
            style={{
              fontSize: '24px',
              fontWeight: '600',
              color: 'var(--text-primary)',
              marginBottom: '8px',
              letterSpacing: '-0.03em',
            }}
          >
            Bem-vindo
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.5' }}>
            Conecte sua conta do Facebook para acessar suas contas de anúncio e começar a publicar.
          </p>
        </div>

        {/* Facebook button */}
        <button
          onClick={handleLogin}
          disabled={loading || status === 'loading'}
          style={{
            width: '100%',
            padding: '14px 20px',
            borderRadius: 'var(--radius-md)',
            background: loading ? 'var(--bg-elevated)' : 'var(--accent)',
            color: '#FFFFFF',
            border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '15px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            transition: 'all 200ms ease',
            letterSpacing: '-0.01em',
          }}
          onMouseEnter={(e) => {
            if (!loading) (e.currentTarget as HTMLElement).style.background = 'var(--accent-hover)'
          }}
          onMouseLeave={(e) => {
            if (!loading) (e.currentTarget as HTMLElement).style.background = 'var(--accent)'
          }}
        >
          {loading ? (
            <>
              <span
                style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: 'white',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                  display: 'inline-block',
                }}
              />
              Conectando...
            </>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              Entrar com Facebook
            </>
          )}
        </button>

        {/* Required permissions */}
        <div
          style={{
            marginTop: '24px',
            padding: '16px',
            background: 'var(--bg-elevated)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--bg-border)',
          }}
        >
          <p
            style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              marginBottom: '8px',
              fontWeight: '500',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Permissões solicitadas
          </p>
          {[
            'Gerenciar anúncios (ads_management)',
            'Ler dados de anúncios (ads_read)',
            'Gerenciar Business Managers',
          ].map((perm) => (
            <div
              key={perm}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginTop: '6px',
              }}
            >
              <div
                style={{
                  width: '4px',
                  height: '4px',
                  borderRadius: '50%',
                  background: 'var(--accent)',
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{perm}</span>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
