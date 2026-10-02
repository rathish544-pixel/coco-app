import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Eye, EyeOff, KeyRound, Loader2, Lock } from 'lucide-react'

import { listAccounts } from '../api/auth'
import { FloatingHearts } from '../components/FloatingHearts'
import { useAuth } from '../state/AuthContext'
import { useLove } from '../state/LoveContext'
import type { Account } from '../types'

export function Login() {
  const { login, error, clearError, booting } = useAuth()
  const { config } = useLove()

  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountsFailed, setAccountsFailed] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    void listAccounts()
      .then((rows) => {
        if (!cancelled) setAccounts(rows)
      })
      .catch(() => {
        // The name field stays usable even if this call fails.
        if (!cancelled) setAccountsFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Nothing to do once signed in — the router redirects away from here.
  if (booting) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="animate-spin text-rose" size={26} />
      </div>
    )
  }

  function pickAccount(account: Account) {
    setSelected(account.username)
    setUsername(account.username)
    clearError()
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!username.trim() || !password) return
    setSubmitting(true)
    try {
      await login(username.trim(), password)
      setPassword('')
    } catch {
      // The message is already in context; keep the field focused.
      setPassword('')
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit = username.trim().length > 0 && password.length > 0 && !submitting

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-5 py-10 safe-top safe-bottom">
      <FloatingHearts count={14} />

      {/* soft light behind the card */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/3 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-rose/25 blur-[110px]"
      />

      <div className="relative z-10 w-full max-w-sm">
        {/* ---------- identity ---------- */}
        <header className="mb-7 flex flex-col items-center text-center">
          <span className="animate-heartbeat mb-4 text-5xl text-rose drop-shadow-[0_8px_30px_rgba(255,111,156,0.6)]">
            ♥
          </span>
          <p className="mb-1.5 text-[11px] uppercase tracking-[0.4em] text-faint">
            {config?.app_name ?? 'Thulasi'}
          </p>
          <h1 className="font-display text-[2.6rem] font-semibold leading-none text-gradient">
            Welcome back
          </h1>
          <p className="mt-3 max-w-[17rem] text-sm leading-relaxed text-mist/80">
            Our memories, our songs and every note I send you — kept for just the two of us.
          </p>
        </header>

        {/* ---------- form ---------- */}
        <form
          onSubmit={handleSubmit}
          className="glass animate-fade-up rounded-soft p-5 shadow-[0_24px_70px_rgba(0,0,0,0.5)]"
        >
          {accounts.length > 0 && (
            <div className="mb-4">
              <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-faint">
                Who is this?
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                {accounts.map((account) => {
                  const active = selected === account.username
                  return (
                    <button
                      key={account.username}
                      type="button"
                      onClick={() => pickAccount(account)}
                      className={[
                        'flex flex-col items-start gap-0.5 rounded-2xl border px-3.5 py-3 text-left transition',
                        active
                          ? 'border-rose/70 bg-rose/15 shadow-[0_0_0_1px_rgba(255,111,156,0.35)]'
                          : 'border-white/12 bg-white/[0.04] hover:border-rose/40 hover:bg-white/[0.07]',
                      ].join(' ')}
                    >
                      <span className="font-display text-xl leading-tight text-cream">
                        {account.display_name}
                      </span>
                      <span className="text-[11px] text-faint">
                        {account.owner === 'me' ? 'my phone' : 'her phone'}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <label className="mb-3 block">
            <span className="mb-1.5 block text-[11px] uppercase tracking-[0.2em] text-faint">
              Name
            </span>
            <div className="relative">
              <input
                value={username}
                onChange={(event) => {
                  setUsername(event.target.value)
                  setSelected(null)
                  clearError()
                }}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="me"
                className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 pr-11 text-cream outline-none transition placeholder:text-faint/60 focus:border-rose/60"
              />
              <Lock
                size={16}
                className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-faint"
              />
            </div>
          </label>

          <label className="mb-4 block">
            <span className="mb-1.5 block text-[11px] uppercase tracking-[0.2em] text-faint">
              Password
            </span>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value)
                  clearError()
                }}
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 pr-11 text-cream outline-none transition placeholder:text-faint/60 focus:border-rose/60"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-faint transition hover:text-mist"
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </label>

          {error && (
            <p
              role="alert"
              className="animate-fade-up mb-4 rounded-2xl border border-rose/40 bg-rose/10 px-4 py-3 text-sm text-blush"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose to-rose-deep px-6 py-4 font-medium text-night-deep shadow-[0_14px_34px_rgba(217,79,125,0.4)] transition hover:from-blush hover:to-rose active:scale-[0.99] disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <KeyRound size={18} />
            )}
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>

          {accountsFailed && (
            <p className="mt-3 text-center text-xs text-faint">
              Can’t load the accounts — type your name instead.
            </p>
          )}
        </form>

        <p className="mt-6 text-center text-xs text-faint/80">
          Private to us two. <span className="text-mist/70">Nothing here is ever shared.</span>
        </p>
      </div>
    </div>
  )
}
