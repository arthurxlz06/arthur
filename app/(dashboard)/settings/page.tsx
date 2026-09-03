'use client'

import { useEffect, useState } from 'react'
import { Check, AlertCircle, Loader, Plus, Trash2, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'

type Status = 'loading' | 'connected' | 'disconnected'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface AdAccount {
  id: string
  meta_account_id: string
  name: string
  status: 'active' | 'disabled'
  is_selected: boolean
}
interface BmConnected {
  id: string
  meta_bm_id: string
  name: string
  ad_accounts: AdAccount[]
}
interface BmAvailable {
  id: string
  name: string
  is_connected: boolean
}

// ─── ConnectionCard ───────────────────────────────────────────────────────────

function ConnectionCard({ logo, name, description, status, daysLeft, onConnect, onDisconnect, connecting, disconnecting }: {
  logo: React.ReactNode; name: string; description: string; status: Status; daysLeft?: number | null
  onConnect: () => void; onDisconnect: () => void; connecting: boolean; disconnecting: boolean
}) {
  const expiring = daysLeft !== null && daysLeft !== undefined && daysLeft <= 14
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: '200px' }}>
        <div style={{ flexShrink: 0 }}>{logo}</div>
        <div>
          <p style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '3px' }}>{name}</p>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{description}</p>
          {status === 'connected' && daysLeft !== null && daysLeft !== undefined && (
            <p style={{ fontSize: '12px', color: expiring ? 'var(--status-warning, #f59e0b)' : 'var(--text-muted)', marginTop: '2px' }}>
              {expiring ? `Token expira em ${daysLeft} dia${daysLeft !== 1 ? 's' : ''} — reconecte em breve` : `Token válido por ~${daysLeft} dias`}
            </p>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
        {status === 'loading' && <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-muted)' }}><Loader size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> Verificando...</span>}
        {status === 'connected' && (
          <>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: 'var(--status-success)', fontWeight: '500' }}><Check size={14} /> Conectado</span>
            <button onClick={onDisconnect} disabled={disconnecting} style={{ padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.06)', color: 'var(--status-error)', cursor: disconnecting ? 'wait' : 'pointer', fontSize: '13px', fontWeight: '500', opacity: disconnecting ? 0.6 : 1 }}>
              {disconnecting ? 'Desconectando...' : 'Desconectar'}
            </button>
          </>
        )}
        {status === 'disconnected' && (
          <>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: 'var(--text-muted)' }}><AlertCircle size={14} /> Não conectado</span>
            <button onClick={onConnect} disabled={connecting} style={{ padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--accent)', color: 'white', cursor: connecting ? 'wait' : 'pointer', fontSize: '13px', fontWeight: '500', opacity: connecting ? 0.7 : 1 }}>
              {connecting ? 'Conectando...' : 'Conectar'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── BmAccountSection ─────────────────────────────────────────────────────────

function BmAccountSection() {
  const [connected, setConnected] = useState<BmConnected[]>([])
  const [available, setAvailable] = useState<BmAvailable[]>([])
  const [showPicker, setShowPicker] = useState(false)
  const [loadingAvail, setLoadingAvail] = useState(false)
  const [loadingBm, setLoadingBm] = useState<string | null>(null)
  const [syncingBm, setSyncingBm] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<string | null>(null)

  const notify = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const fetchConnected = () =>
    fetch(`/api/facebook/accounts?_=${Date.now()}`, { cache: 'no-store' }).then(r => r.json()).then(d => setConnected(d.bms ?? []))

  useEffect(() => { fetchConnected() }, [])

  const [bmError, setBmError] = useState<string | null>(null)

  const openPicker = async () => {
    setShowPicker(true); setLoadingAvail(true); setBmError(null)
    const d = await fetch('/api/facebook/businesses').then(r => r.json())
    if (d.error) setBmError(d.error)
    setAvailable(d.businesses ?? [])
    setLoadingAvail(false)
  }

  const addBm = async (bm: BmAvailable) => {
    setLoadingBm(bm.id)
    const r = await fetch('/api/facebook/businesses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bm_id: bm.id, bm_name: bm.name }) })
    const d = await r.json()
    if (d.error) { notify('Erro: ' + d.error) } else {
      notify(`BM "${bm.name}" adicionada — ${d.accounts_imported} conta(s) importada(s)`)
      setShowPicker(false)
      fetchConnected()
      setExpanded(e => { const n = new Set(e); n.add(bm.id); return n })
    }
    setLoadingBm(null)
  }

  const removeBm = async (bm: BmConnected) => {
    if (!confirm(`Remover "${bm.name}"?`)) return
    await fetch('/api/facebook/businesses', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bm_id: bm.meta_bm_id }) })
    fetchConnected()
  }

  const toggleAccount = async (acc: AdAccount) => {
    await fetch('/api/facebook/accounts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ account_id: acc.id, is_selected: !acc.is_selected }) })
    fetchConnected()
  }

  const toggleExpand = (id: string) =>
    setExpanded(e => { const n = new Set(e); if (n.has(id)) { n.delete(id) } else { n.add(id) } return n })

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', padding: '20px 24px' }}>
      {toast && <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 300, padding: '10px 16px', borderRadius: 'var(--radius-sm)', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: 'var(--status-success)', fontSize: '13px', fontWeight: '500' }}>{toast}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: connected.length > 0 ? '16px' : '0' }}>
        <div>
          <p style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '3px' }}>Business Managers e Contas de Anúncio</p>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Selecione quais contas o bot vai usar</p>
        </div>
        <button onClick={openPicker} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--accent)', color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: '500', flexShrink: 0 }}>
          <Plus size={14} /> Adicionar BM
        </button>
      </div>

      {/* Picker de BMs disponíveis */}
      {showPicker && (
        <div style={{ marginBottom: '16px', padding: '14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--bg-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>Suas Business Managers</p>
            <button onClick={() => setShowPicker(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '18px', lineHeight: 1 }}>×</button>
          </div>
          {loadingAvail ? (
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Carregando...</p>
          ) : bmError ? (
            <p style={{ fontSize: '13px', color: 'var(--status-error)' }}>Erro: {bmError}</p>
          ) : available.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Nenhuma conta encontrada. Tente reconectar o Meta.</p>
          ) : available.map(bm => (
            <div key={bm.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--bg-border)' }}>
              <div>
                <p style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '500' }}>{bm.name}</p>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ID: {bm.id}</p>
              </div>
              {bm.is_connected ? (
                <span style={{ fontSize: '12px', color: 'var(--status-success)' }}>✓ Adicionada</span>
              ) : (
                <button onClick={() => addBm(bm)} disabled={loadingBm === bm.id} style={{ padding: '5px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--accent)', color: 'white', cursor: 'pointer', fontSize: '12px', opacity: loadingBm === bm.id ? 0.6 : 1 }}>
                  {loadingBm === bm.id ? 'Importando...' : 'Adicionar'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* BMs conectadas */}
      {connected.length === 0 ? (
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: connected.length === 0 && !showPicker ? '12px' : '0' }}>
          Nenhuma BM adicionada ainda. Clique em &quot;Adicionar BM&quot; para começar.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {connected.map(bm => {
            const isOpen = expanded.has(bm.meta_bm_id)
            const selectedCount = bm.ad_accounts.filter(a => a.is_selected).length
            return (
              <div key={bm.id} style={{ border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                {/* Header da BM */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--bg-elevated)', cursor: 'pointer' }} onClick={() => toggleExpand(bm.meta_bm_id)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {isOpen ? <ChevronUp size={14} color="var(--text-muted)" /> : <ChevronDown size={14} color="var(--text-muted)" />}
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{bm.name}</p>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{bm.ad_accounts.length} conta(s){selectedCount > 0 ? ` · ${selectedCount} selecionada(s)` : ''}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }} onClick={e => e.stopPropagation()}>
                    <button onClick={async () => {
                      setSyncingBm(bm.meta_bm_id)
                      await fetch('/api/facebook/businesses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bm_id: bm.meta_bm_id, bm_name: bm.name }) })
                      await fetchConnected()
                      setSyncingBm(null)
                      notify('Contas atualizadas')
                    }} title="Atualizar contas" disabled={syncingBm === bm.meta_bm_id} style={{ background: 'none', border: 'none', cursor: syncingBm === bm.meta_bm_id ? 'wait' : 'pointer', padding: '4px', color: 'var(--text-muted)', opacity: syncingBm === bm.meta_bm_id ? 0.5 : 1 }}>
                      <RefreshCw size={13} style={{ animation: syncingBm === bm.meta_bm_id ? 'spin .7s linear infinite' : 'none' }} />
                    </button>
                    <button onClick={() => removeBm(bm)} title="Remover BM" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--status-error)' }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Contas da BM */}
                {isOpen && (
                  <div>
                    {bm.ad_accounts.length === 0 ? (
                      <p style={{ padding: '12px 14px', fontSize: '12px', color: 'var(--text-muted)' }}>Nenhuma conta de anúncio encontrada nessa BM.</p>
                    ) : bm.ad_accounts.map(acc => (
                      <label key={acc.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 14px', borderTop: '1px solid var(--bg-border)', cursor: 'pointer', background: acc.is_selected ? 'rgba(91,110,245,0.04)' : 'transparent' }}>
                        <input type="checkbox" checked={acc.is_selected} onChange={() => toggleAccount(acc)}
                          style={{ width: '15px', height: '15px', accentColor: 'var(--accent)', cursor: 'pointer', flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: '13px', color: acc.is_selected ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: acc.is_selected ? '500' : '400' }}>{acc.name}</p>
                          <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{acc.meta_account_id}</p>
                        </div>
                        <span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '10px', background: acc.status === 'active' ? 'rgba(34,197,94,0.1)' : 'rgba(100,100,100,0.1)', color: acc.status === 'active' ? 'var(--status-success)' : 'var(--text-muted)' }}>
                          {acc.status === 'active' ? 'Ativa' : 'Pausada'}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [metaStatus, setMetaStatus] = useState<Status>('loading')
  const [metaDaysLeft, setMetaDaysLeft] = useState<number | null>(null)
  const [dropboxStatus, setDropboxStatus] = useState<Status>('loading')
  const [metaDisconnecting, setMetaDisconnecting] = useState(false)
  const [dropboxDisconnecting, setDropboxDisconnecting] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  const showToast = (msg: string, ok: boolean) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 4000) }

  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const metaConnected = p.get('meta_connected') === '1'
    const metaError = p.get('meta_error')
    const dropboxParam = p.get('dropbox')

    if (metaConnected) {
      setMetaStatus('connected')
      showToast('Meta conectado com sucesso!', true)
    } else if (metaError) {
      setMetaStatus('disconnected')
      showToast('Erro ao conectar Meta: ' + decodeURIComponent(metaError), false)
    }
    if (dropboxParam === 'connected') {
      setDropboxStatus('connected')
      showToast('Dropbox conectado com sucesso!', true)
    } else if (dropboxParam === 'error') {
      setDropboxStatus('disconnected')
      showToast('Erro ao conectar o Dropbox. Tente novamente.', false)
    }
    if (metaConnected || metaError || dropboxParam) {
      window.history.replaceState({}, '', '/settings')
    }

    // Só busca status da API se não há parâmetro de URL (evita race condition)
    if (!metaConnected && !metaError) {
      fetch('/api/meta/status').then(r => r.json()).then((d: { connected?: boolean; days_left?: number | null }) => {
        setMetaStatus(d.connected ? 'connected' : 'disconnected')
        setMetaDaysLeft(d.days_left ?? null)
      }).catch(() => setMetaStatus('disconnected'))
    }
    if (!dropboxParam) {
      fetch('/api/dropbox/status').then(r => r.json()).then((d: { connected?: boolean }) => setDropboxStatus(d.connected ? 'connected' : 'disconnected')).catch(() => setDropboxStatus('disconnected'))
    }
  }, [])

  const handleMetaDisconnect = async () => {
    setMetaDisconnecting(true)
    await fetch('/api/meta/disconnect', { method: 'POST' })
    setMetaStatus('disconnected')
    setMetaDisconnecting(false)
  }

  return (
    <div>
      {toast && (
        <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 200, padding: '12px 18px', borderRadius: 'var(--radius-md)', background: toast.ok ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', border: `1px solid ${toast.ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, color: toast.ok ? 'var(--status-success)' : 'var(--status-error)', fontSize: '13px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {toast.ok ? <Check size={14} /> : <AlertCircle size={14} />} {toast.msg}
        </div>
      )}

      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '600', color: 'var(--text-primary)', letterSpacing: '-0.03em', marginBottom: '4px' }}>Configurações</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Gerencie as conexões com serviços externos</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '720px' }}>
        <ConnectionCard
          logo={<svg width="28" height="28" viewBox="0 0 32 32" fill="none"><rect width="32" height="32" rx="6" fill="#1877F2"/><path d="M22 16C22 12.686 19.314 10 16 10C12.686 10 10 12.686 10 16C10 18.994 12.024 21.516 14.75 22.258V18H13V16H14.75V14.5C14.75 12.776 15.776 11.75 17.35 11.75C18.104 11.75 18.875 11.875 18.875 11.875V13.562H18.023C17.186 13.562 16.938 14.063 16.938 14.578V16H18.8L18.513 18H16.938V22.258C19.664 21.516 22 18.994 22 16Z" fill="white"/></svg>}
          name="Meta (Facebook Ads)"
          description="Necessário para puxar métricas das campanhas e criativos"
          status={metaStatus}
          daysLeft={metaDaysLeft}
          onConnect={() => { window.location.href = '/api/meta/oauth' }}
          onDisconnect={handleMetaDisconnect}
          connecting={false}
          disconnecting={metaDisconnecting}
        />

        {/* Seleção de BM e contas — aparece só quando Meta está conectado */}
        {metaStatus === 'connected' && <BmAccountSection />}

        <ConnectionCard
          logo={<svg width="28" height="28" viewBox="0 0 40 40" fill="none"><path d="M10 4L20 10.5L10 17L0 10.5L10 4Z" fill="#0061FF"/><path d="M30 4L40 10.5L30 17L20 10.5L30 4Z" fill="#0061FF"/><path d="M0 23.5L10 17L20 23.5L10 30L0 23.5Z" fill="#0061FF"/><path d="M20 23.5L30 17L40 23.5L30 30L20 23.5Z" fill="#0061FF"/><path d="M10 31.5L20 25L30 31.5L20 38L10 31.5Z" fill="#0061FF"/></svg>}
          name="Dropbox"
          description="Usado para vincular vídeos dos criativos automaticamente"
          status={dropboxStatus}
          onConnect={() => { window.location.href = '/api/dropbox/auth' }}
          onDisconnect={async () => { setDropboxDisconnecting(true); await fetch('/api/dropbox/disconnect', { method: 'POST' }); setDropboxStatus('disconnected'); setDropboxDisconnecting(false) }}
          connecting={false}
          disconnecting={dropboxDisconnecting}
        />
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
