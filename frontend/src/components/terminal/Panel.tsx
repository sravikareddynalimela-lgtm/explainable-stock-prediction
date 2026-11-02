import type { ReactNode } from 'react'

/** A terminal panel. `fkey` shows the keyboard shortcut that jumps to this section. */
export function Panel({ id, fkey, title, meta, children, className = '', bodyClass = '' }: {
  id?: string
  fkey?: string
  title: ReactNode
  meta?: ReactNode
  children: ReactNode
  className?: string
  bodyClass?: string
}) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-h` : undefined} className={`scroll-mt-28 overflow-hidden rounded-sm border border-line bg-panel ${className}`}>
      <header className="flex h-9 items-center gap-2 border-b border-line px-3">
        {fkey && (
          <kbd className="num grid h-[18px] min-w-[18px] place-items-center rounded-sm bg-brand px-1 text-[10px] font-bold text-on-brand" title={`Press ${fkey} to jump here`}>
            {fkey}
          </kbd>
        )}
        <h2 id={id ? `${id}-h` : undefined} className="truncate text-[13px] font-semibold tracking-tight">{title}</h2>
        {meta && <div className="ml-auto flex shrink-0 items-center gap-3 text-xs text-fg-3">{meta}</div>}
      </header>
      <div className={bodyClass}>{children}</div>
    </section>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-4 py-6 text-sm text-fg-2">{children}</p>
}

export function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }, (_, i) => <div key={i} className="h-6 animate-pulse rounded-sm bg-raised" />)}
    </div>
  )
}
