import { useQuery } from '@tanstack/react-query'
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts'
import { useEffect, useRef, useState } from 'react'
import { api, type Quote } from '../lib/api'

const RANGES = [
  { id: '1d', label: '1D' },
  { id: '5d', label: '5D' },
  { id: '1mo', label: '1M' },
  { id: '3mo', label: '3M' },
  { id: '6mo', label: '6M' },
  { id: '1y', label: '1Y' },
  { id: '5y', label: '5Y' },
]

const C = {
  ink: '#13213A', ink3: '#8592A8', grid: '#E6EBF0', rule: '#D9E0E8',
  up: '#0B7D62', down: '#B8382F', sma20: '#4B3FD6', sma50: '#C08A1E',
}

export function PriceChart({ symbol, quote }: { symbol: string; quote?: Quote }) {
  const [range, setRange] = useState('6mo')
  const [overlays, setOverlays] = useState({ sma: true, bb: false })
  const box = useRef<HTMLDivElement>(null)
  const chart = useRef<IChartApi | null>(null)
  const candles = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const lastBar = useRef<{ time: number; open: number; high: number; low: number; close: number } | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['history', symbol, range],
    queryFn: () => api.history(symbol, range),
    refetchInterval: range === '1d' ? 60_000 : 10 * 60_000,
  })

  // build chart for each data set
  useEffect(() => {
    if (!box.current || !data) return
    const c = createChart(box.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: C.ink3, fontFamily: 'Schibsted Grotesk Variable, sans-serif', fontSize: 12, attributionLogo: false },
      grid: { vertLines: { visible: false }, horzLines: { color: C.grid } },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.08, bottom: 0.24 } },
      timeScale: { borderColor: C.rule, timeVisible: data.intraday, secondsVisible: false, rightOffset: 4 },
      crosshair: { mode: CrosshairMode.Normal, vertLine: { color: C.ink3, labelBackgroundColor: C.ink }, horzLine: { color: C.ink3, labelBackgroundColor: C.ink } },
      localization: { priceFormatter: (p: number) => p.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 }) },
    })
    const toT = (t: number) => t as UTCTimestamp

    const vol = c.addSeries(HistogramSeries, { priceScaleId: 'vol', priceFormat: { type: 'volume' }, lastValueVisible: false, priceLineVisible: false })
    c.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } })
    vol.setData(data.candles.map((k) => ({ time: toT(k.time), value: k.volume, color: k.close >= k.open ? '#0B7D6233' : '#B8382F33' })))

    if (overlays.bb && !data.intraday) {
      for (const s of [data.bbUpper, data.bbLower]) {
        const l = c.addSeries(LineSeries, { color: '#8592A8', lineWidth: 1, lineStyle: 2, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false })
        l.setData(s.map((p) => ({ time: toT(p.time), value: p.value })))
      }
    }
    if (overlays.sma && !data.intraday) {
      for (const [s, color] of [[data.sma20, C.sma20], [data.sma50, C.sma50]] as const) {
        const l = c.addSeries(LineSeries, { color, lineWidth: 2, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false })
        l.setData(s.map((p) => ({ time: toT(p.time), value: p.value })))
      }
    }

    const cs = c.addSeries(CandlestickSeries, {
      upColor: C.up, downColor: C.down, borderUpColor: C.up, borderDownColor: C.down, wickUpColor: C.up, wickDownColor: C.down,
      priceLineColor: C.ink, priceLineWidth: 1,
    })
    cs.setData(data.candles.map((k) => ({ time: toT(k.time), open: k.open, high: k.high, low: k.low, close: k.close })))
    lastBar.current = data.candles.at(-1) ?? null
    c.timeScale().fitContent()
    chart.current = c
    candles.current = cs
    return () => {
      c.remove()
      chart.current = null
      candles.current = null
    }
  }, [data, overlays])

  // apply live price to the latest bar
  useEffect(() => {
    const lb = lastBar.current
    if (!quote || !candles.current || !lb || data?.range === '5y') return
    const close = quote.price
    const bar = { ...lb, close, high: Math.max(lb.high, close), low: Math.min(lb.low, close) }
    candles.current.update({ ...bar, time: bar.time as UTCTimestamp })
  }, [quote, data])

  return (
    <section aria-label="Price chart">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Chart range" className="flex rounded-lg bg-grid p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.id}
              role="tab"
              aria-selected={range === r.id}
              onClick={() => setRange(r.id)}
              className={`num rounded-md px-3 py-1 text-sm font-medium transition-colors ${range === r.id ? 'bg-sheet text-ink shadow-[0_1px_2px_rgba(19,33,58,0.12)]' : 'text-ink-2 hover:text-ink'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
        {!data?.intraday && (
          <div className="flex items-center gap-4 text-sm text-ink-2">
            <Toggle on={overlays.sma} onClick={() => setOverlays((o) => ({ ...o, sma: !o.sma }))}>
              <span className="inline-block h-0.5 w-3 bg-why" /> 20-day <span className="ml-1 inline-block h-0.5 w-3 bg-[#C08A1E]" /> 50-day
            </Toggle>
            <Toggle on={overlays.bb} onClick={() => setOverlays((o) => ({ ...o, bb: !o.bb }))}>
              <span className="inline-block w-3 border-t border-dashed border-ink-3" /> Bollinger
            </Toggle>
          </div>
        )}
      </div>
      <div className="relative mt-3 h-[360px] sm:h-[420px]">
        <div ref={box} className="absolute inset-0" />
        {isLoading && <div className="absolute inset-0 animate-pulse rounded-lg bg-grid/60" />}
        {error && (
          <p className="absolute inset-0 grid place-items-center text-sm text-ink-2">
            Couldn't load price history: {(error as Error).message}
          </p>
        )}
      </div>
    </section>
  )
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-pressed={on} className={`flex items-center gap-1.5 transition-opacity ${on ? 'opacity-100' : 'opacity-45 hover:opacity-75'}`}>
      {children}
    </button>
  )
}
