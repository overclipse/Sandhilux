import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from 'recharts'
import type { DailyUptime } from '../types/api'

interface Props {
  data: DailyUptime[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload as DailyUptime
  const isGood = d.uptime >= 95
  return (
    <div style={{
      background: 'rgba(12, 18, 34, 0.9)',
      backdropFilter: 'blur(16px)',
      border: `1px solid ${isGood ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
      borderRadius: 10,
      padding: '10px 14px',
      fontSize: 12,
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    }}>
      <div style={{ color: 'var(--text-3)', fontSize: 11 }}>{d.date}</div>
      <div style={{ color: isGood ? 'var(--green)' : 'var(--red)', fontWeight: 600, marginTop: 2 }}>
        Uptime: {d.uptime.toFixed(1)}%
      </div>
    </div>
  )
}

export function UptimeChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="greenBar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--green)" stopOpacity={0.9} />
            <stop offset="100%" stopColor="var(--green)" stopOpacity={0.4} />
          </linearGradient>
          <linearGradient id="redBar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--red)" stopOpacity={0.9} />
            <stop offset="100%" stopColor="var(--red)" stopOpacity={0.4} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(30, 41, 59, 0.4)" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: 'var(--text-3)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: 'var(--text-3)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          domain={[80, 100]}
          unit="%"
          width={40}
        />
        <Tooltip content={<CustomTooltip />} wrapperStyle={{ outline: 'none' }} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
        <Bar dataKey="uptime" radius={[4, 4, 0, 0]} maxBarSize={36}>
          {data.map((entry, i) => (
            <Cell
              key={i}
              fill={entry.uptime >= 95 ? 'url(#greenBar)' : 'url(#redBar)'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
