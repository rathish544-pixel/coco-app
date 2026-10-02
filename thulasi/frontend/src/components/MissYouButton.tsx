import { useAuth } from '../state/AuthContext'

interface MissYouButtonProps {
  recipientName: string
  onPress: () => void
}

/** The special button. Big, warm, unmissable on a phone screen. */
export function MissYouButton({ recipientName, onPress }: MissYouButtonProps) {
  // Whoever is signed in, the button points at the other person.
  const { owner } = useAuth()
  const pronoun = owner === 'me' ? 'her' : 'him'
  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={onPress}
        aria-label={`Tell ${recipientName} you miss her`}
        className="group relative flex h-56 w-56 items-center justify-center rounded-full transition active:scale-95"
      >
        {/* soft living glow */}
        <span className="animate-glow absolute inset-0 rounded-full bg-rose/40 blur-3xl" />

        {/* outer ring */}
        <span className="absolute inset-2 rounded-full border border-white/20" />
        <span className="absolute inset-0 rounded-full bg-gradient-to-br from-rose via-rose-deep to-wine shadow-[0_20px_60px_rgba(217,79,125,0.55)]" />
        <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_32%_26%,rgba(255,255,255,0.42),transparent_58%)]" />

        <span className="relative flex flex-col items-center gap-1">
          <span className="animate-heartbeat text-6xl leading-none drop-shadow-lg">♥</span>
          <span className="font-display text-2xl font-semibold tracking-wide text-cream">
            I miss you
          </span>
          <span className="text-[11px] uppercase tracking-[0.28em] text-cream/75">
            tap to tell {pronoun}
          </span>
        </span>
      </button>
      <p className="mt-5 max-w-xs text-center text-sm text-mist/80">
        One tap sends {recipientName} a little notification on their phone.
      </p>
    </div>
  )
}
