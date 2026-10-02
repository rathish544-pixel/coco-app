import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

interface ToastState {
  id: number
  text: string
  tone: 'love' | 'warn'
}

interface ToastContextValue {
  notify: (text: string, tone?: 'love' | 'warn') => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastState[]>([])

  const notify = useCallback((text: string, tone: 'love' | 'warn' = 'love') => {
    const id = Date.now() + Math.random()
    setToasts((current) => [...current, { id, text, tone }])
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id))
    }, 4200)
  }, [])

  const value = useMemo(() => ({ notify }), [notify])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4 safe-top">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={[
              'animate-pop glass max-w-sm rounded-2xl px-4 py-3 text-center text-sm shadow-lg',
              toast.tone === 'warn' ? 'text-gold' : 'text-cream',
            ].join(' ')}
          >
            {toast.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used inside <ToastProvider>.')
  }
  return context
}
