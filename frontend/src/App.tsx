import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Agents } from './components/Agents'
import { News } from './components/News'
import { PriceChart } from './components/PriceChart'
import { QuoteHeader } from './components/QuoteHeader'
import { Search } from './components/Search'
import { TrackRecord } from './components/TrackRecord'
import { Verdict } from './components/Verdict'
import { Watchlist } from './components/Watchlist'
import { WhyWaterfall } from './components/WhyWaterfall'
import { ApiError, api } from './lib/api'
import { useLiveQuotes } from './lib/useLiveQuotes'

const DEFAULT_WATCHLIST = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'TSLA', 'RELIANCE.NS', 'TCS.NS', 'INFY.NS', 'HDFCBANK.NS']

function loadWatchlist(): string[] {
  try {
    const raw = localStorage.getItem('watchlist')
    const v = raw ? JSON.parse(raw) : null
    return Array.isArray(v) && v.length ? v : DEFAULT_WATCHLIST
  } catch {
    return DEFAULT_WATCHLIST
  }
}

function initialSymbol() {
  const s = new URLSearchParams(location.search).get('s')
  return s ? s.toUpperCase() : 'AAPL'
}

export default function App() {
  const [watchlist, setWatchlist] = useState<string[]>(loadWatchlist)
  const [symbol, setSymbolState] = useState(initialSymbol)

  useEffect(() => {
    try {
      localStorage.setItem('watchlist', JSON.stringify(watchlist))
    } catch {
      /* storage unavailable */
    }
  }, [watchlist])

  const setSymbol = useCallback((s: string) => {
    setSymbolState(s)
    const url = new URL(location.href)
    url.searchParams.set('s', s)
    history.replaceState(null, '', url)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  useEffect(() => {
    const onPop = () => setSymbolState(initialSymbol())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const { quotes, state: live } = useLiveQuotes([...watchlist, symbol])
  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: api.health,
    refetchInterval: (q) => (q.state.data?.model.state === 'training' ? 3000 : 60_000),
  })
  const training = health?.model.state === 'training'

  const analysis = useQuery({
    queryKey: ['analysis', symbol, health?.trainedAt],
    queryFn: () => api.analysis(symbol),
    refetchInterval: 5 * 60_000,
    retry: (n, e) => !(e instanceof ApiError && e.status < 500) && n < 2,
  })

  useEffect(() => {
    document.title = `${symbol} | Clearview`
  }, [symbol])

  const inList = watchlist.includes(symbol)
  const q = quotes[symbol]

  return (
    <div className="mx-auto max-w-[1480px] px-4 pb-16 sm:px-6">
      <div className="sticky top-0 z-30 -mx-4 bg-paper/85 px-4 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex items-center gap-4 py-3 sm:gap-8">
          <a href="/" className="flex shrink-0 items-center gap-2" aria-label="Clearview home">
            <img src="/favicon.svg" alt="" className="h-7 w-7" />
            <span className="hidden text-lg font-bold tracking-tight sm:inline">Clearview</span>
          </a>
          <Search onPick={setSymbol} />
          <div className="ml-auto flex shrink-0 items-center gap-2 text-sm text-ink-2">
            <span className={`h-2 w-2 rounded-full ${live === 'live' ? 'live-dot bg-up' : 'bg-hold'}`} aria-hidden />
            <span className="hidden sm:inline">{live === 'live' ? 'Live' : live === 'connecting' ? 'Connecting' : 'Reconnecting'}</span>
            {health?.dataSource === 'demo' && <span className="rounded-full bg-hold-soft px-2 py-0.5 text-xs font-semibold text-hold">Simulated data</span>}
          </div>
        </div>
        {training && (
          <div className="-mx-4 border-y border-why/20 bg-why-soft px-4 py-2 text-sm text-why sm:-mx-6 sm:px-6" role="status">
            Training the model on live data: {health?.model.message}. Predictions appear when it finishes, usually in a minute or two.
            <span className="ml-3 inline-block h-1.5 w-32 rounded-full bg-why/20 align-middle"><span className="block h-full rounded-full bg-why transition-all" style={{ width: `${(health?.model.progress ?? 0) * 100}%` }} /></span>
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="order-last lg:order-first">
          <div className="lg:sticky lg:top-20">
            <Watchlist symbols={watchlist} quotes={quotes} active={symbol} onSelect={setSymbol} onRemove={(s) => setWatchlist((w) => w.filter((x) => x !== s))} />
            <p className="mt-6 px-3 text-xs leading-relaxed text-ink-3">
              Prices from Yahoo Finance, refreshed every few seconds. Some exchanges are delayed up to 15 minutes.
            </p>
          </div>
        </aside>

        <main className="min-w-0 space-y-10">
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1"><QuoteHeader q={q} symbol={symbol} /></div>
              {!inList && (
                <button onClick={() => setWatchlist((w) => [...w, symbol])} className="flex shrink-0 items-center gap-1.5 rounded-lg bg-sheet px-3 py-1.5 text-sm font-medium ring-1 ring-rule hover:bg-grid">
                  <Plus className="h-4 w-4" aria-hidden /> Add to watchlist
                </button>
              )}
            </div>
            <PriceChart symbol={symbol} quote={q} />
          </div>

          {analysis.isLoading ? (
            <div className="grid gap-6 xl:grid-cols-[22rem_1fr]">
              <div className="h-96 animate-pulse rounded-2xl bg-grid" />
              <div className="h-96 animate-pulse rounded-2xl bg-grid" />
            </div>
          ) : analysis.error ? (
            <div className="rounded-2xl bg-down-soft p-6 text-down">
              <p className="font-semibold">Couldn't analyse {symbol}.</p>
              <p className="mt-1 text-sm">{(analysis.error as Error).message}. Check the symbol (Indian stocks end in .NS, e.g. INFY.NS) and try again.</p>
            </div>
          ) : analysis.data ? (
            <>
              <div className="grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
                <Verdict a={analysis.data} />
                {analysis.data.explanation ? (
                  <WhyWaterfall key={symbol} a={analysis.data} />
                ) : (
                  <div className="grid place-items-center rounded-2xl bg-sheet p-8 text-center text-ink-2 ring-1 ring-rule">
                    The ML model is still training. The technical, trend and risk agents are already working.
                  </div>
                )}
              </div>
              <Agents agents={analysis.data.agents} />
              <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_24rem]">
                {analysis.data.prediction ? <TrackRecord a={analysis.data} /> : <div />}
                <News symbol={symbol} />
              </div>
            </>
          ) : null}

          <footer className="border-t border-rule pt-6 text-xs leading-relaxed text-ink-3">
            Clearview is an educational project. Predictions are uncertain and are not financial advice. Analysis uses daily closes as of {analysis.data?.asOf ?? 'the latest session'}.
          </footer>
        </main>
      </div>
    </div>
  )
}
