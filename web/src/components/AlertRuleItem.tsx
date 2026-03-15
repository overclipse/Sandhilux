import type { AlertRule } from '../types/api'
import styles from './AlertRuleItem.module.css'

interface Props {
  rule: AlertRule
  onDelete?: (id: string) => void
}

const ruleLabels: Record<AlertRule['type'], string> = {
  down: 'Down detection',
  latency_gt: 'Latency threshold',
  status_code: 'Status code mismatch',
}

export function AlertRuleItem({ rule, onDelete }: Props) {
  return (
    <div className={styles.item}>
      <div className={styles.info}>
        <span className={styles.type}>{ruleLabels[rule.type]}</span>
        <span className={styles.detail}>
          {rule.type === 'latency_gt' && `> ${rule.threshold}ms`}
          {rule.type === 'down' && rule.consecutive_fails && `after ${rule.consecutive_fails} fails`}
        </span>
        {rule.notify_telegram && (
          <span className={styles.telegramTag}>📨 Telegram</span>
        )}
      </div>
      {onDelete && (
        <button className="btn btn-danger btn-sm" onClick={() => onDelete(rule.id)}>
          Remove
        </button>
      )}
    </div>
  )
}
