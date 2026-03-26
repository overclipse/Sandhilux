import { useT } from '../i18n'
import type { AlertRule } from '../types/api'
import styles from './AlertRuleItem.module.css'

interface Props {
  rule: AlertRule
  onDelete?: (id: string) => void
}

export function AlertRuleItem({ rule, onDelete }: Props) {
  const t = useT()
  const ruleLabels: Record<string, string> = {
    down: t('rule.down'),
    latency_gt: t('rule.latency'),
    status_code: t('rule.statusMismatch'),
  }
  return (
    <div className={styles.item}>
      <div className={styles.info}>
        <span className={styles.type}>{ruleLabels[rule.type]}</span>
        <span className={styles.detail}>
          {rule.type === 'latency_gt' && `> ${rule.threshold}ms`}
          {rule.type === 'down' && rule.consecutive_fails && t('rule.afterFails', { count: rule.consecutive_fails })}
        </span>
      </div>
      {onDelete && (
        <button className="btn btn-danger btn-sm" onClick={() => onDelete(rule.id)}>
          {t('rule.remove')}
        </button>
      )}
    </div>
  )
}
