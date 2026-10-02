import { useCallback, useEffect, useState } from 'react'
import { Music, Plus } from 'lucide-react'

import { deleteSong, listSongs } from '../api/songs'
import { EmptyState, ErrorState, Loading } from '../components/Loading'
import { Sheet } from '../components/Sheet'
import { SongCard } from '../components/SongCard'
import { SongSheet } from '../components/SongSheet'
import { useToast } from '../components/Toast'
import { usePlayer } from '../state/PlayerContext'
import type { Song } from '../types'

export function Songs() {
  const { notify } = useToast()
  const { stop } = usePlayer()
  const [songs, setSongs] = useState<Song[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<Song | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Song | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setSongs(await listSongs())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load our songs.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function confirmDelete() {
    if (!pendingDelete) return
    try {
      await deleteSong(pendingDelete.id)
      setSongs((current) => current.filter((song) => song.id !== pendingDelete.id))
      if (pendingDelete.audio_url) stop()
      notify('Song removed.')
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not delete that.', 'warn')
    } finally {
      setPendingDelete(null)
    }
  }

  const playableCount = songs.filter((song) => song.audio_url).length

  return (
    <div className="flex flex-col gap-5">
      {songs.length > 0 && (
        <div className="glass flex items-center gap-3 rounded-soft px-4 py-3">
          <Music className="text-rose" size={20} />
          <div>
            <p className="text-sm text-cream">
              {songs.length} {songs.length === 1 ? 'song' : 'songs'} in our playlist
            </p>
            <p className="text-[11px] text-faint">
              {playableCount > 0
                ? `${playableCount} ready to play right here`
                : 'Upload the audio files to play them right here'}
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <Loading label="Finding our soundtrack…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : songs.length === 0 ? (
        <EmptyState
          title="No songs yet"
          hint="Add the songs that belong to the two of you, and why."
          action={
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="mt-2 rounded-full bg-rose px-6 py-2.5 text-sm font-medium text-night-deep transition hover:bg-blush"
            >
              Add a song
            </button>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {songs.map((song) => (
            <SongCard
              key={song.id}
              song={song}
              queue={songs}
              onEdit={setEditing}
              onDelete={setPendingDelete}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setAddOpen(true)}
        aria-label="Add a song"
        className="fixed bottom-40 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-rose to-rose-deep text-night-deep shadow-[0_10px_30px_rgba(217,79,125,0.55)] transition hover:from-blush hover:to-rose active:scale-95"
      >
        <Plus size={24} />
      </button>

      <SongSheet
        open={addOpen || editing !== null}
        song={editing}
        onClose={() => {
          setAddOpen(false)
          setEditing(null)
        }}
        onSaved={() => void load()}
      />

      <Sheet
        open={pendingDelete !== null}
        title="Remove this song?"
        subtitle={pendingDelete?.title}
        onClose={() => setPendingDelete(null)}
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-mist">It will disappear from our playlist.</p>
          <button
            type="button"
            onClick={confirmDelete}
            className="rounded-2xl bg-rose px-6 py-3.5 font-medium text-night-deep transition hover:bg-blush"
          >
            Yes, remove it
          </button>
          <button
            type="button"
            onClick={() => setPendingDelete(null)}
            className="rounded-2xl border border-white/15 px-6 py-3.5 text-mist transition hover:bg-white/5"
          >
            Keep it
          </button>
        </div>
      </Sheet>
    </div>
  )
}
