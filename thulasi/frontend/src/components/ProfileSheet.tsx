import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bell, Eye, EyeOff, KeyRound, Loader2, LogOut, UserRound } from 'lucide-react'

import { Sheet } from './Sheet'
import { useToast } from './Toast'
import { useAuth } from '../state/AuthContext'
import { useLove } from '../state/LoveContext'

interface ProfileSheetProps {
  open: boolean
  onClose: () => void
}

export function ProfileSheet({ open, onClose }: ProfileSheetProps) {
  const { user, owner, logout, updatePassword } = useAuth()
  const { config, pushStatus } = useLove()
  const { notify } = useToast()
  const navigate = useNavigate()

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPasswords, setShowPasswords] = useState(false)
  const [saving, setSaving] = useState(false)

  const herName = config?.her_name ?? 'Kutty'
  const myName = config?.my_name ?? 'Me'
  const displayName = user?.display_name ?? 'Me'
  const devicesConnected = owner === 'me' ? (pushStatus?.my_devices ?? 0) : (pushStatus?.her_devices ?? 0)

  async function handlePassword() {
    if (next !== confirm) {
      notify('The two new passwords don’t match.', 'warn')
      return
    }
    if (next.length < 6) {
      notify('Choose a password of at least 6 characters.', 'warn')
      return
    }
    setSaving(true)
    try {
      await updatePassword(current, next)
      notify('Password changed 💗')
      setCurrent('')
      setNext('')
      setConfirm('')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not change it.', 'warn')
    } finally {
      setSaving(false)
    }
  }

  async function handleLogout() {
    onClose()
    await logout()
    navigate('/login', { replace: true })
    notify('Signed out. Come back soon.')
  }

  return (
    <Sheet
      open={open}
      title={displayName}
      subtitle={`Signed in as ${user?.username ?? '—'} · ${
        owner === 'me' ? `notifying ${herName}` : `notifying ${myName}`
      }`}
      onClose={onClose}
    >
      <div className="flex flex-col gap-5">
        {/* ---------- who you are ---------- */}
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-rose to-wine font-display text-2xl text-cream">
            {displayName.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm text-cream">
              {displayName} <span className="text-faint">· {user?.username}</span>
            </p>
            <p className="text-xs text-faint">
              {devicesConnected > 0
                ? `${devicesConnected} phone${devicesConnected === 1 ? '' : 's'} receiving notifications`
                : 'No phone connected for notifications yet'}
            </p>
          </div>
        </div>

        {/* ---------- setup shortcut ---------- */}
        <button
          type="button"
          onClick={() => {
            onClose()
            navigate('/setup')
          }}
          className="flex items-center gap-2.5 rounded-2xl border border-rose/30 bg-rose/10 px-4 py-3 text-left text-sm text-cream transition hover:bg-rose/15"
        >
          <Bell size={17} className="text-rose" />
          Notification setup & install
        </button>

        {/* ---------- change password ---------- */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <p className="mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-[0.2em] text-faint">
            <KeyRound size={12} /> Change password
          </p>

          <div className="relative">
            <input
              type={showPasswords ? 'text' : 'password'}
              value={current}
              onChange={(event) => setCurrent(event.target.value)}
              placeholder="Current password"
              autoComplete="current-password"
              className="mb-2.5 w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 pr-11 text-sm text-cream outline-none transition placeholder:text-faint/60 focus:border-rose/60"
            />
            <button
              type="button"
              onClick={() => setShowPasswords((value) => !value)}
              aria-label={showPasswords ? 'Hide passwords' : 'Show passwords'}
              className="absolute right-3 top-[9px] rounded-full p-1.5 text-faint transition hover:text-mist"
            >
              {showPasswords ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <input
              type={showPasswords ? 'text' : 'password'}
              value={next}
              onChange={(event) => setNext(event.target.value)}
              placeholder="New password"
              autoComplete="new-password"
              className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-cream outline-none transition placeholder:text-faint/60 focus:border-rose/60"
            />
            <input
              type={showPasswords ? 'text' : 'password'}
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              placeholder="Repeat it"
              autoComplete="new-password"
              className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-cream outline-none transition placeholder:text-faint/60 focus:border-rose/60"
            />
          </div>

          <button
            type="button"
            onClick={handlePassword}
            disabled={saving || !current || !next || !confirm}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose to-rose-deep px-5 py-3 text-sm font-medium text-night-deep transition hover:from-blush hover:to-rose disabled:opacity-50"
          >
            {saving && <Loader2 className="animate-spin" size={15} />}
            Update password
          </button>
        </div>

        {/* ---------- sign out ---------- */}
        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center justify-center gap-2 rounded-2xl border border-white/15 px-5 py-3.5 text-mist transition hover:border-rose/40 hover:text-cream"
        >
          <LogOut size={17} /> Sign out
        </button>

        <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-faint/80">
          <UserRound size={11} /> Signed in on this device only
        </p>

        <Link
          to="/setup"
          onClick={onClose}
          className="text-center text-xs text-faint underline decoration-dotted transition hover:text-mist"
        >
          Open full setup
        </Link>
      </div>
    </Sheet>
  )
}
