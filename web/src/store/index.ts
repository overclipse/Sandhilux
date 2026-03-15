import { create } from 'zustand'
import type { Alert, Endpoint, User } from '../types/api'

interface AppState {
  // Auth
  accessToken: string | null
  user: User | null
  setAuth: (token: string, user: User) => void
  clearAuth: () => void

  // Endpoints
  endpoints: Endpoint[]
  setEndpoints: (endpoints: Endpoint[]) => void
  updateEndpoint: (patch: {
    endpoint_id: string
    is_up: boolean
    latency_ms: number
    status_code: number
    status: Endpoint['status']
    checked_at: string
  }) => void

  // Alerts
  alerts: Alert[]
  setAlerts: (alerts: Alert[]) => void
  addAlert: (alert: Alert) => void
  resolveAlert: (alertId: string) => void

  // Active alerts count (for sidebar badge)
  activeAlertsCount: number
}

export const useAppStore = create<AppState>((set) => ({
  // Auth (временно — bypass авторизации)
  accessToken: 'dev',
  user: { id: '1', email: 'dev@local', role: 'admin', created_at: new Date().toISOString() },
  setAuth: (token, user) => set({ accessToken: token, user }),
  clearAuth: () => set({ accessToken: null, user: null }),

  // Endpoints
  endpoints: [],
  setEndpoints: (endpoints) => set({ endpoints }),
  updateEndpoint: (patch) =>
    set((state) => ({
      endpoints: state.endpoints.map((ep) =>
        ep.id === patch.endpoint_id
          ? {
              ...ep,
              status: patch.status,
              avg_latency: patch.latency_ms,
              last_checked_at: patch.checked_at,
            }
          : ep,
      ),
    })),

  // Alerts
  alerts: [],
  setAlerts: (alerts) =>
    set({
      alerts,
      activeAlertsCount: alerts.filter((a) => a.status === 'active').length,
    }),
  addAlert: (alert) =>
    set((state) => {
      const alerts = [alert, ...state.alerts]
      return {
        alerts,
        activeAlertsCount: alerts.filter((a) => a.status === 'active').length,
      }
    }),
  resolveAlert: (alertId) =>
    set((state) => {
      const alerts = state.alerts.map((a) =>
        a.id === alertId
          ? { ...a, status: 'resolved' as const, resolved_at: new Date().toISOString() }
          : a,
      )
      return {
        alerts,
        activeAlertsCount: alerts.filter((a) => a.status === 'active').length,
      }
    }),

  activeAlertsCount: 0,
}))
