/** Thin fetch wrapper with a readable error message for the UI. */

const CONFIGURED = import.meta.env.VITE_API_URL?.trim()

/**
 * In development we hit the Vite proxy at /api so a phone on the same
 * network can reach the backend without CORS or a hard-coded IP.
 */
const API_BASE = CONFIGURED ? CONFIGURED.replace(/\/$/, '') : '/api'

const TOKEN_KEY = 'thulasi.token'

/**
 * Fired whenever the server answers 401, so the app can bounce to the login
 * screen no matter which call discovered the expired session first.
 */
export const UNAUTHORIZED_EVENT = 'thulasi:unauthorized'

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/* --------------------------------------------------------------------------
 * Session token
 * ------------------------------------------------------------------------ */
export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    // Private browsing modes can throw on storage access.
    return null
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* nothing useful we can do — the cookie still keeps the session alive */
  }
}

async function parseError(response: Response): Promise<string> {
  try {
    const body = await response.json()
    if (typeof body?.detail === 'string') return body.detail
    if (Array.isArray(body?.detail) && body.detail[0]?.msg) return body.detail[0].msg
  } catch {
    /* fall through to the generic message */
  }
  return `Request failed (${response.status})`
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken()

  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      // Lets the http-only session cookie ride along as well as the header.
      credentials: 'include',
      headers: {
        ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    })
  } catch {
    throw new ApiError('Cannot reach the server. Is the backend running?', 0)
  }

  if (response.status === 401 && path !== '/auth/me') {
    window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT))
  }

  if (!response.ok) {
    throw new ApiError(await parseError(response), response.status)
  }

  if (response.status === 204) {
    return undefined as T
  }
  return (await response.json()) as T
}

/**
 * Full URL for a media path returned by the API.
 *
 * Media is stored with a relative path ("/media/x.jpg") so it works from any
 * host, but older rows may still hold "http://localhost:8000/media/x.jpg".
 * Both forms are normalised onto API_BASE so a phone never asks its own
 * localhost for an image.
 */
export function mediaUrl(url: string | null | undefined): string | null {
  if (!url) return null

  const marker = '/media/'
  const index = url.indexOf(marker)
  if (index >= 0) {
    return `${API_BASE}${url.slice(index)}`
  }

  if (url.startsWith('http')) return url
  return `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`
}
