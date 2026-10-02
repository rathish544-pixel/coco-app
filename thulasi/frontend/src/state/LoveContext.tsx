import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'

import { getConfig, getPushStatus } from '../api/notifications'
import { useAuth } from './AuthContext'
import type { AppConfig, Owner, PushStatus } from '../types'

const OWNER_KEY = 'thulasi.owner'
const TOGETHER_KEY = 'thulasi.togetherSince'
export const DEFAULT_TOGETHER_DATE = '2024-01-14'

interface LoveContextValue {
  config: AppConfig | null
  loading: boolean
  loadError: string | null
  owner: Owner
  setOwner: (owner: Owner) => void
  otherOwner: Owner
  togetherSince: string
  setTogetherSince: (date: string) => void
  daysTogether: number
  pushStatus: PushStatus | null
  refreshPushStatus: () => Promise<void>
  reloadConfig: () => Promise<void>
}

const LoveContext = createContext<LoveContextValue | null>(null)

function readOwner(): Owner {
  const stored = localStorage.getItem(OWNER_KEY)
  return stored === 'her' ? 'her' : 'me'
}

function daysSince(date: string): number {
  const start = new Date(`${date}T00:00:00`)
  if (Number.isNaN(start.getTime())) return 0
  const diff = Date.now() - start.getTime()
  return Math.max(0, Math.floor(diff / 86_400_000)) + 1
}

export function LoveProvider({ children }: { children: ReactNode }) {
  const { user, owner: authOwner } = useAuth()
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [legacyOwner, setLegacyOwner] = useState<Owner>(() => readOwner())
  const [togetherSince, setTogetherSinceState] = useState<string>(
    () => localStorage.getItem(TOGETHER_KEY) || DEFAULT_TOGETHER_DATE,
  )
  const [pushStatus, setPushStatus] = useState<PushStatus | null>(null)

  // The signed-in account decides who this device notifies and who it acts as.
  // Before login completes we fall back to whatever was stored locally.
  const owner: Owner = user ? authOwner : legacyOwner
  const otherOwner: Owner = owner === 'me' ? 'her' : 'me'

  const reloadConfig = useCallback(async () => {
    try {
      const next = await getConfig()
      setConfig(next)
      setLoadError(null)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load the app.')
    } finally {
      setLoading(false)
    }
  }, [])

  const refreshPushStatus = useCallback(async () => {
    try {
      setPushStatus(await getPushStatus())
    } catch {
      /* status is a nicety — ignore failures */
    }
  }, [])

  useEffect(() => {
    void reloadConfig()
    void refreshPushStatus()
  }, [reloadConfig, refreshPushStatus])

  const setOwner = useCallback((next: Owner) => {
    localStorage.setItem(OWNER_KEY, next)
    setLegacyOwner(next)
  }, [])

  const setTogetherSince = useCallback((date: string) => {
    localStorage.setItem(TOGETHER_KEY, date)
    setTogetherSinceState(date)
  }, [])

  const value = useMemo<LoveContextValue>(
    () => ({
      config,
      loading,
      loadError,
      owner,
      setOwner,
      otherOwner,
      togetherSince,
      setTogetherSince,
      daysTogether: daysSince(togetherSince),
      pushStatus,
      refreshPushStatus,
      reloadConfig,
    }),
    [
      config,
      loading,
      loadError,
      owner,
      setOwner,
      otherOwner,
      togetherSince,
      setTogetherSince,
      pushStatus,
      refreshPushStatus,
      reloadConfig,
    ],
  )

  return <LoveContext.Provider value={value}>{children}</LoveContext.Provider>
}

export function useLove(): LoveContextValue {
  const context = useContext(LoveContext)
  if (!context) {
    throw new Error('useLove must be used inside <LoveProvider>.')
  }
  return context
}
