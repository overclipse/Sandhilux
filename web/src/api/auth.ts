import axios from 'axios'
import { API_URL } from './client'
import client from './client'
import type { AuthResponse } from '../types/api'

export async function login(email: string, password: string): Promise<AuthResponse> {
  const { data } = await axios.post<AuthResponse>(
    `${API_URL}/api/auth/login`,
    { email, password },
    { withCredentials: true },
  )
  return data
}

export async function logout(): Promise<void> {
  await client.post('/api/auth/logout')
}
