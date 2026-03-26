import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useT } from '../i18n'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { endpointsApi } from '../api/endpoints'
import { metricsApi } from '../api/metrics'
import type { MetricsPeriod } from '../api/metrics'
import { StatusDot } from '../components/StatusDot'
import { LatencyChart } from '../components/LatencyChart'
import { UptimeChart } from '../components/UptimeChart'
import { UptimeTimeline } from '../components/UptimeTimeline'
import { CheckHistoryTable } from '../components/CheckHistoryTable'
import { AlertRuleItem } from '../components/AlertRuleItem'
import { RoleGuard } from '../components/RoleGuard'
import { ErrorBanner } from '../components/ErrorBanner'
import { getErrorMessage } from '../utils/error'
import { useRelativeTime } from '../hooks/useRelativeTime'
import styles from './EndpointDetail.module.css'

const PERIODS: MetricsPeriod[] = ['1h', '24h', '7d', '30d']

export function EndpointDetail() {
  const t = useT()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [period, setPeriod] = useState<MetricsPeriod>('24h')
  const [addRuleOpen, setAddRuleOpen] = useState(false)
  const [ruleType, setRuleType] = useState<'down' | 'latency_gt' | 'status_code'>('down')
  const [ruleThreshold, setRuleThreshold] = useState('')
  const [ruleFails, setRuleFails] = useState('3')
  const [ruleTelegram, setRuleTelegram] = useState(false)

  const { data: endpoint, error: endpointError, refetch } = useQuery({
    queryKey: ['endpoint', id],
    queryFn: () => endpointsApi.get(id!),
  })

  const { data: stats } = useQuery({
    queryKey: ['endpoint-stats', id],
    queryFn: () => endpointsApi.getStats(id!),
  })

  const { data: latency = [] } = useQuery({
    queryKey: ['latency', id, period],
    queryFn: () => metricsApi.latency(id!, period),
  })

  const { data: uptimeData = [] } = useQuery({
    queryKey: ['uptime', id, period],
    queryFn: () => metricsApi.uptime(id!, period),
  })

  const { data: timeline = [] } = useQuery({
    queryKey: ['timeline', id, period],
    queryFn: () => metricsApi.timeline(id!, period),
  })

  const { data: rules = [], refetch: refetchRules } = useQuery({
    queryKey: ['rules', id],
    queryFn: () => endpointsApi.getRules(id!),
  })

  const checkNow = useMutation({
    mutationFn: () => endpointsApi.checkNow(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['endpoint', id] })
      qc.invalidateQueries({ queryKey: ['history', id] })
    },
  })

  const deleteRule = useMutation({
    mutationFn: (ruleId: string) => endpointsApi.deleteRule(id!, ruleId),
    onSuccess: () => refetchRules(),
  })

  const deleteEndpoint = useMutation({
    mutationFn: () => endpointsApi.delete(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['endpoints'] })
      navigate('/endpoints')
    },
  })

  const createRule = useMutation({
    mutationFn: () =>
      endpointsApi.createRule(id!, {
        type: ruleType,
        threshold: ruleType === 'latency_gt' ? Number(ruleThreshold) : undefined,
        consecutive_fails: ruleType === 'down' ? Number(ruleFails) : undefined,
        notify_telegram: ruleTelegram,
      }),
    onSuccess: () => {
      setAddRuleOpen(false)
      refetchRules()
    },
  })

  const lastCheck = useRelativeTime(endpoint?.last_checked_at)

  if (endpointError) {
    return (
      <div className={styles.page}>
        <ErrorBanner message={getErrorMessage(endpointError)} onRetry={() => refetch()} />
      </div>
    )
  }

  if (!endpoint) return null

  const threshold = rules.find((r) => r.type === 'latency_gt')?.threshold

  return (
    <div className={styles.page}>
      {/* Header card */}
      <div className={`card ${styles.headerCard}`}>
        <div className={styles.headerLeft}>
          <StatusDot status={endpoint.status} size={14} />
          <div>
            <div className={styles.nameRow}>
              <span className={styles.name}>{endpoint.name}</span>
              <span className={`badge badge-${endpoint.status}`}>{endpoint.method}</span>
            </div>
            <span className={`${styles.url} mono`}>{endpoint.url}</span>
          </div>
        </div>
        <div className={styles.headerMeta}>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>{t('detail.uptime')}</span>
            <span style={{ color: endpoint.uptime_24h < 90 ? 'var(--red)' : 'var(--green)' }}>
              {endpoint.uptime_24h.toFixed(1)}%
            </span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>{t('detail.avgLatency')}</span>
            <span style={{ color: threshold && endpoint.avg_latency > threshold ? 'var(--yellow)' : 'var(--text-1)' }}>
              {endpoint.avg_latency}ms
            </span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>{t('detail.interval')}</span>
            <span>{endpoint.check_interval}s</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>{t('detail.lastCheck')}</span>
            <span>{lastCheck}</span>
          </div>
        </div>
        <div className={styles.headerActions}>
          <RoleGuard role="admin">
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => checkNow.mutate()}
              disabled={checkNow.isPending}
            >
              {checkNow.isPending ? <span className="spinner" /> : '▶'} {t('detail.checkNow')}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/endpoints/${id}/edit`)}>
              {t('detail.edit')}
            </button>
            <button
              className="btn btn-ghost btn-sm"
              style={{ color: 'var(--red)' }}
              onClick={() => {
                if (confirm(t('detail.confirmDelete'))) deleteEndpoint.mutate()
              }}
              disabled={deleteEndpoint.isPending}
            >
              {deleteEndpoint.isPending ? <span className="spinner" /> : t('detail.delete')}
            </button>
          </RoleGuard>
        </div>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className={styles.statsGrid}>
          <div className="card"><div className={styles.stat}><span className={styles.statLabel}>{t('detail.p50')}</span><span className={styles.statValue}>{Number(stats.p50_latency).toFixed(2)}ms</span></div></div>
          <div className="card"><div className={styles.stat}><span className={styles.statLabel}>{t('detail.p95')}</span><span className={styles.statValue}>{Number(stats.p95_latency).toFixed(2)}ms</span></div></div>
          <div className="card"><div className={styles.stat}><span className={styles.statLabel}>{t('detail.incidents')}</span><span className={styles.statValue} style={{ color: stats.incidents_7d > 0 ? 'var(--red)' : 'var(--text-1)' }}>{stats.incidents_7d}</span></div></div>
          <div className="card"><div className={styles.stat}><span className={styles.statLabel}>{t('detail.checksToday')}</span><span className={styles.statValue}>{stats.checks_today}</span></div></div>
        </div>
      )}

      {/* Latency chart */}
      <div className="card">
        <div className={styles.chartHeader}>
          <span className={styles.sectionTitle}>{t('detail.latency')}</span>
          <div className={styles.periods}>
            {PERIODS.map((p) => (
              <button
                key={p}
                className={`${styles.periodBtn} ${period === p ? styles.periodActive : ''}`}
                onClick={() => setPeriod(p)}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <div style={{ padding: '0 16px 16px' }}>
          <LatencyChart data={latency} threshold={threshold} />
        </div>
      </div>

      {/* Uptime chart + Timeline */}
      <div className={styles.chartsRow}>
        <div className="card" style={{ flex: 1 }}>
          <div className={styles.chartHeader}>
            <span className={styles.sectionTitle}>{t('detail.uptimeTitle')}</span>
          </div>
          <div style={{ padding: '0 16px 16px' }}>
            {uptimeData.length > 0 ? (
              <UptimeChart data={uptimeData} />
            ) : (
              <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>—</div>
            )}
          </div>
        </div>
        <div className="card" style={{ flex: 1 }}>
          <div className={styles.chartHeader}>
            <span className={styles.sectionTitle}>{t('detail.timeline')}</span>
          </div>
          <div style={{ padding: '12px 16px 16px' }}>
            {timeline.length > 0 ? (
              <UptimeTimeline data={timeline} />
            ) : (
              <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>—</div>
            )}
          </div>
        </div>
      </div>

      {/* Alert rules */}
      <div className="card">
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>{t('detail.alertRules')}</span>
          <RoleGuard role="admin">
            <button className="btn btn-ghost btn-sm" onClick={() => setAddRuleOpen((v) => !v)}>
              {t('detail.addRule')}
            </button>
          </RoleGuard>
        </div>

        {addRuleOpen && (
          <div className={styles.addRuleForm}>
            <div className={styles.addRuleRow}>
              <select className="form-input" style={{ width: 180 }} value={ruleType} onChange={(e) => setRuleType(e.target.value as typeof ruleType)}>
                <option value="down">{t('rule.down')}</option>
                <option value="latency_gt">{t('rule.latency')}</option>
                <option value="status_code">{t('rule.statusCode')}</option>
              </select>
              {ruleType === 'latency_gt' && (
                <input className="form-input" style={{ width: 120 }} type="number" placeholder={t('rule.msThreshold')} value={ruleThreshold} onChange={(e) => setRuleThreshold(e.target.value)} />
              )}
              {ruleType === 'down' && (
                <input className="form-input" style={{ width: 140 }} type="number" placeholder={t('rule.consecutiveFails')} value={ruleFails} onChange={(e) => setRuleFails(e.target.value)} />
              )}
              <label className={styles.telegramToggle}>
                <input type="checkbox" checked={ruleTelegram} onChange={(e) => setRuleTelegram(e.target.checked)} />
                {t('rule.telegram')}
              </label>
              <button className="btn btn-primary btn-sm" onClick={() => createRule.mutate()} disabled={createRule.isPending}>
                {createRule.isPending ? <span className="spinner" /> : t('rule.save')}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setAddRuleOpen(false)}>{t('rule.cancel')}</button>
            </div>
          </div>
        )}

        {rules.map((rule) => (
          <AlertRuleItem key={rule.id} rule={rule} onDelete={(rid) => deleteRule.mutate(rid)} />
        ))}

        {rules.length === 0 && !addRuleOpen && (
          <p style={{ padding: '16px', color: 'var(--text-3)', fontSize: 12 }}>{t('detail.noRules')}</p>
        )}
      </div>

      {/* History */}
      <div className="card">
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>{t('detail.checkHistory')}</span>
        </div>
        <CheckHistoryTable endpointId={id!} threshold={threshold} />
      </div>
    </div>
  )
}
