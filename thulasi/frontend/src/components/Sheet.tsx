import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'

interface SheetProps {
  open: boolean
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
}

/** A bottom sheet that slides up from the edge — natural on a phone. */
export function Sheet({ open, title, subtitle, onClose, children }: SheetProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open, onClose])

  if (!open) return null

  // Rendered into <body> so the fixed bottom nav and mini player (which sit
  // outside the page's stacking context) can never paint over the sheet.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-night-deep/80 backdrop-blur-sm"
      />
      <div className="animate-pop relative z-10 max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[2rem] border border-white/10 bg-night-soft/95 px-5 pb-8 pt-3 safe-bottom shadow-[0_-20px_60px_rgba(0,0,0,0.5)]">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-white/20" />
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl font-semibold text-cream">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-faint">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="mt-1 rounded-full border border-white/15 p-2 text-mist transition hover:bg-white/10"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}
