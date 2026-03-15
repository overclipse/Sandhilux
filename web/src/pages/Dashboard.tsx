import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { metricsApi } from '../api/metrics'
import { endpointsApi } from '../api/endpoints'
import { useAppStore } from '../store'
import { MetricCard } from '../components/MetricCard'
import { EndpointRow } from '../components/EndpointRow'
import { LatencyChart } from '../components/LatencyChart'
import { UptimeChart } from '../components/UptimeChart'
import { RoleGuard } from '../components/RoleGuard'
import styles from './Dashboard.module.css'

export function Dashboard() {
  const navigate = useNavigate()
  const endpoints = useAppStore((s) => s.endpoints)
  const setEndpoints = useAppStore((s) => s.setEndpoints)

  const { data: overview, refetch: refetchOverview, isFetching } = useQuery({
    queryKey: ['overview'],
    queryFn: () => metricsApi.overview(),
  })

  const { data: latency24h = [] } = useQuery({
    queryKey: ['dashboard-latency'],
    queryFn: () => metricsApi.dashboardLatency(),
  })

  const { data: uptime7d = [] } = useQuery({
    queryKey: ['dashboard-uptime'],
    queryFn: () => metricsApi.dashboardUptime(),
  })

  useQuery({
    queryKey: ['endpoints'],
    queryFn: async () => {
      const data = await endpointsApi.list()
      setEndpoints(data)
      return data
    },
  })

  const onlineCount = endpoints.filter((e) => e.status === 'up').length

  const uptimeColor = (v?: number) => {
    if (!v) return 'default' as const
    return v < 95 ? 'red' as const : 'default' as const
  }
  const latencyColor = (v?: number) => {
    if (!v) return 'default' as const
    return v > 1000 ? 'yellow' as const : 'default' as const
  }

  return (
    <div className={styles.page}>
      {/* Topbar */}
      <div className={styles.topbar}>
        <h1 className={styles.pageTitle}>Dashboard</h1>
        <div className={styles.topbarRight}>
          <span className={`${styles.onlinePill} ${endpoints.some((e) => e.status === 'down') ? styles.pillRed : styles.pillGreen}`}>
            {onlineCount} / {endpoints.length} online
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => refetchOverview()} disabled={isFetching}>
            {isFetching ? <span className="spinner" /> : '↻'} Refresh
          </button>
          <RoleGuard role="admin">
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/endpoints/new')}>
              + Add endpoint
            </button>
          </RoleGuard>
        </div>
      </div>

      {/* Metric cards */}
      <div className={styles.cards}>
        <MetricCard label="Total endpoints" value={overview?.total_endpoints ?? '—'} />
        <MetricCard
          label="Avg uptime 24h"
          value={overview ? `${overview.avg_uptime_24h.toFixed(1)}%` : '—'}
          trend={overview?.uptime_trend}
          color={uptimeColor(overview?.avg_uptime_24h)}
        />
        <MetricCard
          label="Avg latency"
          value={overview ? `${overview.avg_latency}ms` : '—'}
          trend={overview?.latency_trend}
          color={latencyColor(overview?.avg_latency)}
        />
        <MetricCard
          label="Active alerts"
          value={overview?.active_alerts ?? '—'}
          color={overview && overview.active_alerts > 0 ? 'red' : 'default'}
        />
      </div>

      {/* Table */}
      <div className={`card ${styles.tableCard}`}>
        <div className={styles.tableHeader}>
          <span className={styles.sectionTitle}>Endpoints</span>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th />
                <th>Name / URL</th>
                <th>Uptime 24h</th>
                <th>Avg Latency</th>
                <th>Last check</th>
                <th>Interval</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {endpoints.map((ep) => (
                <EndpointRow key={ep.id} endpoint={ep} />
              ))}
              {endpoints.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-3)', padding: '32px' }}>
                    No endpoints yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Charts */}
      <div className={styles.charts}>
        <div className="card">
          <div className={styles.chartHeader}>
            <span className={styles.sectionTitle}>Latency — last 24h</span>
          </div>
          <div style={{ padding: '0 16px 16px' }}>
            <LatencyChart data={latency24h} />
          </div>
        </div>
        <div className="card">
          <div className={styles.chartHeader}>
            <span className={styles.sectionTitle}>Uptime — last 7d</span>
          </div>
          <div style={{ padding: '0 16px 16px' }}>
            <UptimeChart data={uptime7d} />
          </div>
        </div>
      </div>
    </div>
  )
}
