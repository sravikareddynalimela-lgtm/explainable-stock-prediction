import { useState } from 'react'
import type { RecentRow } from '../../lib/api'
import { compact } from '../../lib/format'

/** The original app's "View Recent Stock Data", with the agents' indicators. */
export function RecentData({ rows }: { rows: RecentRow[] }) {
  const [all, setAll] = useState(false)
  const shown = all ? rows : rows.slice(0, 10)
  const n = (v: number | null, d = 2) => (v == null ? '–' : v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }))
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="num w-full min-w-[860px] text-xs">
          <thead className="bg-raised text-fg-3">
            <tr>
              {['Date', 'Open', 'High', 'Low', 'Close', 'Change', 'Volume', 'RSI 14', 'SMA 5', 'SMA 20', 'MACD', 'Volatility'].map((h, i) => (
                <th key={h} className={`px-3 py-2 font-medium ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const up = (r.change ?? 0) >= 0
              return (
                <tr key={r.date} className="border-b border-line/60 hover:bg-raised/50">
                  <td className="px-3 py-1.5 text-left text-fg-2">{r.date}</td>
                  <td className="px-3 py-1.5 text-right">{n(r.open)}</td>
                  <td className="px-3 py-1.5 text-right">{n(r.high)}</td>
                  <td className="px-3 py-1.5 text-right">{n(r.low)}</td>
                  <td className="px-3 py-1.5 text-right font-semibold">{n(r.close)}</td>
                  <td className={`px-3 py-1.5 text-right ${up ? 'text-up' : 'text-down'}`}>{r.change == null ? '–' : `${up ? '+' : '−'}${Math.abs(r.change * 100).toFixed(2)}%`}</td>
                  <td className="px-3 py-1.5 text-right text-fg-2">{compact(r.volume)}</td>
                  <td className={`px-3 py-1.5 text-right ${r.rsi != null && r.rsi >= 70 ? 'text-down' : r.rsi != null && r.rsi <= 30 ? 'text-up' : ''}`}>{n(r.rsi, 1)}</td>
                  <td className="px-3 py-1.5 text-right">{n(r.sma5)}</td>
                  <td className="px-3 py-1.5 text-right">{n(r.sma20)}</td>
                  <td className={`px-3 py-1.5 text-right ${r.macd >= 0 ? 'text-up' : 'text-down'}`}>{n(r.macd, 3)}</td>
                  <td className="px-3 py-1.5 text-right text-fg-2">{r.volatility == null ? '–' : `${(r.volatility * 100).toFixed(2)}%`}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {rows.length > 10 && (
        <button onClick={() => setAll((v) => !v)} className="w-full border-t border-line py-2 text-xs font-semibold text-brand hover:bg-raised">
          {all ? 'Show last 10 sessions' : `Show all ${rows.length} sessions`}
        </button>
      )}
    </div>
  )
}
