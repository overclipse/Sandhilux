import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useT } from '../i18n'
import type { Alert } from '../types/api'
import { alertsApi } from '../api/alerts'
import { useAppStore } from '../store'
import { useAuth } from '../hooks/useAuth'
import styles from './AlertCard.module.css'

interface Props {
  alert: Alert
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function formatDuration(start: string, end?: string): string {
  const ms = (end ? new Date(end).getTime() : Date.now()) - new Date(start).getTime()
  const mins = Math.round(ms / 60_000)
  if (mins < 1) return '<1m'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ${mins % 60}m`
  return `${Math.floor(hours / 24)}d ${hours % 24}h`
}

export function AlertCard({ alert }: Props) {
  const t = useT()
  const [loading, setLoading] = useState(false)
  const { resolveAlert } = useAppStore()
  const { isAdmin } = useAuth()
  const navigate = useNavigate()

  const isResolved = alert.status === 'resolved'

  async function handleResolve() {
    setLoading(true)
    try {
      await alertsApi.resolve(alert.id)
      resolveAlert(alert.id)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`${styles.card} card fade-in ${isResolved ? styles.resolved : ''}`}>
      <span className={`${styles.stripe} ${styles[alert.type]}`} />
      <div className={styles.body}>
        <div className={styles.header}>
          <button className={styles.name} onClick={() => navigate(`/endpoints/${alert.endpoint_id}`)}>
            {alert.endpoint_name}
          </button>
          <span className={`badge badge-${alert.type}`}>{alert.type.toUpperCase()}</span>
          <span className={styles.durationPill}>
            {formatDuration(alert.created_at, alert.resolved_at ?? undefined)}
          </span>
          {isResolved && alert.resolved_at && (
            <span className={styles.resolvedPill}>{'✓ ' + t('alerts.resolvedAt') + ' ' + formatTime(alert.resolved_at)}</span>
          )}
        </div>

        <p className={`${styles.message} mono`}>{alert.message}</p>

        <div className={styles.meta}>
          <span>{alert.rule_type}</span>
          {alert.rule_detail && <span>· {alert.rule_detail}</span>}
          <span>· {new Date(alert.created_at).toLocaleString('en-GB')}</span>
        </div>
      </div>

      {!isResolved && isAdmin && (
        <button className="btn btn-ghost btn-sm" onClick={handleResolve} disabled={loading}>
          {loading ? <span className="spinner" /> : t('alerts.resolve')}
        </button>
      )}
    </div>
  )
}
