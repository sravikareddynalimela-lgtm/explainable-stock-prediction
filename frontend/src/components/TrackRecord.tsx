import { useQuery } from '@tanstack/react-query'
import { ColorType, LineSeries, createChart } from 'lightweight-charts'
import { useEffect, useRef } from 'react'
import { api, type Analysis } from '../lib/api'
import { pct } from '../lib/format'
import { usePalette } from '../lib/theme'

export function TrackRecord({ a }: { a: Analysis }) {
  const { data: info } = useQuery({ queryKey: ['model'], queryFn: api.model, staleTime: 5 * 60_000 })
  const m = info?.metrics
  const t = a.track
  const o = m?.overall
  if (!o) return null

  const acc = t?.accuracy ?? o.accuracy
  const base = t?.baseline ?? o.baseline
  const edge = acc - base

  return (
    <section aria-label="Backtest" className="p-4">
      <p className="max-w-prose text-sm text-fg-2">
        Tested walk-forward from {o.testStart} to {o.testEnd}: the model was retrained {o.folds} times and only ever scored on days it hadn't seen.
        {t ? ` Results below are for ${a.symbol}.` : ` ${a.symbol} isn't in the training set, so these are results across all ${m.universe.length} training stocks.`}
      </p>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,17rem)_1fr]">
        <div className="space-y-5">
          <Compare label="Direction accuracy" value={acc} baseline={base} baselineLabel={o.baselineLabel} />
          <p className={`text-sm ${edge > 0.005 ? 'text-up' : edge < -0.005 ? 'text-down' : 'text-fg-2'}`}>
            {edge > 0.005
              ? `${(edge * 100).toFixed(1)} points better than always guessing the same direction.`
              : edge < -0.005
                ? `${(Math.abs(edge) * 100).toFixed(1)} points worse than always guessing the same direction.`
                : 'About the same as always guessing the same direction.'}
          </p>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Stat label="Most confident 20%" value={pct(o.highConviction.accuracy)} hint="accuracy" />
            <Stat label="ROC AUC" value={o.auc.toFixed(3)} hint="0.5 is a coin flip" />
            {t && <Stat label="Long-when-up strategy" value={pct(t.strategyReturn, 0, true)} hint={`vs ${pct(t.buyHoldReturn, 0, true)} buy & hold`} />}
            {t && <Stat label="Days invested" value={pct(t.timeInMarket, 0)} hint={`of ${t.samples} test days`} />}
            {!t && <Stat label="Test predictions" value={o.samples.toLocaleString()} hint="out of sample" />}
          </dl>
        </div>
        {t ? <Equity data={t.equity} /> : <Importance items={m.featureImportance.slice(0, 8)} />}
      </div>
      <p className="mt-5 text-xs text-fg-3">
        Next-day stock direction is close to random. A few points above baseline is a realistic result, not a flaw. Strategy returns ignore fees and slippage. This is a learning project, not financial advice.
      </p>
    </section>
  )
}

function Compare({ label, value, baseline, baselineLabel }: { label: string; value: number; baseline: number; baselineLabel: string }) {
  const scale = (v: number) => `${Math.max(0, Math.min(100, ((v - 0.4) / 0.25) * 100))}%`
  return (
    <div>
      <div className="text-sm text-fg-2">{label}</div>
      <div className="num text-4xl font-bold tracking-tight">{pct(value)}</div>
      <div className="mt-3 space-y-1.5 text-xs">
        <Bar w={scale(value)} cls="bg-why" label="Model" v={pct(value)} />
        <Bar w={scale(baseline)} cls="bg-fg-3/50" label={baselineLabel} v={pct(baseline)} />
      </div>
    </div>
  )
}

function Bar({ w, cls, label, v }: { w: string; cls: string; label: string; v: string }) {
  return (
    <div>
      <div className="flex justify-between text-fg-2"><span>{label}</span><span className="num">{v}</span></div>
      <div className="mt-0.5 h-2 rounded-full bg-raised"><div className={`h-full rounded-full ${cls}`} style={{ width: w }} /></div>
    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div>
      <dt className="text-fg-2">{label}</dt>
      <dd className="num text-lg font-semibold">{value}</dd>
      <dd className="text-xs text-fg-3">{hint}</dd>
    </div>
  )
}

function Equity({ data }: { data: { date: string; strategy: number; buyHold: number }[] }) {
  const C = usePalette()
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!box.current) return
    const c = createChart(box.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: C.text, fontFamily: 'JetBrains Mono Variable, monospace', fontSize: 11, attributionLogo: false },
      grid: { vertLines: { visible: false }, horzLines: { color: C.grid } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderColor: C.line },
      handleScroll: false,
      handleScale: false,
      localization: { priceFormatter: (p: number) => `${((p - 1) * 100).toFixed(0)}%` },
    })
    const hold = c.addSeries(LineSeries, { color: C.muted, lineWidth: 2, priceLineVisible: false, lastValueVisible: false })
    hold.setData(data.map((d) => ({ time: d.date, value: d.buyHold })))
    const strat = c.addSeries(LineSeries, { color: C.why, lineWidth: 2, priceLineVisible: false })
    strat.setData(data.map((d) => ({ time: d.date, value: d.strategy })))
    c.timeScale().fitContent()
    return () => c.remove()
  }, [data, C])
  return (
    <figure>
      <figcaption className="flex gap-4 text-sm text-fg-2">
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 bg-why" />Invested only when model says up</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 bg-fg-3" />Buy &amp; hold</span>
      </figcaption>
      <div ref={box} className="mt-2 h-60" />
    </figure>
  )
}

function Importance({ items }: { items: { label: string; importance: number }[] }) {
  const max = Math.max(...items.map((i) => i.importance))
  return (
    <figure>
      <figcaption className="text-sm text-fg-2">What the model relies on most, across all stocks</figcaption>
      <ul className="mt-3 space-y-2 text-sm">
        {items.map((i) => (
          <li key={i.label} className="grid grid-cols-[11rem_1fr_3rem] items-center gap-3">
            <span className="truncate">{i.label}</span>
            <span className="h-2 rounded-full bg-raised"><span className="block h-full rounded-full bg-why/70" style={{ width: `${(i.importance / max) * 100}%` }} /></span>
            <span className="num text-right text-fg-2">{(i.importance * 100).toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </figure>
  )
}
