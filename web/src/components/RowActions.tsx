import { useState, useRef, useEffect } from 'react'
import { useT } from '../i18n'
import styles from './RowActions.module.css'

interface Props {
  enabled: boolean
  onEdit: () => void
  onToggle: () => void
  onDelete: () => void
}

export function RowActions({ enabled, onEdit, onToggle, onDelete }: Props) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const act = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation()
    setOpen(false)
    fn()
  }

  return (
    <div className={styles.wrapper} ref={ref}>
      <button
        className={styles.trigger}
        data-open={open}
        onClick={(e) => { e.stopPropagation(); setOpen(!open) }}
      >
        <span className={styles.dots}>
          <span /><span /><span />
        </span>
      </button>

      {open && (
        <div className={styles.menu}>
          <button className={styles.item} onClick={act(onEdit)}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11.5 1.5l3 3L5 14H2v-3L11.5 1.5z" />
            </svg>
            {t('actions.edit')}
          </button>

          <button className={styles.itemMuted} onClick={act(onToggle)}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              {enabled ? (
                <><rect x="1" y="4" width="14" height="8" rx="4" /><circle cx="11" cy="8" r="2" fill="currentColor" /></>
              ) : (
                <><rect x="1" y="4" width="14" height="8" rx="4" /><circle cx="5" cy="8" r="2" fill="currentColor" /></>
              )}
            </svg>
            {enabled ? t('actions.pause') : t('actions.resume')}
          </button>

          <div className={styles.sep} />

          <button className={styles.itemDanger} onClick={act(onDelete)}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 4h12M5.5 4V2.5h5V4M6 7v5M10 7v5M3.5 4l.5 9.5a1 1 0 001 .5h6a1 1 0 001-.5L12.5 4" />
            </svg>
            {t('actions.delete')}
          </button>
        </div>
      )}
    </div>
  )
}
