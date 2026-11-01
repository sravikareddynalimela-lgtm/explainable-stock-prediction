import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { timeAgo } from '../lib/format'

export function News({ symbol }: { symbol: string }) {
  const { data, isLoading } = useQuery({ queryKey: ['news', symbol], queryFn: () => api.news(symbol), refetchInterval: 10 * 60_000 })
  return (
    <section aria-labelledby="news-h">
      <h2 id="news-h" className="text-xl font-semibold tracking-tight">Latest headlines</h2>
      {isLoading ? (
        <div className="mt-4 space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-grid" />)}</div>
      ) : !data?.length ? (
        <p className="mt-3 text-sm text-ink-2">No recent headlines for {symbol}.</p>
      ) : (
        <ul className="mt-3 divide-y divide-rule">
          {data.slice(0, 8).map((n) => (
            <li key={n.url}>
              <a href={n.url} target="_blank" rel="noreferrer" className="group flex gap-4 py-3">
                {n.thumbnail && <img src={n.thumbnail} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-md object-cover" />}
                <div className="min-w-0">
                  <p className="font-medium leading-snug group-hover:underline">{n.title}</p>
                  <p className="mt-1 text-xs text-ink-3">{n.publisher}{n.publishedAt ? `, ${timeAgo(n.publishedAt)}` : ''}</p>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
