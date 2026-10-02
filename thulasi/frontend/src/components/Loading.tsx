import type { ReactNode } from 'react'
import { Heart, Loader2 } from 'lucide-react'

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-faint">
      <Loader2 className="animate-spin text-rose" size={26} />
      <p className="text-sm">{label}</p>
    </div>
  )
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <div className="glass animate-fade-up flex flex-col items-center gap-3 rounded-soft px-6 py-12 text-center">
      <Heart className="text-rose" size={28} />
      <h3 className="font-display text-2xl text-cream">{title}</h3>
      {hint && <p className="max-w-xs text-sm text-faint">{hint}</p>}
      {action}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="glass animate-fade-up flex flex-col items-center gap-3 rounded-soft px-6 py-10 text-center">
      <h3 className="font-display text-2xl text-cream">Something went quiet</h3>
      <p className="max-w-xs text-sm text-faint">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 rounded-full border border-rose/50 bg-rose/15 px-5 py-2 text-sm text-cream transition hover:bg-rose/25"
        >
          Try again
        </button>
      )}
    </div>
  )
}
