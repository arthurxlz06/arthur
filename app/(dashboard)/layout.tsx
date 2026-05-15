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

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', archived: true },
  { href: '/accounts', icon: Settings, label: 'Contas', archived: true },
  { href: '/library', icon: FolderOpen, label: 'Biblioteca', archived: true },
  { href: '/publish', icon: Radio, label: 'Publicar', archived: true },
  { href: '/history', icon: History, label: 'Histórico', archived: true },
  { href: '/creatives', icon: PlaySquare, label: 'Criativos', archived: false },
  { href: '/settings', icon: SlidersHorizontal, label: 'Configurações', archived: false },
]

const archivedRoutes = navItems.filter((n) => n.archived).map((n) => n.href)

function ComingSoon({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '16px', textAlign: 'center' }}>
      <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Archive size={22} color="var(--text-muted)" />
      </div>
      <div>
        <p style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 6px' }}>{label}</p>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>Esta seção está arquivada e será disponibilizada em breve.</p>
      </div>
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const [isMobile, setIsMobile] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

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
              AdUploader
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
              AdUploader
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '16px 12px' }}>
          {navItems.map(({ href, icon: Icon, label, archived }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '9px 10px',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: '2px',
                  color: active ? 'var(--text-primary)' : archived ? 'var(--text-muted)' : 'var(--text-secondary)',
                  background: active ? 'var(--bg-elevated)' : 'transparent',
                  textDecoration: 'none',
                  fontSize: '14px',
                  fontWeight: active ? '500' : '400',
                  transition: 'all 200ms ease',
                  opacity: archived ? 0.55 : 1,
                }}
              >
                <Icon size={16} />
                <span style={{ flex: 1 }}>{label}</span>
                {archived && (
                  <span style={{ fontSize: '9px', fontWeight: '600', color: 'var(--text-muted)', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', padding: '1px 5px', borderRadius: '4px', letterSpacing: '0.04em' }}>
                    EM BREVE
                  </span>
                )}
              </Link>
            )
          })}
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
        {archivedRoutes.includes(pathname ?? '')
          ? <ComingSoon label={navItems.find((n) => n.href === pathname)?.label ?? ''} />
          : children}
      </main>
    </div>
  )
}
