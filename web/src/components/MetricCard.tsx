import styles from './MetricCard.module.css'

interface Props {
  label: string
  value: string | number
  trend?: number
}

export function MetricCard({ label, value, trend }: Props) {
  const trendUp = trend !== undefined && trend > 0
  const trendDown = trend !== undefined && trend < 0

  return (
    <div className={`card ${styles.card}`}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
      {trend !== undefined && (
        <span className={`${styles.trend} ${trendUp ? styles.trendUp : trendDown ? styles.trendDown : ''}`}>
          {trendUp ? '↑' : trendDown ? '↓' : '→'}{' '}
          {trendUp ? '+' : ''}{typeof trend === 'number' ? Math.round(trend) : trend}
        </span>
      )}
    </div>
  )
}
