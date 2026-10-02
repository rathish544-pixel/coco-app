import { Calendar, MapPin, Pencil, Trash2 } from 'lucide-react'

import { mediaUrl } from '../api/client'
import { prettyDate } from '../utils/date'
import type { Memory } from '../types'

interface MemoryCardProps {
  memory: Memory
  onEdit: (memory: Memory) => void
  onDelete: (memory: Memory) => void
}

export function MemoryCard({ memory, onEdit, onDelete }: MemoryCardProps) {
  const image = mediaUrl(memory.image_url)
  const date = prettyDate(memory.happened_on)

  return (
    <article className="glass animate-fade-up group relative overflow-hidden rounded-soft">
      {image && (
        <img
          src={image}
          alt={memory.caption || memory.title}
          loading="lazy"
          className="h-52 w-full object-cover transition duration-500 group-hover:scale-[1.03]"
        />
      )}

      <div className="relative p-4">
        {/* A quiet heart marker keeps photo-less memories from looking unfinished. */}
        {!image && (
          <span aria-hidden className="absolute right-4 top-4 text-lg text-rose/40">
            ♥
          </span>
        )}

        <h3 className="font-display text-2xl leading-snug text-cream">{memory.title}</h3>

        {(date || memory.place) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] uppercase tracking-wider text-faint">
            {date && (
              <span className="flex items-center gap-1">
                <Calendar size={12} /> {date}
              </span>
            )}
            {memory.place && (
              <span className="flex items-center gap-1">
                <MapPin size={12} /> {memory.place}
              </span>
            )}
          </div>
        )}

        {memory.story && (
          <p className="font-hand mt-2 text-xl leading-snug text-mist">{memory.story}</p>
        )}

        {memory.caption && (
          <p className="mt-2 text-xs italic leading-relaxed text-faint">{memory.caption}</p>
        )}
      </div>

      {/*
        Always visible (dimmed, full on hover): phones have no hover state, so
        hiding these behind group-hover would make them unreachable on touch.
      */}
      <div className="absolute right-2.5 top-2.5 flex gap-1.5 opacity-70 transition group-hover:opacity-100 group-focus-within:opacity-100">
        <button
          type="button"
          onClick={() => onEdit(memory)}
          aria-label={`Edit ${memory.title}`}
          className="rounded-full border border-white/15 bg-night-deep/80 p-2 text-mist backdrop-blur transition hover:border-rose/50 hover:text-cream"
        >
          <Pencil size={15} />
        </button>
        <button
          type="button"
          onClick={() => onDelete(memory)}
          aria-label={`Delete ${memory.title}`}
          className="rounded-full border border-white/15 bg-night-deep/80 p-2 text-mist backdrop-blur transition hover:border-rose/50 hover:text-rose"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </article>
  )
}
