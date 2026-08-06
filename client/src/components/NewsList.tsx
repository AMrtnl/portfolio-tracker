import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { SectionHead } from '@/components/ui/data'
import { PanelUnavailable, SkeletonBlock } from '@/components/ui/states'
import { useNews, warningText } from '@/hooks/useAnalytics'
import { cn, relativeTime } from '@/lib/utils'

/**
 * News, filtered to things you own.
 *
 * Lightyear's news list is the shape worth copying: the tickers the story
 * touches sit above the headline as small chips, the publisher and age sit
 * below it, and the headline itself is the only large type. Yahoo Finance
 * and Fidelity both put publisher above headline instead — that reads as a
 * press wire; putting the symbols first answers "why am I being shown
 * this" before you read the words.
 *
 * No thumbnails. The API doesn't return images, and inventing a grey box
 * per row would add noise for nothing.
 */
export function NewsList({
  headingId,
  symbol,
  limit = 12,
  title = 'In the news',
}: {
  headingId: string
  /** Restricts the feed to one holding's coverage. */
  symbol?: string
  limit?: number
  title?: string
}) {
  const { data, isLoading, error, refetch } = useNews(limit, symbol)
  const articles = data?.articles ?? []
  const warnings = warningText(data?.warnings)

  return (
    <section aria-labelledby={headingId}>
      <SectionHead
        id={headingId}
        title={title}
        caption={
          symbol
            ? `Recent coverage mentioning ${symbol}.`
            : 'Stories mentioning the symbols in your portfolio.'
        }
      />

      {isLoading ? (
        <ul className="list-none space-y-4 border-y border-border/60 py-4 p-0" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="space-y-2">
              <SkeletonBlock className="h-2.5 w-16" />
              <SkeletonBlock className="h-4 w-11/12" />
              <SkeletonBlock className="h-2.5 w-32" />
            </li>
          ))}
        </ul>
      ) : error ? (
        <PanelUnavailable what="Market news" onRetry={() => refetch()} />
      ) : articles.length === 0 ? (
        <p className="border-y border-border/60 py-6 text-sm text-muted-foreground">
          No recent stories mention your holdings.
        </p>
      ) : (
        <ul className="list-none border-y border-border/60 p-0">
          {articles.map((article, i) => (
            <li
              key={`${article.link}-${i}`}
              className="animate-rise border-b border-border/40 last:border-0"
              style={{ animationDelay: `${30 + i * 25}ms` }}
            >
              <article className="row-hover -mx-2 rounded-md px-2 py-3.5">
                {article.symbols && article.symbols.length > 0 && (
                  <p className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                    {article.symbols.slice(0, 4).map((sym) => (
                      <Link
                        key={sym}
                        to={`/holdings/${encodeURIComponent(sym)}`}
                        className="num text-[0.6875rem] font-semibold text-primary underline-offset-2 hover:underline"
                      >
                        {sym}
                      </Link>
                    ))}
                    {article.symbols.length > 4 && (
                      <span className="num text-[0.6875rem] text-muted-foreground">
                        +{article.symbols.length - 4}
                      </span>
                    )}
                  </p>
                )}

                <h3 className="text-pretty text-[0.9375rem] font-medium leading-snug">
                  <a
                    href={article.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline items-baseline rounded"
                  >
                    {article.title}
                    <ArrowUpRight
                      aria-hidden
                      className={cn(
                        'ml-1 inline h-3 w-3 shrink-0 -translate-y-px text-muted-foreground',
                        'transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5',
                      )}
                    />
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </h3>

                <p className="t-meta mt-1.5">
                  {article.publisher || 'Unknown source'}
                  {article.publishedAt && (
                    <>
                      {' · '}
                      <time dateTime={article.publishedAt}>
                        {relativeTime(article.publishedAt)}
                      </time>
                    </>
                  )}
                </p>
              </article>
            </li>
          ))}
        </ul>
      )}

      {warnings.length > 0 && (
        <ul className="t-meta mt-3 list-none space-y-1 p-0">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
    </section>
  )
}
