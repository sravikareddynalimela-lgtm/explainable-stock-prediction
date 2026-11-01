import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Quote } from '../lib/api'
import { shortName } from './TickerTape'

type Sort = 'mine' | 'gainers' | 'losers'

export function Watchlist({ symbols, quotes, active, onSelect, onRemove }: {
  symbols: string[]; quotes: Record<string, Quote>; active: string; onSelect: (s: string) => void; onRemove: (s: string) => void
}) {
  const [sort, setSort] = useState<Sort>('mine')
  const sorted = [...symbols]
  if (sort !== 'mine') {
    const pct = (s: string) => quotes[s]?.changePct ?? 0
    sorted.sort((a, b) => (sort === 'gainers' ? pct(b) - pct(a) : pct(a) - pct(b)))
  }
  return (
    <nav aria-label="Watchlist" className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <h2 className="text-sm font-semibold">Watchlist <span className="num ml-1 text-xs text-fg-3">{symbols.length}</span></h2>
        <div className="flex gap-0.5 text-[11px] font-semibold" role="group" aria-label="Sort watchlist">
          {(['mine', 'gainers', 'losers'] as Sort[]).map((s) => (
            <button key={s} onClick={() => setSort(s)} aria-pressed={sort === s}
              className={`rounded px-1.5 py-0.5 ${sort === s ? 'bg-raised text-fg' : 'text-fg-3 hover:text-fg'}`}>
              {s === 'mine' ? 'Mine' : s === 'gainers' ? 'Gainers' : 'Losers'}
            </button>
          ))}
        </div>
      </div>
      <ul className="flex-1 overflow-y-auto">
        {sorted.map((s) => <Row key={s} s={s} q={quotes[s]} on={s === active} onSelect={onSelect} onRemove={onRemove} />)}
        {symbols.length === 0 && <li className="px-3 py-6 text-sm text-fg-2">Your watchlist is empty. Search for a stock and add it.</li>}
      </ul>
    </nav>
  )
}

function Row({ s, q, on, onSelect, onRemove }: { s: string; q?: Quote; on: boolean; onSelect: (s: string) => void; onRemove: (s: string) => void }) {
  const prev = useRef<number | undefined>(undefined)
  const [flash, setFlash] = useState({ cls: '', n: 0 })
  useEffect(() => {
    if (q && prev.current !== undefined && q.price !== prev.current) {
      setFlash((f) => ({ cls: q.price > prev.current! ? 'flash-up' : 'flash-down', n: f.n + 1 }))
    }
    prev.current = q?.price
  }, [q])
  const upDay = (q?.changePct ?? 0) >= 0
  return (
    <li className="group relative border-b border-line/60">
      <button onClick={() => onSelect(s)} aria-current={on ? 'true' : undefined}
        className={`grid w-full grid-cols-[1fr_auto] items-center gap-x-3 px-3 py-2 text-left transition-colors ${on ? 'bg-raised shadow-[inset_2px_0_0_var(--color-brand)]' : 'hover:bg-raised/60'}`}>
        <span className="truncate text-sm font-semibold">{shortName(s)}</span>
        <span key={flash.n} className={`num rounded px-1 text-right text-sm ${flash.cls}`}>
          {q ? q.price.toLocaleString(q.currency === 'INR' ? 'en-IN' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '···'}
        </span>
        <span className="truncate text-[11px] text-fg-3">{q?.name ?? (s.endsWith('.NS') ? 'NSE' : '')}</span>
        <span className={`num justify-self-end rounded px-1 text-[11px] ${q ? (upDay ? 'bg-up-dim text-up' : 'bg-down-dim text-down') : ''}`}>
          {q ? `${upDay ? '+' : '−'}${Math.abs(q.changePct).toFixed(2)}%` : ''}
        </span>
      </button>
      <button onClick={() => onRemove(s)} aria-label={`Remove ${s} from watchlist`}
        className="absolute right-1 top-1 hidden rounded bg-raised p-0.5 text-fg-3 ring-1 ring-line-2 hover:text-down group-hover:block focus-visible:block">
        <X className="h-3 w-3" />
      </button>
    </li>
  )
}
