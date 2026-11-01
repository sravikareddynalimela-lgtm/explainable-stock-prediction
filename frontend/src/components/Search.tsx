import { useQuery } from '@tanstack/react-query'
import { Search as SearchIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'

export function Search({ onPick }: { onPick: (symbol: string) => void }) {
  const [text, setText] = useState('')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 250)
    return () => clearTimeout(t)
  }, [text])

  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const slash = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault()
        ref.current?.querySelector('input')?.focus()
      }
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', slash)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', slash)
    }
  }, [])

  const { data = [], isFetching } = useQuery({ queryKey: ['search', q], queryFn: () => api.search(q), enabled: q.length > 0, staleTime: 3600_000 })

  const pick = (s: string) => {
    onPick(s.toUpperCase())
    setText('')
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative w-full max-w-md">
      <label className="flex items-center gap-2 rounded-md border border-line-2 bg-raised px-3 py-1.5 focus-within:border-brand">
        <SearchIcon className="h-4 w-4 text-fg-3" aria-hidden />
        <span className="sr-only">Search stocks</span>
        <input
          value={text}
          onChange={(e) => { setText(e.target.value); setOpen(true); setHi(0) }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') setHi((h) => Math.min(h + 1, data.length - 1))
            else if (e.key === 'ArrowUp') setHi((h) => Math.max(h - 1, 0))
            else if (e.key === 'Enter') { if (data[hi]) pick(data[hi].symbol); else if (text.trim()) pick(text.trim()) }
            else if (e.key === 'Escape') setOpen(false)
          }}
          placeholder="Search stocks, e.g. Reliance or AAPL"
          role="combobox" aria-expanded={open && data.length > 0} aria-controls="search-results"
          className="w-full bg-transparent text-sm outline-none placeholder:text-fg-3"
        />
        <kbd className="num hidden rounded border border-line-2 px-1.5 text-[10px] text-fg-3 sm:block">/</kbd>
      </label>
      {open && q && (
        <ul id="search-results" role="listbox" className="absolute z-40 mt-1 w-full overflow-hidden rounded-md border border-line-2 bg-panel py-1 shadow-2xl shadow-black/60">
          {data.length === 0 && (
            <li className="px-3 py-2.5 text-sm text-fg-2">
              {isFetching ? 'Searching…' : <>No matches. Press Enter to open <b className="num text-fg">{text.toUpperCase()}</b>.</>}
            </li>
          )}
          {data.map((r, i) => (
            <li key={r.symbol} role="option" aria-selected={i === hi}>
              <button onMouseEnter={() => setHi(i)} onClick={() => pick(r.symbol)}
                className={`grid w-full grid-cols-[6.5rem_1fr_auto] items-baseline gap-3 px-3 py-2 text-left text-sm ${i === hi ? 'bg-raised' : ''}`}>
                <span className="num truncate font-semibold text-fg">{r.symbol}</span>
                <span className="truncate text-fg-2">{r.name}</span>
                <span className="text-[11px] text-fg-3">{r.exchange}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
