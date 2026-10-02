import { ExternalLink, Music, Pause, Pencil, Play, Trash2 } from 'lucide-react'

import { mediaUrl } from '../api/client'
import { usePlayer } from '../state/PlayerContext'
import type { Song } from '../types'

interface SongCardProps {
  song: Song
  queue: Song[]
  onEdit: (song: Song) => void
  onDelete: (song: Song) => void
}

export function SongCard({ song, queue, onEdit, onDelete }: SongCardProps) {
  const { song: current, playing, play, toggle, canPlay } = usePlayer()
  const isCurrent = current?.id === song.id
  const playable = canPlay(song)
  const cover = mediaUrl(song.cover_url)

  return (
    <article className="glass animate-fade-up flex gap-3 rounded-soft p-3">
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-rose/40 via-wine/70 to-night-soft">
        {cover ? (
          <img src={cover} alt={song.title} className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-2xl text-cream/55">
            ♪
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-display truncate text-xl leading-tight text-cream">{song.title}</h3>
            {song.artist && <p className="truncate text-xs text-faint">{song.artist}</p>}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {playable ? (
              <button
                type="button"
                onClick={() => (isCurrent ? toggle() : play(song, queue))}
                aria-label={isCurrent && playing ? `Pause ${song.title}` : `Play ${song.title}`}
                className="rounded-full bg-rose p-2.5 text-night-deep transition hover:bg-blush"
              >
                {isCurrent && playing ? <Pause size={16} /> : <Play size={16} />}
              </button>
            ) : song.external_url ? (
              <a
                href={song.external_url}
                target="_blank"
                rel="noreferrer"
                aria-label={`Open ${song.title}`}
                className="rounded-full border border-white/20 p-2.5 text-mist transition hover:border-rose/60 hover:text-cream"
              >
                <ExternalLink size={16} />
              </a>
            ) : (
              <span className="rounded-full border border-white/10 p-2.5 text-faint" title="No audio yet">
                <Music size={16} />
              </span>
            )}

            <button
              type="button"
              onClick={() => onEdit(song)}
              aria-label={`Edit ${song.title}`}
              className="rounded-full p-2 text-faint transition hover:text-rose"
            >
              <Pencil size={15} />
            </button>

            <button
              type="button"
              onClick={() => onDelete(song)}
              aria-label={`Delete ${song.title}`}
              className="rounded-full p-2 text-faint transition hover:text-rose"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>

        {song.note && <p className="font-hand mt-1.5 text-lg leading-snug text-mist">{song.note}</p>}

        {!playable && (
          <p className="mt-1 text-[11px] text-faint/80">
            {song.external_url ? 'Opens in another app' : 'Upload the audio to play it here'}
          </p>
        )}
      </div>
    </article>
  )
}
