import type {
  Endpoint,
  Alert,
  AlertRule,
  CheckRecord,
  MetricsOverview,
  LatencyPoint,
  DailyUptime,
  EndpointStats,
  TelegramSettings,
  User,
} from '../types/api'

// ─── Endpoints ────────────────────────────────────────────────────────────────

export const MOCK_ENDPOINTS: Endpoint[] = [
  {
    id: 'ep-1',
    name: 'Production API',
    url: 'https://api.example.com/health',
    method: 'GET',
    check_interval: 60,
    timeout: 10,
    expected_status: 200,
    latency_threshold: 2000,
    enabled: true,
    status: 'up',
    uptime_24h: 99.8,
    avg_latency: 142,
    last_checked_at: new Date(Date.now() - 28_000).toISOString(),
    created_at: '2025-01-10T08:00:00Z',
  },
  {
    id: 'ep-2',
    name: 'Auth Service',
    url: 'https://auth.example.com/ping',
    method: 'GET',
    check_interval: 30,
    timeout: 5,
    expected_status: 200,
    latency_threshold: 500,
    enabled: true,
    status: 'slow',
    uptime_24h: 97.4,
    avg_latency: 843,
    last_checked_at: new Date(Date.now() - 12_000).toISOString(),
    created_at: '2025-01-12T10:00:00Z',
  },
  {
    id: 'ep-3',
    name: 'Payment Gateway',
    url: 'https://payments.example.com/status',
    method: 'POST',
    check_interval: 120,
    timeout: 15,
    expected_status: 200,
    latency_threshold: 3000,
    enabled: true,
    status: 'down',
    uptime_24h: 81.2,
    avg_latency: 0,
    last_checked_at: new Date(Date.now() - 65_000).toISOString(),
    created_at: '2025-01-15T09:30:00Z',
  },
  {
    id: 'ep-4',
    name: 'CDN Assets',
    url: 'https://cdn.example.com/probe',
    method: 'HEAD',
    check_interval: 300,
    timeout: 10,
    latency_threshold: 800,
    enabled: true,
    status: 'up',
    uptime_24h: 100,
    avg_latency: 38,
    last_checked_at: new Date(Date.now() - 5_000).toISOString(),
    created_at: '2025-02-01T11:00:00Z',
  },
  {
    id: 'ep-5',
    name: 'Metrics Collector',
    url: 'https://metrics.example.com/healthz',
    method: 'GET',
    check_interval: 60,
    timeout: 10,
    latency_threshold: 1000,
    enabled: true,
    status: 'up',
    uptime_24h: 98.9,
    avg_latency: 210,
    last_checked_at: new Date(Date.now() - 45_000).toISOString(),
    created_at: '2025-02-10T14:00:00Z',
  },
]

// ─── Metrics overview ─────────────────────────────────────────────────────────

export const MOCK_OVERVIEW: MetricsOverview = {
  total_endpoints: 5,
  online_endpoints: 4,
  avg_uptime_24h: 95.5,
  avg_latency: 247,
  active_alerts: 2,
  uptime_trend: -1.2,
  latency_trend: 0.8,
}

// ─── Latency chart data ───────────────────────────────────────────────────────

function genLatency(points: number, baseMs: number, noiseMs: number): LatencyPoint[] {
  const now = Date.now()
  return Array.from({ length: points }, (_, i) => {
    const t = now - (points - i) * (3_600_000 / points)
    const latency = Math.max(10, Math.round(baseMs + (Math.random() - 0.5) * noiseMs * 2))
    const statusCode = latency > 3000 ? 0 : Math.random() > 0.95 ? 503 : 200
    return { time: new Date(t).toISOString(), latency, status_code: statusCode }
  })
}

export const MOCK_LATENCY: Record<string, LatencyPoint[]> = {
  'ep-1': genLatency(48, 140, 60),
  'ep-2': genLatency(48, 820, 250),
  'ep-3': genLatency(48, 3200, 800),
  'ep-4': genLatency(48, 38, 20),
  'ep-5': genLatency(48, 210, 90),
}

// ─── Uptime chart ─────────────────────────────────────────────────────────────

function genUptime(days: number, base: number): DailyUptime[] {
  const result: DailyUptime[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000)
    result.push({
      date: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
      uptime: Math.min(100, Math.max(0, base + (Math.random() - 0.5) * 8)),
    })
  }
  return result
}

export const MOCK_UPTIME: Record<string, DailyUptime[]> = {
  'ep-1': genUptime(7, 99.5),
  'ep-2': genUptime(7, 96.0),
  'ep-3': genUptime(7, 82.0),
  'ep-4': genUptime(7, 100),
  'ep-5': genUptime(7, 98.5),
}

// ─── Endpoint stats ───────────────────────────────────────────────────────────

export const MOCK_STATS: Record<string, EndpointStats> = {
  'ep-1': { p50_latency: 138, p95_latency: 310, incidents_7d: 0, checks_today: 1440 },
  'ep-2': { p50_latency: 810, p95_latency: 1420, incidents_7d: 3, checks_today: 2880 },
  'ep-3': { p50_latency: 2840, p95_latency: 4100, incidents_7d: 12, checks_today: 720 },
  'ep-4': { p50_latency: 36, p95_latency: 68, incidents_7d: 0, checks_today: 288 },
  'ep-5': { p50_latency: 205, p95_latency: 480, incidents_7d: 1, checks_today: 1440 },
}

// ─── Alert rules ──────────────────────────────────────────────────────────────

export const MOCK_RULES: Record<string, AlertRule[]> = {
  'ep-1': [
    { id: 'r-1', endpoint_id: 'ep-1', type: 'down', consecutive_fails: 3, notify_telegram: true, created_at: '2025-01-10T08:00:00Z' },
    { id: 'r-2', endpoint_id: 'ep-1', type: 'latency_gt', threshold: 2000, notify_telegram: false, created_at: '2025-01-10T08:00:00Z' },
  ],
  'ep-2': [
    { id: 'r-3', endpoint_id: 'ep-2', type: 'latency_gt', threshold: 500, notify_telegram: true, created_at: '2025-01-12T10:00:00Z' },
  ],
  'ep-3': [
    { id: 'r-4', endpoint_id: 'ep-3', type: 'down', consecutive_fails: 1, notify_telegram: true, created_at: '2025-01-15T09:30:00Z' },
    { id: 'r-5', endpoint_id: 'ep-3', type: 'latency_gt', threshold: 3000, notify_telegram: true, created_at: '2025-01-15T09:30:00Z' },
  ],
  'ep-4': [],
  'ep-5': [
    { id: 'r-6', endpoint_id: 'ep-5', type: 'down', consecutive_fails: 2, notify_telegram: false, created_at: '2025-02-10T14:00:00Z' },
  ],
}

// ─── Check history ────────────────────────────────────────────────────────────

function genHistory(endpointId: string, count: number): CheckRecord[] {
  const ep = MOCK_ENDPOINTS.find((e) => e.id === endpointId)!
  return Array.from({ length: count }, (_, i) => {
    const t = new Date(Date.now() - i * ep.check_interval * 1000).toISOString()
    const ok = Math.random() > 0.08
    const latency_ms = ok ? Math.round(ep.avg_latency + (Math.random() - 0.5) * 80) : 0
    const status_code = ok ? 200 : Math.random() > 0.5 ? 503 : 0
    const status = !ok ? 'down' : latency_ms > (ep.latency_threshold ?? 9999) ? 'slow' : 'up'
    return {
      id: `h-${endpointId}-${i}`,
      endpoint_id: endpointId,
      is_up: ok,
      status,
      status_code,
      latency_ms,
      error: ok ? undefined : status_code === 0 ? 'connection timeout' : 'HTTP 503 Service Unavailable',
      checked_at: t,
    } satisfies CheckRecord
  })
}

export const MOCK_HISTORY: Record<string, CheckRecord[]> = Object.fromEntries(
  MOCK_ENDPOINTS.map((ep) => [ep.id, genHistory(ep.id, 50)]),
)

// ─── Alerts ───────────────────────────────────────────────────────────────────

export const MOCK_ALERTS: Alert[] = [
  {
    id: 'a-1',
    endpoint_id: 'ep-3',
    endpoint_name: 'Payment Gateway',
    type: 'down',
    status: 'active',
    message: 'Endpoint unreachable — connection timeout after 15s',
    rule_type: 'down',
    rule_detail: 'after 1 consecutive fail',
    telegram_sent: true,
    created_at: new Date(Date.now() - 3_600_000).toISOString(),
  },
  {
    id: 'a-2',
    endpoint_id: 'ep-2',
    endpoint_name: 'Auth Service',
    type: 'slow',
    status: 'active',
    message: 'latency 843ms > 500ms',
    rule_type: 'latency_gt',
    rule_detail: 'threshold 500ms',
    telegram_sent: true,
    created_at: new Date(Date.now() - 1_200_000).toISOString(),
  },
  {
    id: 'a-3',
    endpoint_id: 'ep-3',
    endpoint_name: 'Payment Gateway',
    type: 'down',
    status: 'resolved',
    message: 'Endpoint unreachable — HTTP 503',
    rule_type: 'down',
    rule_detail: 'after 1 consecutive fail',
    telegram_sent: true,
    created_at: new Date(Date.now() - 86_400_000).toISOString(),
    resolved_at: new Date(Date.now() - 82_000_000).toISOString(),
  },
  {
    id: 'a-4',
    endpoint_id: 'ep-1',
    endpoint_name: 'Production API',
    type: 'slow',
    status: 'resolved',
    message: 'latency 2541ms > 2000ms',
    rule_type: 'latency_gt',
    rule_detail: 'threshold 2000ms',
    telegram_sent: false,
    created_at: new Date(Date.now() - 172_800_000).toISOString(),
    resolved_at: new Date(Date.now() - 170_000_000).toISOString(),
  },
]

// ─── Dashboard aggregate charts ───────────────────────────────────────────────

export const MOCK_DASHBOARD_LATENCY: LatencyPoint[] = genLatency(48, 247, 120)
export const MOCK_DASHBOARD_UPTIME: DailyUptime[] = genUptime(7, 95.5)

// ─── Settings ─────────────────────────────────────────────────────────────────

export const MOCK_USERS: User[] = [
  { id: '1', email: 'admin@example.com', role: 'admin', created_at: '2025-01-01T00:00:00Z' },
  { id: '2', email: 'viewer@example.com', role: 'viewer', created_at: '2025-02-01T00:00:00Z' },
]

export const MOCK_TELEGRAM: TelegramSettings = {
  bot_token: '123456:ABC-DEF',
  chat_id: '-1001234567890',
  configured: true,
}
