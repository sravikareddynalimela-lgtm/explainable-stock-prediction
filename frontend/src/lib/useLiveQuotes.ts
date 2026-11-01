import { useEffect, useRef, useState } from 'react'
import { api, type Quote } from './api'

export type LiveState = 'connecting' | 'live' | 'reconnecting'

/** Subscribes to the backend's Server-Sent Events stream of quotes. */
export function useLiveQuotes(symbols: string[]) {
  const [quotes, setQuotes] = useState<Record<string, Quote>>({})
  const [state, setState] = useState<LiveState>('connecting')
  const [lastUpdate, setLastUpdate] = useState<number | null>(null)
  const key = [...new Set(symbols)].sort().join(',')
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!key) return
    const list = key.split(',')
    setState('connecting')
    // Prime with a regular fetch so the UI has data before the first stream event.
    api.quotes(list).then((qs) => setQuotes((prev) => merge(prev, qs))).catch(() => {})

    const es = new EventSource(api.streamUrl(list))
    esRef.current = es
    es.addEventListener('quotes', (e) => {
      const qs = JSON.parse((e as MessageEvent).data) as Quote[]
      setQuotes((prev) => merge(prev, qs))
      setLastUpdate(Date.now())
      setState('live')
    })
    es.onerror = () => setState('reconnecting')
    return () => es.close()
  }, [key])

  return { quotes, state, lastUpdate }
}

function merge(prev: Record<string, Quote>, qs: Quote[]) {
  const next = { ...prev }
  for (const q of qs) next[q.symbol] = q
  return next
}
