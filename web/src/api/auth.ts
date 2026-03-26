import client from './client'
import type { User } from '../types/api'

/** Check if first-time setup is required (no users exist yet). */
export async function authStatus(): Promise<{ setup_required: boolean }> {
  const { data } = await client.get('/api/auth/status')
  return data
}

/** Login with email + password. Returns JWT. */
export async function login(email: string, password: string): Promise<{ token: string }> {
  const { data } = await client.post('/api/auth/login', { email, password })
  return data
}

/** Create first admin account (only works when no users exist). Returns JWT. */
export async function setup(email: string, password: string, name?: string): Promise<{ token: string }> {
  const { data } = await client.post('/api/auth/setup', { email, password, name })
  return data
}

/** Fetch current user profile from JWT. */
export async function fetchMe(): Promise<User> {
  const { data } = await client.get<User>('/api/me')
  return data
}

/** Register a new viewer account with username + password. */
export async function register(username: string, password: string, name?: string): Promise<{ token: string }> {
  const { data } = await client.post('/api/auth/register', { username, password, name })
  return data
}

/** Logout (clears server-side state if any). */
export async function logout(): Promise<void> {
  await client.post('/api/auth/logout')
}

/** Decode JWT payload to User without an API call. */
export function decodeToken(token: string): User | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return {
      id: payload.user_id,
      email: payload.email,
      role: payload.role,
      name: payload.name || '',
      avatar_url: payload.avatar_url || '',
      created_at: '',
    }
  } catch {
    return null
  }
}
