import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { metricsApi } from '../api/metrics'
import type { DashboardPeriod } from '../api/metrics'
import { endpointsApi } from '../api/endpoints'
import { useAppStore } from '../store'
import { MetricCard } from '../components/MetricCard'
import { EndpointRow } from '../components/EndpointRow'
import { LatencyChart } from '../components/LatencyChart'
import { UptimeChart } from '../components/UptimeChart'
import { StatusDot } from '../components/StatusDot'
import { RoleGuard } from '../components/RoleGuard'
import { ErrorBanner } from '../components/ErrorBanner'
import { getErrorMessage } from '../utils/error'
import { useT } from '../i18n'
import styles from './Dashboard.module.css'

function formatDuration(start: string, end?: string): string {
  const ms = (end ? new Date(end).getTime() : Date.now()) - new Date(start).getTime()
  const mins = Math.round(ms / 60_000)
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ${mins % 60}m`
  return `${Math.floor(hours / 24)}d ${hours % 24}h`
}

const PERIODS: DashboardPeriod[] = ['24h', '7d', '30d']

export function Dashboard() {
  const t = useT()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const endpoints = useAppStore((s) => s.endpoints)
  const setEndpoints = useAppStore((s) => s.setEndpoints)
  const [period, setPeriod] = useState<DashboardPeriod>('24h')

  const { data: overview, refetch: refetchOverview, isFetching, isLoading: overviewLoading, error: overviewError } = useQuery({
    queryKey: ['overview', period],
    queryFn: () => metricsApi.overview(period),
  })

  const { data: latencyData = [], error: latencyError } = useQuery({
    queryKey: ['dashboard-latency', period],
    queryFn: () => metricsApi.dashboardLatency(period),
  })

  const { data: uptimeData = [], error: uptimeError } = useQuery({
    queryKey: ['dashboard-uptime', period],
    queryFn: () => metricsApi.dashboardUptime(period),
  })

  const { data: worstData = [] } = useQuery({
    queryKey: ['dashboard-worst', period],
    queryFn: () => metricsApi.worst(period),
  })

  const { data: incidentsData = [] } = useQuery({
    queryKey: ['dashboard-incidents'],
    queryFn: () => metricsApi.incidents(),
  })

  const { error: endpointsError, refetch: refetchEndpoints } = useQuery({
    queryKey: ['endpoints'],
    queryFn: async () => {
      const data = await endpointsApi.list()
      setEndpoints(data)
      return data
    },
  })

  const toggleMutation = useMutation({
    mutationFn: (id: string) => endpointsApi.toggle(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['endpoints'] })
      queryClient.invalidateQueries({ queryKey: ['overview'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => endpointsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['endpoints'] })
      queryClient.invalidateQueries({ queryKey: ['overview'] })
    },
  })

  const handleToggle = (id: string) => toggleMutation.mutate(id)
  const handleDelete = (id: string) => {
    const ep = endpoints.find((e) => e.id === id)
    if (!confirm(t('common.confirmDelete', { name: ep?.name ?? 'endpoint' }))) return
    deleteMutation.mutate(id)
  }

  const firstError = overviewError || endpointsError || latencyError || uptimeError
  const onlineCount = endpoints.filter((e) => e.status === 'up').length
  const downCount = endpoints.filter((e) => e.status === 'down').length

  const latencySparkline = latencyData.length > 1 ? latencyData.map((p) => p.latency) : undefined
  const uptimeSparkline = uptimeData.length > 1 ? uptimeData.map((p) => p.uptime) : undefined

  const uptimeColor = (v?: number) => {
    if (!v) return 'default' as const
    return v < 95 ? 'red' as const : v >= 99 ? 'green' as const : 'default' as const
  }
  const latencyColor = (v?: number) => {
    if (!v) return 'default' as const
    return v > 1000 ? 'red' as const : v > 500 ? 'yellow' as const : 'default' as const
  }

  return (
    <div className={styles.page}>
      {/* Topbar */}
      <div className={styles.topbar}>
        <h1 className={styles.pageTitle}>{t('dashboard.title')}</h1>
        <div className={styles.topbarRight}>
          {/* Period selector */}
          <div className={styles.periodGroup}>
            {PERIODS.map((p) => (
              <button
                key={p}
                className={`${styles.periodBtn} ${period === p ? styles.periodActive : ''}`}
                onClick={() => setPeriod(p)}
              >
                {t(`dashboard.period.${p}`)}
              </button>
            ))}
          </div>

          {/* Status dots */}
          <div className={styles.statusDots} title={`${onlineCount}/${endpoints.length} ${t('dashboard.online')}`}>
            {endpoints.map((ep) => (
              <span key={ep.id} className={styles.dotWrap} title={ep.name}>
                <StatusDot status={ep.enabled ? ep.status : 'slow'} size={7} />
              </span>
            ))}
          </div>

          <button className="btn btn-ghost btn-sm" onClick={() => { refetchOverview(); refetchEndpoints() }} disabled={isFetching}>
            {isFetching ? <span className="spinner" /> : '↻'} {t('dashboard.refresh')}
          </button>
          <RoleGuard role="admin">
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/endpoints/new')}>
              {t('dashboard.addEndpoint')}
            </button>
          </RoleGuard>
        </div>
      </div>

      {firstError && (
        <ErrorBanner
          message={getErrorMessage(firstError)}
          onRetry={() => { refetchOverview(); refetchEndpoints() }}
        />
      )}

      {/* Metric cards */}
      <div className={styles.cards}>
        {overviewLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card skeleton-card skeleton" style={{ minHeight: 100 }} />
          ))
        ) : (
          <>
            <MetricCard
              label={t('dashboard.totalEndpoints')}
              value={overview?.total_endpoints ?? '—'}
              color={downCount > 0 ? 'red' : 'default'}
            />
            <MetricCard
              label={t('dashboard.avgUptime')}
              value={overview ? `${overview.avg_uptime_24h.toFixed(1)}%` : '—'}
              trend={overview?.uptime_trend}
              color={uptimeColor(overview?.avg_uptime_24h)}
              sparkline={uptimeSparkline}
            />
            <MetricCard
              label={t('dashboard.avgLatency')}
              value={overview ? `${Math.round(overview.avg_latency)}ms` : '—'}
              trend={overview?.latency_trend}
              color={latencyColor(overview?.avg_latency)}
              sparkline={latencySparkline}
            />
            <MetricCard
              label={t('dashboard.activeAlerts')}
              value={overview?.active_alerts ?? '—'}
              color={overview && overview.active_alerts > 0 ? 'red' : 'default'}
            />
          </>
        )}
      </div>

      {/* Charts side by side */}
      <div className={styles.charts}>
        <div className="card">
          <div className={styles.chartHeader}>
            <span className={styles.sectionTitle}>{t('dashboard.latencyTitle')}</span>
            {latencyData.length > 0 && (
              <span className={styles.chartStat}>
                {t('dashboard.avg')} <strong>{Math.round(latencyData.reduce((s, p) => s + p.latency, 0) / latencyData.length)}ms</strong>
              </span>
            )}
          </div>
          <div style={{ padding: '0 16px 16px' }}>
            {latencyData.length > 0 ? (
              <LatencyChart data={latencyData} />
            ) : (
              <div className={styles.chartEmpty}>
                <span>{t('dashboard.noLatency')}</span>
                <span className={styles.chartEmptySub}>{t('dashboard.noLatencySub')}</span>
              </div>
            )}
          </div>
        </div>
        <div className="card">
          <div className={styles.chartHeader}>
            <span className={styles.sectionTitle}>{t('dashboard.uptimeTitle')}</span>
            {uptimeData.length > 0 && (
              <span className={styles.chartStat}>
                {t('dashboard.avg')} <strong>{(uptimeData.reduce((s, p) => s + p.uptime, 0) / uptimeData.length).toFixed(1)}%</strong>
              </span>
            )}
          </div>
          <div style={{ padding: '0 16px 16px' }}>
            {uptimeData.length > 0 ? (
              <UptimeChart data={uptimeData} />
            ) : (
              <div className={styles.chartEmpty}>
                <span>{t('dashboard.noUptime')}</span>
                <span className={styles.chartEmptySub}>{t('dashboard.noUptimeSub')}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Worst endpoints + Recent incidents — side by side */}
      <div className={styles.charts}>
        {/* Worst performers */}
        <div className="card">
          <div className={styles.chartHeader}>
            <span className={styles.sectionTitle}>{t('dashboard.worst')}</span>
          </div>
          <div className={styles.worstList}>
            {worstData.length > 0 ? worstData.filter((w) => w.uptime < 100).slice(0, 5).map((w) => (
              <div
                key={w.id}
                className={styles.worstItem}
                onClick={() => navigate(`/endpoints/${w.id}`)}
              >
                <StatusDot status={w.status} size={7} />
                <span className={styles.worstName}>{w.name}</span>
                <span className={styles.worstUptime} style={{ color: w.uptime < 95 ? 'var(--red)' : w.uptime < 99 ? 'var(--yellow)' : 'var(--text-2)' }}>
                  {w.uptime.toFixed(1)}%
                </span>
              </div>
            )) : null}
            {worstData.length === 0 || worstData.every((w) => w.uptime >= 100) ? (
              <div className={styles.worstEmpty}>{t('dashboard.allGood')}</div>
            ) : null}
          </div>
        </div>

        {/* Recent incidents */}
        <div className="card">
          <div className={styles.chartHeader}>
            <span className={styles.sectionTitle}>{t('dashboard.incidents')}</span>
            {incidentsData.length > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/alerts')}>
                {t('dashboard.allIncidents')}
              </button>
            )}
          </div>
          <div className={styles.incidentList}>
            {incidentsData.length > 0 ? incidentsData.slice(0, 5).map((inc) => (
              <div key={inc.id} className={styles.incidentItem}>
                <StatusDot status={inc.type === 'down' ? 'down' : inc.type === 'slow' ? 'slow' : 'down'} size={7} />
                <span className={styles.incidentName}>{inc.endpoint_name}</span>
                <span className={`badge badge-${inc.type === 'down' ? 'down' : 'slow'}`} style={{ fontSize: 10 }}>{inc.type.toUpperCase()}</span>
                <span className={styles.incidentDuration}>
                  {formatDuration(inc.created_at, inc.resolved_at ?? undefined)}
                </span>
                <span className={styles.incidentTime}>
                  {inc.status === 'active' ? t('dashboard.ongoing') : new Date(inc.created_at).toLocaleDateString()}
                </span>
              </div>
            )) : (
              <div className={styles.worstEmpty}>{t('dashboard.noIncidents')}</div>
            )}
          </div>
        </div>
      </div>

      {/* Endpoints table */}
      <div className={`card ${styles.tableCard}`}>
        <div className={styles.tableHeader}>
          <span className={styles.sectionTitle}>{t('dashboard.endpoints')}</span>
          <span className={styles.tableCount}>{endpoints.length} {t('dashboard.total')}</span>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th />
                <th>{t('table.nameUrl')}</th>
                <th>{t('table.uptime')}</th>
                <th>{t('table.latency')}</th>
                <th>{t('table.lastCheck')}</th>
                <th>{t('table.interval')}</th>
                <th>{t('table.status')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {endpoints.map((ep, i) => (
                <EndpointRow
                  key={ep.id}
                  endpoint={ep}
                  index={i}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                />
              ))}
              {endpoints.length === 0 && (
                <tr>
                  <td colSpan={8} className={styles.emptyRow}>
                    <div className={styles.emptyState}>
                      <span className={styles.emptyIcon}>📡</span>
                      <span>{t('dashboard.noEndpoints')}</span>
                      <RoleGuard role="admin">
                        <button className="btn btn-primary btn-sm" onClick={() => navigate('/endpoints/new')}>
                          {t('dashboard.addFirst')}
                        </button>
                      </RoleGuard>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
