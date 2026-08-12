import { Shell, type Page, type Plane } from '@/components/chrome'

/**
 * What a screen looks like while its data is still in flight.
 *
 * Every screen here is server-rendered and does its own reads before it can
 * return anything, so the browser sits on the previous page with no sign
 * that a click registered. Next renders the nearest loading.tsx the instant
 * a navigation starts, which turns that dead air into a screen that is
 * visibly arriving.
 *
 * It deliberately mirrors the real layout — head, badge, then cards — so
 * the page settles into place rather than replacing itself.
 */
export function ScreenSkeleton({
  current,
  plane = 'private',
  cards = 2,
}: {
  current?: Page
  plane?: Plane
  cards?: number
}) {
  return (
    <Shell current={current} plane={plane}>
      <div className="page-head">
        <div className="skel skel--title" />
        <div className="skel skel--text" style={{ maxWidth: '38ch' }} />
      </div>

      {Array.from({ length: cards }).map((_, i) => (
        <div className="card" key={i}>
          <div className="skel skel--title" />
          <div className="skel skel--text" />
          <div className="skel skel--text" style={{ maxWidth: '24ch' }} />
        </div>
      ))}

      {/* Announced once, not per bar: a screen reader should hear that the
          page is loading, not hear six placeholder shapes described. */}
      <p className="sr-only" role="status">
        Loading…
      </p>
    </Shell>
  )
}
