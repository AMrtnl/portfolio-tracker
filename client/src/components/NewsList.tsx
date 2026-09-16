import { useNews } from '@/hooks/useAnalytics'
import { relativeTime } from '@/lib/utils'

/**
 * News filtered to things you own. Symbols, publisher, and age sit above
 * the headline as one quiet line; the headline is the only large type.
 */
export function NewsList({
  symbol,
  limit = 8,
  title = 'In the news',
}: {
  symbol?: string
  limit?: number
  title?: string
}) {
  const { data, isLoading, isError, refetch } = useNews(limit, symbol)
  const articles = data?.articles ?? []

  return (
    <>
      <div className="a-header">{title}</div>
      <section className="a-gcard pad" aria-label={title}>
        {isLoading ? (
          <div aria-hidden style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 8 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span className="ui-skel" style={{ width: 90, height: 9, borderRadius: 5 }} />
                <span className="ui-skel" style={{ width: '92%', height: 13, borderRadius: 6 }} />
              </div>
            ))}
          </div>
        ) : isError ? (
          <div style={{ padding: '4px 4px 8px' }}>
            <p className="a-insnote spaced">Market news could not be loaded.</p>
            <button type="button" className="a-more" onClick={() => refetch()}>
              Try again
            </button>
          </div>
        ) : articles.length === 0 ? (
          <p className="a-insnote spaced" style={{ paddingBottom: 12 }}>
            {symbol
              ? `No recent stories mention ${symbol}.`
              : 'No recent stories mention your holdings.'}
          </p>
        ) : (
          articles.map((a, i) => (
            <a
              key={`${a.link}-${i}`}
              className="a-newsrow"
              href={a.link}
              target="_blank"
              rel="noopener noreferrer"
            >
              <em>
                {[
                  (a.symbols ?? []).slice(0, 3).join(' · '),
                  a.publisher,
                  a.publishedAt ? relativeTime(a.publishedAt) : undefined,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </em>
              <b>{a.title}</b>
            </a>
          ))
        )}
      </section>
    </>
  )
}
