'use client'

import { useEffect, useState } from 'react'
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react'

interface AdAccount {
  id: string
  meta_account_id: string
  name: string
  status: string
  is_selected: boolean
}

interface BM {
  id: string
  meta_bm_id: string
  name: string
  ad_accounts: AdAccount[]
}

interface AvailableBM {
  id: string
  name: string
  is_connected: boolean
}

export default function AccountsPage() {
  const [bms, setBms] = useState<BM[]>([])
  const [availableBMs, setAvailableBMs] = useState<AvailableBM[]>([])
  const [expandedBMs, setExpandedBMs] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [showConnectModal, setShowConnectModal] = useState(false)
  const [connectingBM, setConnectingBM] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    const [accountsRes, bmsRes] = await Promise.all([
      fetch('/api/facebook/accounts'),
      fetch('/api/facebook/businesses'),
    ])
    const accountsData = await accountsRes.json()
    const bmsData = await bmsRes.json()
    setBms(accountsData.bms ?? [])
    setAvailableBMs(bmsData.businesses ?? [])
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  const toggleBMExpand = (id: string) => {
    setExpandedBMs((prev) => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  const toggleAccount = async (accountId: string, current: boolean) => {
    await fetch('/api/facebook/accounts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_id: accountId, is_selected: !current }),
    })
    setBms((prev) =>
      prev.map((bm) => ({
        ...bm,
        ad_accounts: bm.ad_accounts.map((acc) =>
          acc.id === accountId ? { ...acc, is_selected: !current } : acc
        ),
      }))
    )
  }

  const connectBM = async (bmId: string, bmName: string) => {
    setConnectingBM(bmId)
    await fetch('/api/facebook/businesses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bm_id: bmId, bm_name: bmName }),
    })
    await fetchData()
    setConnectingBM(null)
    setShowConnectModal(false)
  }

  const disconnectBM = async (bmId: string) => {
    await fetch('/api/facebook/businesses', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bm_id: bmId }),
    })
    await fetchData()
  }

  const totalSelected = bms.reduce(
    (sum, bm) => sum + bm.ad_accounts.filter((a) => a.is_selected).length,
    0
  )
  const totalAccounts = bms.reduce((sum, bm) => sum + bm.ad_accounts.length, 0)

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: '32px',
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
            Contas de Anúncio
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            {totalSelected} de {totalAccounts} contas ativas para publicação
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={fetchData}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 14px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-surface)',
              border: '1px solid var(--bg-border)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '13px',
              transition: 'all 200ms ease',
            }}
          >
            <RefreshCw size={14} /> Atualizar
          </button>
          <button
            onClick={() => setShowConnectModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 14px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--accent)',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '500',
              transition: 'all 200ms ease',
            }}
          >
            <Plus size={14} /> Conectar BM
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: 'var(--text-secondary)',
            fontSize: '14px',
          }}
        >
          <div
            style={{
              width: '16px',
              height: '16px',
              border: '2px solid var(--bg-border)',
              borderTopColor: 'var(--accent)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          Carregando contas...
        </div>
      )}

      {/* Empty state */}
      {!loading && bms.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: '64px 32px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--bg-border)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <Building2 size={32} color="var(--text-muted)" style={{ margin: '0 auto 16px' }} />
          <p
            style={{
              color: 'var(--text-secondary)',
              fontSize: '15px',
              marginBottom: '8px',
            }}
          >
            Nenhuma Business Manager conectada
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            Clique em &ldquo;Conectar BM&rdquo; para começar
          </p>
        </div>
      )}

      {/* BM list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {bms.map((bm) => {
          const isExpanded = expandedBMs.has(bm.id)
          const selectedCount = bm.ad_accounts.filter((a) => a.is_selected).length
          return (
            <div
              key={bm.id}
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--bg-border)',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
              }}
            >
              {/* BM header row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px 20px',
                  cursor: 'pointer',
                }}
                onClick={() => toggleBMExpand(bm.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {isExpanded ? (
                    <ChevronDown size={16} color="var(--text-muted)" />
                  ) : (
                    <ChevronRight size={16} color="var(--text-muted)" />
                  )}
                  <Building2 size={16} color="var(--accent)" />
                  <div>
                    <p
                      style={{
                        fontSize: '14px',
                        fontWeight: '500',
                        color: 'var(--text-primary)',
                      }}
                    >
                      {bm.name}
                    </p>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {selectedCount} de {bm.ad_accounts.length} contas ativas
                    </p>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    disconnectBM(bm.meta_bm_id)
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 10px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'transparent',
                    border: '1px solid transparent',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '12px',
                    transition: 'all 200ms ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--status-error)'
                    e.currentTarget.style.borderColor = 'rgba(239,68,68,0.2)'
                    e.currentTarget.style.background = 'rgba(239,68,68,0.08)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--text-muted)'
                    e.currentTarget.style.borderColor = 'transparent'
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <Trash2 size={12} /> Remover
                </button>
              </div>

              {/* Ad accounts list */}
              {isExpanded && (
                <div style={{ borderTop: '1px solid var(--bg-border)' }}>
                  {bm.ad_accounts.length === 0 && (
                    <p
                      style={{
                        padding: '20px',
                        color: 'var(--text-muted)',
                        fontSize: '13px',
                        textAlign: 'center',
                      }}
                    >
                      Nenhuma conta de anúncio encontrada nesta BM
                    </p>
                  )}
                  {bm.ad_accounts.map((acc, i) => (
                    <div
                      key={acc.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 20px 12px 48px',
                        borderBottom:
                          i < bm.ad_accounts.length - 1
                            ? '1px solid var(--bg-border)'
                            : 'none',
                        background: acc.is_selected
                          ? 'rgba(91,110,245,0.04)'
                          : 'transparent',
                        transition: 'background 200ms ease',
                      }}
                    >
                      <div>
                        <p
                          style={{
                            fontSize: '13px',
                            fontWeight: '500',
                            color: 'var(--text-primary)',
                          }}
                        >
                          {acc.name}
                        </p>
                        <p
                          style={{
                            fontSize: '11px',
                            color: 'var(--text-muted)',
                            fontFamily: 'monospace',
                          }}
                        >
                          {acc.meta_account_id}
                        </p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background:
                              acc.status === 'active'
                                ? 'rgba(34,197,94,0.1)'
                                : 'rgba(239,68,68,0.1)',
                            color:
                              acc.status === 'active'
                                ? 'var(--status-success)'
                                : 'var(--status-error)',
                          }}
                        >
                          {acc.status === 'active' ? 'Ativa' : 'Inativa'}
                        </span>
                        <button
                          onClick={() => toggleAccount(acc.id, acc.is_selected)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          {acc.is_selected ? (
                            <ToggleRight size={24} color="var(--accent)" />
                          ) : (
                            <ToggleLeft size={24} color="var(--text-muted)" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Connect BM modal */}
      {showConnectModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setShowConnectModal(false)}
        >
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--bg-border)',
              borderRadius: 'var(--radius-lg)',
              padding: '24px',
              width: '480px',
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              style={{
                fontSize: '17px',
                fontWeight: '600',
                color: 'var(--text-primary)',
                marginBottom: '16px',
                letterSpacing: '-0.02em',
              }}
            >
              Conectar Business Manager
            </h2>
            {availableBMs.filter((bm) => !bm.is_connected).length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                Todas as BMs disponíveis já estão conectadas.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {availableBMs
                  .filter((bm) => !bm.is_connected)
                  .map((bm) => (
                    <div
                      key={bm.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '14px 16px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--bg-border)',
                        background: 'var(--bg-elevated)',
                      }}
                    >
                      <div>
                        <p
                          style={{
                            fontSize: '14px',
                            fontWeight: '500',
                            color: 'var(--text-primary)',
                          }}
                        >
                          {bm.name}
                        </p>
                        <p
                          style={{
                            fontSize: '11px',
                            color: 'var(--text-muted)',
                            fontFamily: 'monospace',
                          }}
                        >
                          {bm.id}
                        </p>
                      </div>
                      <button
                        onClick={() => connectBM(bm.id, bm.name)}
                        disabled={connectingBM === bm.id}
                        style={{
                          padding: '7px 14px',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--accent)',
                          border: 'none',
                          color: 'white',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: '500',
                          opacity: connectingBM === bm.id ? 0.6 : 1,
                        }}
                      >
                        {connectingBM === bm.id ? 'Conectando...' : 'Conectar'}
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
