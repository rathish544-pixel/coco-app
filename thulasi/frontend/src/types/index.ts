export type Owner = 'me' | 'her'

/* ----- private login ----- */
export interface User {
  id: number
  username: string
  display_name: string
  owner: Owner
  last_login_at: string | null
}

/** A row from GET /auth/accounts — names only, never passwords. */
export interface Account {
  username: string
  display_name: string
  owner: Owner
}

export interface LoginResponse {
  token: string
  expires_at: number
  user: User
}

/* ----- the private album ----- */
export interface Photo {
  id: number
  url: string
  caption: string | null
  taken_on: string | null
  size_bytes: number | null
  content_type: string | null
  created_at: string
}

export interface PhotoInput {
  url: string
  caption?: string | null
  taken_on?: string | null
}

export interface Memory {
  id: number
  title: string
  story: string | null
  happened_on: string | null
  place: string | null
  image_url: string | null
  caption: string | null
  created_at: string
}

export interface MemoryInput {
  title: string
  story?: string | null
  happened_on?: string | null
  place?: string | null
  image_url?: string | null
  caption?: string | null
}

export interface Song {
  id: number
  title: string
  artist: string | null
  note: string | null
  audio_url: string | null
  cover_url: string | null
  external_url: string | null
  created_at: string
}

export interface SongInput {
  title: string
  artist?: string | null
  note?: string | null
  audio_url?: string | null
  cover_url?: string | null
  external_url?: string | null
}

export interface AppConfig {
  app_name: string
  version: string
  my_name: string
  her_name: string
  push_enabled: boolean
  vapid_public_key: string
}

export interface PushStatus {
  push_enabled: boolean
  her_devices: number
  my_devices: number
  her_name: string
  my_name: string
}

export interface LoveNote {
  id: number
  sender: string
  message: string
  delivered: number
  created_at: string
}

export interface MissYouResult {
  status: string
  message: string
  devices_notified: number
  recipient: string
}

export interface UploadResult {
  url: string
  filename: string
  content_type: string
  size: number
}
