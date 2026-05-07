'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import {
  Folder as FolderIcon,
  Film,
  Building2,
  ChevronRight,
  ChevronLeft,
  Rocket,
  Check,
  X,
  AlertCircle,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Video {
  id: string
  filename: string
  order_number: number | null
  size_bytes: number | null
  import_status: string
}

interface FolderData {
  id: string
  name: string
  videos: Video[]
}

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

interface JobVideo {
  filename: string
  order_number: number | null
}

interface JobAccount {
  name: string
  meta_account_id: string
}

interface PublishJob {
  id: string
  status: string
  meta_video_id: string | null
  error_message: string | null
  queued_at: string
  finished_at: string | null
  videos: JobVideo | null
  ad_accounts: JobAccount | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ORPHAN = '__orphan__'

function formatSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: 'Na fila',
    processing: 'Processando...',
    done: 'Concluído',
    failed: 'Falhou',
  }
  return map[status] ?? status
}

function statusColor(status: string): string {
  if (status === 'done') return 'var(--status-success)'
  if (status === 'failed') return 'var(--status-error)'
  if (status === 'processing') return 'var(--status-warning)'
  return 'var(--accent)'
}

function Spinner({ size = 14, color = 'var(--status-warning)' }: { size?: number; color?: string }) {
  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        border: `2px solid transparent`,
        borderTopColor: color,
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
        flexShrink: 0,
      }}
    />
  )
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'done') return <Check size={14} color="var(--status-success)" strokeWidth={2.5} />
  if (status === 'failed') return <X size={14} color="var(--status-error)" strokeWidth={2.5} />
  if (status === 'processing') return <Spinner size={14} color="var(--status-warning)" />
  return (
    <div
      style={{
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: 'var(--accent)',
        flexShrink: 0,
      }}
    />
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function PublishPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1)

  // Step 1
  const [folders, setFolders] = useState<FolderData[]>([])
  const [orphanVideos, setOrphanVideos] = useState<Video[]>([])
  const [loadingLibrary, setLoadingLibrary] = useState(true)
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)

  // Step 2
  const [bms, setBms] = useState<BM[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set())
  const [expandedBMs, setExpandedBMs] = useState<Set<string>>(new Set())

  // Step 3
  const [jobs, setJobs] = useState<PublishJob[]>([])
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState('')
  const [totalCreated, setTotalCreated] = useState(0)

  const mountedRef = useRef(true)
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (pollingRef.current) clearTimeout(pollingRef.current)
    }
  }, [])

  // Load library on mount
  useEffect(() => {
    fetch('/api/library')
      .then((r) => r.json())
      .then((data: { folders?: FolderData[]; orphanVideos?: Video[] }) => {
        setFolders(data.folders ?? [])
        setOrphanVideos(data.orphanVideos ?? [])
        setLoadingLibrary(false)
      })
  }, [])

  // Load accounts when entering step 2
  useEffect(() => {
    if (step !== 2 || bms.length > 0) return
    setLoadingAccounts(true)
    fetch('/api/facebook/accounts')
      .then((r) => r.json())
      .then((data: { bms?: BM[] }) => {
        const fetched = data.bms ?? []
        setBms(fetched)
        // Pre-select all is_selected accounts, expand all BMs
        const preSelected = new Set<string>()
        const allBMIds = new Set<string>()
        fetched.forEach((bm) => {
          allBMIds.add(bm.id)
          bm.ad_accounts
            .filter((a) => a.is_selected)
            .forEach((a) => preSelected.add(a.id))
        })
        setSelectedAccountIds(preSelected)
        setExpandedBMs(allBMIds)
        setLoadingAccounts(false)
      })
  }, [step, bms.length])

  // Poll job status in step 3
  const fetchJobs = useCallback(async () => {
    if (pollingRef.current) clearTimeout(pollingRef.current)
    const res = await fetch('/api/publish')
    const data = (await res.json()) as { jobs?: PublishJob[] }
    if (!mountedRef.current) return
    const fetched = data.jobs ?? []
    setJobs(fetched)
    const hasActive = fetched.some(
      (j) => j.status === 'pending' || j.status === 'processing'
    )
    if (hasActive) {
      pollingRef.current = setTimeout(fetchJobs, 5000)
    }
  }, [])

  useEffect(() => {
    if (step !== 3) return
    fetchJobs()
    return () => {
      if (pollingRef.current) clearTimeout(pollingRef.current)
    }
  }, [step, fetchJobs])

  // ── Computed ──────────────────────────────────────────────────────────────

  const readyVideos = ((): Video[] => {
    if (selectedFolderId === null) return []
    if (selectedFolderId === ORPHAN) {
      return [...orphanVideos]
        .filter((v) => v.import_status === 'ready')
        .sort((a, b) => (a.order_number ?? 0) - (b.order_number ?? 0))
    }
    const folder = folders.find((f) => f.id === selectedFolderId)
    return [...(folder?.videos ?? [])]
      .filter((v) => v.import_status === 'ready')
      .sort((a, b) => (a.order_number ?? 0) - (b.order_number ?? 0))
  })()

  const selectedAccounts = bms
    .flatMap((bm) => bm.ad_accounts)
    .filter((a) => selectedAccountIds.has(a.id))

  const totalUploads = readyVideos.length * selectedAccounts.length

  // ── Actions ───────────────────────────────────────────────────────────────

  const toggleAccount = (id: string) => {
    setSelectedAccountIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleBMExpand = (id: string) => {
    setExpandedBMs((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handlePublish = async () => {
    setPublishing(true)
    setPublishError('')
    const folderId = selectedFolderId === ORPHAN ? null : selectedFolderId
    const res = await fetch('/api/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        folder_id: folderId,
        account_ids: Array.from(selectedAccountIds),
      }),
    })
    const data = (await res.json()) as {
      error?: string
      jobs_created?: number
    }
    if (data.error) {
      setPublishError(data.error)
      setPublishing(false)
      return
    }
    setTotalCreated(data.jobs_created ?? 0)
    setPublishing(false)
    setStep(3)
  }

  // ── Step indicators ───────────────────────────────────────────────────────

  const steps = ['Conteúdo', 'Contas', 'Fila']

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1
          style={{
            fontSize: '24px',
            fontWeight: '600',
            color: 'var(--text-primary)',
            letterSpacing: '-0.03em',
            marginBottom: '16px',
          }}
        >
          Publicar Anúncios
        </h1>

        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
          {steps.map((label, i) => {
            const num = i + 1
            const done = step > num
            const active = step === num
            return (
              <div key={label} style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: done
                        ? 'var(--status-success)'
                        : active
                        ? 'var(--accent)'
                        : 'var(--bg-border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {done ? (
                      <Check size={12} color="white" strokeWidth={2.5} />
                    ) : (
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: '600',
                          color: active ? 'white' : 'var(--text-muted)',
                        }}
                      >
                        {num}
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: '13px',
                      color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                      fontWeight: active ? '500' : '400',
                    }}
                  >
                    {label}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div
                    style={{
                      width: '32px',
                      height: '1px',
                      background: done ? 'var(--status-success)' : 'var(--bg-border)',
                      margin: '0 12px',
                    }}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── STEP 1: Select folder ── */}
      {step === 1 && (
        <div>
          <p
            style={{
              fontSize: '13px',
              fontWeight: '500',
              color: 'var(--text-secondary)',
              marginBottom: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
            }}
          >
            Selecione a pasta de vídeos
          </p>

          {loadingLibrary ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                color: 'var(--text-secondary)',
                fontSize: '14px',
                padding: '24px 0',
              }}
            >
              <Spinner size={16} color="var(--accent)" /> Carregando biblioteca...
            </div>
          ) : (
            <>
              {/* Folder grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                  gap: '10px',
                  marginBottom: '24px',
                }}
              >
                {folders.map((folder) => {
                  const readyCount = folder.videos.filter(
                    (v) => v.import_status === 'ready'
                  ).length
                  const active = selectedFolderId === folder.id
                  return (
                    <button
                      key={folder.id}
                      onClick={() => setSelectedFolderId(folder.id)}
                      disabled={readyCount === 0}
                      style={{
                        padding: '16px',
                        borderRadius: 'var(--radius-md)',
                        border: `2px solid ${active ? 'var(--accent)' : 'var(--bg-border)'}`,
                        background: active ? 'rgba(91,110,245,0.08)' : 'var(--bg-surface)',
                        cursor: readyCount === 0 ? 'not-allowed' : 'pointer',
                        opacity: readyCount === 0 ? 0.45 : 1,
                        textAlign: 'left',
                        transition: 'all 150ms ease',
                      }}
                    >
                      <FolderIcon
                        size={20}
                        color={active ? 'var(--accent)' : 'var(--text-muted)'}
                        style={{ marginBottom: '8px' }}
                      />
                      <p
                        style={{
                          fontSize: '13px',
                          fontWeight: '500',
                          color: 'var(--text-primary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          marginBottom: '2px',
                        }}
                        title={folder.name}
                      >
                        {folder.name}
                      </p>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {readyCount} vídeo{readyCount !== 1 ? 's' : ''} prontos
                      </p>
                    </button>
                  )
                })}

                {/* Orphan videos option */}
                {orphanVideos.filter((v) => v.import_status === 'ready').length > 0 && (
                  <button
                    onClick={() => setSelectedFolderId(ORPHAN)}
                    style={{
                      padding: '16px',
                      borderRadius: 'var(--radius-md)',
                      border: `2px solid ${selectedFolderId === ORPHAN ? 'var(--accent)' : 'var(--bg-border)'}`,
                      background:
                        selectedFolderId === ORPHAN
                          ? 'rgba(91,110,245,0.08)'
                          : 'var(--bg-surface)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 150ms ease',
                    }}
                  >
                    <Film
                      size={20}
                      color={selectedFolderId === ORPHAN ? 'var(--accent)' : 'var(--text-muted)'}
                      style={{ marginBottom: '8px' }}
                    />
                    <p
                      style={{
                        fontSize: '13px',
                        fontWeight: '500',
                        color: 'var(--text-primary)',
                        marginBottom: '2px',
                      }}
                    >
                      Sem pasta
                    </p>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {orphanVideos.filter((v) => v.import_status === 'ready').length} vídeos
                    </p>
                  </button>
                )}

                {folders.length === 0 &&
                  orphanVideos.filter((v) => v.import_status === 'ready').length === 0 && (
                    <div
                      style={{
                        gridColumn: '1 / -1',
                        padding: '40px',
                        textAlign: 'center',
                        color: 'var(--text-muted)',
                        fontSize: '14px',
                        background: 'var(--bg-surface)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--bg-border)',
                      }}
                    >
                      Nenhum vídeo pronto na biblioteca. Importe vídeos primeiro.
                    </div>
                  )}
              </div>

              {/* Video preview */}
              {readyVideos.length > 0 && (
                <div style={{ marginBottom: '28px' }}>
                  <p
                    style={{
                      fontSize: '13px',
                      fontWeight: '500',
                      color: 'var(--text-secondary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.07em',
                      marginBottom: '10px',
                    }}
                  >
                    Vídeos na ordem de publicação
                  </p>
                  <div
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--bg-border)',
                      borderRadius: 'var(--radius-md)',
                      overflow: 'hidden',
                    }}
                  >
                    {readyVideos.map((v, i) => (
                      <div
                        key={v.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '10px 16px',
                          borderBottom:
                            i < readyVideos.length - 1
                              ? '1px solid var(--bg-border)'
                              : 'none',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '12px',
                            fontWeight: '600',
                            color: 'var(--accent)',
                            width: '20px',
                            flexShrink: 0,
                          }}
                        >
                          {v.order_number ?? i + 1}
                        </span>
                        <Film size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
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
                          {v.filename}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>
                          {formatSize(v.size_bytes)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Next button */}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setStep(2)}
                  disabled={readyVideos.length === 0}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '10px 20px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--accent)',
                    border: 'none',
                    color: 'white',
                    cursor: readyVideos.length === 0 ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    opacity: readyVideos.length === 0 ? 0.5 : 1,
                  }}
                >
                  Próximo <ChevronRight size={16} />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── STEP 2: Select accounts ── */}
      {step === 2 && (
        <div>
          <p
            style={{
              fontSize: '13px',
              fontWeight: '500',
              color: 'var(--text-secondary)',
              marginBottom: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
            }}
          >
            Selecione as contas de destino
          </p>

          {loadingAccounts ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                color: 'var(--text-secondary)',
                fontSize: '14px',
                padding: '24px 0',
              }}
            >
              <Spinner size={16} color="var(--accent)" /> Carregando contas...
            </div>
          ) : (
            <>
              {bms.length === 0 ? (
                <div
                  style={{
                    padding: '40px',
                    textAlign: 'center',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--bg-border)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-muted)',
                    fontSize: '14px',
                    marginBottom: '24px',
                  }}
                >
                  Nenhuma Business Manager conectada. Conecte contas na página de Contas.
                </div>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    marginBottom: '20px',
                  }}
                >
                  {bms.map((bm) => {
                    const eligibleAccounts = bm.ad_accounts.filter((a) => a.is_selected)
                    if (eligibleAccounts.length === 0) return null
                    const isExpanded = expandedBMs.has(bm.id)
                    const checkedCount = eligibleAccounts.filter((a) =>
                      selectedAccountIds.has(a.id)
                    ).length

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
                        {/* BM header */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '12px 16px',
                            cursor: 'pointer',
                          }}
                          onClick={() => toggleBMExpand(bm.id)}
                        >
                          {isExpanded ? (
                            <ChevronLeft
                              size={14}
                              color="var(--text-muted)"
                              style={{ transform: 'rotate(-90deg)' }}
                            />
                          ) : (
                            <ChevronRight size={14} color="var(--text-muted)" />
                          )}
                          <Building2 size={15} color="var(--accent)" />
                          <span
                            style={{
                              fontSize: '13px',
                              fontWeight: '500',
                              color: 'var(--text-primary)',
                              flex: 1,
                            }}
                          >
                            {bm.name}
                          </span>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            {checkedCount}/{eligibleAccounts.length} selecionadas
                          </span>
                        </div>

                        {/* Accounts */}
                        {isExpanded && (
                          <div style={{ borderTop: '1px solid var(--bg-border)' }}>
                            {eligibleAccounts.map((acc) => {
                              const checked = selectedAccountIds.has(acc.id)
                              return (
                                <label
                                  key={acc.id}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    padding: '10px 16px 10px 40px',
                                    cursor: 'pointer',
                                    background: checked
                                      ? 'rgba(91,110,245,0.04)'
                                      : 'transparent',
                                    transition: 'background 150ms ease',
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleAccount(acc.id)}
                                    style={{ accentColor: 'var(--accent)', flexShrink: 0 }}
                                  />
                                  <span
                                    style={{
                                      fontSize: '13px',
                                      color: 'var(--text-primary)',
                                      flex: 1,
                                    }}
                                  >
                                    {acc.name}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: '11px',
                                      color: 'var(--text-muted)',
                                      fontFamily: 'monospace',
                                    }}
                                  >
                                    {acc.meta_account_id}
                                  </span>
                                </label>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Summary */}
              {totalUploads > 0 && (
                <div
                  style={{
                    padding: '12px 16px',
                    background: 'rgba(91,110,245,0.08)',
                    border: '1px solid rgba(91,110,245,0.2)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '13px',
                    color: 'var(--text-primary)',
                    marginBottom: '20px',
                  }}
                >
                  Resumo:{' '}
                  <strong>{readyVideos.length}</strong> vídeos ×{' '}
                  <strong>{selectedAccounts.length}</strong> contas ={' '}
                  <strong>{totalUploads}</strong> uploads
                </div>
              )}

              {publishError && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 14px',
                    background: 'rgba(239,68,68,0.08)',
                    border: '1px solid rgba(239,68,68,0.2)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--status-error)',
                    fontSize: '13px',
                    marginBottom: '16px',
                  }}
                >
                  <AlertCircle size={14} />
                  {publishError}
                </div>
              )}

              {/* Navigation */}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button
                  onClick={() => setStep(1)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '10px 20px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--bg-border)',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}
                >
                  <ChevronLeft size={16} /> Voltar
                </button>
                <button
                  onClick={handlePublish}
                  disabled={publishing || selectedAccountIds.size === 0 || readyVideos.length === 0}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 24px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--accent)',
                    border: 'none',
                    color: 'white',
                    cursor:
                      publishing || selectedAccountIds.size === 0 || readyVideos.length === 0
                        ? 'not-allowed'
                        : 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    opacity:
                      selectedAccountIds.size === 0 || readyVideos.length === 0 ? 0.5 : 1,
                  }}
                >
                  {publishing ? (
                    <>
                      <Spinner size={14} color="white" /> Iniciando...
                    </>
                  ) : (
                    <>
                      <Rocket size={16} /> Publicar Tudo
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── STEP 3: Live queue ── */}
      {step === 3 && (
        <div>
          {/* Summary header */}
          <div style={{ marginBottom: '20px' }}>
            {(() => {
              const done = jobs.filter((j) => j.status === 'done').length
              const failed = jobs.filter((j) => j.status === 'failed').length
              const active = jobs.filter(
                (j) => j.status === 'pending' || j.status === 'processing'
              ).length
              const total = jobs.length || totalCreated

              return (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <h2
                      style={{
                        fontSize: '16px',
                        fontWeight: '600',
                        color: 'var(--text-primary)',
                        marginBottom: '4px',
                      }}
                    >
                      {active > 0 ? `${active} em andamento` : `${total} uploads`}
                    </h2>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                      {done > 0 && `${done} concluídos`}
                      {done > 0 && failed > 0 && ' · '}
                      {failed > 0 && `${failed} com erro`}
                      {active > 0 && (done > 0 || failed > 0) && ' · '}
                      {active > 0 && `${active} pendentes`}
                    </p>
                  </div>
                  {active > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '12px',
                        color: 'var(--text-muted)',
                      }}
                    >
                      <Spinner size={12} color="var(--accent)" />
                      Atualizando...
                    </div>
                  )}
                </div>
              )
            })()}
          </div>

          {/* Jobs list */}
          {jobs.length === 0 ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                color: 'var(--text-secondary)',
                fontSize: '14px',
                padding: '24px 0',
              }}
            >
              <Spinner size={16} color="var(--accent)" /> Carregando fila...
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
              {jobs.map((job, i) => (
                <div
                  key={job.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '11px 16px',
                    borderBottom:
                      i < jobs.length - 1 ? '1px solid var(--bg-border)' : 'none',
                    background:
                      job.status === 'processing'
                        ? 'rgba(234,179,8,0.04)'
                        : job.status === 'failed'
                        ? 'rgba(239,68,68,0.03)'
                        : 'transparent',
                  }}
                >
                  <StatusIcon status={job.status} />
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
                  <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>→</span>
                  <span
                    style={{
                      fontSize: '12px',
                      color: 'var(--text-secondary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '200px',
                    }}
                  >
                    {job.ad_accounts?.name ?? job.ad_accounts?.meta_account_id ?? '—'}
                  </span>
                  <span
                    style={{
                      fontSize: '12px',
                      color: statusColor(job.status),
                      fontWeight: '500',
                      flexShrink: 0,
                      minWidth: '90px',
                      textAlign: 'right',
                    }}
                  >
                    {statusLabel(job.status)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* New publish button */}
          <div style={{ marginTop: '20px' }}>
            <button
              onClick={() => {
                setStep(1)
                setSelectedFolderId(null)
                setSelectedAccountIds(new Set())
                setJobs([])
                setTotalCreated(0)
                setPublishError('')
              }}
              style={{
                padding: '9px 18px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-surface)',
                border: '1px solid var(--bg-border)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              Nova publicação
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
