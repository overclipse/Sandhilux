import axios from 'axios'
import { useAppStore } from '../store'

export const API_URL = import.meta.env.VITE_API_URL ?? ''

const client = axios.create({
  baseURL: API_URL,
})

// Attach access token to every request
client.interceptors.request.use((config) => {
  const token = useAppStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 401 → clear auth and redirect to login
client.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      useAppStore.getState().clearAuth()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)

export default client
