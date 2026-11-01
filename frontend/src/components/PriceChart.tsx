import { useQuery } from '@tanstack/react-query'
import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  type UTCTimestamp,
} from 'lightweight-charts'
import { useEffect, useRef, useState } from 'react'
import { api, type Candle, type Quote } from '../lib/api'
import { compact } from '../lib/format'

const RANGES = [
  { id: '1d', label: '1D' }, { id: '5d', label: '5D' }, { id: '1mo', label: '1M' }, { id: '3mo', label: '3M' },
  { id: '6mo', label: '6M' }, { id: '1y', label: '1Y' }, { id: '5y', label: '5Y' },
]

const C = { text: '#5D6A7B', grid: '#151B24', line: '#1D2530', up: '#00C27A', down: '#FF4D5E', sma20: '#3D8BFF', sma50: '#F2B13C', bb: '#5D6A7B', cross: '#9AA6B6' }

type Kind = 'candles' | 'line'

export function PriceChart({ symbol, quote }: { symbol: string; quote?: Quote }) {
  const [range, setRange] = useState('6mo')
  const [kind, setKind] = useState<Kind>('candles')
  const [overlays, setOverlays] = useState({ sma: true, bb: false })
  const [legend, setLegend] = useState<Candle | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const main = useRef<ISeriesApi<'Candlestick'> | ISeriesApi<'Area'> | null>(null)
  const lastBar = useRef<Candle | null>(null)
  const chartRef = useRef<IChartApi | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['history', symbol, range],
    queryFn: () => api.history(symbol, range),
    refetchInterval: range === '1d' ? 60_000 : 10 * 60_000,
  })

  useEffect(() => {
    if (!box.current || !data) return
    const c = createChart(box.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: C.text, fontFamily: 'JetBrains Mono Variable, monospace', fontSize: 11, attributionLogo: false },
      grid: { vertLines: { color: C.grid }, horzLines: { color: C.grid } },
      rightPriceScale: { borderColor: C.line, scaleMargins: { top: 0.08, bottom: 0.22 } },
      timeScale: { borderColor: C.line, timeVisible: data.intraday, secondsVisible: false, rightOffset: 5 },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: C.cross, width: 1, style: 3, labelBackgroundColor: '#2A3441' },
        horzLine: { color: C.cross, width: 1, style: 3, labelBackgroundColor: '#2A3441' },
      },
    })
    const t = (x: number) => x as UTCTimestamp

    const vol = c.addSeries(HistogramSeries, { priceScaleId: 'vol', priceFormat: { type: 'volume' }, lastValueVisible: false, priceLineVisible: false })
    c.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } })
    vol.setData(data.candles.map((k) => ({ time: t(k.time), value: k.volume, color: k.close >= k.open ? '#00C27A40' : '#FF4D5E40' })))

    if (!data.intraday && overlays.bb) {
      for (const s of [data.bbUpper, data.bbLower]) {
        c.addSeries(LineSeries, { color: C.bb, lineWidth: 1, lineStyle: 2, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false })
          .setData(s.map((p) => ({ time: t(p.time), value: p.value })))
      }
    }
    if (!data.intraday && overlays.sma) {
      for (const [s, color] of [[data.sma20, C.sma20], [data.sma50, C.sma50]] as const) {
        c.addSeries(LineSeries, { color, lineWidth: 1, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false })
          .setData(s.map((p) => ({ time: t(p.time), value: p.value })))
      }
    }

    const first = data.candles[0]?.close ?? 0
    const last = data.candles.at(-1)?.close ?? 0
    const upTrend = last >= first
    let series: ISeriesApi<'Candlestick'> | ISeriesApi<'Area'>
    if (kind === 'candles') {
      const s = c.addSeries(CandlestickSeries, {
        upColor: C.up, downColor: C.down, borderUpColor: C.up, borderDownColor: C.down, wickUpColor: C.up, wickDownColor: C.down,
        priceLineStyle: 2,
      })
      s.setData(data.candles.map((k) => ({ time: t(k.time), open: k.open, high: k.high, low: k.low, close: k.close })))
      series = s
    } else {
      const col = upTrend ? C.up : C.down
      const s = c.addSeries(AreaSeries, { lineColor: col, topColor: `${col}40`, bottomColor: `${col}00`, lineWidth: 2, priceLineStyle: 2 })
      s.setData(data.candles.map((k) => ({ time: t(k.time), value: k.close })))
      series = s
    }

    const byTime = new Map(data.candles.map((k) => [k.time, k]))
    lastBar.current = data.candles.at(-1) ?? null
    setLegend(lastBar.current)
    const onMove = (p: MouseEventParams) => {
      const k = p.time != null ? byTime.get(p.time as number) : undefined
      setLegend(k ?? lastBar.current)
    }
    c.subscribeCrosshairMove(onMove)
    c.timeScale().fitContent()
    main.current = series
    chartRef.current = c
    return () => {
      c.unsubscribeCrosshairMove(onMove)
      c.remove()
      main.current = null
      chartRef.current = null
    }
  }, [data, overlays, kind])

  // move the latest bar with the live price
  useEffect(() => {
    const lb = lastBar.current
    if (!quote || !main.current || !lb || range === '5y') return
    const close = quote.price
    const bar = { ...lb, close, high: Math.max(lb.high, close), low: Math.min(lb.low, close) }
    lastBar.current = bar
    if (kind === 'candles') (main.current as ISeriesApi<'Candlestick'>).update({ ...bar, time: bar.time as UTCTimestamp })
    else (main.current as ISeriesApi<'Area'>).update({ time: bar.time as UTCTimestamp, value: close })
  }, [quote, kind, range])

  const chg = legend ? legend.close - legend.open : 0
  const fmt = (v: number) => v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <section aria-label="Price chart" className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-3 py-2">
        <Seg items={RANGES} value={range} onChange={setRange} label="Chart range" />
        <span className="h-4 w-px bg-line-2" aria-hidden />
        <Seg items={[{ id: 'candles', label: 'Candles' }, { id: 'line', label: 'Line' }]} value={kind} onChange={(v) => setKind(v as Kind)} label="Chart type" />
        {!data?.intraday && (
          <div className="ml-auto flex items-center gap-1 text-xs">
            <Chip on={overlays.sma} onClick={() => setOverlays((o) => ({ ...o, sma: !o.sma }))}>
              <i className="h-0.5 w-2.5 bg-brand" />SMA 20<i className="ml-1 h-0.5 w-2.5 bg-hold" />SMA 50
            </Chip>
            <Chip on={overlays.bb} onClick={() => setOverlays((o) => ({ ...o, bb: !o.bb }))}>
              <i className="w-2.5 border-t border-dashed border-fg-3" />Bollinger
            </Chip>
          </div>
        )}
      </div>
      <div className="relative min-h-[380px] flex-1">
        {legend && (
          <div className="num pointer-events-none absolute left-3 top-2 z-10 flex flex-wrap gap-x-3 text-[11px] text-fg-3">
            <span>O <b className="font-normal text-fg">{fmt(legend.open)}</b></span>
            <span>H <b className="font-normal text-fg">{fmt(legend.high)}</b></span>
            <span>L <b className="font-normal text-fg">{fmt(legend.low)}</b></span>
            <span>C <b className={`font-normal ${chg >= 0 ? 'text-up' : 'text-down'}`}>{fmt(legend.close)}</b></span>
            <span>Vol <b className="font-normal text-fg">{compact(legend.volume)}</b></span>
          </div>
        )}
        <div ref={box} className="absolute inset-0" />
        {isLoading && <div className="absolute inset-0 animate-pulse bg-raised/40" />}
        {error && <p className="absolute inset-0 grid place-items-center text-sm text-fg-2">Price history unavailable: {(error as Error).message}</p>}
      </div>
    </section>
  )
}

function Seg({ items, value, onChange, label }: { items: { id: string; label: string }[]; value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-0.5">
      {items.map((r) => (
        <button key={r.id} role="tab" aria-selected={value === r.id} onClick={() => onChange(r.id)}
          className={`rounded px-2 py-1 text-xs font-semibold transition-colors ${value === r.id ? 'bg-raised text-fg' : 'text-fg-3 hover:text-fg'}`}>
          {r.label}
        </button>
      ))}
    </div>
  )
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-pressed={on}
      className={`flex items-center gap-1.5 rounded px-2 py-1 transition-colors ${on ? 'bg-raised text-fg' : 'text-fg-3 hover:text-fg-2'}`}>
      {children}
    </button>
  )
}
