import { api } from './client'
import type { Memory, MemoryInput, Photo, PhotoInput } from '../types'

export function listMemories(search?: string): Promise<Memory[]> {
  const query = search?.trim() ? `?search=${encodeURIComponent(search.trim())}` : ''
  return api<Memory[]>(`/memories${query}`)
}

export function createMemory(input: MemoryInput): Promise<Memory> {
  return api<Memory>('/memories', { method: 'POST', body: JSON.stringify(input) })
}

export function updateMemory(id: number, input: Partial<MemoryInput>): Promise<Memory> {
  return api<Memory>(`/memories/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
}

export function deleteMemory(id: number): Promise<void> {
  return api<void>(`/memories/${id}`, { method: 'DELETE' })
}

/* --------------------------------------------------------------------------
 * Photos — the private album
 * ------------------------------------------------------------------------ */
export function listPhotos(): Promise<Photo[]> {
  return api<Photo[]>('/photos')
}

export function createPhoto(input: PhotoInput): Promise<Photo> {
  return api<Photo>('/photos', { method: 'POST', body: JSON.stringify(input) })
}

/** Upload the file itself, then the record is created in the same request. */
export async function uploadPhoto(
  file: File,
  caption?: string,
  takenOn?: string,
): Promise<Photo> {
  const form = new FormData()
  form.append('file', file)
  if (caption) form.append('caption', caption)
  if (takenOn) form.append('taken_on', takenOn)
  return api<Photo>('/photos/upload', { method: 'POST', body: form })
}

export function updatePhoto(
  id: number,
  input: { caption?: string | null; taken_on?: string | null },
): Promise<Photo> {
  return api<Photo>(`/photos/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
}

export function deletePhoto(id: number): Promise<void> {
  return api<void>(`/photos/${id}`, { method: 'DELETE' })
}
