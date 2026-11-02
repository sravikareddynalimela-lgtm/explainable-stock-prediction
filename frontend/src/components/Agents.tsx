import { Activity, BrainCircuit, History, Waves } from 'lucide-react'
import type { Agent, Analysis } from '../lib/api'
import { VoteIcon } from './terminal/PredictionResult'

const ICON = { model: BrainCircuit, technical: Activity, historical: History, volatility: Waves }

const STANCE: Record<string, string> = {
  BULLISH: 'text-up bg-up-dim', BEARISH: 'text-down bg-down-dim', NEUTRAL: 'text-fg-2 bg-raised',
  LOW: 'text-up bg-up-dim', MEDIUM: 'text-hold bg-hold-dim', HIGH: 'text-down bg-down-dim',
}
const WORD: Record<string, string> = { BULLISH: 'Bullish', BEARISH: 'Bearish', NEUTRAL: 'Neutral', LOW: 'Low risk', MEDIUM: 'Medium risk', HIGH: 'High risk' }

/** "Multi-Agent Analysis": one column per agent. */
export function AgentGrid({ agents }: { agents: Agent[] }) {
  return (
    <div className="grid gap-px bg-line sm:grid-cols-2 xl:grid-cols-4">
      {agents.map((a) => <AgentColumn key={a.id} a={a} />)}
    </div>
  )
}

function AgentColumn({ a }: { a: Agent }) {
  const Icon = ICON[a.id] ?? Activity
  const directional = a.id !== 'volatility'
  const pos = ((a.score + 1) / 2) * 100
  return (
    <article className="flex flex-col bg-panel p-4">
      <header className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${a.id === 'model' ? 'text-why' : 'text-brand'}`} aria-hidden />
        <h3 className="text-sm font-semibold">{a.name}</h3>
        <span className={`ml-auto rounded-sm px-1.5 py-0.5 text-[11px] font-semibold ${STANCE[a.stance] ?? 'bg-raised'}`}>
          {a.id === 'model' && a.stance === 'NEUTRAL' && a.vote ? `Leans ${a.vote.toLowerCase()}` : WORD[a.stance] ?? a.stance}
        </span>
      </header>
      <p className="mt-1 text-xs leading-snug text-fg-3">{a.summary}</p>

      {directional ? (
        <div className="mt-3">
          <div className="relative h-1.5 rounded-sm bg-raised">
            <span className="absolute inset-y-0 left-1/2 w-px bg-fg-3" />
            <span className={`absolute inset-y-0 ${a.score >= 0 ? 'bg-up' : 'bg-down'}`}
              style={a.score >= 0 ? { left: '50%', width: `${pos - 50}%` } : { left: `${pos}%`, width: `${50 - pos}%` }} />
          </div>
          <div className="num mt-1 flex items-center justify-between text-[11px] text-fg-3">
            <span>−1</span>
            <span className="flex items-center gap-1 text-fg">
              Signal <b className="font-semibold">{a.vote}</b> <VoteIcon vote={a.vote} />
              <span className="text-fg-3">({a.score >= 0 ? '+' : '−'}{Math.abs(a.score).toFixed(2)})</span>
            </span>
            <span>+1</span>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-xs text-fg-2">Conviction scaled to <b className="num text-fg">{Math.round((a.dampener ?? 1) * 100)}%</b></p>
      )}

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-sm bg-raised/60 p-2 text-xs">
        {a.metrics.map((m) => (
          <div key={m.label} className="min-w-0">
            <dt className="truncate text-fg-3">{m.label}</dt>
            <dd className="num truncate text-[13px] text-fg">{m.value}</dd>
          </div>
        ))}
      </dl>

      <ul className="mt-3 space-y-1.5 text-[13px] leading-snug text-fg-2">
        {a.reasons.map((r) => (
          <li key={r} className="relative pl-3 before:absolute before:left-0 before:top-[0.55em] before:h-1 before:w-1 before:bg-fg-3">{r}</li>
        ))}
      </ul>
    </article>
  )
}

/** "Agent Fusion": the original majority vote, next to the weighted score that drives the recommendation. */
export function Fusion({ a }: { a: Analysis }) {
  const f = a.fusion
  const pos = ((Math.max(-1, Math.min(1, f.score)) + 1) / 2) * 100
  const tone = f.signal === 'BUY' ? 'text-up' : f.signal === 'SELL' ? 'text-down' : 'text-hold'
  return (
    <div className="grid gap-px bg-line lg:grid-cols-[1fr_1fr_1.3fr]">
      <div className="bg-panel p-4">
        <div className="text-xs text-fg-3">Votes</div>
        <table className="mt-2 w-full text-sm">
          <tbody>
            {f.votes.map((v) => (
              <tr key={v.agent} className="border-b border-line/70 last:border-0">
                <td className="py-1.5 text-fg-2">{v.agent}</td>
                <td className="py-1.5 text-right"><span className="inline-flex items-center gap-1 font-semibold">{v.vote}<VoteIcon vote={v.vote} /></span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid grid-cols-3 bg-panel text-center lg:grid-cols-1 lg:text-left">
        <Stat k="UP votes" v={String(f.upVotes)} cls="text-up" />
        <Stat k="DOWN votes" v={String(f.downVotes)} cls="text-down" />
        <Stat k="Fused direction" v={f.majority} cls={f.majority === 'UP' ? 'text-up' : f.majority === 'DOWN' ? 'text-down' : 'text-hold'} />
      </div>
      <div className="bg-panel p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-fg-3">Weighted score → recommendation</span>
          <span className={`text-lg font-bold ${tone}`}>{f.signal}</span>
        </div>
        <div className="relative mt-4 h-2 rounded-sm bg-gradient-to-r from-down via-hold to-up opacity-80">
          <span className="absolute inset-y-0 left-[40%] right-[40%] bg-panel/40" aria-hidden />
          <span className="absolute top-1/2 h-4 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-fg ring-2 ring-panel" style={{ left: `${pos}%` }} />
        </div>
        <div className="num mt-1.5 flex justify-between text-[11px] text-fg-3"><span>SELL −1</span><span>HOLD</span><span>+1 BUY</span></div>
        <p className="mt-3 text-xs leading-relaxed text-fg-2">{f.explanation}</p>
      </div>
    </div>
  )
}

function Stat({ k, v, cls }: { k: string; v: string; cls: string }) {
  return (
    <div className="border-line px-4 py-3 lg:border-b lg:last:border-0">
      <div className="text-xs text-fg-3">{k}</div>
      <div className={`num text-2xl font-semibold ${cls}`}>{v}</div>
    </div>
  )
}
