import { api } from './client'
import type {
  AppConfig,
  LoveNote,
  MissYouResult,
  Owner,
  PushStatus,
  UploadResult,
} from '../types'

export function getConfig(): Promise<AppConfig> {
  return api<AppConfig>('/config')
}

export function getPushStatus(): Promise<PushStatus> {
  return api<PushStatus>('/push/status')
}

export function subscribeToPush(
  owner: Owner,
  subscription: PushSubscriptionJSON,
  label?: string,
): Promise<{ status: string; owner: string; devices_for_owner: number }> {
  return api('/push/subscribe', {
    method: 'POST',
    body: JSON.stringify({ owner, subscription, label }),
  })
}

export function unsubscribeFromPush(endpoint: string): Promise<{ status: string }> {
  return api('/push/unsubscribe', { method: 'POST', body: JSON.stringify({ endpoint }) })
}

export function sendMissYou(
  sender: Owner,
  message?: string,
): Promise<MissYouResult> {
  return api<MissYouResult>('/miss-you', {
    method: 'POST',
    body: JSON.stringify({ sender, message: message?.trim() || null }),
  })
}

export function sendTestPush(
  owner: Owner,
): Promise<{ status: string; devices_notified: number }> {
  return api('/push/test', { method: 'POST', body: JSON.stringify({ owner }) })
}

export function recentNotes(limit = 8): Promise<LoveNote[]> {
  return api<LoveNote[]>(`/miss-you/recent?limit=${limit}`)
}

export async function uploadMedia(file: File): Promise<UploadResult> {
  const form = new FormData()
  form.append('file', file)
  return api<UploadResult>('/media', { method: 'POST', body: form })
}
