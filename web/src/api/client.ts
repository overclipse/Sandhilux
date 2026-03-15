import axios from 'axios'
import { useAppStore } from '../store'

export const API_URL = import.meta.env.VITE_API_URL ?? ''

const client = axios.create({
  baseURL: API_URL,
  withCredentials: true, // send httpOnly refresh cookie
})

// Attach access token to every request
client.interceptors.request.use((config) => {
  const token = useAppStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

let isRefreshing = false
let failedQueue: Array<{
  resolve: (token: string) => void
  reject: (err: unknown) => void
}> = []

function processQueue(err: unknown, token: string | null) {
  failedQueue.forEach((p) => (err ? p.reject(err) : p.resolve(token!)))
  failedQueue = []
}

// 401 → try refresh → retry original request
client.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error)
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject })
      }).then((token) => {
        original.headers.Authorization = `Bearer ${token}`
        return client(original)
      })
    }

    original._retry = true
    isRefreshing = true

    try {
      const { data } = await axios.post(
        `${API_URL}/api/auth/refresh`,
        {},
        { withCredentials: true },
      )
      const newToken: string = data.access_token
      useAppStore.getState().setAuth(newToken, useAppStore.getState().user!)
      processQueue(null, newToken)
      original.headers.Authorization = `Bearer ${newToken}`
      return client(original)
    } catch (err) {
      processQueue(err, null)
      useAppStore.getState().clearAuth()
      window.location.href = '/login'
      return Promise.reject(err)
    } finally {
      isRefreshing = false
    }
  },
)

export default client
