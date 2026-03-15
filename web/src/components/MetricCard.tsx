import styles from './MetricCard.module.css'

interface Props {
  label: string
  value: string | number
  trend?: number
  color?: 'default' | 'red' | 'yellow'
}

export function MetricCard({ label, value, trend, color = 'default' }: Props) {
  const trendUp = trend !== undefined && trend > 0
  const trendDown = trend !== undefined && trend < 0

  return (
    <div className={`card ${styles.card}`}>
      <span className={styles.label}>{label}</span>
      <span className={`${styles.value} ${color !== 'default' ? styles[color] : ''}`}>
        {value}
      </span>
      {trend !== undefined && (
        <span className={`${styles.trend} ${trendUp ? styles.trendUp : trendDown ? styles.trendDown : ''}`}>
          {trendUp ? '↑' : trendDown ? '↓' : '→'}
        </span>
      )}
    </div>
  )
}
