import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Loader2, Trash2 } from 'lucide-react'

import { api } from '../api/client'
import { createMemory, updateMemory } from '../api/memories'
import { uploadMedia } from '../api/notifications'
import { Sheet } from './Sheet'
import { TextArea, TextField } from './Field'
import { useToast } from './Toast'
import type { Memory } from '../types'

/** Same limits the backend enforces — checked early for a friendly message. */
const MAX_IMAGE_BYTES = 25 * 1024 * 1024
const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

interface MemorySheetProps {
  open: boolean
  /** When present the sheet edits this memory instead of creating one. */
  memory?: Memory | null
  onClose: () => void
  onSaved: () => void
}

export function MemorySheet({ open, memory, onClose, onSaved }: MemorySheetProps) {
  const { notify } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)

  const editing = Boolean(memory)

  const [title, setTitle] = useState('')
  const [story, setStory] = useState('')
  const [caption, setCaption] = useState('')
  const [place, setPlace] = useState('')
  const [happenedOn, setHappenedOn] = useState('')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Load the record whenever the editor opens.
  useEffect(() => {
    if (!open) return
    setTitle(memory?.title ?? '')
    setStory(memory?.story ?? '')
    setCaption(memory?.caption ?? '')
    setPlace(memory?.place ?? '')
    setHappenedOn(memory?.happened_on ?? '')
    setImageUrl(memory?.image_url ?? null)
    if (fileRef.current) fileRef.current.value = ''
  }, [open, memory])

  async function handleFile(file: File | undefined) {
    if (!file) return
    if (!ACCEPTED_TYPES.includes(file.type)) {
      notify('Use a JPG, PNG or WebP image.', 'warn')
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      notify('That photo is over 25 MB. Try a smaller one.', 'warn')
      return
    }
    setUploading(true)
    try {
      const uploaded = await uploadMedia(file)
      setImageUrl(uploaded.url)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Upload failed.', 'warn')
    } finally {
      setUploading(false)
    }
  }

  function clearPhoto() {
    setImageUrl(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleSave() {
    if (!title.trim()) {
      notify('Give this memory a name first.', 'warn')
      return
    }
    setSaving(true)
    try {
      if (editing && memory) {
        const photoChanged = (memory.image_url ?? null) !== imageUrl
        await updateMemory(memory.id, {
          title: title.trim(),
          story: story.trim() || null,
          caption: caption.trim() || null,
          place: place.trim() || null,
          happened_on: happenedOn || null,
          image_url: imageUrl,
        })
        // Best-effort tidy-up: drop the old file if nothing else shows it.
        if (photoChanged && memory.image_url) {
          const previous = memory.image_url
          void fetchRemovedMedia(previous)
        }
        notify('Memory updated 💗')
      } else {
        await createMemory({
          title: title.trim(),
          story: story.trim() || null,
          caption: caption.trim() || null,
          place: place.trim() || null,
          happened_on: happenedOn || null,
          image_url: imageUrl,
        })
        notify('Saved to our memories 💗')
      }
      onSaved()
      onClose()
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not save that.', 'warn')
    } finally {
      setSaving(false)
    }
  }

  async function fetchRemovedMedia(url: string) {
    try {
      const filename = url.split('/media/').pop()
      if (filename) await api(`/media/${encodeURIComponent(filename)}`, { method: 'DELETE' })
    } catch {
      /* still referenced, or already gone — either is fine */
    }
  }

  return (
    <Sheet
      open={open}
      title={editing ? 'Edit memory' : 'Add a memory'}
      subtitle={editing ? 'Change the details of this moment.' : 'A moment you want to keep forever.'}
      onClose={onClose}
    >
      <div className="flex flex-col gap-4">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="relative flex h-44 w-full items-center justify-center overflow-hidden rounded-2xl border border-dashed border-white/25 bg-white/5 transition hover:border-rose/50"
        >
          {imageUrl ? (
            <img src={imageUrl} alt="" className="h-full w-full object-cover" />
          ) : uploading ? (
            <span className="flex flex-col items-center gap-2 text-faint">
              <Loader2 className="animate-spin" size={22} />
              <span className="text-sm">Uploading…</span>
            </span>
          ) : (
            <span className="flex flex-col items-center gap-2 text-faint">
              <ImagePlus size={24} />
              <span className="text-sm">Add a photo</span>
              <span className="text-[11px] text-faint/70">JPG, PNG or WebP · up to 25 MB</span>
            </span>
          )}
        </button>

        {imageUrl && (
          <button
            type="button"
            onClick={clearPhoto}
            className="flex items-center justify-center gap-1.5 text-xs text-faint transition hover:text-blush"
          >
            <Trash2 size={13} /> Remove photo
          </button>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(event) => void handleFile(event.target.files?.[0])}
        />

        <TextField
          label="Title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="The day we met"
          maxLength={200}
        />

        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Date"
            type="date"
            value={happenedOn}
            onChange={(event) => setHappenedOn(event.target.value)}
          />
          <TextField
            label="Place"
            value={place}
            onChange={(event) => setPlace(event.target.value)}
            placeholder="Where we were"
          />
        </div>

        <TextArea
          label="The story"
          rows={4}
          value={story}
          onChange={(event) => setStory(event.target.value)}
          placeholder="What made this day special…"
        />

        <TextField
          label="Caption (optional)"
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
          placeholder="A short line for the photo"
          maxLength={300}
        />

        <button
          type="button"
          onClick={handleSave}
          disabled={saving || uploading}
          className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose to-rose-deep px-6 py-4 font-medium text-night-deep transition hover:from-blush hover:to-rose disabled:opacity-60"
        >
          {saving && <Loader2 className="animate-spin" size={18} />}
          {editing ? 'Save changes' : 'Keep this memory'}
        </button>
      </div>
    </Sheet>
  )
}
