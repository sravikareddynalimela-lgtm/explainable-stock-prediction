import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { timeAgo } from '../lib/format'

export function News({ symbol }: { symbol: string }) {
  const { data, isLoading } = useQuery({ queryKey: ['news', symbol], queryFn: () => api.news(symbol), refetchInterval: 10 * 60_000 })
  return (
    <section aria-label="Headlines" className="px-4 pb-2">
      {isLoading ? (
        <div className="space-y-3 py-4">{[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-sm bg-raised" />)}</div>
      ) : !data?.length ? (
        <p className="py-4 text-sm text-fg-2">No recent headlines for {symbol}.</p>
      ) : (
        <ul className="divide-y divide-line">
          {data.slice(0, 8).map((n) => (
            <li key={n.url}>
              <a href={n.url} target="_blank" rel="noreferrer" className="group flex gap-4 py-3">
                {n.thumbnail && <img src={n.thumbnail} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-sm object-cover" />}
                <div className="min-w-0">
                  <p className="font-medium leading-snug group-hover:underline">{n.title}</p>
                  <p className="mt-1 text-xs text-fg-3">{n.publisher}{n.publishedAt ? `, ${timeAgo(n.publishedAt)}` : ''}</p>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
