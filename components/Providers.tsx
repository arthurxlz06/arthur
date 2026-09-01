'use client'

import { ToastProvider } from '@/contexts/toast'

export default function Providers({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>
}
