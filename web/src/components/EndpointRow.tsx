import { useNavigate } from 'react-router-dom'
import { useT } from '../i18n'
import type { Endpoint } from '../types/api'
import { StatusDot } from './StatusDot'
import { RowActions } from './RowActions'
import { RoleGuard } from './RoleGuard'
import { useRelativeTime } from '../hooks/useRelativeTime'
import styles from './EndpointRow.module.css'

interface Props {
  endpoint: Endpoint
  index?: number
  onToggle?: (id: string) => void
  onDelete?: (id: string) => void
}

function uptimeColor(v: number) {
  if (v >= 98) return 'var(--green)'
  if (v < 90) return 'var(--red)'
  return 'var(--text-1)'
}

function latencyColor(v: number, threshold?: number) {
  if (threshold && v > threshold) return 'var(--yellow)'
  return 'var(--text-1)'
}

export function EndpointRow({ endpoint, index = 0, onToggle, onDelete }: Props) {
  const t = useT()
  const navigate = useNavigate()
  const lastCheck = useRelativeTime(endpoint.last_checked_at)
  const isDown = endpoint.status === 'down'

  return (
    <tr
      className={`${styles.row} ${isDown ? styles.rowDown : ''} ${!endpoint.enabled ? styles.rowDisabled : ''}`}
      style={{ '--i': index } as React.CSSProperties}
      onClick={() => navigate(`/endpoints/${endpoint.id}`)}
    >
      <td className={styles.dotCell}>
        <StatusDot status={endpoint.enabled ? endpoint.status : 'slow'} size={8} />
      </td>
      <td className={styles.nameCell}>
        <span className={styles.name}>
          {endpoint.name}
          {!endpoint.enabled && <span className={styles.pausedBadge}>{t('common.paused')}</span>}
        </span>
        <span className={`${styles.url} mono`}>{endpoint.url}</span>
      </td>
      <td style={{ color: uptimeColor(endpoint.uptime_24h) }}>
        {endpoint.uptime_24h.toFixed(1)}%
      </td>
      <td style={{ color: latencyColor(endpoint.avg_latency, endpoint.latency_threshold) }}>
        {endpoint.avg_latency}ms
      </td>
      <td className={styles.meta}>{lastCheck}</td>
      <td className={styles.meta}>{endpoint.check_interval}s</td>
      <td>
        <span className={`badge badge-${endpoint.status}`}>{endpoint.status.toUpperCase()}</span>
      </td>
      <td className={styles.actionsCell}>
        <RoleGuard role="admin">
          <RowActions
            enabled={endpoint.enabled}
            onEdit={() => navigate(`/endpoints/${endpoint.id}/edit`)}
            onToggle={() => onToggle?.(endpoint.id)}
            onDelete={() => onDelete?.(endpoint.id)}
          />
        </RoleGuard>
      </td>
    </tr>
  )
}
