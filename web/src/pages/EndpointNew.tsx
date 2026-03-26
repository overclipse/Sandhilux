import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { endpointsApi } from '../api/endpoints'
import { useT } from '../i18n'
import type { EndpointCreate } from '../types/api'
import { getErrorMessage } from '../utils/error'
import styles from './EndpointNew.module.css'

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD']

function validate(form: EndpointCreate, t: (key: string) => string): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!form.name.trim()) errors.name = t('form.required')
  if (!form.url.trim()) errors.url = t('form.required')
  else {
    try { new URL(form.url) } catch { errors.url = t('form.invalidUrl') }
  }
  if (form.check_interval < 10 || form.check_interval > 3600) errors.check_interval = t('form.intervalRange')
  if (form.timeout < 1 || form.timeout > 30) errors.timeout = t('form.timeoutRange')
  if (form.expected_status !== undefined && (form.expected_status < 100 || form.expected_status > 599)) {
    errors.expected_status = t('form.statusRange')
  }
  if (form.latency_threshold !== undefined && form.latency_threshold <= 0) {
    errors.latency_threshold = t('form.mustBePositive')
  }
  if (form.headers) {
    try { JSON.parse(form.headers) } catch { errors.headers = t('form.invalidJson') }
  }
  return errors
}

export function EndpointNew() {
  const t = useT()
  const navigate = useNavigate()
  const [form, setForm] = useState<EndpointCreate>({
    name: '',
    url: '',
    method: 'GET',
    headers: '',
    body: '',
    check_interval: 60,
    timeout: 10,
    expected_status: undefined,
    latency_threshold: undefined,
    follow_redirects: true,
    enabled: true,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [shaking, setShaking] = useState(false)

  const createMutation = useMutation({
    mutationFn: (data: EndpointCreate) => endpointsApi.create(data),
    onSuccess: (ep) => navigate(`/endpoints/${ep.id}`),
  })

  function set<K extends keyof EndpointCreate>(key: K, value: EndpointCreate[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => { const next = { ...prev }; delete next[key]; return next })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate(form, t)
    if (Object.keys(errs).length) {
      setErrors(errs)
      setShaking(true)
      setTimeout(() => setShaking(false), 450)
      return
    }
    createMutation.mutate(form)
  }

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>{t('form.back')}</button>
        <h1 className={styles.pageTitle}>{t('form.addTitle')}</h1>
      </div>

      <form className={`card ${styles.formCard}${shaking ? ' shake' : ''}`} onSubmit={handleSubmit} noValidate>
        <div className={styles.grid}>
          {/* Name */}
          <div className={`form-group ${styles.full}`}>
            <label className="form-label">{t('form.name')} *</label>
            <input className={`form-input ${errors.name ? 'error' : ''}`} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="My API" />
            {errors.name && <span className="form-error">{errors.name}</span>}
          </div>

          {/* Method + URL */}
          <div className={`form-group ${styles.full}`}>
            <label className="form-label">{t('form.methodUrl')} *</label>
            <div className={styles.methodUrl}>
              <select className="form-input" style={{ width: 100, flexShrink: 0 }} value={form.method} onChange={(e) => set('method', e.target.value)}>
                {METHODS.map((m) => <option key={m}>{m}</option>)}
              </select>
              <input className={`form-input ${errors.url ? 'error' : ''}`} value={form.url} onChange={(e) => set('url', e.target.value)} placeholder="https://api.example.com/health" />
            </div>
            {errors.url && <span className="form-error">{errors.url}</span>}
          </div>

          {/* Headers */}
          <div className={`form-group ${styles.full}`}>
            <label className="form-label">{t('form.headers')}</label>
            <textarea
              className={`form-input mono ${errors.headers ? 'error' : ''}`}
              rows={3}
              value={form.headers}
              onChange={(e) => set('headers', e.target.value)}
              placeholder='{"Authorization": "Bearer token"}'
            />
            {errors.headers && <span className="form-error">{errors.headers}</span>}
          </div>

          {/* Body */}
          <div className={`form-group ${styles.full}`}>
            <label className="form-label">{t('form.body')}</label>
            <textarea className="form-input mono" rows={3} value={form.body} onChange={(e) => set('body', e.target.value)} placeholder='{"key": "value"}' />
          </div>

          {/* Interval */}
          <div className="form-group">
            <label className="form-label">{t('form.interval')} *</label>
            <input className={`form-input ${errors.check_interval ? 'error' : ''}`} type="number" min={10} max={3600} value={form.check_interval} onChange={(e) => set('check_interval', Number(e.target.value))} />
            {errors.check_interval && <span className="form-error">{errors.check_interval}</span>}
          </div>

          {/* Timeout */}
          <div className="form-group">
            <label className="form-label">{t('form.timeout')} *</label>
            <input className={`form-input ${errors.timeout ? 'error' : ''}`} type="number" min={1} max={30} value={form.timeout} onChange={(e) => set('timeout', Number(e.target.value))} />
            {errors.timeout && <span className="form-error">{errors.timeout}</span>}
          </div>

          {/* Expected status */}
          <div className="form-group">
            <label className="form-label">{t('form.expectedStatus')}</label>
            <input className={`form-input ${errors.expected_status ? 'error' : ''}`} type="number" min={100} max={599} placeholder="200" value={form.expected_status ?? ''} onChange={(e) => set('expected_status', e.target.value ? Number(e.target.value) : undefined)} />
            {errors.expected_status && <span className="form-error">{errors.expected_status}</span>}
          </div>

          {/* Latency threshold */}
          <div className="form-group">
            <label className="form-label">{t('form.latencyThreshold')}</label>
            <input className={`form-input ${errors.latency_threshold ? 'error' : ''}`} type="number" min={1} placeholder="2000" value={form.latency_threshold ?? ''} onChange={(e) => set('latency_threshold', e.target.value ? Number(e.target.value) : undefined)} />
            {errors.latency_threshold && <span className="form-error">{errors.latency_threshold}</span>}
          </div>

          {/* Follow redirects */}
          <div className={`form-group ${styles.full}`}>
            <label className={styles.toggleLabel}>
              <input type="checkbox" checked={form.follow_redirects} onChange={(e) => set('follow_redirects', e.target.checked)} />
              <span>{t('form.followRedirects')}</span>
            </label>
          </div>

          {/* Enable immediately */}
          <div className={`form-group ${styles.full}`}>
            <label className={styles.toggleLabel}>
              <input type="checkbox" checked={form.enabled} onChange={(e) => set('enabled', e.target.checked)} />
              <span>{t('form.enableNow')}</span>
            </label>
          </div>
        </div>

        {createMutation.error && (
          <p className="form-error" style={{ padding: '0 24px' }}>
            {getErrorMessage(createMutation.error)}
          </p>
        )}

        <div className={styles.formFooter}>
          <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>{t('form.cancel')}</button>
          <button type="submit" className="btn btn-primary" disabled={createMutation.isPending}>
            {createMutation.isPending ? <span className="spinner" /> : t('form.create')}
          </button>
        </div>
      </form>
    </div>
  )
}
