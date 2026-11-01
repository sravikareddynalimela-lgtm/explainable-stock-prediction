import { useCallback, useEffect, useState } from 'react'
import { useAuth } from './auth'
import { supabase } from './supabase'

export const DEFAULT_WATCHLIST = ['RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS', 'INFY.NS', 'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'TSLA']

/** Each user's watchlist, stored in the Supabase `watchlist` table (see supabase/schema.sql). */
export function useWatchlist() {
  const { user } = useAuth()
  const [symbols, setSymbols] = useState<string[]>(DEFAULT_WATCHLIST)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase || !user) return
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase.from('watchlist').select('symbol, position').order('position')
      if (cancelled) return
      if (error) {
        setError('Watchlist couldn’t be loaded. Run supabase/schema.sql in your Supabase project.')
        return
      }
      if (data.length === 0) {
        // first login: seed with defaults
        await supabase.from('watchlist').insert(DEFAULT_WATCHLIST.map((symbol, position) => ({ user_id: user.id, symbol, position })))
        setSymbols(DEFAULT_WATCHLIST)
      } else {
        setSymbols(data.map((r) => r.symbol))
      }
      setError(null)
    })()
    return () => {
      cancelled = true
    }
  }, [user])

  const add = useCallback(async (symbol: string) => {
    setSymbols((s) => (s.includes(symbol) ? s : [...s, symbol]))
    if (supabase && user) {
      const { error } = await supabase.from('watchlist').upsert({ user_id: user.id, symbol, position: Math.floor(Date.now() / 1000) }, { onConflict: 'user_id,symbol' })
      if (error) setError(`Couldn’t save ${symbol}: ${error.message}`)
    }
  }, [user])

  const remove = useCallback(async (symbol: string) => {
    setSymbols((s) => s.filter((x) => x !== symbol))
    if (supabase && user) {
      const { error } = await supabase.from('watchlist').delete().eq('symbol', symbol)
      if (error) setError(`Couldn’t remove ${symbol}: ${error.message}`)
    }
  }, [user])

  return { symbols, add, remove, error }
}
