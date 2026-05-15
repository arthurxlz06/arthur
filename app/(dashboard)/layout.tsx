'use client'

import { useSession, signOut } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  LayoutDashboard,
  FolderOpen,
  Radio,
  History,
  Settings,
  SlidersHorizontal,
  LogOut,
  Zap,
  Menu,
  X,
  PlaySquare,
  Archive,
} from 'lucide-react'

const activeItems = [
  { href: '/creatives', icon: PlaySquare, label: 'Criativos' },
  { href: '/settings', icon: SlidersHorizontal, label: 'Configurações' },
]

const archivedItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/accounts', icon: Settings, label: 'Contas' },
  { href: '/library', icon: FolderOpen, label: 'Biblioteca' },
  { href: '/publish', icon: Radio, label: 'Publicar' },
  { href: '/history', icon: History, label: 'Histórico' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const [isMobile, setIsMobile] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(archivedItems.some((n) => n.href === pathname))

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  if (status === 'loading') {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'var(--bg-base)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: '24px',
            height: '24px',
            border: '2px solid var(--bg-border)',
            borderTopColor: 'var(--accent)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base)' }}>
      {/* Mobile top bar */}
      {isMobile && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            height: '52px',
            background: 'var(--bg-surface)',
            borderBottom: '1px solid var(--bg-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
            zIndex: 50,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '6px',
                background: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Zap size={12} color="white" />
            </div>
            <span
              style={{
                fontSize: '14px',
                fontWeight: '700',
                color: 'var(--text-primary)',
                letterSpacing: '-0.03em',
              }}
            >
              68Prêmios
            </span>
          </div>
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              display: 'flex',
              padding: '4px',
            }}
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      )}

      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.65)',
            zIndex: 35,
            backdropFilter: 'blur(2px)',
          }}
        />
      )}

      {/* Sidebar */}
      <aside
        style={{
          width: '240px',
          flexShrink: 0,
          background: 'var(--bg-surface)',
          borderRight: '1px solid var(--bg-border)',
          display: 'flex',
          flexDirection: 'column',
          padding: '24px 0',
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          zIndex: 40,
          transform: isMobile && !sidebarOpen ? 'translateX(-100%)' : 'translateX(0)',
          transition: 'transform 250ms ease',
        }}
      >
        {/* Logo */}
        <div style={{ padding: '0 20px 24px', borderBottom: '1px solid var(--bg-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '7px',
                background: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Zap size={14} color="white" />
            </div>
            <span
              style={{
                fontSize: '15px',
                fontWeight: '700',
                color: 'var(--text-primary)',
                letterSpacing: '-0.03em',
              }}
            >
              68Prêmios
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '16px 12px', overflowY: 'auto' }}>
          {/* Active pages */}
          {activeItems.map(({ href, icon: Icon, label }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '9px 10px', borderRadius: 'var(--radius-sm)', marginBottom: '2px',
                  color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                  background: active ? 'var(--bg-elevated)' : 'transparent',
                  textDecoration: 'none', fontSize: '14px',
                  fontWeight: active ? '500' : '400', transition: 'all 200ms ease',
                }}
              >
                <Icon size={16} />
                {label}
              </Link>
            )
          })}

          {/* Archived group */}
          <div style={{ marginTop: '12px' }}>
            <button
              onClick={() => setArchiveOpen((v) => !v)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                padding: '6px 10px', borderRadius: 'var(--radius-sm)',
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', fontSize: '11px', fontWeight: '600',
                letterSpacing: '0.06em', textTransform: 'uppercase',
                marginBottom: '2px', transition: 'color 150ms',
              }}
            >
              <Archive size={12} />
              <span style={{ flex: 1, textAlign: 'left' }}>Arquivado</span>
              <span style={{ fontSize: '10px', transition: 'transform 200ms', display: 'inline-block', transform: archiveOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
            </button>

            {archiveOpen && archivedItems.map(({ href, icon: Icon, label }) => {
              const active = pathname === href
              return (
                <Link
                  key={href}
                  href={href}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '8px 10px 8px 28px', borderRadius: 'var(--radius-sm)', marginBottom: '2px',
                    color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                    background: active ? 'var(--bg-elevated)' : 'transparent',
                    textDecoration: 'none', fontSize: '13px',
                    fontWeight: active ? '500' : '400', transition: 'all 200ms ease',
                  }}
                >
                  <Icon size={14} />
                  {label}
                </Link>
              )
            })}
          </div>
        </nav>

        {/* User + Logout */}
        <div style={{ padding: '16px 12px', borderTop: '1px solid var(--bg-border)' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 10px',
              marginBottom: '4px',
            }}
          >
            {session?.user?.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={session.user.image}
                alt=""
                style={{ width: '28px', height: '28px', borderRadius: '50%' }}
              />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  fontSize: '13px',
                  fontWeight: '500',
                  color: 'var(--text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {session?.user?.name}
              </p>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '9px 10px',
              borderRadius: 'var(--radius-sm)',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '14px',
              transition: 'all 200ms ease',
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLElement).style.color = 'var(--status-error)'
              ;(e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.08)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'
              ;(e.currentTarget as HTMLElement).style.background = 'transparent'
            }}
          >
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main
        style={{
          flex: 1,
          minWidth: 0,
          marginLeft: isMobile ? '0' : '240px',
          padding: isMobile ? '68px 16px 24px' : '32px',
          minHeight: '100vh',
        }}
      >
        {children}
      </main>
    </div>
  )
}
