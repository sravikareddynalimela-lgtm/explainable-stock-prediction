import { Activity, BrainCircuit, ShieldAlert, TrendingUp } from 'lucide-react'
import type { Agent } from '../lib/api'

const ICON = { model: BrainCircuit, technical: Activity, trend: TrendingUp, risk: ShieldAlert }

const STANCE: Record<string, string> = {
  BULLISH: 'bg-up-dim text-up',
  BEARISH: 'bg-down-dim text-down',
  NEUTRAL: 'bg-raised text-fg-2',
  LOW: 'bg-up-dim text-up',
  ELEVATED: 'bg-hold-dim text-hold',
  HIGH: 'bg-down-dim text-down',
}

const stanceWord = (s: string) => ({ BULLISH: 'Bullish', BEARISH: 'Bearish', NEUTRAL: 'Neutral', LOW: 'Low risk', ELEVATED: 'Elevated risk', HIGH: 'High risk' })[s] ?? s

export function Agents({ agents }: { agents: Agent[] }) {
  return (
    <section aria-labelledby="agents-h" className="p-4 sm:p-5">
      <h2 id="agents-h" className="text-base font-semibold">How each agent sees it</h2>
      <div className="mt-3 grid gap-px overflow-hidden rounded-lg bg-line ring-1 ring-line sm:grid-cols-2 xl:grid-cols-4">
        {agents.map((a) => (
          <AgentCard key={a.id} a={a} />
        ))}
      </div>
    </section>
  )
}

function AgentCard({ a }: { a: Agent }) {
  const Icon = ICON[a.id]
  const directional = a.id !== 'risk'
  const pos = ((a.score + 1) / 2) * 100
  return (
    <article className="flex flex-col bg-panel p-5">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className={`h-[18px] w-[18px] ${a.id === 'model' ? 'text-why' : 'text-fg-2'}`} aria-hidden />
          <h3 className="font-semibold">{a.name}</h3>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STANCE[a.stance] ?? 'bg-raised'}`}>{stanceWord(a.stance)}</span>
      </header>
      <p className="mt-1 text-sm text-fg-2">{a.summary}</p>

      {directional ? (
        <div className="mt-4" aria-label={`Score ${a.score.toFixed(2)} from −1 to +1`}>
          <div className="relative h-1.5 rounded-full bg-raised">
            <div className="absolute inset-y-0 left-1/2 w-px bg-fg-3" />
            <div
              className={`absolute inset-y-0 rounded-full ${a.score >= 0 ? 'bg-up' : 'bg-down'}`}
              style={a.score >= 0 ? { left: '50%', width: `${pos - 50}%` } : { left: `${pos}%`, width: `${50 - pos}%` }}
            />
          </div>
          <div className="num mt-1 flex justify-between text-[11px] text-fg-3">
            <span>−1</span>
            <span className="font-semibold text-fg">{a.score >= 0 ? '+' : '−'}{Math.abs(a.score).toFixed(2)}</span>
            <span>+1</span>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-fg-2">
          Conviction scaled to <span className="num font-semibold text-fg">{Math.round((a.dampener ?? 1) * 100)}%</span>
        </p>
      )}

      <ul className="mt-4 space-y-2 text-sm leading-snug text-fg">
        {a.reasons.map((r) => (
          <li key={r} className="relative pl-3.5 before:absolute before:left-0 before:top-[0.55em] before:h-1 before:w-1 before:rounded-full before:bg-fg-3">
            {r}
          </li>
        ))}
      </ul>

      <dl className="mt-auto grid grid-cols-2 gap-x-3 gap-y-2 border-t border-line pt-4 text-xs">
        {a.metrics.map((m) => (
          <div key={m.label}>
            <dt className="text-fg-3">{m.label}</dt>
            <dd className="num text-sm font-semibold text-fg">{m.value}</dd>
          </div>
        ))}
      </dl>
    </article>
  )
}
