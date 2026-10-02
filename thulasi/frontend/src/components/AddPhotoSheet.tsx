import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Loader2, Trash2 } from 'lucide-react'

import { uploadPhoto } from '../api/memories'
import { Sheet } from './Sheet'
import { TextField } from './Field'
import { useToast } from './Toast'

const MAX_IMAGE_BYTES = 25 * 1024 * 1024
const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

interface AddPhotoSheetProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
}

/**
 * The full flow: choose a photo, see it, add words, save.
 * The file goes up at save time so nothing is stored if you back out.
 */
export function AddPhotoSheet({ open, onClose, onSaved }: AddPhotoSheetProps) {
  const { notify } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [takenOn, setTakenOn] = useState('')
  const [saving, setSaving] = useState(false)

  function reset() {
    setFile(null)
    setCaption('')
    setTakenOn('')
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null)
    if (fileRef.current) fileRef.current.value = ''
    if (cameraRef.current) cameraRef.current.value = ''
    if (galleryRef.current) galleryRef.current.value = ''
  }

  // Release the object URL whenever the sheet closes.
  useEffect(() => {
    if (open) return
    const timer = window.setTimeout(reset, 250)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function pick(next: File | undefined) {
    if (!next) return
    if (!ACCEPTED_TYPES.includes(next.type)) {
      notify('Use a JPG, PNG or WebP image.', 'warn')
      return
    }
    if (next.size > MAX_IMAGE_BYTES) {
      notify('That photo is over 25 MB. Try a smaller one.', 'warn')
      return
    }
    if (preview) URL.revokeObjectURL(preview)
    setFile(next)
    setPreview(URL.createObjectURL(next))
  }

  async function handleSave() {
    if (!file) {
      notify('Choose a photo first.', 'warn')
      return
    }
    setSaving(true)
    try {
      await uploadPhoto(file, caption.trim() || undefined, takenOn || undefined)
      notify('Added to our album 💗')
      reset()
      onSaved()
      onClose()
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not save that photo.', 'warn')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet
      open={open}
      title="Add a photo"
      subtitle="JPG, PNG or WebP · up to 25 MB"
      onClose={onClose}
    >
      <div className="flex flex-col gap-4">
        <div className="relative flex h-56 w-full items-center justify-center overflow-hidden rounded-2xl border border-dashed border-white/25 bg-white/5">
          {preview ? (
            <img src={preview} alt="Preview" className="h-full w-full object-cover" />
          ) : (
            <span className="flex flex-col items-center gap-2 text-faint">
              <ImagePlus size={26} />
              <span className="text-sm">Choose a photo</span>
              <span className="text-[11px] text-faint/70">from your camera or gallery</span>
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="rounded-2xl border border-white/15 px-4 py-3 text-sm text-mist transition hover:bg-white/5"
          >
            📷 Take photo
          </button>
          <button
            type="button"
            onClick={() => galleryRef.current?.click()}
            className="rounded-2xl border border-rose/40 bg-rose/10 px-4 py-3 text-sm text-cream transition hover:bg-rose/20"
          >
            🖼️ Choose from gallery
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(event) => pick(event.target.files?.[0])}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          hidden
          onChange={(event) => pick(event.target.files?.[0])}
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(event) => pick(event.target.files?.[0])}
        />

        {file && (
          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5">
            <p className="truncate text-xs text-mist">
              {file.name} · {(file.size / (1024 * 1024)).toFixed(1)} MB
            </p>
            <button
              type="button"
              onClick={reset}
              className="flex items-center gap-1.5 text-xs text-faint transition hover:text-blush"
            >
              <Trash2 size={13} /> Clear
            </button>
          </div>
        )}

        <TextField
          label="Caption (optional)"
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
          placeholder="What was happening here…"
          maxLength={300}
        />

        <TextField
          label="Date (optional)"
          type="date"
          value={takenOn}
          onChange={(event) => setTakenOn(event.target.value)}
        />

        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !file}
          className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose to-rose-deep px-6 py-4 font-medium text-night-deep transition hover:from-blush hover:to-rose disabled:opacity-60"
        >
          {saving && <Loader2 className="animate-spin" size={18} />}
          {saving ? 'Uploading…' : 'Save to our album'}
        </button>

        <p className="text-center text-xs text-faint">
          Photos are stored on the server, so they’re still here after you close the app.
        </p>
      </div>
    </Sheet>
  )
}
