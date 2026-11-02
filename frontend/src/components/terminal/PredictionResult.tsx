import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import type { Analysis } from '../../lib/api'

const SIGNAL = {
  BUY: { text: 'text-up', bg: 'bg-up', dim: 'bg-up-dim', ring: 'ring-up/40' },
  SELL: { text: 'text-down', bg: 'bg-down', dim: 'bg-down-dim', ring: 'ring-down/40' },
  HOLD: { text: 'text-hold', bg: 'bg-hold', dim: 'bg-hold-dim', ring: 'ring-hold/40' },
}

/** The original app's "Prediction Result" + "Recommendation", in one panel. */
export function PredictionResult({ a }: { a: Analysis }) {
  const p = a.prediction
  const f = a.fusion
  const s = SIGNAL[f.signal]

  return (
    <div className="divide-y divide-line">
      {/* model prediction */}
      <div className="px-4 py-4">
        <div className="text-xs text-fg-3">Prediction for the next session</div>
        {p ? (
          <>
            <div className={`mt-1 flex items-center gap-2 text-3xl font-bold tracking-tight ${p.direction === 'UP' ? 'text-up' : 'text-down'}`}>
              {p.direction === 'UP' ? <ArrowUpRight className="h-8 w-8" aria-hidden /> : <ArrowDownRight className="h-8 w-8" aria-hidden />}
              {p.direction}
            </div>
            <div className="mt-4 flex items-baseline justify-between text-sm">
              <span className="text-fg-2">Model confidence</span>
              <span className="num text-lg font-semibold">{(p.confidence * 100).toFixed(2)}%</span>
            </div>
            <ConfidenceBar pUp={p.pUp} />
            <p className="mt-2 text-xs text-fg-3">
              {p.highConviction ? 'Among the model’s most confident 20% of calls. ' : ''}
              Confidence is not a guarantee of accuracy.
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm text-fg-2">The ML model is still training. Agents below are already live.</p>
        )}
      </div>

      {/* recommendation */}
      <div className={`px-4 py-4 ${s.dim}`}>
        <div className="flex items-center justify-between">
          <span className="text-xs text-fg-3">Recommendation</span>
          <span className="num text-xs text-fg-3">score {f.score >= 0 ? '+' : '−'}{Math.abs(f.score).toFixed(2)}</span>
        </div>
        <div className="mt-1 flex items-center gap-3">
          <span className={`text-4xl font-bold tracking-tight ${s.text}`}>{f.signal}</span>
          <span className={`h-2.5 w-2.5 rounded-full ${s.bg}`} aria-hidden />
        </div>
        <p className="mt-2 text-sm leading-snug text-fg">{f.reason}</p>
        <p className="mt-2 text-[11px] text-fg-3">Educational rule-based recommendation, not a validated trading signal.</p>
      </div>

      {/* compact vote summary; full breakdown is in the Agents section */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between text-xs text-fg-3">
          <span>Agent votes</span>
          <a href="#agents" className="text-brand hover:underline">Details</a>
        </div>
        <ul className="mt-2 space-y-1 text-sm">
          {f.votes.map((v) => (
            <li key={v.agent} className="flex items-center justify-between">
              <span className="text-fg-2">{v.agent}</span>
              <span className="flex items-center gap-1 text-xs font-semibold">{v.vote}<VoteIcon vote={v.vote} /></span>
            </li>
          ))}
          <li className="flex items-center justify-between border-t border-line pt-1.5">
            <span className="text-fg-2">Volatility risk</span>
            <span className="text-xs font-semibold">{a.agents.find((x) => x.id === 'volatility')?.stance ?? '–'}</span>
          </li>
        </ul>
      </div>
    </div>
  )
}

/** Two-sided bar: P(down) on the left, P(up) on the right. */
function ConfidenceBar({ pUp }: { pUp: number }) {
  return (
    <div className="mt-2" aria-label={`P(up) ${(pUp * 100).toFixed(1)}%, P(down) ${((1 - pUp) * 100).toFixed(1)}%`}>
      <div className="flex h-2 overflow-hidden rounded-sm bg-raised">
        <div className="bg-down" style={{ width: `${(1 - pUp) * 100}%` }} />
        <div className="w-px bg-panel" />
        <div className="bg-up" style={{ width: `${pUp * 100}%` }} />
      </div>
      <div className="num mt-1 flex justify-between text-[11px]">
        <span className="text-down">DOWN {((1 - pUp) * 100).toFixed(1)}%</span>
        <span className="text-up">UP {(pUp * 100).toFixed(1)}%</span>
      </div>
    </div>
  )
}

export function VoteIcon({ vote }: { vote: 'UP' | 'DOWN' | 'HOLD' | null }) {
  if (vote === 'UP') return <ArrowUpRight className="h-4 w-4 text-up" aria-label="Up" />
  if (vote === 'DOWN') return <ArrowDownRight className="h-4 w-4 text-down" aria-label="Down" />
  return <Minus className="h-4 w-4 text-hold" aria-label="Hold" />
}
