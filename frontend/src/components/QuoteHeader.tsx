import { Star } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Analysis, Quote } from '../lib/api'
import { compact, money } from '../lib/format'

const STATE: Record<string, { label: string; cls: string }> = {
  OPEN: { label: 'Market open', cls: 'text-up' },
  PRE: { label: 'Pre-market', cls: 'text-hold' },
  POST: { label: 'After hours', cls: 'text-hold' },
  CLOSED: { label: 'Market closed', cls: 'text-fg-3' },
  UNKNOWN: { label: '', cls: '' },
}

export function QuoteHeader({ q, symbol, inList, onToggleList }: { q?: Quote; symbol: string; inList: boolean; onToggleList: () => void }) {
  const prev = useRef<number | null>(null)
  const [flash, setFlash] = useState({ cls: '', n: 0 })
  useEffect(() => {
    if (!q) return
    if (prev.current != null && q.price !== prev.current) setFlash((f) => ({ cls: q.price > prev.current! ? 'flash-up' : 'flash-down', n: f.n + 1 }))
    prev.current = q.price
  }, [q])
  useEffect(() => { prev.current = null }, [symbol])

  if (!q) return <div className="h-[76px] animate-pulse px-4 py-3"><div className="h-full w-72 rounded bg-raised" /></div>
  const up = q.change >= 0
  const st = STATE[q.marketState] ?? STATE.UNKNOWN

  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 px-4 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="num text-lg font-bold">{symbol}</h1>
          <span className="truncate text-sm text-fg-2">{q.name}</span>
          <span className="rounded border border-line-2 px-1.5 text-[10px] font-semibold text-fg-3">{q.exchange || '—'}</span>
          <button onClick={onToggleList} aria-pressed={inList} aria-label={inList ? 'Remove from watchlist' : 'Add to watchlist'}
            className={`rounded p-1 transition-colors ${inList ? 'text-hold' : 'text-fg-3 hover:text-fg'}`}>
            <Star className="h-4 w-4" fill={inList ? 'currentColor' : 'none'} />
          </button>
        </div>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-3">
          <span key={flash.n} className={`num -mx-1 rounded px-1 text-4xl font-semibold ${flash.cls}`}>{money(q.price, q.currency)}</span>
          <span className={`num text-lg ${up ? 'text-up' : 'text-down'}`}>
            {up ? '▲' : '▼'} {Math.abs(q.change).toFixed(2)} ({up ? '+' : '−'}{Math.abs(q.changePct).toFixed(2)}%)
          </span>
        </div>
      </div>
      <p className={`flex items-center gap-1.5 text-xs ${st.cls}`}>
        {q.marketState === 'OPEN' && <span className="live-dot h-1.5 w-1.5 rounded-full bg-up" aria-hidden />}
        {st.label}
        <span className="num text-fg-3">{st.label ? ' ' : ''}{new Date(q.time * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
      </p>
    </header>
  )
}

export function KeyStats({ q, a }: { q?: Quote; a?: Analysis }) {
  if (!q) return null
  const pos = q.dayHigh > q.dayLow ? ((q.price - q.dayLow) / (q.dayHigh - q.dayLow)) * 100 : 50
  const lo52 = q.fiftyTwoWeekLow ?? q.dayLow
  const hi52 = q.fiftyTwoWeekHigh ?? q.dayHigh
  const pos52 = hi52 > lo52 ? ((q.price - lo52) / (hi52 - lo52)) * 100 : 50
  const ind = a?.indicators
  const rows: [string, string][] = [
    ['Open', money(q.open, q.currency)],
    ['Prev close', money(q.previousClose, q.currency)],
    ['Volume', compact(q.volume)],
    ['RSI 14', ind?.rsi != null ? ind.rsi.toFixed(1) : '–'],
    ['SMA 20', ind?.sma20 != null ? money(ind.sma20, q.currency) : '–'],
    ['SMA 50', ind?.sma50 != null ? money(ind.sma50, q.currency) : '–'],
    ['SMA 200', ind?.sma200 != null ? money(ind.sma200, q.currency) : '–'],
    ['ATR 14', ind?.atr != null ? money(ind.atr, q.currency) : '–'],
  ]
  return (
    <section aria-labelledby="stats-h">
      <h2 id="stats-h" className="border-b border-line px-4 py-2 text-sm font-semibold">Key stats</h2>
      <div className="space-y-4 px-4 py-4">
        <RangeBar label="Day range" lo={money(q.dayLow, q.currency)} hi={money(q.dayHigh, q.currency)} pos={pos} />
        <RangeBar label="52-week range" lo={money(lo52, q.currency)} hi={money(hi52, q.currency)} pos={pos52} />
      </div>
      <dl className="grid grid-cols-2 border-t border-line">
        {rows.map(([k, v], i) => (
          <div key={k} className={`flex items-baseline justify-between px-4 py-2 text-sm ${i % 2 === 0 ? 'border-r border-line' : ''} border-b border-line/60`}>
            <dt className="text-fg-3">{k}</dt>
            <dd className="num text-fg">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function RangeBar({ label, lo, hi, pos }: { label: string; lo: string; hi: string; pos: number }) {
  return (
    <div>
      <div className="text-xs text-fg-3">{label}</div>
      <div className="relative mt-2 h-1 rounded-full bg-gradient-to-r from-down/60 via-line-2 to-up/60">
        <span className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 bg-fg" style={{ left: `calc(${Math.max(0, Math.min(100, pos))}% - 1px)` }} />
      </div>
      <div className="num mt-1.5 flex justify-between text-xs text-fg-2"><span>{lo}</span><span>{hi}</span></div>
    </div>
  )
}
