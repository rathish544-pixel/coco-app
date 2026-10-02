import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'

import { changePassword, login as apiLogin, logout as apiLogout, me } from '../api/auth'
import { getToken, setToken, UNAUTHORIZED_EVENT } from '../api/client'
import type { Owner, User } from '../types'

interface AuthContextValue {
  user: User | null
  /** True while we are still asking the server who we are. */
  booting: boolean
  error: string | null
  login: (username: string, password: string) => Promise<User>
  logout: () => Promise<void>
  updatePassword: (currentPassword: string, newPassword: string) => Promise<void>
  clearError: () => void
  /** Which notification owner this signed-in person is. */
  owner: Owner
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [booting, setBooting] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Restore the session after a refresh by revalidating the stored token.
  useEffect(() => {
    let cancelled = false

    async function restore() {
      if (!getToken()) {
        setBooting(false)
        return
      }
      try {
        const current = await me()
        if (!cancelled) setUser(current)
      } catch {
        setToken(null)
      } finally {
        if (!cancelled) setBooting(false)
      }
    }

    void restore()
    return () => {
      cancelled = true
    }
  }, [])

  // Any 401 from anywhere in the app drops us back to the login screen.
  useEffect(() => {
    function handleUnauthorized() {
      setToken(null)
      setUser(null)
    }
    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized)
  }, [])

  const login = useCallback(async (username: string, password: string): Promise<User> => {
    setError(null)
    try {
      const response = await apiLogin(username, password)
      setToken(response.token)
      setUser(response.user)
      return response.user
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not sign you in.'
      setError(message)
      throw err
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await apiLogout()
    } catch {
      /* local state matters more than the cookie sweep */
    }
    setToken(null)
    setUser(null)
  }, [])

  const updatePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      const updated = await changePassword(currentPassword, newPassword)
      setUser(updated)
    },
    [],
  )

  const clearError = useCallback(() => setError(null), [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      booting,
      error,
      login,
      logout,
      updatePassword,
      clearError,
      // A signed-in person always acts as their own notification owner.
      owner: user?.owner === 'her' ? 'her' : 'me',
    }),
    [user, booting, error, login, logout, updatePassword, clearError],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>.')
  }
  return context
}
