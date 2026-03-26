import { useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useT } from '../i18n'
import { endpointsApi } from '../api/endpoints'
import type { CheckRecord, EndpointStatus } from '../types/api'
import styles from './CheckHistoryTable.module.css'

interface Props {
  endpointId: string
  threshold?: number
}

type StatusFilter = 'all' | EndpointStatus
type CodeFilter = 'all' | '2xx' | '3xx' | '4xx' | '5xx' | '0'

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

function matchCodeFilter(code: number, filter: CodeFilter): boolean {
  if (filter === 'all') return true
  if (filter === '0') return code === 0
  const prefix = filter.charAt(0)
  return String(code).charAt(0) === prefix
}

export function CheckHistoryTable({ endpointId, threshold }: Props) {
  const t = useT()
  const [offset, setOffset] = useState(0)
  const limit = 50

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [codeFilter, setCodeFilter] = useState<CodeFilter>('all')
  const [errorsOnly, setErrorsOnly] = useState(false)
  const [search, setSearch] = useState('')

  const { data = [], isFetching } = useQuery({
    queryKey: ['history', endpointId, offset],
    queryFn: () => endpointsApi.getHistory(endpointId, limit, offset),
  })

  const filtered = useMemo(() => {
    return data.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      if (!matchCodeFilter(r.status_code, codeFilter)) return false
      if (errorsOnly && r.is_up) return false
      if (search && !(r.error ?? '').toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [data, statusFilter, codeFilter, errorsOnly, search])

  const hasFilters = statusFilter !== 'all' || codeFilter !== 'all' || errorsOnly || search !== ''

  const resetFilters = () => {
    setStatusFilter('all')
    setCodeFilter('all')
    setErrorsOnly(false)
    setSearch('')
  }

  const exportCSV = useCallback(() => {
    const headers = ['time', 'status', 'code', 'latency_ms', 'error']
    const rows = filtered.map((r) => [
      new Date(r.checked_at).toISOString(),
      r.status,
      r.status_code,
      r.latency_ms,
      `"${(r.error ?? '').replace(/"/g, '""')}"`,
    ])
    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `checks-${endpointId}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [filtered, endpointId])

  return (
    <div>
      {/* Filter bar */}
      <div className={styles.filterBar}>
        <select
          className={`form-input ${styles.filterSelect}`}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
        >
          <option value="all">{t('history.allStatuses')}</option>
          <option value="up">UP</option>
          <option value="down">DOWN</option>
          <option value="slow">SLOW</option>
        </select>

        <select
          className={`form-input ${styles.filterSelect}`}
          value={codeFilter}
          onChange={(e) => setCodeFilter(e.target.value as CodeFilter)}
        >
          <option value="all">{t('history.allCodes')}</option>
          <option value="2xx">2xx</option>
          <option value="3xx">3xx</option>
          <option value="4xx">4xx</option>
          <option value="5xx">5xx</option>
          <option value="0">0 (timeout)</option>
        </select>

        <label className={styles.filterCheck}>
          <input type="checkbox" checked={errorsOnly} onChange={(e) => setErrorsOnly(e.target.checked)} />
          <span>{t('history.errorsOnly')}</span>
        </label>

        <input
          className={`form-input ${styles.filterSearch}`}
          placeholder={t('history.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {hasFilters && (
          <button className="btn btn-ghost btn-sm" onClick={resetFilters}>{t('history.reset')}</button>
        )}

        <button className="btn btn-ghost btn-sm" onClick={exportCSV} disabled={filtered.length === 0}>
          {t('history.export')}
        </button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('history.time')}</th>
              <th>{t('history.status')}</th>
              <th>{t('history.code')}</th>
              <th>{t('history.latency')}</th>
              <th>{t('history.error')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
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
                <td>
                  <span style={{ color: threshold && r.latency_ms > threshold ? 'var(--yellow)' : 'var(--text-1)' }}>
                    {r.latency_ms}ms
                  </span>
                  <div
                    className={styles.latencyBar}
                    style={{
                      width: `${Math.min(r.latency_ms / (threshold || 2000) * 100, 100)}%`,
                      background: threshold && r.latency_ms > threshold ? 'var(--yellow)' : 'var(--blue)',
                    }}
                  />
                </td>
                <td className={styles.error}>{r.error || '—'}</td>
              </tr>
            ))}
            {filtered.length === 0 && data.length > 0 && (
              <tr>
                <td colSpan={5} className={styles.emptyRow}>{t('history.noData')}</td>
              </tr>
            )}
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
          {isFetching ? <span className="spinner" /> : t('history.loadMore')}
        </button>
      )}
    </div>
  )
}
