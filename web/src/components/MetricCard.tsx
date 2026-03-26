import styles from './MetricCard.module.css'

interface Props {
  label: string
  value: string | number
  trend?: number
  color?: 'default' | 'green' | 'red' | 'yellow'
  sparkline?: number[]
}

export function MetricCard({ label, value, trend, color = 'default', sparkline }: Props) {
  const trendUp = trend !== undefined && trend > 0
  const trendDown = trend !== undefined && trend < 0

  const borderColor = color === 'green' ? 'var(--green)' : color === 'red' ? 'var(--red)' : color === 'yellow' ? 'var(--yellow)' : undefined

  return (
    <div
      className={`card ${styles.card}`}
      style={borderColor ? { '--accent-color': borderColor } as React.CSSProperties : undefined}
    >
      {borderColor && <div className={styles.statusBorder} />}
      <span className={styles.label}>{label}</span>
      <span className={`${styles.value} ${color !== 'default' ? styles[color] : ''}`}>
        {value}
      </span>
      {trend !== undefined && (
        <span className={`${styles.trend} ${trendUp ? styles.trendUp : trendDown ? styles.trendDown : ''}`}>
          {trendUp ? '↑' : trendDown ? '↓' : '→'}
        </span>
      )}
      {sparkline && sparkline.length > 1 && (
        <Sparkline data={sparkline} color={borderColor || 'var(--blue)'} />
      )}
    </div>
  )
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const w = 120
  const h = 28
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - min) / range) * (h - 4) - 2
    return `${x},${y}`
  })
  const polyline = points.join(' ')
  // area: close path at bottom
  const area = `0,${h} ${polyline} ${w},${h}`

  return (
    <svg className={styles.sparkline} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`spark-fill-${color.replace(/[^a-z0-9]/gi, '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={area}
        fill={`url(#spark-fill-${color.replace(/[^a-z0-9]/gi, '')})`}
      />
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
