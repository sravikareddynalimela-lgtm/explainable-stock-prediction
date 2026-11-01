export const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? ''

export type Quote = {
  symbol: string
  name: string
  exchange: string
  currency: string
  price: number
  previousClose: number
  change: number
  changePct: number
  open: number
  dayHigh: number
  dayLow: number
  volume: number
  fiftyTwoWeekHigh: number | null
  fiftyTwoWeekLow: number | null
  marketState: 'OPEN' | 'CLOSED' | 'PRE' | 'POST' | 'UNKNOWN'
  time: number
  source: 'yahoo' | 'demo'
}

export type Candle = { time: number; open: number; high: number; low: number; close: number; volume: number }
export type Point = { time: number; value: number }

export type History = {
  symbol: string
  range: string
  interval: string
  intraday: boolean
  candles: Candle[]
  sma20: Point[]
  sma50: Point[]
  bbUpper: Point[]
  bbLower: Point[]
  rsi: Point[]
}

export type Agent = {
  id: 'model' | 'technical' | 'trend' | 'risk'
  name: string
  score: number
  stance: string
  summary: string
  reasons: string[]
  metrics: { label: string; value: string }[]
  dampener?: number
}

export type Contribution = {
  feature: string
  label: string
  value: number | null
  display: string
  shap: number
  impact: number
  direction: 'up' | 'down'
  sentence: string
}

export type Track = {
  accuracy: number
  baseline: number
  samples: number
  strategyReturn: number
  buyHoldReturn: number
  timeInMarket: number
  equity: { date: string; strategy: number; buyHold: number }[]
}

export type ModelStatus = { state: 'idle' | 'training' | 'ready' | 'error'; message: string; progress: number }

export type Analysis = {
  symbol: string
  asOf: string
  prediction: { direction: 'UP' | 'DOWN'; pUp: number; confidence: number; highConviction: boolean } | null
  explanation: { pUp: number; baseProbability: number; contributions: Contribution[] } | null
  track: Track | null
  inUniverse: boolean
  agents: Agent[]
  fusion: {
    signal: 'BUY' | 'SELL' | 'HOLD'
    score: number
    rawScore: number
    dampener: number
    agreement: string
    explanation: string
  }
  indicators: Record<string, number | null>
  modelStatus: ModelStatus
}

export type ModelInfo = {
  status: ModelStatus
  metrics: null | {
    overall: {
      accuracy: number
      baseline: number
      baselineLabel: string
      auc: number
      samples: number
      highConviction: { accuracy: number; share: number; threshold: number }
      testStart: string
      testEnd: string
      folds: number
    }
    trainedAt: string
    dataSource: string
    universe: string[]
    rows: number
    dataStart: string
    dataEnd: string
    featureImportance: { feature: string; label: string; importance: number }[]
    model: string
  }
}

export type NewsItem = { title: string; url: string; publisher: string; publishedAt: string | null; summary: string; thumbnail: string | null }
export type SearchHit = { symbol: string; name: string; exchange: string; type: string }
export type Health = { status: string; dataSource: string; model: ModelStatus; trainedAt: string | null }

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) {
    let detail = res.statusText
    try {
      detail = (await res.json()).detail ?? detail
    } catch {
      /* not json */
    }
    throw new ApiError(res.status, detail)
  }
  return res.json()
}

export const api = {
  health: () => get<Health>('/api/health'),
  quotes: (symbols: string[]) => get<Quote[]>(`/api/quotes?symbols=${encodeURIComponent(symbols.join(','))}`),
  history: (symbol: string, range: string) => get<History>(`/api/history/${encodeURIComponent(symbol)}?range=${range}`),
  analysis: (symbol: string) => get<Analysis>(`/api/analysis/${encodeURIComponent(symbol)}`),
  news: (symbol: string) => get<NewsItem[]>(`/api/news/${encodeURIComponent(symbol)}`),
  search: (q: string) => get<SearchHit[]>(`/api/search?q=${encodeURIComponent(q)}`),
  model: () => get<ModelInfo>('/api/model'),
  streamUrl: (symbols: string[]) => `${API_BASE}/api/stream?symbols=${encodeURIComponent(symbols.join(','))}`,
}
