import { useEffect, useState } from 'react'
import { Bell, BellOff, Check, Loader2, Send, Smartphone } from 'lucide-react'

import { sendTestPush } from '../api/notifications'
import { TextField } from '../components/Field'
import { usePush } from '../hooks/usePush'
import { useAuth } from '../state/AuthContext'
import { useLove } from '../state/LoveContext'
import { useToast } from '../components/Toast'

export function Setup() {
  const { config, owner, pushStatus, refreshPushStatus, togetherSince, setTogetherSince } =
    useLove()
  const { user } = useAuth()
  const { notify } = useToast()
  const push = usePush()
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    void refreshPushStatus()
  }, [refreshPushStatus])

  const herName = config?.her_name ?? 'Thulasi'
  const myName = config?.my_name ?? 'Me'
  const herDevices = pushStatus?.her_devices ?? 0
  const myDevices = pushStatus?.my_devices ?? 0
  const connectedToHer = herDevices > 0

  async function handleEnable() {
    const ok = await push.enable(owner)
    if (ok) notify('Notifications are on for this phone 💗')
  }

  async function handleTest() {
    setTesting(true)
    try {
      const result = await sendTestPush(owner)
      if (result.devices_notified === 0) {
        notify('No phone is connected yet — turn notifications on above.', 'warn')
      } else {
        notify('Test sent. Check this phone’s notifications.')
      }
      await refreshPushStatus()
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not send a test.', 'warn')
    } finally {
      setTesting(false)
    }
  }

  const statusCopy: Record<string, string> = {
    on: 'Notifications are ON for this phone.',
    off: 'Notifications are off for this phone.',
    denied: 'Notifications are blocked in your browser settings.',
    blocked: 'The server has no push keys yet — run the VAPID script.',
    unsupported: 'This browser cannot receive notifications.',
    checking: 'Checking this phone…',
  }

  return (
    <div className="flex flex-col gap-5">
      {/* ---- step 1: whose phone ---- */}
      <section className="glass animate-fade-up rounded-soft p-5">
        <h2 className="font-display text-2xl text-cream">Step 1 · Whose phone is this?</h2>
        <p className="mt-1 text-sm text-faint">
          The account you signed in as decides who receives notifications and who they come from.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          {(['me', 'her'] as const).map((who) => {
            const active = owner === who
            return (
              <div
                key={who}
                className={[
                  'flex flex-col items-start gap-1 rounded-2xl border px-4 py-3 text-left transition',
                  active
                    ? 'border-rose/70 bg-rose/15'
                    : 'border-white/15 bg-white/5',
                ].join(' ')}
              >
                <span className="flex items-center gap-2 text-sm text-cream">
                  {who === 'me' ? myName : herName}
                  {active && <Check size={14} className="text-rose" />}
                </span>
                <span className="text-[11px] text-faint">
                  {active
                    ? `signed in as ${user?.username ?? '…'}`
                    : `sign in as ${who === 'me' ? 'me' : 'coco'} on that phone`}
                </span>
              </div>
            )
          })}
        </div>

        <p className="mt-3 text-xs text-faint">
          To switch this phone to the other account, sign out from the profile button in the top
          right and sign back in as them.
        </p>
      </section>

      {/* ---- step 2: notifications ---- */}
      <section className="glass animate-fade-up rounded-soft p-5">
        <h2 className="font-display text-2xl text-cream">Step 2 · Turn on notifications</h2>
        <p className="mt-1 text-sm text-faint">
          This phone asks permission once, then it can receive the “I miss you” taps.
        </p>

        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
          {push.state === 'on' ? (
            <Bell className="text-rose" size={17} />
          ) : (
            <BellOff className="text-faint" size={17} />
          )}
          <span className="text-sm text-mist">{statusCopy[push.state] ?? ''}</span>
        </div>

        {push.message && <p className="mt-3 text-sm text-blush">{push.message}</p>}

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          {push.state === 'on' ? (
            <button
              type="button"
              onClick={() => void push.disable()}
              disabled={push.busy}
              className="flex-1 rounded-2xl border border-white/15 px-5 py-3.5 text-mist transition hover:bg-white/5 disabled:opacity-60"
            >
              Turn off for this phone
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleEnable()}
              disabled={push.busy}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose to-rose-deep px-5 py-3.5 font-medium text-night-deep transition hover:from-blush hover:to-rose disabled:opacity-60"
            >
              {push.busy ? <Loader2 className="animate-spin" size={17} /> : <Bell size={17} />}
              Turn on notifications
            </button>
          )}

          <button
            type="button"
            onClick={() => void handleTest()}
            disabled={testing}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-rose/40 bg-rose/10 px-5 py-3.5 text-cream transition hover:bg-rose/20 disabled:opacity-60"
          >
            {testing ? <Loader2 className="animate-spin" size={17} /> : <Send size={17} />}
            Send a test
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-center">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
            <p className="font-display text-3xl text-cream">{myDevices}</p>
            <p className="text-[11px] uppercase tracking-wider text-faint">my phones</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
            <p className="font-display text-3xl text-cream">{herDevices}</p>
            <p className="text-[11px] uppercase tracking-wider text-faint">
              {herName}’s phones
            </p>
          </div>
        </div>

        {!connectedToHer && (
          <p className="mt-3 rounded-2xl border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-gold">
            {herName} hasn’t connected a phone yet. Open this app on her phone, choose her name
            above, and turn notifications on there.
          </p>
        )}
      </section>

      {/* ---- step 3: install ---- */}
      <section className="glass animate-fade-up rounded-soft p-5">
        <h2 className="flex items-center gap-2 font-display text-2xl text-cream">
          <Smartphone size={19} className="text-rose" /> Step 3 · Add it to the Home Screen
        </h2>
        <p className="mt-1 text-sm text-faint">
          Notification permissions can be withdrawn quietly for browser tabs, so installing it
          keeps your hearts arriving.
        </p>

        <ol className="mt-4 flex flex-col gap-3 text-sm text-mist">
          <li className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <span className="mb-1 block text-[11px] uppercase tracking-[0.2em] text-faint">
              On Android (Chrome)
            </span>
            Tap the ⋮ menu → <span className="text-cream">Add to Home screen</span> → Install.
          </li>
          <li className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <span className="mb-1 block text-[11px] uppercase tracking-[0.2em] text-faint">
              On iPhone (Safari 16.4+)
            </span>
            Tap Share → <span className="text-cream">Add to Home Screen</span>, then open it from
            the icon and allow notifications.
          </li>
        </ol>
      </section>

      {/* ---- extras ---- */}
      <section className="glass animate-fade-up flex flex-col gap-4 rounded-soft p-5">
        <div>
          <h2 className="font-display text-2xl text-cream">Since when?</h2>
          <p className="mt-1 text-sm text-faint">Used for the day counter on the home screen.</p>
          <div className="mt-3">
            <TextField
              label="Our first day"
              type="date"
              value={togetherSince}
              onChange={(event) => setTogetherSince(event.target.value)}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-faint">
          <p>
            Server: {config?.push_enabled ? 'push keys configured ✓' : 'push keys missing ✗'} ·
            version {config?.version ?? '—'}
          </p>
        </div>
      </section>
    </div>
  )
}
