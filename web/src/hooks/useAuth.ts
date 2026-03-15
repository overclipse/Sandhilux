import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store'
import { logout as apiLogout } from '../api/auth'

export function useAuth() {
  const { user, accessToken, clearAuth } = useAppStore()
  const navigate = useNavigate()

  const isAuthenticated = accessToken !== null
  const isAdmin = user?.role === 'admin'

  const logout = useCallback(async () => {
    try {
      await apiLogout()
    } catch {
      // ignore — clear local state regardless
    } finally {
      clearAuth()
      navigate('/login', { replace: true })
    }
  }, [clearAuth, navigate])

  return { user, isAuthenticated, isAdmin, logout }
}
