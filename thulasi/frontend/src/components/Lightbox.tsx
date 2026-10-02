import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Calendar, ChevronLeft, ChevronRight, Trash2, X } from 'lucide-react'

import { mediaUrl } from '../api/client'
import { prettyDate } from '../utils/date'
import type { Photo } from '../types'

interface LightboxProps {
  photos: Photo[]
  index: number
  onIndexChange: (index: number) => void
  onClose: () => void
  onDelete: (photo: Photo) => void
}

/** A full-screen viewer for the album. Arrow keys and buttons both work. */
export function Lightbox({ photos, index, onIndexChange, onClose, onDelete }: LightboxProps) {
  const photo = photos[index]
  const hasMultiple = photos.length > 1

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowRight' && hasMultiple) onIndexChange((index + 1) % photos.length)
      if (event.key === 'ArrowLeft' && hasMultiple) {
        onIndexChange((index - 1 + photos.length) % photos.length)
      }
    }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [index, photos.length, hasMultiple, onClose, onIndexChange])

  if (!photo) return null

  const source = mediaUrl(photo.url)
  const date = prettyDate(photo.taken_on)

  return createPortal(
    <div className="fixed inset-0 z-[70] flex flex-col bg-night-deep/95 backdrop-blur-xl">
      {/* ---------- top bar ---------- */}
      <div className="safe-top flex items-center justify-between gap-3 px-4 pb-2">
        <p className="text-[11px] uppercase tracking-[0.28em] text-faint">
          {index + 1} of {photos.length}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onDelete(photo)}
            aria-label="Delete this photo"
            className="rounded-full border border-white/15 p-2.5 text-mist transition hover:border-rose/50 hover:text-rose"
          >
            <Trash2 size={17} />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close viewer"
            className="rounded-full border border-white/15 p-2.5 text-mist transition hover:border-rose/50 hover:text-cream"
          >
            <X size={17} />
          </button>
        </div>
      </div>

      {/* ---------- image ---------- */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 py-2">
        {hasMultiple && (
          <button
            type="button"
            aria-label="Previous photo"
            onClick={() => onIndexChange((index - 1 + photos.length) % photos.length)}
            className="absolute left-2 z-10 rounded-full border border-white/15 bg-night-deep/70 p-3 text-cream backdrop-blur transition hover:border-rose/50"
          >
            <ChevronLeft size={20} />
          </button>
        )}

        <img
          key={photo.id}
          src={source ?? ''}
          alt={photo.caption ?? 'Our photo'}
          className="animate-pop max-h-full max-w-full rounded-2xl object-contain shadow-[0_30px_80px_rgba(0,0,0,0.6)]"
        />

        {hasMultiple && (
          <button
            type="button"
            aria-label="Next photo"
            onClick={() => onIndexChange((index + 1) % photos.length)}
            className="absolute right-2 z-10 rounded-full border border-white/15 bg-night-deep/70 p-3 text-cream backdrop-blur transition hover:border-rose/50"
          >
            <ChevronRight size={20} />
          </button>
        )}
      </div>

      {/* ---------- caption ---------- */}
      <div className="safe-bottom px-6 pb-6 pt-2 text-center">
        {photo.caption && <p className="font-hand text-2xl text-blush">{photo.caption}</p>}
        {date && (
          <p className="mt-1.5 flex items-center justify-center gap-1.5 text-[11px] uppercase tracking-[0.2em] text-faint">
            <Calendar size={12} /> {date}
          </p>
        )}
      </div>
    </div>,
    document.body,
  )
}
