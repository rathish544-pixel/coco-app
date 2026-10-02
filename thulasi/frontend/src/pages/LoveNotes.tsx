import { useCallback, useEffect, useState } from 'react'
import { Heart, Loader2 } from 'lucide-react'

import { recentNotes } from '../api/notifications'
import { EmptyState, ErrorState } from '../components/Loading'
import { MissYouButton } from '../components/MissYouButton'
import { MissYouSheet } from '../components/MissYouSheet'
import { useAuth } from '../state/AuthContext'
import { useLove } from '../state/LoveContext'
import type { LoveNote } from '../types'

function relativeTime(iso: string): string {
  const then = new Date(iso.endsWith('Z') || iso.includes('+') ? iso : `${iso}Z`)
  const seconds = Math.floor((Date.now() - then.getTime()) / 1000)
  if (Number.isNaN(seconds)) return ''
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} ${days === 1 ? 'day' : 'days'} ago`
  const months = Math.floor(days / 30)
  return `${months} ${months === 1 ? 'month' : 'months'} ago`
}

export function LoveNotes() {
  const { config } = useLove()
  const { owner } = useAuth()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [notes, setNotes] = useState<LoveNote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const herName = config?.her_name ?? 'Kutty'
  const myName = config?.my_name ?? 'Me'
  const recipient = owner === 'me' ? herName : myName

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setNotes(await recentNotes(50))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load our notes.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="flex flex-col items-center gap-7">
      <MissYouButton recipientName={recipient} onPress={() => setSheetOpen(true)} />

      <section className="w-full">
        <p className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-faint">
          <Heart size={12} className="text-rose" /> every note so far
        </p>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-rose" size={22} />
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : notes.length === 0 ? (
          <EmptyState
            title="No notes yet"
            hint="Tap the heart above and it will appear here forever."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {notes.map((note, index) => (
              <li
                key={note.id}
                className="glass animate-fade-up rounded-soft p-4"
                style={{ animationDelay: `${Math.min(index, 8) * 0.04}s` }}
              >
                <div className="flex items-start gap-3">
                  <span className="mt-1 text-rose">
                    <Heart size={15} fill="currentColor" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-hand text-xl leading-snug text-cream">{note.message}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-faint">
                      <span className="text-rose/80">
                        {note.sender === 'me' ? myName : herName}
                      </span>
                      <span aria-hidden>·</span>
                      <span>{relativeTime(note.created_at)}</span>
                      {note.delivered > 0 && (
                        <>
                          <span aria-hidden>·</span>
                          <span>reached {note.delivered} phone{note.delivered === 1 ? '' : 's'}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <MissYouSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </div>
  )
}
