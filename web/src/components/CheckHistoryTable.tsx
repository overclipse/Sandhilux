import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { endpointsApi } from '../api/endpoints'
import type { CheckRecord } from '../types/api'
import styles from './CheckHistoryTable.module.css'

interface Props {
  endpointId: string
  threshold?: number
}

function statusColor(record: CheckRecord) {
  if (record.status === 'down') return 'var(--red)'
  if (record.status === 'slow') return 'var(--yellow)'
  return 'var(--green)'
}

function codeColor(code: number) {
  if (code === 0) return 'var(--red)'
  if (code >= 400) return 'var(--red)'
  if (code >= 200 && code < 300) return 'var(--green)'
  return 'var(--text-2)'
}

export function CheckHistoryTable({ endpointId, threshold }: Props) {
  const [offset, setOffset] = useState(0)
  const limit = 50

  const { data = [], isFetching } = useQuery({
    queryKey: ['history', endpointId, offset],
    queryFn: () => endpointsApi.getHistory(endpointId, limit, offset),
  })

  return (
    <div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Time</th>
              <th>Status</th>
              <th>Code</th>
              <th>Latency</th>
              <th>Error</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.id}>
                <td className={`mono ${styles.time}`}>
                  {new Date(r.checked_at).toLocaleTimeString('en-GB')}
                </td>
                <td style={{ color: statusColor(r), fontWeight: 600 }}>
                  {r.status.toUpperCase()}
                </td>
                <td className="mono" style={{ color: codeColor(r.status_code) }}>
                  {r.status_code || '—'}
                </td>
                <td style={{ color: threshold && r.latency_ms > threshold ? 'var(--yellow)' : 'var(--text-1)' }}>
                  {r.latency_ms}ms
                </td>
                <td className={styles.error}>{r.error || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.length === limit && (
        <button
          className="btn btn-ghost btn-sm"
          style={{ marginTop: 12 }}
          onClick={() => setOffset((o) => o + limit)}
          disabled={isFetching}
        >
          {isFetching ? <span className="spinner" /> : 'Load more'}
        </button>
      )}
    </div>
  )
}
