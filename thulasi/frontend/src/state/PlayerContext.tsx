import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'

import { mediaUrl } from '../api/client'
import type { Song } from '../types'

interface PlayerContextValue {
  song: Song | null
  playing: boolean
  progress: number
  duration: number
  volume: number
  play: (song: Song, queue?: Song[]) => void
  toggle: () => void
  stop: () => void
  seek: (seconds: number) => void
  setVolume: (value: number) => void
  next: () => void
  previous: () => void
  canPlay: (song: Song) => boolean
}

const PlayerContext = createContext<PlayerContextValue | null>(null)

export function canPlaySong(song: Song): boolean {
  return Boolean(song.audio_url && song.audio_url.trim())
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [song, setSong] = useState<Song | null>(null)
  const [queue, setQueue] = useState<Song[]>([])
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolumeState] = useState(1)

  // One <audio> element for the whole app.
  useEffect(() => {
    const audio = new Audio()
    audio.preload = 'metadata'
    audioRef.current = audio

    const onTime = () => setProgress(audio.currentTime)
    const onMeta = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
    const onEnd = () => setPlaying(false)

    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onMeta)
    audio.addEventListener('ended', onEnd)

    return () => {
      audio.pause()
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onMeta)
      audio.removeEventListener('ended', onEnd)
    }
  }, [])

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  const play = useCallback((nextSong: Song, nextQueue?: Song[]) => {
    const audio = audioRef.current
    if (!audio || !canPlaySong(nextSong)) return

    if (nextQueue) setQueue(nextQueue.filter(canPlaySong))

    const source = mediaUrl(nextSong.audio_url) ?? ''
    if (audio.src !== source) {
      audio.src = source
      audio.currentTime = 0
    }
    void audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
    setSong(nextSong)
  }, [])

  const toggle = useCallback(() => {
    const audio = audioRef.current
    if (!audio || !song) return
    if (audio.paused) {
      void audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
    } else {
      audio.pause()
      setPlaying(false)
    }
  }, [song])

  const stop = useCallback(() => {
    audioRef.current?.pause()
    setPlaying(false)
    setSong(null)
    setProgress(0)
  }, [])

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = seconds
    setProgress(seconds)
  }, [])

  const setVolume = useCallback((value: number) => {
    setVolumeState(Math.min(1, Math.max(0, value)))
  }, [])

  const step = useCallback(
    (direction: 1 | -1) => {
      if (!song || queue.length === 0) return
      const index = queue.findIndex((item) => item.id === song.id)
      if (index === -1) return
      const nextIndex = (index + direction + queue.length) % queue.length
      play(queue[nextIndex], queue)
    },
    [play, queue, song],
  )

  const value = useMemo<PlayerContextValue>(
    () => ({
      song,
      playing,
      progress,
      duration,
      volume,
      play,
      toggle,
      stop,
      seek,
      setVolume,
      next: () => step(1),
      previous: () => step(-1),
      canPlay: canPlaySong,
    }),
    [song, playing, progress, duration, volume, play, toggle, stop, seek, setVolume, step],
  )

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
}

export function usePlayer(): PlayerContextValue {
  const context = useContext(PlayerContext)
  if (!context) {
    throw new Error('usePlayer must be used inside <PlayerProvider>.')
  }
  return context
}
