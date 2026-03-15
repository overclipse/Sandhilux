import client from './client'
import type { MetricsOverview, LatencyPoint, DailyUptime } from '../types/api'

export type MetricsPeriod = '1h' | '24h' | '7d' | '30d'

export const metricsApi = {
  overview: (period?: MetricsPeriod) =>
    client
      .get<MetricsOverview>('/api/metrics/overview', { params: period ? { period } : undefined })
      .then((r) => r.data),

  latency: (endpointId: string, period: MetricsPeriod) =>
    client
      .get<LatencyPoint[]>(`/api/metrics/${endpointId}`, { params: { period } })
      .then((r) => r.data),

  uptime: (endpointId: string) =>
    client
      .get<DailyUptime[]>(`/api/metrics/${endpointId}/uptime`)
      .then((r) => r.data),

  dashboardLatency: () =>
    client.get<LatencyPoint[]>('/api/metrics/latency').then((r) => r.data),

  dashboardUptime: () =>
    client.get<DailyUptime[]>('/api/metrics/uptime').then((r) => r.data),
}
