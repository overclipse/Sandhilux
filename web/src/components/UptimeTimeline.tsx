import { useMemo } from 'react'
import type { TimelineSegment } from '../types/api'
import styles from './UptimeTimeline.module.css'

interface Props {
  data: TimelineSegment[]
}

const STATUS_COLORS: Record<string, string> = {
  up: 'var(--green)',
  down: 'var(--red)',
  slow: 'var(--yellow)',
}

export function UptimeTimeline({ data }: Props) {
  const segments = useMemo(() => {
    if (data.length === 0) return []
    const start = new Date(data[0].start).getTime()
    const end = new Date(data[data.length - 1].end).getTime()
    const total = end - start
    if (total <= 0) return []
    return data.map((seg) => {
      const s = new Date(seg.start).getTime()
      const e = new Date(seg.end).getTime()
      return {
        left: ((s - start) / total) * 100,
        width: Math.max(((e - s) / total) * 100, 0.5),
        status: seg.status,
        start: new Date(seg.start),
        end: new Date(seg.end),
      }
    })
  }, [data])

  if (segments.length === 0) return null

  return (
    <div className={styles.wrap}>
      <div className={styles.bar}>
        {segments.map((seg, i) => (
          <div
            key={i}
            className={styles.segment}
            style={{
              left: `${seg.left}%`,
              width: `${seg.width}%`,
              background: STATUS_COLORS[seg.status] ?? 'var(--text-3)',
            }}
            title={`${seg.status.toUpperCase()} ${seg.start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} – ${seg.end.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`}
          />
        ))}
      </div>
      <div className={styles.labels}>
        <span>{segments[0].start.toLocaleDateString()}</span>
        <span>{segments[segments.length - 1].end.toLocaleDateString()}</span>
      </div>
    </div>
  )
}
