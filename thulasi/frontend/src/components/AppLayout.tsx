import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'

import { BottomNav } from './BottomNav'
import { FloatingHearts } from './FloatingHearts'
import { MiniPlayer } from './MiniPlayer'
import { ProfileSheet } from './ProfileSheet'
import { useAuth } from '../state/AuthContext'
import { useLove } from '../state/LoveContext'

const TITLES: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'Our little world', subtitle: 'just for you' },
  '/memories': { title: 'Our memories', subtitle: 'every moment worth keeping' },
  '/photos': { title: 'Our photos', subtitle: 'a private album for two' },
  '/songs': { title: 'Our songs', subtitle: 'press play and think of me' },
  '/notes': { title: 'Love notes', subtitle: 'every “I miss you” so far' },
  '/setup': { title: 'Setup', subtitle: 'one minute on each phone' },
}

export function AppLayout() {
  const { pathname } = useLocation()
  const { config } = useLove()
  const { user, owner } = useAuth()
  const [profileOpen, setProfileOpen] = useState(false)

  const heading = TITLES[pathname] ?? TITLES['/']
  const herName = config?.her_name ?? 'Kutty'
  const myName = config?.my_name ?? 'Me'
  const displayName = user?.display_name ?? 'Me'

  // The home headline always names the *other* half of the pair.
  const headline =
    owner === 'me' ? `For ${herName}` : `For ${myName}`

  return (
    <div className="relative min-h-dvh">
      <FloatingHearts />

      <header className="safe-top relative z-10 px-5 pb-3">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.34em] text-faint">
              {heading.subtitle}
            </p>
            <h1 className="truncate font-display text-[2rem] font-semibold leading-tight text-gradient">
              {pathname === '/' ? headline : heading.title}
            </h1>
          </div>

          {/* Profile indicator + sign out */}
          <button
            type="button"
            onClick={() => setProfileOpen(true)}
            aria-label={`Account: ${displayName}. Open profile`}
            className="group relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/20 bg-gradient-to-br from-rose/80 to-wine text-cream transition hover:border-rose/60 active:scale-95"
          >
            <span className="font-display text-2xl leading-none">
              {displayName.charAt(0).toUpperCase()}
            </span>
            <span
              aria-hidden
              className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-night bg-rose text-[9px] text-night-deep transition group-hover:scale-110"
            >
              ♥
            </span>
          </button>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-lg px-5 pb-40">
        <Outlet />
      </main>

      <MiniPlayer />
      <BottomNav />
      <ProfileSheet open={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  )
}
