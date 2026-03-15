import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { alertsApi } from '../api/alerts'
import type { AlertsFilter } from '../api/alerts'
import { endpointsApi } from '../api/endpoints'
import { useAppStore } from '../store'
import { AlertCard } from '../components/AlertCard'
import styles from './Alerts.module.css'

type StatusFilter = 'all' | 'active' | 'resolved'
type PeriodFilter = 'today' | '7d' | '30d'
type TypeFilter = 'all' | 'down' | 'slow' | 'status'

export function Alerts() {
  const [status, setStatus] = useState<StatusFilter>('all')
  const [period, setPeriod] = useState<PeriodFilter>('7d')
  const [type, setType] = useState<TypeFilter>('all')
  const [endpointId, setEndpointId] = useState('')

  const alerts = useAppStore((s) => s.alerts)
  const setAlerts = useAppStore((s) => s.setAlerts)

  const filter: AlertsFilter = {
    status: status !== 'all' ? status : undefined,
    period,
    type: type !== 'all' ? type : undefined,
    endpoint_id: endpointId || undefined,
  }

  useQuery({
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

  const statusOptions: StatusFilter[] = ['all', 'active', 'resolved']
  const periodOptions: PeriodFilter[] = ['today', '7d', '30d']
  const typeOptions: TypeFilter[] = ['all', 'down', 'slow', 'status']

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <h1 className={styles.pageTitle}>Alerts</h1>
      </div>

      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Status</span>
          {statusOptions.map((s) => (
            <button key={s} className={`${styles.filterBtn} ${status === s ? styles.active : ''}`} onClick={() => setStatus(s)}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Period</span>
          {periodOptions.map((p) => (
            <button key={p} className={`${styles.filterBtn} ${period === p ? styles.active : ''}`} onClick={() => setPeriod(p)}>
              {p}
            </button>
          ))}
        </div>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Type</span>
          {typeOptions.map((t) => (
            <button key={t} className={`${styles.filterBtn} ${type === t ? styles.active : ''}`} onClick={() => setType(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Endpoint</span>
          <select className="form-input" style={{ minWidth: 160 }} value={endpointId} onChange={(e) => setEndpointId(e.target.value)}>
            <option value="">All endpoints</option>
            {endpoints.map((ep) => (
              <option key={ep.id} value={ep.id}>{ep.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.list}>
        {alerts.map((alert) => (
          <AlertCard key={alert.id} alert={alert} />
        ))}
        {alerts.length === 0 && (
          <div className={styles.empty}>No alerts match the current filters</div>
        )}
      </div>
    </div>
  )
}
