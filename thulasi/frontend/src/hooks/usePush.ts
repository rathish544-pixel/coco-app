import { useCallback, useEffect, useState } from 'react'

import { subscribeToPush, unsubscribeFromPush } from '../api/notifications'
import { useLove } from '../state/LoveContext'
import type { Owner } from '../types'

export type PushState =
  | 'unsupported'
  | 'checking'
  | 'off'
  | 'denied'
  | 'on'
  | 'blocked'

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalised = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(normalised)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i)
  return output
}

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext === true &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    })
    await registration.update().catch(() => undefined)
    await navigator.serviceWorker.ready
    return registration
  } catch {
    return null
  }
}

export function usePush() {
  const { config, owner, refreshPushStatus } = useLove()
  const [state, setState] = useState<PushState>('checking')
  const [endpoint, setEndpoint] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const inspect = useCallback(async () => {
    if (!pushSupported()) return void setState('unsupported')
    if (!config?.vapid_public_key) return void setState('blocked')
    if (Notification.permission === 'denied') return void setState('denied')

    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    if (subscription) {
      setEndpoint(subscription.endpoint)
      setState('on')
    } else {
      setEndpoint(null)
      setState('off')
    }
  }, [config?.vapid_public_key])

  useEffect(() => {
    void registerServiceWorker()
  }, [])

  useEffect(() => {
    void inspect()
  }, [inspect])

  const enable = useCallback(
    async (asOwner: Owner = owner): Promise<boolean> => {
      if (!pushSupported()) {
        setState('unsupported')
        setMessage('This browser cannot show notifications. Try Chrome on Android.')
        return false
      }
      if (!config?.vapid_public_key) {
        setState('blocked')
        setMessage('The server has no VAPID keys yet. Run the key script, then restart it.')
        return false
      }

      setBusy(true)
      setMessage(null)
      try {
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') {
          setState('denied')
          setMessage('Notifications are blocked. Allow them in your browser settings.')
          return false
        }

        const registration = await registerServiceWorker()
        if (!registration) {
          setState('unsupported')
          setMessage('This phone could not register Coco notifications. Open Coco in Chrome over the HTTPS link.')
          return false
        }

        const existing = await registration.pushManager.getSubscription()
        const applicationServerKey = urlBase64ToUint8Array(config.vapid_public_key)
        const subscription =
          existing ??
          (await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
          }))

        await subscribeToPush(
          asOwner,
          subscription.toJSON() as PushSubscriptionJSON,
          navigator.userAgent.includes('Android') ? 'Android phone' : 'This device',
        )

        setEndpoint(subscription.endpoint)
        setState('on')
        setMessage('Notifications are on for this phone. 💗')
        await refreshPushStatus()
        return true
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Could not turn on notifications.')
        return false
      } finally {
        setBusy(false)
      }
    },
    [config?.vapid_public_key, owner, refreshPushStatus],
  )

  const disable = useCallback(async () => {
    setBusy(true)
    setMessage(null)
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        await unsubscribeFromPush(subscription.endpoint).catch(() => undefined)
        await subscription.unsubscribe()
      }
      setEndpoint(null)
      setState('off')
      setMessage('Notifications turned off for this phone.')
      await refreshPushStatus()
    } finally {
      setBusy(false)
    }
  }, [refreshPushStatus])

  return { state, endpoint, busy, message, setMessage, enable, disable, refresh: inspect }
}
