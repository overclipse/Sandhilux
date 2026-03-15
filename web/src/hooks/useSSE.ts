import { useEffect } from 'react'
import { useAppStore } from '../store'
import { metricsApi } from '../api/metrics'
import type { SSEMessage } from '../types/api'

const API_URL = import.meta.env.VITE_API_URL ?? ''

export function useSSE() {
  const { accessToken, updateEndpoint, addAlert, resolveAlert, setEndpoints } = useAppStore()

  useEffect(() => {
    if (!accessToken) return

    let es: EventSource
    let reconnectTimer: ReturnType<typeof setTimeout>

    function connect() {
      es = new EventSource(`${API_URL}/api/events?token=${accessToken}`)

      es.onmessage = (event: MessageEvent) => {
        let msg: SSEMessage
        try {
          msg = JSON.parse(event.data as string) as SSEMessage
        } catch {
          return
        }

        if (msg.type === 'check_result') updateEndpoint(msg.data)
        if (msg.type === 'alert_created') addAlert(msg.data)
        if (msg.type === 'alert_resolved') resolveAlert(msg.data.alert_id)
      }

      es.onerror = () => {
        es.close()
        // Re-sync after reconnect to recover missed events
        reconnectTimer = setTimeout(() => {
          metricsApi.overview().catch(() => undefined)
          connect()
        }, 5000)
      }
    }

    connect()

    return () => {
      clearTimeout(reconnectTimer)
      es?.close()
    }
  }, [accessToken, updateEndpoint, addAlert, resolveAlert, setEndpoints])
}
