import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Camera, ChevronRight, Heart, Images, Mail, Music } from 'lucide-react'

import { recentNotes } from '../api/notifications'
import { MissYouButton } from '../components/MissYouButton'
import { MissYouSheet } from '../components/MissYouSheet'
import { ErrorState, Loading } from '../components/Loading'
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
  return `${days} ${days === 1 ? 'day' : 'days'} ago`
}

export function Home() {
  const { config, loading, loadError, reloadConfig, owner, daysTogether } = useLove()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [notes, setNotes] = useState<LoveNote[]>([])

  const herName = config?.her_name ?? 'Kutty'
  const myName = config?.my_name ?? 'Me'
  const recipient = owner === 'me' ? herName : myName

  useEffect(() => {
    recentNotes(6)
      .then(setNotes)
      .catch(() => undefined)
  }, [])

  if (loading) return <Loading label="Getting our little world ready…" />
  if (loadError) return <ErrorState message={loadError} onRetry={() => void reloadConfig()} />

  const lastSent = notes[0]

  return (
    <div className="flex flex-col items-center gap-8 pt-2">
      <div className="animate-fade-up flex flex-col items-center gap-2 text-center">
        <p className="text-[11px] uppercase tracking-[0.34em] text-faint">
          {daysTogether > 0 ? `${daysTogether} days of us` : 'us'}
        </p>
        <h2 className="font-display text-4xl leading-tight text-cream">
          {herName}
          <span className="text-rose"> ♥</span>
        </h2>
        <p className="max-w-xs text-sm text-mist/80">
          Our memories, our songs, and a button for the moments I miss you most.
        </p>
      </div>

      <MissYouButton recipientName={recipient} onPress={() => setSheetOpen(true)} />

      {lastSent && (
        <div className="glass w-full rounded-soft px-4 py-3 text-center">
          <p className="text-[11px] uppercase tracking-[0.2em] text-faint">
            Last time you reached out
          </p>
          <p className="font-hand mt-1 text-xl text-blush">“{lastSent.message}”</p>
          <p className="mt-1 text-xs text-faint">{relativeTime(lastSent.created_at)}</p>
        </div>
      )}

      <div className="grid w-full grid-cols-2 gap-3">
        <Link
          to="/memories"
          className="glass group flex flex-col gap-1.5 rounded-soft p-4 transition hover:border-rose/40"
        >
          <Images className="text-rose" size={21} />
          <span className="font-display text-xl text-cream">Memories</span>
          <span className="flex items-center gap-1 text-[11px] text-faint">
            Look back <ChevronRight size={12} className="transition group-hover:translate-x-1" />
          </span>
        </Link>
        <Link
          to="/photos"
          className="glass group flex flex-col gap-1.5 rounded-soft p-4 transition hover:border-rose/40"
        >
          <Camera className="text-rose" size={21} />
          <span className="font-display text-xl text-cream">Photos</span>
          <span className="flex items-center gap-1 text-[11px] text-faint">
            Our album <ChevronRight size={12} className="transition group-hover:translate-x-1" />
          </span>
        </Link>
        <Link
          to="/songs"
          className="glass group flex flex-col gap-1.5 rounded-soft p-4 transition hover:border-rose/40"
        >
          <Music className="text-rose" size={21} />
          <span className="font-display text-xl text-cream">Songs</span>
          <span className="flex items-center gap-1 text-[11px] text-faint">
            Press play <ChevronRight size={12} className="transition group-hover:translate-x-1" />
          </span>
        </Link>
        <Link
          to="/notes"
          className="glass group flex flex-col gap-1.5 rounded-soft p-4 transition hover:border-rose/40"
        >
          <Mail className="text-rose" size={21} />
          <span className="font-display text-xl text-cream">Notes</span>
          <span className="flex items-center gap-1 text-[11px] text-faint">
            Love notes <ChevronRight size={12} className="transition group-hover:translate-x-1" />
          </span>
        </Link>
      </div>

      {notes.length > 1 && (
        <div className="glass w-full rounded-soft p-4">
          <p className="mb-3 flex items-center gap-1.5 text-[11px] uppercase tracking-[0.2em] text-faint">
            <Heart size={12} /> little moments
          </p>
          <ul className="flex flex-col gap-3">
            {notes.slice(1, 5).map((note) => (
              <li key={note.id} className="flex items-start gap-3 border-b border-white/5 pb-3 last:border-0 last:pb-0">
                <span className="mt-1 text-rose">♥</span>
                <div className="min-w-0">
                  <p className="truncate text-sm text-mist">{note.message}</p>
                  <p className="text-[11px] text-faint">
                    {note.sender === 'me' ? myName : herName} · {relativeTime(note.created_at)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!config?.push_enabled && (
        <Link
          to="/setup"
          className="w-full rounded-soft border border-gold/30 bg-gold/10 px-4 py-3 text-center text-sm text-gold transition hover:bg-gold/15"
        >
          Notifications still need setting up — tap here.
        </Link>
      )}

      <MissYouSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </div>
  )
}
