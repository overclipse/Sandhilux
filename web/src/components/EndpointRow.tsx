import { useNavigate } from 'react-router-dom'
import type { Endpoint } from '../types/api'
import { StatusDot } from './StatusDot'
import { useRelativeTime } from '../hooks/useRelativeTime'
import styles from './EndpointRow.module.css'

interface Props {
  endpoint: Endpoint
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

export function EndpointRow({ endpoint }: Props) {
  const navigate = useNavigate()
  const lastCheck = useRelativeTime(endpoint.last_checked_at)

  return (
    <tr className={styles.row} onClick={() => navigate(`/endpoints/${endpoint.id}`)}>
      <td className={styles.dotCell}>
        <StatusDot status={endpoint.status} size={8} />
      </td>
      <td className={styles.nameCell}>
        <span className={styles.name}>{endpoint.name}</span>
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
    </tr>
  )
}
