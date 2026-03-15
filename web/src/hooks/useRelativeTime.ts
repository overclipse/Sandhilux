import { useEffect, useState } from 'react'

function formatRelative(date: string): string {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (diff < 5) return 'just now'
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

export function useRelativeTime(date: string | undefined): string {
  const [label, setLabel] = useState(() => (date ? formatRelative(date) : '—'))

  useEffect(() => {
    if (!date) return
    setLabel(formatRelative(date))
    const id = setInterval(() => setLabel(formatRelative(date)), 1000)
    return () => clearInterval(id)
  }, [date])

  return label
}
