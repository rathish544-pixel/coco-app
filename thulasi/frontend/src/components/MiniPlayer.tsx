import { Pause, Play, SkipBack, SkipForward, X } from 'lucide-react'

import { usePlayer } from '../state/PlayerContext'

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function MiniPlayer() {
  const { song, playing, progress, duration, toggle, stop, seek, next, previous } = usePlayer()

  if (!song) return null

  const percent = duration > 0 ? Math.min(100, (progress / duration) * 100) : 0

  return (
    <div className="fixed inset-x-0 bottom-[5.4rem] z-40 px-3">
      <div className="glass animate-fade-up mx-auto max-w-md rounded-3xl px-4 py-3 shadow-[0_10px_40px_rgba(0,0,0,0.45)]">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-rose to-wine text-lg text-cream">
            ♪
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-cream">{song.title}</p>
            <p className="truncate text-xs text-faint">
              {song.artist || 'Our song'}
              {duration > 0 && ` · ${formatTime(progress)} / ${formatTime(duration)}`}
            </p>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={previous}
              aria-label="Previous song"
              className="rounded-full p-2 text-mist transition hover:bg-white/10"
            >
              <SkipBack size={17} />
            </button>
            <button
              type="button"
              onClick={toggle}
              aria-label={playing ? 'Pause' : 'Play'}
              className="rounded-full bg-rose p-2.5 text-night-deep transition hover:bg-blush"
            >
              {playing ? <Pause size={17} /> : <Play size={17} />}
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Next song"
              className="rounded-full p-2 text-mist transition hover:bg-white/10"
            >
              <SkipForward size={17} />
            </button>
            <button
              type="button"
              onClick={stop}
              aria-label="Stop"
              className="rounded-full p-1.5 text-faint transition hover:bg-white/10"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={progress}
          onChange={(event) => seek(Number(event.target.value))}
          aria-label="Seek"
          className="mt-2 h-1 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-rose [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-rose"
          style={{
            background: `linear-gradient(to right, #ff6f9c ${percent}%, rgba(255,255,255,0.15) ${percent}%)`,
          }}
        />
      </div>
    </div>
  )
}
