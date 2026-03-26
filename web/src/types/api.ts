export type EndpointStatus = 'up' | 'down' | 'slow'

export interface Endpoint {
  id: string
  name: string
  url: string
  method: string
  headers?: Record<string, string>
  body?: string
  check_interval: number
  timeout: number
  expected_status?: number
  latency_threshold?: number
  follow_redirects: boolean
  enabled: boolean
  status: EndpointStatus
  uptime_24h: number
  avg_latency: number
  last_checked_at: string
  created_at: string
}

export interface EndpointCreate {
  name: string
  url: string
  method: string
  headers?: string
  body?: string
  check_interval: number
  timeout: number
  expected_status?: number
  latency_threshold?: number
  follow_redirects: boolean
  enabled: boolean
}

export type AlertType = 'down' | 'slow' | 'status'
export type AlertStatus = 'active' | 'resolved'

export interface Alert {
  id: string
  endpoint_id: string
  endpoint_name: string
  type: AlertType
  status: AlertStatus
  message: string
  rule_type: string
  rule_detail: string
  telegram_sent: boolean
  created_at: string
  resolved_at?: string
}

export type AlertRuleType = 'down' | 'latency_gt' | 'status_code'

export interface AlertRule {
  id: string
  endpoint_id: string
  type: AlertRuleType
  threshold?: number
  consecutive_fails?: number
  notify_telegram: boolean
  created_at: string
}

export interface AlertRuleCreate {
  type: AlertRuleType
  threshold?: number
  consecutive_fails?: number
  notify_telegram: boolean
}

export interface MetricsOverview {
  total_endpoints: number
  online_endpoints: number
  avg_uptime_24h: number
  avg_latency: number
  active_alerts: number
  uptime_trend: number
  latency_trend: number
}

export interface LatencyPoint {
  time: string
  latency: number
  status_code: number
}

export interface DailyUptime {
  date: string
  uptime: number
}

export interface EndpointStats {
  p50_latency: number
  p95_latency: number
  incidents_7d: number
  checks_today: number
}

export interface CheckRecord {
  id: string
  endpoint_id: string
  is_up: boolean
  status: EndpointStatus
  status_code: number
  latency_ms: number
  error?: string
  checked_at: string
}

export type UserRole = 'admin' | 'viewer'

export interface User {
  id: string
  email: string
  role: UserRole
  name?: string
  avatar_url?: string
  created_at: string
}

export interface TelegramSettings {
  bot_token: string
  chat_id: string
  configured: boolean
}

export interface WorstEndpoint {
  id: string
  name: string
  url: string
  status: EndpointStatus
  uptime: number
}

export interface RecentIncident {
  id: string
  endpoint_id: string
  endpoint_name: string
  type: AlertType
  status: AlertStatus
  message: string
  created_at: string
  resolved_at?: string
}

export interface TimelineSegment {
  start: string
  end: string
  status: EndpointStatus
}

// SSE event payloads
export interface SSECheckResult {
  type: 'check_result'
  data: {
    endpoint_id: string
    is_up: boolean
    latency_ms: number
    status_code: number
    status: EndpointStatus
    checked_at: string
  }
}

export interface SSEAlertCreated {
  type: 'alert_created'
  data: Alert
}

export interface SSEAlertResolved {
  type: 'alert_resolved'
  data: { alert_id: string }
}

export interface SSEEndpointStatus {
  type: 'endpoint_status'
  data: { endpoint_id: string; is_up: boolean }
}

export type SSEMessage =
  | SSECheckResult
  | SSEAlertCreated
  | SSEAlertResolved
  | SSEEndpointStatus
