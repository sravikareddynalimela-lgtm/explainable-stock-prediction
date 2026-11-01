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
      <label className="flex items-center gap-2 rounded-xl bg-sheet px-3 py-2 ring-1 ring-rule focus-within:ring-2 focus-within:ring-why">
        <SearchIcon className="h-4 w-4 text-ink-3" aria-hidden />
        <span className="sr-only">Search stocks</span>
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setOpen(true)
            setHi(0)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') setHi((h) => Math.min(h + 1, data.length - 1))
            else if (e.key === 'ArrowUp') setHi((h) => Math.max(h - 1, 0))
            else if (e.key === 'Enter') {
              if (data[hi]) pick(data[hi].symbol)
              else if (text.trim()) pick(text.trim())
            } else if (e.key === 'Escape') setOpen(false)
          }}
          placeholder={window.innerWidth < 640 ? "Search stocks" : "Search any stock, e.g. Tesla or INFY.NS"}
          role="combobox"
          aria-expanded={open && data.length > 0}
          aria-controls="search-results"
          className="w-full bg-transparent text-[15px] outline-none placeholder:text-ink-3"
        />
        <kbd className="hidden rounded border border-rule px-1.5 text-xs text-ink-3 sm:block">/</kbd>
      </label>
      {open && q && (
        <ul id="search-results" role="listbox" className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl bg-sheet py-1 shadow-[0_12px_32px_-8px_rgba(19,33,58,0.25)] ring-1 ring-rule">
          {data.length === 0 && (
            <li className="px-4 py-3 text-sm text-ink-2">
              {isFetching ? 'Searching…' : <>No matches. Press Enter to open <b>{text.toUpperCase()}</b> anyway.</>}
            </li>
          )}
          {data.map((r, i) => (
            <li key={r.symbol} role="option" aria-selected={i === hi}>
              <button
                onMouseEnter={() => setHi(i)}
                onClick={() => pick(r.symbol)}
                className={`flex w-full items-baseline justify-between gap-3 px-4 py-2 text-left ${i === hi ? 'bg-grid' : ''}`}
              >
                <span className="min-w-0">
                  <span className="font-semibold">{r.symbol}</span>
                  <span className="ml-2 truncate text-sm text-ink-2">{r.name}</span>
                </span>
                <span className="shrink-0 text-xs text-ink-3">{r.exchange}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
