import { useEffect, useState } from 'react'
import { api, type Quote } from './api'
import { useAuth } from './auth'

export type LiveState = 'connecting' | 'live' | 'reconnecting'

/** Subscribes to the backend's Server-Sent Events stream of quotes. */
export function useLiveQuotes(symbols: string[]) {
  const { session } = useAuth()
  const token = session?.access_token ?? null
  const [quotes, setQuotes] = useState<Record<string, Quote>>({})
  const [state, setState] = useState<LiveState>('connecting')
  const key = [...new Set(symbols)].sort().join(',')

  useEffect(() => {
    if (!key) return
    const list = key.split(',')
    setState('connecting')
    api.quotes(list).then((qs) => setQuotes((prev) => merge(prev, qs))).catch(() => {})

    // reconnects whenever the symbol set or the (auto-refreshed) access token changes
    const es = new EventSource(api.streamUrl(list, token))
    es.addEventListener('quotes', (e) => {
      setQuotes((prev) => merge(prev, JSON.parse((e as MessageEvent).data) as Quote[]))
      setState('live')
    })
    es.onerror = () => setState('reconnecting')
    return () => es.close()
  }, [key, token])

  return { quotes, state }
}

function merge(prev: Record<string, Quote>, qs: Quote[]) {
  const next = { ...prev }
  for (const q of qs) next[q.symbol] = q
  return next
}
