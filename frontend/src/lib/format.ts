const symbolFor: Record<string, string> = { USD: '$', INR: '₹', EUR: '€', GBP: '£', JPY: '¥' }

export function money(v: number | null | undefined, currency = 'USD', digits?: number) {
  if (v == null || Number.isNaN(v)) return '–'
  const d = digits ?? (Math.abs(v) >= 1000 ? 2 : Math.abs(v) < 1 ? 4 : 2)
  const s = v.toLocaleString(currency === 'INR' ? 'en-IN' : 'en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
  return `${symbolFor[currency] ?? ''}${s}${symbolFor[currency] ? '' : ` ${currency}`}`
}

export function signed(v: number, digits = 2) {
  return `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(digits)}`
}

export function pct(v: number, digits = 1, withSign = false) {
  const s = `${Math.abs(v * 100).toFixed(digits)}%`
  if (!withSign) return v < 0 ? `−${s}` : s
  return `${v >= 0 ? '+' : '−'}${s}`
}

export function compact(v: number | null | undefined) {
  if (v == null) return '–'
  return Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(v)
}

export function timeAgo(iso: string | null) {
  if (!iso) return ''
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`
  if (s < 86400) return `${Math.round(s / 3600)}h ago`
  return `${Math.round(s / 86400)}d ago`
}

export const tone = (v: number) => (v > 0 ? 'text-up' : v < 0 ? 'text-down' : 'text-ink-2')
