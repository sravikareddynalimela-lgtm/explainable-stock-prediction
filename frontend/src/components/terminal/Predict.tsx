import { Loader2, Play, RotateCw } from 'lucide-react'

/** Big call to action shown in the Prediction panel before the user asks for a prediction. */
export function PredictCTA({ symbol, onPredict, training }: { symbol: string; onPredict: () => void; training: boolean }) {
  return (
    <div className="flex h-full flex-col px-4 py-5">
      <div className="text-xs text-fg-3">Next-session prediction</div>
      <h3 className="mt-1 text-xl font-semibold tracking-tight">
        Predict <span className="num">{symbol}</span>
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-fg-2">
        Runs the ML model and the Technical, Historical and Volatility agents on the latest daily data, then explains the result.
      </p>
      <ul className="mt-4 space-y-1.5 text-sm text-fg-2">
        {['UP / DOWN with model confidence', 'BUY, SELL or HOLD recommendation', 'Agent votes and SHAP explanation', 'Backtest and recent data'].map((t) => (
          <li key={t} className="flex items-center gap-2">
            <span className="h-1 w-1 bg-brand" aria-hidden />
            {t}
          </li>
        ))}
      </ul>
      <button
        onClick={onPredict}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-sm bg-brand py-3 text-base font-bold text-on-brand transition-opacity hover:opacity-90"
      >
        <Play className="h-4 w-4" fill="currentColor" aria-hidden />
        Predict
        <kbd className="num ml-1 rounded-sm border border-on-brand/30 px-1.5 text-[11px] font-semibold">P</kbd>
      </button>
      {training && <p className="mt-3 text-xs text-why">The ML model is still training; the agents will run now and the model joins when it finishes.</p>}
      <p className="mt-auto pt-4 text-[11px] leading-relaxed text-fg-3">Predictions are educational and not financial advice.</p>
    </div>
  )
}

/** Shown while the analysis request runs. */
export function PredictRunning({ symbol }: { symbol: string }) {
  return (
    <div className="px-4 py-6">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Loader2 className="h-4 w-4 animate-spin text-brand" aria-hidden />
        Predicting <span className="num">{symbol}</span>…
      </div>
      <ol className="mt-4 space-y-2 text-sm text-fg-2">
        {['Loading 10 years of daily prices', 'Computing 20 indicators', 'Running the ML model and agents', 'Explaining the prediction with SHAP'].map((t, i) => (
          <li key={t} className="flex items-center gap-2" style={{ animation: `live-pulse 1.6s ${i * 0.3}s ease-in-out infinite` }}>
            <span className="num text-fg-3">{i + 1}</span>
            {t}
          </li>
        ))}
      </ol>
    </div>
  )
}

/** Compact prompt for the other sections before a prediction has been run. */
export function NotYetPredicted({ what, onPredict }: { what: string; onPredict: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-5">
      <p className="text-sm text-fg-2">{what} will appear after you run a prediction.</p>
      <button onClick={onPredict} className="flex items-center gap-1.5 rounded-sm border border-brand px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand-dim">
        <Play className="h-3 w-3" fill="currentColor" aria-hidden /> Predict
      </button>
    </div>
  )
}

export function RerunButton({ onClick, busy, at }: { onClick: () => void; busy: boolean; at: number | null }) {
  return (
    <span className="flex items-center gap-2">
      {at && <span className="num">{new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
      <button onClick={onClick} disabled={busy} title="Run the prediction again with the latest data"
        className="flex items-center gap-1 rounded-sm border border-line-2 px-1.5 py-0.5 font-semibold text-fg-2 hover:border-brand hover:text-brand disabled:opacity-50">
        <RotateCw className={`h-3 w-3 ${busy ? 'animate-spin' : ''}`} aria-hidden /> Re-run
      </button>
    </span>
  )
}
