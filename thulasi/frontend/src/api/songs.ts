import { api } from './client'
import type { Song, SongInput } from '../types'

export function listSongs(): Promise<Song[]> {
  return api<Song[]>('/songs')
}

export function createSong(input: SongInput): Promise<Song> {
  return api<Song>('/songs', { method: 'POST', body: JSON.stringify(input) })
}

export function updateSong(id: number, input: Partial<SongInput>): Promise<Song> {
  return api<Song>(`/songs/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
}

export function deleteSong(id: number): Promise<void> {
  return api<void>(`/songs/${id}`, { method: 'DELETE' })
}
