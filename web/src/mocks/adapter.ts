import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios'
import {
  MOCK_ENDPOINTS,
  MOCK_OVERVIEW,
  MOCK_LATENCY,
  MOCK_UPTIME,
  MOCK_STATS,
  MOCK_RULES,
  MOCK_HISTORY,
  MOCK_ALERTS,
  MOCK_USERS,
  MOCK_TELEGRAM,
  MOCK_DASHBOARD_LATENCY,
  MOCK_DASHBOARD_UPTIME,
} from './data'

function ok(data: unknown) {
  return Promise.resolve({ data, status: 200, statusText: 'OK', headers: {}, config: {} as InternalAxiosRequestConfig })
}

export const mockAdapter: AxiosAdapter = (config) => {
  const url = config.url ?? ''

  // Auth
  if (url.includes('/api/auth/')) return ok({})

  // Me
  if (url === '/api/me') return ok(MOCK_USERS[0])

  // Endpoints list
  if (url === '/api/endpoints' && config.method === 'get') return ok(MOCK_ENDPOINTS)

  // Endpoint check now
  if (/\/api\/endpoints\/.+\/check/.test(url)) return ok(MOCK_HISTORY['ep-1']?.[0])

  // Alert rules
  if (/\/api\/endpoints\/(.+)\/rules/.test(url) && config.method === 'get') {
    const id = url.match(/\/api\/endpoints\/(.+)\/rules/)![1]
    return ok(MOCK_RULES[id] ?? [])
  }

  // Check history
  if (/\/api\/endpoints\/(.+)\/history/.test(url)) {
    const id = url.match(/\/api\/endpoints\/(.+)\/history/)![1]
    return ok(MOCK_HISTORY[id] ?? [])
  }

  // Endpoint stats
  if (/\/api\/endpoints\/(.+)\/stats/.test(url)) {
    const id = url.match(/\/api\/endpoints\/(.+)\/stats/)![1]
    return ok(MOCK_STATS[id] ?? { p50_latency: 0, p95_latency: 0, incidents_7d: 0, checks_today: 0 })
  }

  // Single endpoint
  if (/\/api\/endpoints\/[^/]+$/.test(url) && config.method === 'get') {
    const id = url.split('/').pop()!
    return ok(MOCK_ENDPOINTS.find((e) => e.id === id) ?? MOCK_ENDPOINTS[0])
  }

  // Create endpoint
  if (url === '/api/endpoints' && config.method === 'post') {
    return ok({ ...MOCK_ENDPOINTS[0], id: `ep-${Date.now()}` })
  }

  // Dashboard aggregate charts
  if (url === '/api/metrics/latency') return ok(MOCK_DASHBOARD_LATENCY)
  if (url === '/api/metrics/uptime') return ok(MOCK_DASHBOARD_UPTIME)

  // Metrics overview
  if (url.includes('/api/metrics/overview')) return ok(MOCK_OVERVIEW)

  // Latency per endpoint
  if (/\/api\/metrics\/(.+)\/uptime/.test(url)) {
    const id = url.match(/\/api\/metrics\/(.+)\/uptime/)![1]
    return ok(MOCK_UPTIME[id] ?? MOCK_UPTIME['ep-1'])
  }
  if (/\/api\/metrics\/[^/]+$/.test(url)) {
    const id = url.split('/').pop()!
    return ok(MOCK_LATENCY[id] ?? MOCK_LATENCY['ep-1'])
  }

  // Alerts
  if (url.includes('/api/alerts') && config.method === 'get') return ok(MOCK_ALERTS)
  if (/\/api\/alerts\/.+\/resolve/.test(url)) return ok({ ...MOCK_ALERTS[0], status: 'resolved' })

  // Settings
  if (url.includes('/api/settings/users') && config.method === 'get') return ok(MOCK_USERS)
  if (url.includes('/api/settings/telegram') && config.method === 'get') return ok(MOCK_TELEGRAM)
  if (url.includes('/api/settings/telegram/test')) return ok({ ok: true })
  if (url.includes('/api/settings')) return ok({ ok: true })

  // SSE events — не перехватываем (EventSource не через axios)
  return ok({})
}
