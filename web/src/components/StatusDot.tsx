import type { EndpointStatus } from '../types/api'
import styles from './StatusDot.module.css'

interface Props {
  status: EndpointStatus
  size?: number
}

export function StatusDot({ status, size = 8 }: Props) {
  return (
    <span
      className={`${styles.dot} ${styles[status]}`}
      style={{ width: size, height: size }}
    />
  )
}
