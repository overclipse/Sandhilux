import client from './client'
import type { MetricsOverview, LatencyPoint, DailyUptime, WorstEndpoint, RecentIncident, TimelineSegment } from '../types/api'

export type MetricsPeriod = '1h' | '24h' | '7d' | '30d'
export type DashboardPeriod = '24h' | '7d' | '30d'

// Normalize backend response to match frontend types.
// Handles both old field names (pre-fix) and new ones.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeLatency(raw: any[]): LatencyPoint[] {
  return raw.map((p) => ({
    time: p.time,
    latency: p.latency ?? p.latency_ms ?? p.avg_latency ?? 0,
    status_code: p.status_code ?? 0,
  }))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeUptime(raw: any[]): DailyUptime[] {
  return raw.map((p) => ({
    date: p.date,
    uptime: p.uptime ?? p.uptime_pct ?? 0,
  }))
}

export const metricsApi = {
  overview: (period?: MetricsPeriod) =>
    client
      .get<MetricsOverview>('/api/metrics/overview', { params: period ? { period } : undefined })
      .then((r) => r.data),

  latency: (endpointId: string, period: MetricsPeriod) =>
    client
      .get(`/api/metrics/${endpointId}`, { params: { period } })
      .then((r) => normalizeLatency(r.data)),

  uptime: (endpointId: string, period?: MetricsPeriod) =>
    client
      .get(`/api/metrics/${endpointId}/uptime`, { params: period ? { period } : undefined })
      .then((r) => normalizeUptime(r.data)),

  timeline: (endpointId: string, period?: MetricsPeriod) =>
    client
      .get<TimelineSegment[]>(`/api/metrics/${endpointId}/timeline`, { params: period ? { period } : undefined })
      .then((r) => r.data),

  dashboardLatency: (period?: DashboardPeriod) =>
    client.get('/api/metrics/latency', { params: period ? { period } : undefined }).then((r) => normalizeLatency(r.data)),

  dashboardUptime: (period?: DashboardPeriod) =>
    client.get('/api/metrics/uptime', { params: period ? { period } : undefined }).then((r) => normalizeUptime(r.data)),

  worst: (period?: DashboardPeriod) =>
    client.get<WorstEndpoint[]>('/api/metrics/worst', { params: period ? { period } : undefined }).then((r) => r.data),

  incidents: () =>
    client.get<RecentIncident[]>('/api/metrics/incidents').then((r) => r.data),
}
