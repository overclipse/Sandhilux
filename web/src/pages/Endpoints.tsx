import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { endpointsApi } from '../api/endpoints'
import { useAppStore } from '../store'
import { EndpointRow } from '../components/EndpointRow'
import { RoleGuard } from '../components/RoleGuard'
import type { EndpointStatus } from '../types/api'
import styles from './Endpoints.module.css'

type Filter = 'all' | EndpointStatus

export function Endpoints() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const endpoints = useAppStore((s) => s.endpoints)
  const setEndpoints = useAppStore((s) => s.setEndpoints)

  useQuery({
    queryKey: ['endpoints'],
    queryFn: async () => {
      const data = await endpointsApi.list()
      setEndpoints(data)
      return data
    },
  })

  const filtered = endpoints.filter((ep) => {
    if (filter !== 'all' && ep.status !== filter) return false
    if (search && !ep.name.toLowerCase().includes(search.toLowerCase()) && !ep.url.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const filters: Filter[] = ['all', 'up', 'down', 'slow']

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <h1 className={styles.pageTitle}>Endpoints</h1>
        <RoleGuard role="admin">
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/endpoints/new')}>
            + Add endpoint
          </button>
        </RoleGuard>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.filters}>
          {filters.map((f) => (
            <button
              key={f}
              className={`${styles.filterBtn} ${filter === f ? styles.filterActive : ''}`}
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              <span className={styles.filterCount}>
                {f === 'all' ? endpoints.length : endpoints.filter((e) => e.status === f).length}
              </span>
            </button>
          ))}
        </div>
        <input
          className={`form-input ${styles.search}`}
          placeholder="Search by name or URL…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className={`card ${styles.tableCard}`}>
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
              {filtered.map((ep) => (
                <EndpointRow key={ep.id} endpoint={ep} />
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-3)', padding: '32px' }}>
                    No endpoints match
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
