import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Agents } from '../components/Agents'
import { Logo } from '../components/Logo'
import { News } from '../components/News'
import { PriceChart } from '../components/PriceChart'
import { KeyStats, QuoteHeader } from '../components/QuoteHeader'
import { Search } from '../components/Search'
import { INDEX_SYMBOLS, TickerTape } from '../components/TickerTape'
import { TrackRecord } from '../components/TrackRecord'
import { UserMenu } from '../components/UserMenu'
import { Verdict } from '../components/Verdict'
import { Watchlist } from '../components/Watchlist'
import { WhyWaterfall } from '../components/WhyWaterfall'
import { ApiError, api, type Quote } from '../lib/api'
import { useLiveQuotes } from '../lib/useLiveQuotes'
import { useWatchlist } from '../lib/useWatchlist'

type Tab = 'why' | 'agents' | 'backtest' | 'news'
const TABS: { id: Tab; label: string }[] = [
  { id: 'why', label: 'Why this call' },
  { id: 'agents', label: 'Agents' },
  { id: 'backtest', label: 'Backtest' },
  { id: 'news', label: 'News' },
]

export default function Dashboard() {
  const [params, setParams] = useSearchParams()
  const symbol = (params.get('s') ?? 'RELIANCE.NS').toUpperCase()
  const [tab, setTab] = useState<Tab>('why')
  const watch = useWatchlist()

  const setSymbol = useCallback((s: string) => {
    setParams({ s }, { replace: false })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [setParams])

  const { quotes, state: live } = useLiveQuotes([...INDEX_SYMBOLS, ...watch.symbols, symbol])
  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: api.health,
    refetchInterval: (q) => (q.state.data?.model.state === 'training' ? 3000 : 60_000),
  })
  const analysis = useQuery({
    queryKey: ['analysis', symbol, health?.trainedAt],
    queryFn: () => api.analysis(symbol),
    refetchInterval: 5 * 60_000,
    retry: (n, e) => !(e instanceof ApiError && e.status < 500) && n < 2,
  })

  useEffect(() => { document.title = `${symbol.replace('.NS', '')} | Clearview` }, [symbol])

  const q = quotes[symbol]
  const inList = watch.symbols.includes(symbol)
  const indexQuotes = INDEX_SYMBOLS.map((s) => quotes[s]).filter((x): x is Quote => Boolean(x))
  const a = analysis.data

  return (
    <div className="min-h-screen">
      {/* top bar */}
      <div className="sticky top-0 z-30 bg-void/95 backdrop-blur">
        <div className="flex h-12 items-center gap-4 border-b border-line px-3 sm:px-4">
          <a href="/" aria-label="Clearview home" className="shrink-0"><Logo compact /></a>
          <Search onPick={setSymbol} />
          <div className="ml-auto flex shrink-0 items-center gap-4">
            <MarketPills quotes={quotes} />
            <span className="hidden items-center gap-1.5 text-xs text-fg-2 sm:flex">
              <span className={`h-1.5 w-1.5 rounded-full ${live === 'live' ? 'live-dot bg-up' : 'bg-hold'}`} aria-hidden />
              {live === 'live' ? 'Live' : live === 'connecting' ? 'Connecting' : 'Reconnecting'}
            </span>
            {health?.dataSource === 'demo' && <span className="rounded bg-hold-dim px-1.5 py-0.5 text-[11px] font-semibold text-hold">Simulated data</span>}
            <UserMenu />
          </div>
        </div>
        <TickerTape quotes={indexQuotes} onPick={setSymbol} />
        {health?.model.state === 'training' && (
          <div role="status" className="flex items-center gap-3 border-b border-why/30 bg-why-dim px-4 py-1.5 text-xs text-why">
            Training the model on live data: {health.model.message}. Predictions appear when it finishes.
            <span className="h-1 w-28 rounded-full bg-why/20"><span className="block h-full rounded-full bg-why transition-all" style={{ width: `${health.model.progress * 100}%` }} /></span>
          </div>
        )}
        {watch.error && <div role="alert" className="border-b border-down/30 bg-down-dim px-4 py-1.5 text-xs text-down">{watch.error}</div>}
      </div>

      <div className="grid gap-2 p-2 lg:grid-cols-[17rem_minmax(0,1fr)] 2xl:grid-cols-[17rem_minmax(0,1fr)_21rem]">
        {/* watchlist */}
        <Panel className="order-3 lg:order-none lg:sticky lg:top-[94px] lg:h-[calc(100vh-102px)] lg:row-span-2">
          <Watchlist symbols={watch.symbols} quotes={quotes} active={symbol} onSelect={setSymbol} onRemove={watch.remove} />
        </Panel>

        {/* chart + analysis */}
        <div className="min-w-0 space-y-2">
          <Panel>
            <QuoteHeader q={q} symbol={symbol} inList={inList} onToggleList={() => (inList ? watch.remove(symbol) : watch.add(symbol))} />
            <div className="h-[460px] border-t border-line xl:h-[520px]"><PriceChart symbol={symbol} quote={q} /></div>
          </Panel>

          {/* signal + stats sit here below 2xl, in their own column above it */}
          <div className="grid gap-2 md:grid-cols-2 2xl:hidden">
            <Panel>{a ? <Verdict a={a} /> : <SignalPlaceholder loading={analysis.isLoading} />}</Panel>
            <Panel><KeyStats q={q} a={a} /></Panel>
          </div>

          <Panel>
            <div role="tablist" aria-label="Analysis" className="flex overflow-x-auto border-b border-line px-2">
              {TABS.map((t) => (
                <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
                  className={`relative shrink-0 px-3 py-2.5 text-sm font-semibold transition-colors ${tab === t.id ? 'text-fg' : 'text-fg-3 hover:text-fg-2'}`}>
                  {t.label}
                  {tab === t.id && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-brand" />}
                </button>
              ))}
            </div>
            <div role="tabpanel" className="min-h-[320px]">
              {analysis.isLoading ? (
                <div className="space-y-3 p-5">{[0, 1, 2, 3].map((i) => <div key={i} className="h-8 animate-pulse rounded bg-raised" />)}</div>
              ) : analysis.error ? (
                <div className="p-5 text-sm">
                  <p className="font-semibold text-down">Couldn’t analyse {symbol}.</p>
                  <p className="mt-1 text-fg-2">{(analysis.error as Error).message}. Indian stocks end in .NS (e.g. INFY.NS).</p>
                </div>
              ) : a ? (
                <>
                  {tab === 'why' && (a.explanation ? <WhyWaterfall key={symbol} a={a} /> : <p className="p-5 text-sm text-fg-2">The ML model is still training. The technical, trend and risk agents are already live under Agents.</p>)}
                  {tab === 'agents' && <Agents agents={a.agents} />}
                  {tab === 'backtest' && (a.prediction ? <TrackRecord a={a} /> : <p className="p-5 text-sm text-fg-2">Backtest results appear once the model finishes training.</p>)}
                  {tab === 'news' && <News symbol={symbol} />}
                </>
              ) : null}
            </div>
          </Panel>
          <p className="px-2 py-3 text-[11px] leading-relaxed text-fg-3">
            Educational project. Predictions are uncertain and are not financial advice. Analysis uses daily closes as of {a?.asOf ?? 'the latest session'}; quotes from Yahoo Finance, some exchanges delayed up to 15 minutes.
          </p>
        </div>

        {/* right column on very wide screens */}
        <div className="hidden space-y-2 2xl:block">
          <div className="sticky top-[94px] space-y-2">
            <Panel>{a ? <Verdict a={a} /> : <SignalPlaceholder loading={analysis.isLoading} />}</Panel>
            <Panel><KeyStats q={q} a={a} /></Panel>
          </div>
        </div>
      </div>
    </div>
  )
}

function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`overflow-hidden rounded-lg border border-line bg-panel ${className}`}>{children}</section>
}

function SignalPlaceholder({ loading }: { loading: boolean }) {
  return (
    <div>
      <h2 className="border-b border-line px-4 py-2 text-sm font-semibold">Signal</h2>
      {loading ? <div className="m-4 h-40 animate-pulse rounded bg-raised" /> : <p className="p-4 text-sm text-fg-2">No signal available for this symbol.</p>}
    </div>
  )
}

function MarketPills({ quotes }: { quotes: Record<string, Quote> }) {
  const pill = (label: string, q?: Quote) => {
    const open = q?.marketState === 'OPEN'
    return (
      <span className="flex items-center gap-1.5 text-xs text-fg-2" title={q ? `${label} ${open ? 'open' : 'closed'}` : label}>
        <span className={`h-1.5 w-1.5 rounded-full ${open ? 'bg-up' : 'bg-fg-3'}`} aria-hidden />
        {label} <span className={open ? 'text-up' : 'text-fg-3'}>{q ? (open ? 'Open' : 'Closed') : '–'}</span>
      </span>
    )
  }
  return (
    <span className="hidden items-center gap-4 md:flex">
      {pill('NSE', quotes['^NSEI'])}
      {pill('NYSE', quotes['^GSPC'])}
    </span>
  )
}
