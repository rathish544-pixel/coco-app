import { useCallback, useEffect, useState } from 'react'
import { Camera, Plus } from 'lucide-react'

import { deletePhoto, listPhotos } from '../api/memories'
import { mediaUrl } from '../api/client'
import { AddPhotoSheet } from '../components/AddPhotoSheet'
import { EmptyState, ErrorState, Loading } from '../components/Loading'
import { Lightbox } from '../components/Lightbox'
import { Sheet } from '../components/Sheet'
import { useToast } from '../components/Toast'
import type { Photo } from '../types'

export function Photos() {
  const { notify } = useToast()
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [viewing, setViewing] = useState<number | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Photo | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setPhotos(await listPhotos())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load our photos.')
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
      await deletePhoto(pendingDelete.id)
      setPhotos((current) => current.filter((photo) => photo.id !== pendingDelete.id))
      // Close the viewer if the photo being deleted is the one on screen.
      setViewing((current) => {
        if (current === null) return current
        const removedIndex = photos.findIndex((photo) => photo.id === pendingDelete.id)
        if (current !== removedIndex) return current
        return current >= photos.length - 1 ? null : current
      })
      notify('Photo removed from the album.')
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not delete that.', 'warn')
    } finally {
      setPendingDelete(null)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {!loading && !error && photos.length > 0 && (
        <div className="glass flex items-center justify-between rounded-soft px-4 py-3">
          <div className="flex items-center gap-3">
            <Camera className="text-rose" size={20} />
            <div>
              <p className="text-sm text-cream">
                {photos.length} {photos.length === 1 ? 'photo' : 'photos'} in our album
              </p>
              <p className="text-[11px] text-faint">Only the two of us can see these</p>
            </div>
          </div>
          <span aria-hidden className="text-lg text-rose/70">
            ♥
          </span>
        </div>
      )}

      {loading ? (
        <Loading label="Opening our album…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : photos.length === 0 ? (
        <EmptyState
          title="No photos yet"
          hint="Add your first picture and it will live here forever — even after you close the app."
          action={
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="mt-2 rounded-full bg-rose px-6 py-2.5 text-sm font-medium text-night-deep transition hover:bg-blush"
            >
              Add a photo
            </button>
          }
        />
      ) : (
        /* Natural aspect ratios give a quiet album feel rather than a rigid grid. */
        <div className="columns-2 gap-3 sm:columns-3 [&>*]:mb-3 [&>*]:break-inside-avoid">
          {photos.map((photo, index) => {
            const source = mediaUrl(photo.url)
            return (
              <button
                key={photo.id}
                type="button"
                onClick={() => setViewing(index)}
                aria-label={`Open photo ${index + 1}`}
                className="glass group relative block w-full overflow-hidden rounded-2xl text-left transition hover:border-rose/40 active:scale-[0.99]"
              >
                {source && (
                  <img
                    src={source}
                    alt={photo.caption ?? 'Our photo'}
                    loading="lazy"
                    className="w-full transition duration-500 group-hover:scale-[1.04]"
                  />
                )}

                {(photo.caption || photo.taken_on) && (
                  <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-night-deep/90 via-night-deep/50 to-transparent px-3 pb-2.5 pt-8">
                    {photo.caption && (
                      <span className="font-hand block truncate text-lg leading-tight text-cream">
                        {photo.caption}
                      </span>
                    )}
                    {photo.taken_on && (
                      <span className="block text-[10px] uppercase tracking-wider text-mist/70">
                        {photo.taken_on}
                      </span>
                    )}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      <button
        type="button"
        onClick={() => setAddOpen(true)}
        aria-label="Add a photo"
        className="fixed bottom-40 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-rose to-rose-deep text-night-deep shadow-[0_10px_30px_rgba(217,79,125,0.55)] transition hover:from-blush hover:to-rose active:scale-95"
      >
        <Plus size={24} />
      </button>

      <AddPhotoSheet open={addOpen} onClose={() => setAddOpen(false)} onSaved={() => void load()} />

      {viewing !== null && photos[viewing] && (
        <Lightbox
          photos={photos}
          index={viewing}
          onIndexChange={setViewing}
          onClose={() => setViewing(null)}
          onDelete={setPendingDelete}
        />
      )}

      <Sheet
        open={pendingDelete !== null}
        title="Delete this photo?"
        subtitle={pendingDelete?.caption ?? undefined}
        onClose={() => setPendingDelete(null)}
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-mist">
            It leaves the album. If a memory still shows this picture, the file itself is kept.
          </p>
          <button
            type="button"
            onClick={confirmDelete}
            className="rounded-2xl bg-rose px-6 py-3.5 font-medium text-night-deep transition hover:bg-blush"
          >
            Yes, delete it
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
