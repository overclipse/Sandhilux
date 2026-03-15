import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Area,
  ComposedChart,
} from 'recharts'
import type { LatencyPoint } from '../types/api'

interface Props {
  data: LatencyPoint[]
  threshold?: number
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomDot(props: any) {
  const { cx, cy, payload, threshold } = props
  if (threshold && payload.latency > threshold) {
    return (
      <g>
        <circle cx={cx} cy={cy} r={6} fill="rgba(239, 68, 68, 0.15)" stroke="none" />
        <circle cx={cx} cy={cy} r={3.5} fill="var(--red)" stroke="rgba(239, 68, 68, 0.4)" strokeWidth={1} />
      </g>
    )
  }
  return null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload as LatencyPoint
  return (
    <div style={{
      background: 'rgba(12, 18, 34, 0.9)',
      backdropFilter: 'blur(16px)',
      border: '1px solid rgba(59, 130, 246, 0.2)',
      borderRadius: 10,
      padding: '10px 14px',
      fontSize: 12,
      boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 20px rgba(59, 130, 246, 0.08)',
    }}>
      <div style={{ color: 'var(--text-3)', marginBottom: 6, fontSize: 11 }}>
        {new Date(d.time).toLocaleString('en-GB')}
      </div>
      <div style={{ color: 'var(--text-1)', fontWeight: 600 }}>
        Latency: <span style={{ color: 'var(--blue)' }}>{d.latency}ms</span>
      </div>
      <div style={{
        color: d.status_code >= 400 || d.status_code === 0 ? 'var(--red)' : 'var(--green)',
        fontSize: 11,
        marginTop: 2,
      }}>
        HTTP {d.status_code || 'N/A'}
      </div>
    </div>
  )
}

export function LatencyChart({ data, threshold }: Props) {
  const formatted = data.map((p) => ({ ...p, time: formatTime(p.time) }))

  return (
    <ResponsiveContainer width="100%" height={240}>
      <ComposedChart data={formatted} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--blue)" stopOpacity={0.2} />
            <stop offset="100%" stopColor="var(--blue)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--blue)" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(30, 41, 59, 0.4)" vertical={false} />
        <XAxis
          dataKey="time"
          tick={{ fill: 'var(--text-3)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: 'var(--text-3)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          unit="ms"
          width={48}
        />
        <Tooltip content={<CustomTooltip />} wrapperStyle={{ outline: 'none' }} cursor={{ stroke: 'rgba(59,130,246,0.15)', strokeWidth: 1 }} />
        {threshold && (
          <ReferenceLine
            y={threshold}
            stroke="var(--red)"
            strokeDasharray="4 4"
            strokeOpacity={0.6}
            label={{ value: `${threshold}ms`, fill: 'var(--red)', fontSize: 11, position: 'right' }}
          />
        )}
        <Area
          type="monotone"
          dataKey="latency"
          fill="url(#latencyGradient)"
          stroke="none"
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="latency"
          stroke="url(#lineGradient)"
          strokeWidth={2.5}
          dot={<CustomDot threshold={threshold} />}
          activeDot={{ r: 5, fill: 'var(--blue)', stroke: 'rgba(59, 130, 246, 0.3)', strokeWidth: 4 }}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
