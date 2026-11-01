import { X } from 'lucide-react'
import type { Quote } from '../lib/api'
import { money, signed } from '../lib/format'

export function Watchlist({ symbols, quotes, active, onSelect, onRemove }: {
  symbols: string[]
  quotes: Record<string, Quote>
  active: string
  onSelect: (s: string) => void
  onRemove: (s: string) => void
}) {
  return (
    <nav aria-label="Watchlist">
      <h2 className="px-3 text-sm font-medium text-ink-2">Watchlist</h2>
      <ul className="mt-2 space-y-0.5">
        {symbols.map((s) => {
          const q = quotes[s]
          const on = s === active
          return (
            <li key={s} className="group relative">
              <button
                onClick={() => onSelect(s)}
                aria-current={on ? 'true' : undefined}
                className={`grid w-full grid-cols-[1fr_auto] items-center gap-x-2 rounded-lg px-3 py-2 text-left transition-colors ${on ? 'bg-ink text-paper' : 'hover:bg-grid'}`}
              >
                <span className="truncate font-semibold">{s.replace('.NS', '')}</span>
                <span className="num text-right text-sm">{q ? money(q.price, q.currency) : '…'}</span>
                <span className={`truncate text-xs ${on ? 'text-paper/60' : 'text-ink-3'}`}>{q?.name ?? (s.endsWith('.NS') ? 'NSE' : '')}</span>
                <span className={`num text-right text-xs font-semibold ${q ? (q.changePct >= 0 ? (on ? 'text-[#7fe0c2]' : 'text-up') : on ? 'text-[#ffaaa2]' : 'text-down') : ''}`}>
                  {q ? `${signed(q.changePct)}%` : ''}
                </span>
              </button>
              <button
                onClick={() => onRemove(s)}
                aria-label={`Remove ${s} from watchlist`}
                className={`absolute -left-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-sheet p-0.5 text-ink-2 ring-1 ring-rule group-hover:block focus-visible:block`}
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
