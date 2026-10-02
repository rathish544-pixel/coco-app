import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Loader2, Music, Trash2, Upload } from 'lucide-react'

import { createSong, updateSong } from '../api/songs'
import { uploadMedia } from '../api/notifications'
import { Sheet } from './Sheet'
import { TextArea, TextField } from './Field'
import { useToast } from './Toast'
import type { Song } from '../types'

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

interface SongSheetProps {
  open: boolean
  /** Present when editing; null/undefined when adding. */
  song?: Song | null
  onClose: () => void
  onSaved: () => void
}

export function SongSheet({ open, song, onClose, onSaved }: SongSheetProps) {
  const { notify } = useToast()
  const audioRef = useRef<HTMLInputElement>(null)
  const coverRef = useRef<HTMLInputElement>(null)

  const editing = Boolean(song)

  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [note, setNote] = useState('')
  const [externalUrl, setExternalUrl] = useState('')
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioName, setAudioName] = useState<string | null>(null)
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const [uploadingAudio, setUploadingAudio] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setTitle(song?.title ?? '')
    setArtist(song?.artist ?? '')
    setNote(song?.note ?? '')
    setExternalUrl(song?.external_url ?? '')
    setAudioUrl(song?.audio_url ?? null)
    setCoverUrl(song?.cover_url ?? null)
    setAudioName(null)
    if (audioRef.current) audioRef.current.value = ''
    if (coverRef.current) coverRef.current.value = ''
  }, [open, song])

  async function pickAudio(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('audio/')) {
      notify('Choose an audio file (MP3, M4A, WAV, OGG…).', 'warn')
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      notify('That audio file is over 25 MB.', 'warn')
      return
    }
    setUploadingAudio(true)
    try {
      const uploaded = await uploadMedia(file)
      setAudioUrl(uploaded.url)
      setAudioName(file.name)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Upload failed.', 'warn')
    } finally {
      setUploadingAudio(false)
    }
  }

  async function pickCover(file: File | undefined) {
    if (!file) return
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
      notify('Use a JPG, PNG or WebP image for the cover.', 'warn')
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      notify('That cover is over 25 MB.', 'warn')
      return
    }
    setUploadingCover(true)
    try {
      const uploaded = await uploadMedia(file)
      setCoverUrl(uploaded.url)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Upload failed.', 'warn')
    } finally {
      setUploadingCover(false)
    }
  }

  async function handleSave() {
    if (!title.trim()) {
      notify('What is this song called?', 'warn')
      return
    }
    setSaving(true)
    try {
      const payload = {
        title: title.trim(),
        artist: artist.trim() || null,
        note: note.trim() || null,
        audio_url: audioUrl,
        cover_url: coverUrl,
        external_url: externalUrl.trim() || null,
      }

      if (editing && song) {
        await updateSong(song.id, payload)
        notify('Song updated 🎵')
      } else {
        await createSong(payload)
        notify('Added to our songs 🎵')
      }
      onSaved()
      onClose()
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not save that.', 'warn')
    } finally {
      setSaving(false)
    }
  }

  const busy = saving || uploadingAudio || uploadingCover

  return (
    <Sheet
      open={open}
      title={editing ? 'Edit song' : 'Add a song'}
      subtitle={editing ? 'Update this one in our playlist.' : 'Something that sounds like us.'}
      onClose={onClose}
    >
      <div className="flex flex-col gap-4">
        <TextField
          label="Song title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Our song"
          maxLength={200}
        />
        <TextField
          label="Artist"
          value={artist}
          onChange={(event) => setArtist(event.target.value)}
          placeholder="Who sings it"
        />

        {/* ---------- cover ---------- */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => coverRef.current?.click()}
            aria-label="Choose cover art"
            className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-white/25 bg-white/5 transition hover:border-rose/50"
          >
            {coverUrl ? (
              <img src={coverUrl} alt="" className="h-full w-full object-cover" />
            ) : uploadingCover ? (
              <Loader2 className="animate-spin text-faint" size={20} />
            ) : (
              <ImagePlus size={22} className="text-faint" />
            )}
          </button>
          <div className="min-w-0 flex-1 text-xs text-faint">
            <p className="mb-1 text-[11px] uppercase tracking-[0.2em]">Cover image</p>
            <p>Optional artwork for the player. JPG, PNG or WebP.</p>
            {coverUrl && (
              <button
                type="button"
                onClick={() => setCoverUrl(null)}
                className="mt-1.5 flex items-center gap-1.5 transition hover:text-blush"
              >
                <Trash2 size={12} /> Remove cover
              </button>
            )}
          </div>
        </div>

        <input
          ref={coverRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(event) => void pickCover(event.target.files?.[0])}
        />

        {/* ---------- audio ---------- */}
        <button
          type="button"
          onClick={() => audioRef.current?.click()}
          className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-white/25 bg-white/5 px-4 py-4 text-sm text-faint transition hover:border-rose/50 hover:text-cream"
        >
          {uploadingAudio ? (
            <>
              <Loader2 className="animate-spin" size={17} /> Uploading…
            </>
          ) : audioUrl ? (
            <>
              <Music size={17} className="text-rose" /> {audioName ?? 'Audio attached'}
            </>
          ) : (
            <>
              <Upload size={17} /> Upload the audio file
            </>
          )}
        </button>

        <input
          ref={audioRef}
          type="file"
          accept="audio/*"
          hidden
          onChange={(event) => void pickAudio(event.target.files?.[0])}
        />

        {audioUrl && (
          <button
            type="button"
            onClick={() => {
              setAudioUrl(null)
              setAudioName(null)
              if (audioRef.current) audioRef.current.value = ''
            }}
            className="flex items-center justify-center gap-1.5 text-xs text-faint transition hover:text-blush"
          >
            <Trash2 size={13} /> Remove audio
          </button>
        )}

        <TextField
          label="Spotify / YouTube link"
          value={externalUrl}
          onChange={(event) => setExternalUrl(event.target.value)}
          placeholder="https://open.spotify.com/track/…"
          inputMode="url"
        />

        <TextArea
          label="Why it's ours"
          rows={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="The night we danced in the kitchen to this…"
        />

        <button
          type="button"
          onClick={handleSave}
          disabled={busy}
          className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose to-rose-deep px-6 py-4 font-medium text-night-deep transition hover:from-blush hover:to-rose disabled:opacity-60"
        >
          {saving && <Loader2 className="animate-spin" size={18} />}
          {editing ? 'Save changes' : 'Add to our songs'}
        </button>
      </div>
    </Sheet>
  )
}
