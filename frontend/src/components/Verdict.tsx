import type { Analysis } from '../lib/api'

const STYLE = {
  BUY: { text: 'text-up', bg: 'bg-up', dim: 'bg-up-dim', line: 'Agents lean bullish for the next session.' },
  SELL: { text: 'text-down', bg: 'bg-down', dim: 'bg-down-dim', line: 'Agents lean bearish for the next session.' },
  HOLD: { text: 'text-hold', bg: 'bg-hold', dim: 'bg-hold-dim', line: 'Agents disagree, or the edge is too small to act on.' },
}

export function Verdict({ a }: { a: Analysis }) {
  const f = a.fusion
  const s = STYLE[f.signal]
  const p = a.prediction
  const pos = ((Math.max(-1, Math.min(1, f.score)) + 1) / 2) * 100
  return (
    <section aria-labelledby="signal-h">
      <h2 id="signal-h" className="flex items-center justify-between border-b border-line px-4 py-2 text-sm font-semibold">
        Signal <span className="text-xs font-normal text-fg-3">next session</span>
      </h2>
      <div className={`px-4 py-5 ${s.dim}`}>
        <div className="flex items-end justify-between gap-3">
          <p className={`text-5xl font-bold leading-none tracking-tight ${s.text}`}>{f.signal}</p>
          {p && (
            <div className="text-right">
              <div className="text-xs text-fg-3">Model P(up)</div>
              <div className={`num text-2xl ${p.pUp >= 0.5 ? 'text-up' : 'text-down'}`}>{(p.pUp * 100).toFixed(1)}%</div>
            </div>
          )}
        </div>
        <p className="mt-3 text-sm text-fg-2">{s.line}</p>
        <div className="mt-5">
          <div className="relative h-1.5 rounded-full bg-gradient-to-r from-down via-hold to-up opacity-80">
            <span className="absolute inset-y-0 left-[40%] right-[40%] bg-void/40" aria-hidden />
            <span className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-void bg-fg" style={{ left: `${pos}%` }} />
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] font-semibold text-fg-3"><span>SELL</span><span>HOLD</span><span>BUY</span></div>
        </div>
      </div>
      <dl className="grid grid-cols-3 border-y border-line text-center">
        <Cell k="Fused score" v={`${f.score >= 0 ? '+' : '−'}${Math.abs(f.score).toFixed(2)}`} />
        <Cell k="Agreeing" v={f.agreement} border />
        <Cell k="Conviction" v={p?.highConviction ? 'High' : 'Normal'} />
      </dl>
      <p className="px-4 py-3 text-xs leading-relaxed text-fg-3">{f.explanation}</p>
    </section>
  )
}

function Cell({ k, v, border }: { k: string; v: string; border?: boolean }) {
  return (
    <div className={`px-2 py-2.5 ${border ? 'border-x border-line' : ''}`}>
      <dt className="text-[11px] text-fg-3">{k}</dt>
      <dd className="num mt-0.5 text-sm text-fg">{v}</dd>
    </div>
  )
}
