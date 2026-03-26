import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { alertsApi } from '../api/alerts'
import type { AlertsFilter } from '../api/alerts'
import { endpointsApi } from '../api/endpoints'
import { useAppStore } from '../store'
import { useT } from '../i18n'
import { AlertCard } from '../components/AlertCard'
import { ErrorBanner } from '../components/ErrorBanner'
import { getErrorMessage } from '../utils/error'
import styles from './Alerts.module.css'

type StatusFilter = 'all' | 'active' | 'resolved'
type PeriodFilter = 'today' | '7d' | '30d'
type TypeFilter = 'all' | 'down' | 'slow' | 'status'
type SortOrder = 'newest' | 'oldest'

function formatAvgDuration(alerts: { created_at: string; resolved_at?: string }[]): string {
  const resolved = alerts.filter((a) => a.resolved_at)
  if (resolved.length === 0) return '—'
  const totalMs = resolved.reduce((sum, a) => {
    return sum + (new Date(a.resolved_at!).getTime() - new Date(a.created_at).getTime())
  }, 0)
  const avgMins = Math.round(totalMs / resolved.length / 60_000)
  if (avgMins < 60) return `${avgMins}m`
  const h = Math.floor(avgMins / 60)
  return h < 24 ? `${h}h ${avgMins % 60}m` : `${Math.floor(h / 24)}d ${h % 24}h`
}

export function Alerts() {
  const t = useT()
  const [status, setStatus] = useState<StatusFilter>('all')
  const [period, setPeriod] = useState<PeriodFilter>('7d')
  const [type, setType] = useState<TypeFilter>('all')
  const [endpointId, setEndpointId] = useState('')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortOrder>('newest')

  const alerts = useAppStore((s) => s.alerts)
  const setAlerts = useAppStore((s) => s.setAlerts)

  const filter: AlertsFilter = {
    status: status !== 'all' ? status : undefined,
    period,
    type: type !== 'all' ? type : undefined,
    endpoint_id: endpointId || undefined,
  }

  const { error: alertsError, refetch: refetchAlerts } = useQuery({
    queryKey: ['alerts', filter],
    queryFn: async () => {
      const data = await alertsApi.list(filter)
      setAlerts(data)
      return data
    },
  })

  const { data: endpoints = [] } = useQuery({
    queryKey: ['endpoints-list'],
    queryFn: () => endpointsApi.list(),
  })

  const filtered = useMemo(() => {
    let result = alerts
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (a) =>
          a.endpoint_name.toLowerCase().includes(q) ||
          a.message.toLowerCase().includes(q) ||
          a.type.toLowerCase().includes(q),
      )
    }
    if (sort === 'oldest') {
      result = [...result].reverse()
    }
    return result
  }, [alerts, search, sort])

  const activeCount = alerts.filter((a) => a.status === 'active').length

  const statusOptions: StatusFilter[] = ['all', 'active', 'resolved']
  const periodOptions: PeriodFilter[] = ['today', '7d', '30d']
  const typeOptions: TypeFilter[] = ['all', 'down', 'slow', 'status']

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <h1 className={styles.pageTitle}>{t('alerts.title')}</h1>
      </div>

      {/* Mini stats */}
      <div className={styles.statsRow}>
        <div className={`card ${styles.miniStat}`}>
          <span className={styles.miniLabel}>{t('alerts.totalAlerts')}</span>
          <span className={styles.miniValue}>{alerts.length}</span>
        </div>
        <div className={`card ${styles.miniStat}`}>
          <span className={styles.miniLabel}>{t('alerts.activeCount')}</span>
          <span className={styles.miniValue} style={{ color: activeCount > 0 ? 'var(--red)' : 'var(--green)' }}>
            {activeCount}
          </span>
        </div>
        <div className={`card ${styles.miniStat}`}>
          <span className={styles.miniLabel}>{t('alerts.avgDuration')}</span>
          <span className={styles.miniValue}>{formatAvgDuration(alerts)}</span>
        </div>
      </div>

      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>{t('alerts.status')}</span>
          {statusOptions.map((s) => (
            <button key={s} className={`${styles.filterBtn} ${status === s ? styles.active : ''}`} onClick={() => setStatus(s)}>
              {s === 'all' ? t('alerts.all') : s === 'active' ? t('alerts.active') : t('alerts.resolved')}
            </button>
          ))}
        </div>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>{t('alerts.period')}</span>
          {periodOptions.map((p) => (
            <button key={p} className={`${styles.filterBtn} ${period === p ? styles.active : ''}`} onClick={() => setPeriod(p)}>
              {p === 'today' ? t('alerts.today') : p}
            </button>
          ))}
        </div>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>{t('alerts.type')}</span>
          {typeOptions.map((tp) => (
            <button key={tp} className={`${styles.filterBtn} ${type === tp ? styles.active : ''}`} onClick={() => setType(tp)}>
              {tp === 'all' ? t('alerts.all') : tp === 'down' ? t('endpoints.down') : tp === 'slow' ? t('endpoints.slow') : tp.charAt(0).toUpperCase() + tp.slice(1)}
            </button>
          ))}
        </div>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>{t('alerts.endpoint')}</span>
          <select className="form-input" style={{ minWidth: 160 }} value={endpointId} onChange={(e) => setEndpointId(e.target.value)}>
            <option value="">{t('alerts.allEndpoints')}</option>
            {endpoints.map((ep) => (
              <option key={ep.id} value={ep.id}>{ep.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Search + sort bar */}
      <div className={styles.searchBar}>
        <input
          className={`form-input ${styles.searchInput}`}
          placeholder={t('alerts.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setSort((s) => (s === 'newest' ? 'oldest' : 'newest'))}
        >
          {sort === 'newest' ? t('alerts.sortNewest') : t('alerts.sortOldest')}
        </button>
      </div>

      {alertsError && <ErrorBanner message={getErrorMessage(alertsError)} onRetry={() => refetchAlerts()} />}

      <div className={styles.list}>
        {filtered.map((alert) => (
          <AlertCard key={alert.id} alert={alert} />
        ))}
        {filtered.length === 0 && (
          <div className={styles.empty}>{t('alerts.noMatch')}</div>
        )}
      </div>
    </div>
  )
}
