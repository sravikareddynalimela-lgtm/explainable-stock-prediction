import { useState } from 'react'
import type { Analysis } from '../../lib/api'
import { WhyWaterfall } from '../WhyWaterfall'

type View = 'bars' | 'waterfall' | 'table'

/** "Why did the model make this prediction?" + top 3 features + SHAP contributions. */
export function Explain({ a }: { a: Analysis }) {
  const [view, setView] = useState<View>('bars')
  const exp = a.explanation
  if (!exp || !a.prediction) return <p className="px-4 py-6 text-sm text-fg-2">Explanations appear once the ML model finishes training.</p>

  const dir = a.prediction.direction
  // SHAP values are for P(up). For a DOWN call, flip sign so "supports" means supports the prediction.
  const sign = dir === 'UP' ? 1 : -1
  const all = exp.all
  const top3 = all.slice(0, 3)
  const strongest = all[0]
  const supports = strongest.shap * sign > 0
  const pro = all.filter((f) => f.shap * sign > 0).length

  return (
    <div className="grid gap-px bg-line xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      {/* narrative + top 3 */}
      <div className="bg-panel p-4">
        <h3 className="text-base font-semibold">Why did the model predict <span className={dir === 'UP' ? 'text-up' : 'text-down'}>{dir}</span>?</h3>
        <p className="mt-2 text-sm leading-relaxed text-fg-2">
          The model starts from a {(exp.baseProbability * 100).toFixed(1)}% base chance of an up day and ends at{' '}
          <b className="num text-fg">{(exp.pUp * 100).toFixed(1)}%</b>.{' '}
          <b className="text-fg">{strongest.label}</b> ({strongest.display}) has the largest effect and{' '}
          <b className={supports ? 'text-up' : 'text-down'}>{supports ? 'supports' : 'opposes'}</b> the {dir} prediction.{' '}
          {pro} of {all.length} features point the same way as the prediction.
        </p>

        <h4 className="mt-5 text-xs font-semibold text-fg-3">Top 3 influential features</h4>
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-fg-3">
              <th className="py-1.5 font-medium">Feature</th>
              <th className="py-1.5 text-right font-medium">Value</th>
              <th className="py-1.5 text-right font-medium">SHAP</th>
              <th className="py-1.5 text-right font-medium">Effect</th>
            </tr>
          </thead>
          <tbody>
            {top3.map((f, i) => {
              const ok = f.shap * sign > 0
              return (
                <tr key={f.feature} className="border-b border-line/60">
                  <td className="py-2"><span className="num mr-2 text-fg-3">{i + 1}</span>{f.label}</td>
                  <td className="num py-2 text-right">{f.display}</td>
                  <td className={`num py-2 text-right ${f.shap >= 0 ? 'text-up' : 'text-down'}`}>{f.shap >= 0 ? '+' : '−'}{Math.abs(f.shap).toFixed(4)}</td>
                  <td className={`py-2 text-right text-xs font-semibold ${ok ? 'text-up' : 'text-down'}`}>{ok ? 'Supports' : 'Opposes'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <p className="mt-4 text-[11px] leading-relaxed text-fg-3">
          SHAP values come from LightGBM’s exact TreeSHAP, in log-odds of an up day: positive pushes toward UP, negative toward DOWN.
          They explain the model’s behaviour, not what causes prices to move.
        </p>
      </div>

      {/* contributions */}
      <div className="min-w-0 bg-panel">
        <div className="flex items-center justify-between border-b border-line px-4 py-2">
          <h3 className="text-sm font-semibold">SHAP contributions for this prediction</h3>
          <div role="tablist" aria-label="Contribution view" className="flex gap-0.5 text-xs">
            {([['bars', 'Bars'], ['waterfall', 'Waterfall'], ['table', 'Table']] as const).map(([id, label]) => (
              <button key={id} role="tab" aria-selected={view === id} onClick={() => setView(id)}
                className={`rounded-sm px-2 py-1 font-semibold ${view === id ? 'bg-brand text-on-brand' : 'text-fg-3 hover:text-fg'}`}>{label}</button>
            ))}
          </div>
        </div>
        {view === 'bars' && <ShapBars key={a.symbol} items={all} />}
        {view === 'waterfall' && <WhyWaterfall key={a.symbol} a={a} />}
        {view === 'table' && <ShapTable items={all} />}
      </div>
    </div>
  )
}

function ShapBars({ items }: { items: { feature: string; label: string; display: string; shap: number }[] }) {
  const max = Math.max(...items.map((i) => Math.abs(i.shap)), 1e-9)
  return (
    <div className="px-4 py-3">
      <div className="mb-2 grid grid-cols-[minmax(7rem,11rem)_1fr_4.5rem] gap-3 text-[11px] text-fg-3">
        <span />
        <span className="flex justify-between"><span>← pushes DOWN</span><span>pushes UP →</span></span>
        <span />
      </div>
      <ul className="space-y-1">
        {items.map((f, i) => {
          const w = (Math.abs(f.shap) / max) * 50
          const up = f.shap >= 0
          return (
            <li key={f.feature} className="grid grid-cols-[minmax(7rem,11rem)_1fr_4.5rem] items-center gap-3 text-xs">
              <span className="truncate" title={`${f.label}: ${f.display}`}>
                <span className="text-fg">{f.label}</span> <span className="num text-fg-3">{f.display}</span>
              </span>
              <span className="relative h-3.5">
                <span className="absolute inset-y-0 left-1/2 w-px bg-line-2" />
                <span
                  className={`absolute inset-y-[2px] ${up ? 'bar-grow bg-up' : 'bar-grow-r bg-down'}`}
                  style={{ [up ? 'left' : 'right']: '50%', width: `${Math.max(w, 0.4)}%`, animationDelay: `${i * 25}ms` }}
                />
              </span>
              <span className={`num text-right ${up ? 'text-up' : 'text-down'}`}>{up ? '+' : '−'}{Math.abs(f.shap).toFixed(4)}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function ShapTable({ items }: { items: { feature: string; label: string; display: string; shap: number; impact: number }[] }) {
  return (
    <div className="max-h-[520px] overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-raised text-left text-xs text-fg-3">
          <tr>
            <th className="px-4 py-2 font-medium">Feature</th>
            <th className="px-4 py-2 text-right font-medium">Feature value</th>
            <th className="px-4 py-2 text-right font-medium">SHAP value</th>
            <th className="px-4 py-2 text-right font-medium">≈ Δ P(up)</th>
          </tr>
        </thead>
        <tbody>
          {items.map((f) => (
            <tr key={f.feature} className="border-b border-line/60 hover:bg-raised/50">
              <td className="px-4 py-1.5">{f.label}</td>
              <td className="num px-4 py-1.5 text-right">{f.display}</td>
              <td className={`num px-4 py-1.5 text-right ${f.shap >= 0 ? 'text-up' : 'text-down'}`}>{f.shap >= 0 ? '+' : '−'}{Math.abs(f.shap).toFixed(6)}</td>
              <td className="num px-4 py-1.5 text-right text-fg-2">{f.impact >= 0 ? '+' : '−'}{Math.abs(f.impact * 100).toFixed(2)} pts</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Global "Feature Importance": what the model relies on across all stocks. */
export function FeatureImportance({ items }: { items: { feature: string; label: string; importance: number }[] }) {
  if (!items.length) return <p className="px-4 py-6 text-sm text-fg-2">Available once the model is trained.</p>
  const max = Math.max(...items.map((i) => i.importance))
  return (
    <div className="p-4">
      <ul className="space-y-1.5">
        {items.map((i, idx) => (
          <li key={i.feature} className="grid grid-cols-[1.5rem_minmax(8rem,12rem)_1fr_3.5rem] items-center gap-2 text-xs">
            <span className="num text-fg-3">{idx + 1}</span>
            <span className="truncate text-fg">{i.label}</span>
            <span className="h-2.5 rounded-sm bg-raised"><span className="block h-full rounded-sm bg-why" style={{ width: `${(i.importance / max) * 100}%` }} /></span>
            <span className="num text-right text-fg-2">{(i.importance * 100).toFixed(2)}%</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[11px] text-fg-3">Share of total split gain across all trees. Shows overall reliance; it doesn’t explain an individual prediction.</p>
    </div>
  )
}
