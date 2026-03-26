import { useT } from '../i18n'
import styles from './ErrorBanner.module.css'

interface Props {
  message: string
  onRetry?: () => void
}

export function ErrorBanner({ message, onRetry }: Props) {
  const t = useT()
  return (
    <div className={styles.banner}>
      <span className={styles.icon}>!</span>
      <span className={styles.message}>{message}</span>
      {onRetry && (
        <button className={styles.retryBtn} onClick={onRetry}>
          {t('common.retry')}
        </button>
      )}
    </div>
  )
}
