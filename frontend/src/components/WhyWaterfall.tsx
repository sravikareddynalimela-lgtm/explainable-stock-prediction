import type { Analysis } from '../lib/api'

/**
 * SHAP waterfall in probability space: starts at the model's base rate and
 * walks feature by feature to the final P(up).
 */
export function WhyWaterfall({ a }: { a: Analysis }) {
  const exp = a.explanation
  if (!exp) return null
  const steps = exp.contributions
  const path: number[] = [exp.baseProbability]
  for (const s of steps) path.push(path[path.length - 1] + s.impact)
  const final = exp.pUp
  const lo = Math.min(...path, 0.5, final)
  const hi = Math.max(...path, 0.5, final)
  const pad = Math.max((hi - lo) * 0.12, 0.002)
  const d0 = lo - pad
  const d1 = hi + pad
  const x = (p: number) => ((p - d0) / (d1 - d0)) * 100
  const fmt = (p: number) => `${(p * 100).toFixed(1)}%`

  return (
    <section aria-label="SHAP waterfall" className="p-4">
      <div className="grid grid-cols-[minmax(8rem,13rem)_1fr_4.5rem] items-center gap-x-4 gap-y-1.5 text-sm">
        <Row label="Typical day" sub="base rate" x0={x(d0)} x1={x(exp.baseProbability)} kind="base" value={fmt(exp.baseProbability)} mid={x(0.5)} delay={0} />
        {steps.map((s, i) => {
          const a0 = path[i]
          const a1 = path[i + 1]
          return (
            <Row
              key={s.feature}
              label={s.label}
              sub={s.display}
              x0={x(Math.min(a0, a1))}
              x1={x(Math.max(a0, a1))}
              kind={s.direction}
              value={`${s.impact >= 0 ? '+' : '−'}${Math.abs(s.impact * 100).toFixed(2)}`}
              mid={x(0.5)}
              delay={(i + 1) * 60}
            />
          )
        })}
        <Row label="Prediction" sub="P(next close higher)" x0={x(d0)} x1={x(final)} kind="final" value={fmt(final)} mid={x(0.5)} delay={(steps.length + 1) * 60} />
      </div>
      <div className="mt-2 grid grid-cols-[minmax(8rem,13rem)_1fr_4.5rem] gap-x-4 text-xs text-fg-3">
        <span />
        <div className="relative h-4">
          <span className="num absolute -translate-x-1/2" style={{ left: `${x(0.5)}%` }}>50%</span>
          {x(0.5) > 14 && <span className="num absolute left-0">{fmt(d0)}</span>}
          {x(0.5) < 86 && <span className="num absolute right-0">{fmt(d1)}</span>}
        </div>
        <span className="text-right">pts</span>
      </div>
      <p className="mt-4 text-xs text-fg-3">
        SHAP values come from LightGBM's exact TreeSHAP. They describe how the model reasons, not what causes prices to move.
      </p>
    </section>
  )
}

function Row({ label, sub, x0, x1, kind, value, mid, delay }: {
  label: string; sub: string; x0: number; x1: number; kind: 'up' | 'down' | 'base' | 'final'; value: string; mid: number; delay: number
}) {
  const color = { up: 'bg-up', down: 'bg-down', base: 'bg-fg-3/40', final: 'bg-why' }[kind]
  const strong = kind === 'final' || kind === 'base'
  return (
    <>
      <div className="min-w-0 py-1">
        <div className={`truncate ${strong ? 'font-semibold' : 'font-medium'}`}>{label}</div>
        {sub && <div className="num truncate text-xs text-fg-3">{sub}</div>}
      </div>
      <div className="relative h-7">
        <div className="absolute inset-y-0 w-px bg-line" style={{ left: `${mid}%` }} />
        <div
          className={`bar-grow absolute top-1/2 h-4 -translate-y-1/2 rounded-[3px] ${color}`}
          style={{ left: `${x0}%`, width: `${Math.max(x1 - x0, 0.6)}%`, animationDelay: `${delay}ms` }}
        />
      </div>
      <div className={`num text-right ${strong ? 'font-semibold' : ''} ${kind === 'up' ? 'text-up' : kind === 'down' ? 'text-down' : kind === 'final' ? 'text-why' : 'text-fg-2'}`}>
        {value}
      </div>
    </>
  )
}
