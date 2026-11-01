import type { Analysis } from '../lib/api'

const STYLE = {
  BUY: { text: 'text-up', soft: 'bg-up-soft', word: 'Buy', line: 'The agents lean bullish for the next session.' },
  SELL: { text: 'text-down', soft: 'bg-down-soft', word: 'Sell', line: 'The agents lean bearish for the next session.' },
  HOLD: { text: 'text-hold', soft: 'bg-hold-soft', word: 'Hold', line: 'The agents disagree or the edge is too small to act on.' },
}

export function Verdict({ a }: { a: Analysis }) {
  const f = a.fusion
  const s = STYLE[f.signal]
  const p = a.prediction
  // position of fused score on a −1..1 track
  const pos = ((Math.max(-1, Math.min(1, f.score)) + 1) / 2) * 100

  return (
    <section aria-labelledby="verdict-h" className={`flex flex-col rounded-2xl p-5 sm:p-6 ${s.soft}`}>
      <h2 id="verdict-h" className="text-sm font-medium text-ink-2">Signal for the next session</h2>
      <p className={`mt-1 text-6xl font-bold leading-none tracking-tight ${s.text}`}>{s.word}</p>
      <p className="mt-3 text-[15px] text-ink">{s.line}</p>

      <div className="mt-6">
        <div className="relative h-2 rounded-full bg-gradient-to-r from-down/70 via-hold/40 to-up/70">
          <div className="absolute inset-y-0 left-[40%] right-[40%] bg-sheet/50" />
          <div
            className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-sheet bg-ink shadow"
            style={{ left: `${pos}%` }}
            aria-label={`Fused score ${f.score.toFixed(2)}`}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-xs text-ink-2">
          <span>Sell</span>
          <span>Hold</span>
          <span>Buy</span>
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div>
          <dt className="text-ink-2">Model P(up)</dt>
          <dd className="num text-lg font-semibold">{p ? `${(p.pUp * 100).toFixed(1)}%` : '–'}</dd>
        </div>
        <div>
          <dt className="text-ink-2">Fused score</dt>
          <dd className="num text-lg font-semibold">{f.score >= 0 ? '+' : '−'}{Math.abs(f.score).toFixed(2)}</dd>
        </div>
        <div>
          <dt className="text-ink-2">Agents agreeing</dt>
          <dd className="num text-lg font-semibold">{f.agreement}</dd>
        </div>
        <div>
          <dt className="text-ink-2">Conviction</dt>
          <dd className="text-lg font-semibold">{p?.highConviction ? 'High' : 'Normal'}</dd>
        </div>
      </dl>
      <p className="mt-auto pt-5 text-xs leading-relaxed text-ink-2">{f.explanation}</p>
    </section>
  )
}
