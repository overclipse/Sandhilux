import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
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

export function AlertCard({ alert }: Props) {
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
          {alert.telegram_sent && (
            <span className={styles.telegramPill}>📨 Telegram sent</span>
          )}
          {isResolved && alert.resolved_at && (
            <span className={styles.resolvedPill}>✓ Resolved {formatTime(alert.resolved_at)}</span>
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
          {loading ? <span className="spinner" /> : 'Resolve'}
        </button>
      )}
    </div>
  )
}
