import { Star } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Quote } from '../lib/api'
import { compact, money } from '../lib/format'

const STATE: Record<string, { label: string; cls: string }> = {
  OPEN: { label: 'Market open', cls: 'text-up' },
  PRE: { label: 'Pre-market', cls: 'text-hold' },
  POST: { label: 'After hours', cls: 'text-hold' },
  CLOSED: { label: 'Market closed', cls: 'text-fg-3' },
  UNKNOWN: { label: '', cls: 'text-fg-3' },
}

/** Symbol, live price and the original "Latest Stock Information" in one strip. */
export function QuoteHeader({ q, symbol, inList, onToggleList }: { q?: Quote; symbol: string; inList: boolean; onToggleList: () => void }) {
  const prev = useRef<number | null>(null)
  const [flash, setFlash] = useState({ cls: '', n: 0 })
  useEffect(() => {
    if (!q) return
    if (prev.current != null && q.price !== prev.current) setFlash((f) => ({ cls: q.price > prev.current! ? 'flash-up' : 'flash-down', n: f.n + 1 }))
    prev.current = q.price
  }, [q])
  useEffect(() => { prev.current = null }, [symbol])

  const up = (q?.change ?? 0) >= 0
  const st = STATE[q?.marketState ?? 'UNKNOWN'] ?? STATE.UNKNOWN
  const cur = q?.currency

  return (
    <div className="flex flex-wrap items-end gap-x-8 gap-y-3 px-3 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="num text-base font-bold">{symbol}</h1>
          <span className="max-w-[16rem] truncate text-sm text-fg-2">{q?.name ?? ''}</span>
          {q?.exchange && <span className="rounded-sm border border-line-2 px-1 text-[10px] font-semibold text-fg-3">{q.exchange}</span>}
          <button onClick={onToggleList} aria-pressed={inList} aria-label={inList ? 'Remove from watchlist' : 'Add to watchlist'}
            className={`rounded-sm p-0.5 ${inList ? 'text-brand' : 'text-fg-3 hover:text-fg'}`}>
            <Star className="h-4 w-4" fill={inList ? 'currentColor' : 'none'} />
          </button>
        </div>
        {q ? (
          <div className="mt-0.5 flex flex-wrap items-baseline gap-x-3">
            <span key={flash.n} className={`num -mx-1 rounded-sm px-1 text-[34px] font-semibold leading-tight ${flash.cls}`}>{money(q.price, cur)}</span>
            <span className={`num text-base ${up ? 'text-up' : 'text-down'}`}>
              {up ? '▲' : '▼'} {Math.abs(q.change).toFixed(2)} ({up ? '+' : '−'}{Math.abs(q.changePct).toFixed(2)}%)
            </span>
            <span className={`flex items-center gap-1.5 text-xs ${st.cls}`}>
              {q.marketState === 'OPEN' && <span className="live-dot h-1.5 w-1.5 rounded-full bg-up" aria-hidden />}
              {st.label}
              <span className="num text-fg-3">{new Date(q.time * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            </span>
          </div>
        ) : (
          <div className="mt-1 h-10 w-64 animate-pulse rounded-sm bg-raised" />
        )}
      </div>

      {q && (
        <dl className="ml-auto grid grid-cols-3 gap-x-6 gap-y-1 text-xs sm:grid-cols-6">
          <Stat k="Open" v={money(q.open, cur)} />
          <Stat k="Day high" v={money(q.dayHigh, cur)} cls="text-up" />
          <Stat k="Day low" v={money(q.dayLow, cur)} cls="text-down" />
          <Stat k="Prev close" v={money(q.previousClose, cur)} />
          <Stat k="Volume" v={compact(q.volume)} />
          <Stat k="52-wk range" v={`${compact(q.fiftyTwoWeekLow)}–${compact(q.fiftyTwoWeekHigh)}`} />
        </dl>
      )}
    </div>
  )
}

function Stat({ k, v, cls = '' }: { k: string; v: string; cls?: string }) {
  return (
    <div>
      <dt className="text-fg-3">{k}</dt>
      <dd className={`num text-[13px] text-fg ${cls}`}>{v}</dd>
    </div>
  )
}
