import { api } from './client'
import type { Account, LoginResponse, User } from '../types'

export function listAccounts(): Promise<Account[]> {
  return api<Account[]>('/auth/accounts')
}

export function login(username: string, password: string): Promise<LoginResponse> {
  return api<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export function logout(): Promise<{ status: string }> {
  return api('/auth/logout', { method: 'POST' })
}

/** Who am I? Returns the live session, or rejects when the token is stale. */
export function me(): Promise<User> {
  return api<User>('/auth/me')
}

export function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<User> {
  return api<User>('/auth/password', {
    method: 'POST',
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  })
}
