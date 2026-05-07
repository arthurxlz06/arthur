'use client'

import { createContext, useContext, useState, useCallback } from 'react'
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: string
  type: ToastType
  message: string
}

interface ToastCtx {
  addToast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastCtx | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be inside ToastProvider')
  return {
    success: (msg: string) => ctx.addToast(msg, 'success'),
    error: (msg: string) => ctx.addToast(msg, 'error'),
    info: (msg: string) => ctx.addToast(msg, 'info'),
  }
}

const COLORS = {
  success: { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.25)', icon: 'var(--status-success)' },
  error: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.25)', icon: 'var(--status-error)' },
  info: { bg: 'rgba(91,110,245,0.12)', border: 'rgba(91,110,245,0.25)', icon: 'var(--accent)' },
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
  const c = COLORS[toast.type]
  const Icon =
    toast.type === 'success' ? CheckCircle : toast.type === 'error' ? AlertCircle : Info

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        padding: '12px 14px',
        borderRadius: 'var(--radius-md)',
        background: c.bg,
        border: `1px solid ${c.border}`,
        backdropFilter: 'blur(12px)',
        minWidth: '280px',
        maxWidth: '420px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        animation: 'toastIn 200ms ease forwards',
      }}
    >
      <Icon size={15} color={c.icon} style={{ flexShrink: 0, marginTop: '1px' }} />
      <p
        style={{
          fontSize: '13px',
          color: 'var(--text-primary)',
          flex: 1,
          lineHeight: '1.45',
          wordBreak: 'break-word',
        }}
      >
        {toast.message}
      </p>
      <button
        onClick={onRemove}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          display: 'flex',
          flexShrink: 0,
          padding: '0',
        }}
      >
        <X size={13} />
      </button>
    </div>
  )
}

function ToastContainer({
  toasts,
  onRemove,
}: {
  toasts: Toast[]
  onRemove: (id: string) => void
}) {
  if (toasts.length === 0) return null
  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        zIndex: 9999,
      }}
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onRemove={() => onRemove(t.id)} />
      ))}
    </div>
  )
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).slice(2)
    const duration = type === 'error' ? 5000 : 3000
    setToasts((prev) => [...prev.slice(-2), { id, type, message }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), duration)
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}
