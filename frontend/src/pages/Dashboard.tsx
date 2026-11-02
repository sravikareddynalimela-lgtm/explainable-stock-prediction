import { useQuery } from '@tanstack/react-query'
import { Moon, Sun } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AgentGrid, Fusion } from '../components/Agents'
import { Logo } from '../components/Logo'
import { News } from '../components/News'
import { PriceChart } from '../components/PriceChart'
import { QuoteHeader } from '../components/QuoteHeader'
import { Search } from '../components/Search'
import { INDEX_SYMBOLS, TickerTape } from '../components/TickerTape'
import { TrackRecord } from '../components/TrackRecord'
import { UserMenu } from '../components/UserMenu'
import { Watchlist } from '../components/Watchlist'
import { Explain, FeatureImportance } from '../components/terminal/Explain'
import { Empty, Panel, Skeleton } from '../components/terminal/Panel'
import { PredictionResult } from '../components/terminal/PredictionResult'
import { RecentData } from '../components/terminal/RecentData'
import { ApiError, api, type Quote } from '../lib/api'
import { ThemeScope, useTheme } from '../lib/theme'
import { useLiveQuotes } from '../lib/useLiveQuotes'
import { useWatchlist } from '../lib/useWatchlist'

const SECTIONS = [
  { id: 'overview', key: '1', label: 'Overview' },
  { id: 'agents', key: '2', label: 'Agents' },
  { id: 'explain', key: '3', label: 'Explain' },
  { id: 'model', key: '4', label: 'Model' },
  { id: 'data', key: '5', label: 'Data' },
  { id: 'news', key: '6', label: 'News' },
] as const

export default function Dashboard() {
  return (
    <ThemeScope>
      <Terminal />
    </ThemeScope>
  )
}

function Terminal() {
  const [params, setParams] = useSearchParams()
  const symbol = (params.get('s') ?? 'RELIANCE.NS').toUpperCase()
  const watch = useWatchlist()
  const active = useActiveSection()

  const setSymbol = useCallback((s: string) => {
    setParams({ s })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [setParams])

  // number keys jump between sections
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement
      if (e.metaKey || e.ctrlKey || e.altKey || el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA') return
      const s = SECTIONS.find((x) => x.key === e.key)
      if (s) document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

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

  const body = (render: () => React.ReactNode, rows = 4) =>
    analysis.isLoading ? <Skeleton rows={rows} />
      : analysis.error ? <Empty><b className="text-down">Couldn’t analyse {symbol}.</b> {(analysis.error as Error).message}. Indian stocks end in .NS (e.g. INFY.NS).</Empty>
      : a ? render() : null

  return (
    <>
      {/* ── top bar ── */}
      <div className="sticky top-0 z-30 border-b border-line bg-panel/95 backdrop-blur">
        <div className="flex h-11 items-center gap-3 px-3">
          <a href="/" aria-label="Clearview home" className="shrink-0"><Logo compact /></a>
          <nav aria-label="Sections" className="hidden items-center xl:flex">
            {SECTIONS.map((s) => (
              <a key={s.id} href={`#${s.id}`}
                className={`flex items-center gap-1.5 rounded-sm px-2 py-1 text-xs font-semibold transition-colors ${active === s.id ? 'bg-brand-dim text-brand' : 'text-fg-3 hover:text-fg'}`}>
                <kbd className={`num grid h-4 min-w-4 place-items-center rounded-sm text-[10px] ${active === s.id ? 'bg-brand text-on-brand' : 'border border-line-2'}`}>{s.key}</kbd>
                {s.label}
              </a>
            ))}
          </nav>
          <div className="min-w-0 flex-1 xl:max-w-sm"><Search onPick={setSymbol} /></div>
          <div className="ml-auto flex shrink-0 items-center gap-3">
            <Clocks quotes={quotes} />
            <span className="hidden items-center gap-1.5 text-xs text-fg-2 sm:flex">
              <span className={`h-1.5 w-1.5 rounded-full ${live === 'live' ? 'live-dot bg-up' : 'bg-hold'}`} aria-hidden />
              {live === 'live' ? 'Live' : live === 'connecting' ? 'Connecting' : 'Reconnecting'}
            </span>
            {health?.dataSource === 'demo' && <span className="rounded-sm bg-hold-dim px-1.5 py-0.5 text-[11px] font-semibold text-hold">Simulated</span>}
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
        <TickerTape quotes={indexQuotes} onPick={setSymbol} />
        {health?.model.state === 'training' && (
          <div role="status" className="flex items-center gap-3 border-t border-why/30 bg-why-dim px-3 py-1 text-xs text-why">
            Training the model on live data: {health.model.message}
            <span className="h-1 w-28 rounded-full bg-why/20"><span className="block h-full rounded-full bg-why transition-all" style={{ width: `${health.model.progress * 100}%` }} /></span>
          </div>
        )}
        {watch.error && <div role="alert" className="border-t border-down/30 bg-down-dim px-3 py-1 text-xs text-down">{watch.error}</div>}
      </div>

      {/* ── body ── */}
      <div className="grid gap-1.5 p-1.5 lg:grid-cols-[15.5rem_minmax(0,1fr)]">
        <aside className="order-last overflow-hidden rounded-sm border border-line bg-panel lg:order-none lg:sticky lg:top-[84px] lg:h-[calc(100vh-90px)]">
          <Watchlist symbols={watch.symbols} quotes={quotes} active={symbol} onSelect={setSymbol} onRemove={watch.remove} />
        </aside>

        <main className="min-w-0 space-y-1.5">
          {/* 1 overview */}
          <div id="overview" className="grid scroll-mt-28 gap-1.5 2xl:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_20rem]">
            <section className="overflow-hidden rounded-sm border border-line bg-panel" aria-label="Price">
              <QuoteHeader q={q} symbol={symbol} inList={inList} onToggleList={() => (inList ? watch.remove(symbol) : watch.add(symbol))} />
              <div className="h-[440px] border-t border-line 2xl:h-[500px]"><PriceChart symbol={symbol} quote={q} /></div>
            </section>
            <Panel fkey="1" title="Prediction result" meta={a && <span className="num">as of {a.asOf}</span>}>
              {body(() => <PredictionResult a={a!} />, 8)}
            </Panel>
          </div>

          {/* 2 agents */}
          <Panel id="agents" fkey="2" title="Multi-agent analysis" meta={a && <span>{a.fusion.agreement} directional agents agree</span>}>
            {body(() => <AgentGrid agents={a!.agents} />, 6)}
          </Panel>
          <Panel title="Agent fusion" meta={<span>majority vote and weighted score</span>}>
            {body(() => <Fusion a={a!} />, 3)}
          </Panel>

          {/* 3 explain */}
          <Panel id="explain" fkey="3" title="Why did the model make this prediction?" meta={<span className="text-why">SHAP</span>}>
            {body(() => <Explain a={a!} />, 8)}
          </Panel>

          {/* 4 model */}
          <div id="model" className="grid scroll-mt-28 gap-1.5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <Panel fkey="4" title="Feature importance" meta={<span>all stocks</span>}>
              {body(() => <FeatureImportance items={a!.featureImportance} />, 8)}
            </Panel>
            <Panel title="Backtest" meta={<span>walk-forward, out of sample</span>}>
              {body(() => (a!.prediction ? <TrackRecord a={a!} /> : <Empty>Backtest results appear once the model finishes training.</Empty>), 6)}
            </Panel>
          </div>

          {/* 5 data */}
          <Panel id="data" fkey="5" title="Recent stock data" meta={<span>daily, newest first</span>}>
            {body(() => <RecentData rows={a!.recent} />, 6)}
          </Panel>

          {/* 6 news */}
          <Panel id="news" fkey="6" title="Latest headlines">
            <News symbol={symbol} />
          </Panel>

          <p className="px-1 py-3 text-[11px] leading-relaxed text-fg-3">
            Educational project. Predictions are uncertain and are not financial advice. Quotes from Yahoo Finance; some exchanges are delayed up to 15 minutes. Press 1–6 to jump between sections.
          </p>
        </main>
      </div>
    </>
  )
}

function ThemeToggle() {
  const { theme, toggle } = useTheme()
  return (
    <button onClick={toggle} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
      className="grid h-8 w-8 place-items-center rounded-sm border border-line-2 text-fg-2 hover:border-brand hover:text-brand">
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  )
}

/** Exchange clocks with open/closed status (status comes from the index quotes). */
function Clocks({ quotes }: { quotes: Record<string, Quote> }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15_000)
    return () => clearInterval(t)
  }, [])
  const clock = (label: string, tz: string, q?: Quote) => {
    const open = q?.marketState === 'OPEN'
    const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: tz })
    return (
      <span className="flex items-center gap-1.5 text-xs" title={`${label} ${open ? 'open' : 'closed'}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${open ? 'bg-up' : 'bg-fg-3'}`} aria-hidden />
        <span className="font-semibold text-fg-2">{label}</span>
        <span className="num text-fg">{time}</span>
        <span className={open ? 'text-up' : 'text-fg-3'}>{q ? (open ? 'Open' : 'Closed') : ''}</span>
      </span>
    )
  }
  return (
    <span className="hidden items-center gap-4 lg:flex">
      {clock('NSE', 'Asia/Kolkata', quotes['^NSEI'])}
      {clock('NYSE', 'America/New_York', quotes['^GSPC'])}
    </span>
  )
}

/** Which section is in view, for the top-bar highlight. */
function useActiveSection() {
  const [active, setActive] = useState<string>('overview')
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((x, y) => x.boundingClientRect.top - y.boundingClientRect.top)
        if (vis[0]) setActive(vis[0].target.id)
      },
      { rootMargin: '-90px 0px -55% 0px' },
    )
    const t = setTimeout(() => SECTIONS.forEach((s) => { const el = document.getElementById(s.id); if (el) obs.observe(el) }), 300)
    return () => { clearTimeout(t); obs.disconnect() }
  }, [])
  return active
}
