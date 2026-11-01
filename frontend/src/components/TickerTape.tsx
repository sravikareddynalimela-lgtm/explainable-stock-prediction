import type { Quote } from '../lib/api'

export const INDEX_NAMES: Record<string, string> = {
  '^NSEI': 'NIFTY 50', '^BSESN': 'SENSEX', '^NSEBANK': 'BANK NIFTY', '^GSPC': 'S&P 500', '^IXIC': 'NASDAQ',
  '^DJI': 'DOW', 'INR=X': 'USD/INR', 'GC=F': 'GOLD', 'CL=F': 'CRUDE', 'BTC-USD': 'BITCOIN',
}
export const INDEX_SYMBOLS = Object.keys(INDEX_NAMES)

export const shortName = (s: string) => INDEX_NAMES[s] ?? s.replace(/\.(NS|BO)$/, '')

export function TickerTape({ quotes, onPick }: { quotes: Quote[]; onPick?: (s: string) => void }) {
  if (!quotes.length) return <div className="h-9 border-b border-line bg-panel" />
  // content is duplicated so the loop is seamless
  const row = (dup: boolean) =>
    quotes.map((q) => (
      <button
        key={`${q.symbol}${dup ? '-d' : ''}`}
        tabIndex={dup || !onPick ? -1 : 0}
        aria-hidden={dup || undefined}
        onClick={() => onPick?.(q.symbol)}
        className="flex items-baseline gap-2 px-5 text-[13px] hover:bg-raised"
      >
        <span className="font-semibold text-fg-2">{shortName(q.symbol)}</span>
        <span className="num text-fg">{q.price.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}</span>
        <span className={`num ${q.changePct >= 0 ? 'text-up' : 'text-down'}`}>
          {q.changePct >= 0 ? '▲' : '▼'} {Math.abs(q.changePct).toFixed(2)}%
        </span>
      </button>
    ))
  return (
    <div className="overflow-hidden border-b border-line bg-panel" aria-label="Market ticker">
      <div className="tape flex h-9 items-center divide-x divide-line">
        {row(false)}
        {row(true)}
      </div>
    </div>
  )
}
