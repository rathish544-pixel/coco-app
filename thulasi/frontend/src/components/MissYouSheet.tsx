import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Heart, Loader2, Send, Sparkles } from 'lucide-react'

import { sendMissYou } from '../api/notifications'
import { useLove } from '../state/LoveContext'
import type { MissYouResult } from '../types'
import { HeartBurst } from './HeartBurst'
import { Sheet } from './Sheet'

const PHrases = [
  'I miss you so much right now.',
  'I just thought of you and smiled.',
  'Counting the hours until I see you.',
  'You crossed my mind again. I miss you.',
  'Sending you a hug through this phone.',
]

interface MissYouSheetProps {
  open: boolean
  onClose: () => void
}

export function MissYouSheet({ open, onClose }: MissYouSheetProps) {
  const { owner, config, refreshPushStatus } = useLove()
  const [message, setMessage] = useState('')
  const [placeholder, setPlaceholder] = useState(PHrases[0])
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<MissYouResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [burst, setBurst] = useState(false)

  const recipientName = owner === 'me' ? (config?.her_name ?? 'Kutty') : (config?.my_name ?? 'Me')
  // Whoever is on the receiving end, worded for that direction.
  const deliveryHint =
    owner === 'me'
      ? 'She gets a notification on her phone, right away.'
      : "You'll get it on your phone, right away."

  // Rotate the hint so the box never feels stale.
  useEffect(() => {
    if (!open) return
    setPlaceholder(PHrases[Math.floor(Math.random() * PHrases.length)])
  }, [open])

  useEffect(() => {
    if (open) return
    // Reset shortly after closing so the animation isn't visible.
    const timer = window.setTimeout(() => {
      setResult(null)
      setError(null)
      setMessage('')
      setBurst(false)
    }, 250)
    return () => window.clearTimeout(timer)
  }, [open])

  async function handleSend() {
    setSending(true)
    setError(null)
    try {
      const response = await sendMissYou(owner, message)
      setResult(response)
      setBurst(true)
      setMessage('')
      void refreshPushStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send that just now.')
    } finally {
      setSending(false)
    }
  }

  return (
    <Sheet
      open={open}
      title={result ? 'On its way 💗' : `Missing ${recipientName}?`}
      subtitle={result ? undefined : deliveryHint}
      onClose={onClose}
    >
      <div className="relative">
        {result ? (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <HeartBurst active={burst} />
            <div className="animate-swap flex h-16 w-16 items-center justify-center rounded-full bg-rose/20">
              <Heart className="text-rose" size={30} fill="currentColor" />
            </div>
            <p className="font-display text-3xl text-cream">
              {result.devices_notified > 0
                ? `Sent to ${result.recipient}`
                : `Saved for ${result.recipient}`}
            </p>
            <p className="font-hand max-w-xs text-xl text-blush">“{result.message}”</p>

            {result.devices_notified === 0 && (
              <p className="max-w-xs rounded-2xl border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-gold">
                No phone is connected yet. Open{' '}
                <Link to="/setup" onClick={onClose} className="underline">
                  Setup
                </Link>{' '}
                on her phone and turn notifications on — then it will reach her instantly.
              </p>
            )}

            <button
              type="button"
              onClick={onClose}
              className="mt-1 rounded-full bg-rose px-6 py-2.5 text-sm font-medium text-night-deep transition hover:bg-blush"
            >
              Close
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {config && !config.push_enabled && (
              <p className="rounded-2xl border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-gold">
                Notifications aren’t configured on the server yet.{' '}
                <Link to="/setup" onClick={onClose} className="underline">
                  See Setup
                </Link>{' '}
                to finish it.
              </p>
            )}

            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={3}
              maxLength={400}
              placeholder={placeholder}
              className="w-full resize-none rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-cream outline-none transition placeholder:text-faint/70 focus:border-rose/60"
            />

            <div>
              <p className="mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-[0.2em] text-faint">
                <Sparkles size={13} /> or borrow one of these
              </p>
              <div className="flex flex-wrap gap-2">
                {PHrases.map((phrase) => (
                  <button
                    key={phrase}
                    type="button"
                    onClick={() => setMessage(phrase)}
                    className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-mist transition hover:border-rose/50 hover:text-cream"
                  >
                    {phrase}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p className="rounded-2xl border border-rose/40 bg-rose/10 px-4 py-3 text-sm text-blush">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={handleSend}
              disabled={sending}
              className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose to-rose-deep px-6 py-4 font-medium text-night-deep shadow-lg transition hover:from-blush hover:to-rose disabled:opacity-60"
            >
              {sending ? <Loader2 className="animate-spin" size={19} /> : <Send size={19} />}
              {sending ? 'Sending…' : `Send to ${recipientName}`}
            </button>

            <p className="text-center text-xs text-faint">
              Leave it blank and I’ll pick something sweet.
            </p>
          </div>
        )}
      </div>
    </Sheet>
  )
}
