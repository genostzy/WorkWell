'use client'

/**
 * Shadcn-style skeleton for the content area only.
 * Used inside the (app) loading.tsx — the Shell persists across navigations.
 */
export function ContentSkeleton({ cards = 2 }: { cards?: number }) {
  return (
    <div className="content-skeleton" aria-hidden="true">
      <div className="page-head">
        <div className="skel skel--title" style={{ width: '35%', height: 24 }} />
        <div className="skel skel--text" style={{ maxWidth: '42ch', marginTop: 8 }} />
      </div>

      <div className="skel-card-group">
        {Array.from({ length: cards }).map((_, i) => (
          <div className="skel-card" key={i} style={{ animationDelay: `${i * 80}ms` }}>
            <div className="skel-card__header">
              <div className="skel skel--title" style={{ width: '40%' }} />
              <div className="skel" style={{ width: 64, height: 22, borderRadius: 99 }} />
            </div>
            <div className="skel-card__body">
              <div className="skel skel--line" />
              <div className="skel skel--line w-70" />
              <div className="skel skel--line w-50" />
            </div>
          </div>
        ))}
      </div>

      <p className="sr-only" role="status">Loading…</p>
    </div>
  )
}
