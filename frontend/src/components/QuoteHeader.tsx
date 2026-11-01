import { useEffect, useRef, useState } from 'react'
import type { Quote } from '../lib/api'
import { compact, money, signed, tone } from '../lib/format'

const STATE: Record<string, string> = { OPEN: 'Market open', CLOSED: 'Market closed', PRE: 'Pre-market', POST: 'After hours', UNKNOWN: '' }

export function QuoteHeader({ q, symbol }: { q?: Quote; symbol: string }) {
  const prev = useRef<number | null>(null)
  const [flash, setFlash] = useState<{ cls: string; n: number }>({ cls: '', n: 0 })

  useEffect(() => {
    if (!q) return
    if (prev.current != null && q.price !== prev.current) {
      setFlash((f) => ({ cls: q.price > prev.current! ? 'tick-up' : 'tick-down', n: f.n + 1 }))
    }
    prev.current = q.price
  }, [q])

  useEffect(() => {
    prev.current = null
  }, [symbol])

  if (!q) {
    return (
      <div className="space-y-3">
        <div className="h-6 w-48 animate-pulse rounded bg-grid" />
        <div className="h-12 w-64 animate-pulse rounded bg-grid" />
      </div>
    )
  }

  const rangePos = q.dayHigh > q.dayLow ? ((q.price - q.dayLow) / (q.dayHigh - q.dayLow)) * 100 : 50

  return (
    <header className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
      <div>
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h1 className="text-2xl font-semibold tracking-tight">{q.name}</h1>
          <span className="text-ink-2">{q.symbol}{q.exchange ? `, ${q.exchange}` : ''}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-4">
          <span key={flash.n} className={`num -mx-1.5 rounded-md px-1.5 text-5xl font-bold tracking-tight ${flash.cls}`}>{money(q.price, q.currency)}</span>
          <span className={`num text-xl font-semibold ${tone(q.change)}`}>
            {signed(q.change)} ({signed(q.changePct)}%)
          </span>
        </div>
        <p className="mt-1 flex items-center gap-2 text-sm text-ink-2">
          {q.marketState === 'OPEN' && <span className="live-dot h-2 w-2 rounded-full bg-up" aria-hidden />}
          <span>
            {STATE[q.marketState]}
            {q.marketState !== 'OPEN' && q.marketState !== 'UNKNOWN' && ', showing last price'}
            {STATE[q.marketState] ? ', ' : ''}
            <span className="text-ink-3">updated {new Date(q.time * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
          </span>
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:grid-cols-4">
        <div className="col-span-2 sm:col-span-2">
          <dt className="text-ink-2">Day range</dt>
          <dd className="num mt-1 flex items-center gap-2">
            <span>{money(q.dayLow, q.currency)}</span>
            <span className="relative h-1.5 w-28 rounded-full bg-grid">
              <span className="absolute top-1/2 h-3 w-1 -translate-y-1/2 rounded-full bg-ink" style={{ left: `calc(${rangePos}% - 2px)` }} />
            </span>
            <span>{money(q.dayHigh, q.currency)}</span>
          </dd>
        </div>
        <Stat label="Prev close" value={money(q.previousClose, q.currency)} />
        <Stat label="Volume" value={compact(q.volume)} />
        <Stat label="Open" value={money(q.open, q.currency)} />
        <Stat label="52-wk low" value={money(q.fiftyTwoWeekLow, q.currency)} />
        <Stat label="52-wk high" value={money(q.fiftyTwoWeekHigh, q.currency)} />
      </dl>
    </header>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-ink-2">{label}</dt>
      <dd className="num mt-0.5 font-semibold">{value}</dd>
    </div>
  )
}
