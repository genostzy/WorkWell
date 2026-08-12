import Link from 'next/link'
import { SignOut } from '@/components/sign-out'
import { Brandmark } from '@/components/brandmark'

export type Page = 'home' | 'check-in' | 'trends' | 'leave' | 'hr' | 'org'

/** Which plane a screen belongs to. Drives the accent — teal-green for the
 *  employee's own data, terracotta for anything the employer sees. The
 *  prototype validated that pair for colour-vision separation, which is
 *  also why plane identity is never carried by colour alone: there is
 *  always a chip, an icon and a sentence too. */
export type Plane = 'private' | 'work' | 'org'

const BADGE: Record<Plane, { icon: string; label: string; sub: string }> = {
  private: {
    icon: '🔒',
    label: 'Private plane',
    sub: 'Only you can see anything here. Your employer never can.',
  },
  work: {
    icon: '🏢',
    label: 'Work plane',
    sub: 'Employment data. HR sees this — and only this.',
  },
  org: {
    icon: '👥',
    label: 'Organisation plane',
    sub: 'Anonymous group patterns. Never a person.',
  },
}

export function PlaneBadge({ plane }: { plane: Plane }) {
  const b = BADGE[plane]
  return (
    <div className="plane-badge">
      <span aria-hidden="true">{b.icon}</span>
      <div>
        <div className="plane-badge__label">{b.label}</div>
        <div className="plane-badge__sub">{b.sub}</div>
      </div>
    </div>
  )
}

/** The privacy claim, stated once and briefly. The prototype learned that
 *  repeating it at paragraph length on every screen makes people stop
 *  reading it, so the detail sits behind a disclosure. */
export function PrivacyNote({
  children,
  detail,
  plane = 'private',
}: {
  children: React.ReactNode
  detail?: string
  plane?: Plane
}) {
  return (
    <div className="privacy-note mb-5">
      <span aria-hidden="true">{BADGE[plane].icon}</span>
      <span>
        {children}
        {detail && (
          <details style={{ display: 'inline' }}>
            <summary className="privacy-more">What this means</summary>
            <span className="privacy-detail">{detail}</span>
          </details>
        )}
      </span>
    </div>
  )
}

const TITLES: Record<Page, string> = {
  home: 'The office',
  'check-in': 'Daily check-in',
  trends: 'Your trends',
  leave: 'Leave & profile',
  hr: 'People',
  org: 'Structural load',
}

/**
 * The shell for every screen that is not the office itself.
 *
 * There is deliberately no nav bar. The office is the navigation surface,
 * so every screen carries a floating button back to it — the prototype's
 * pattern, and the reason the room is worth having at all.
 */
export function Shell({
  children,
  current,
  plane = 'private',
}: {
  children: React.ReactNode
  current?: Page
  plane?: Plane
}) {
  const badge = BADGE[plane]

  return (
    <div className="app" data-plane={plane}>
      <div className="main">
        <header className="topbar">
          <Link className="topbar__home" href="/" aria-label="Back to the office">
            <span className="sidebar__mark">
              <Brandmark size={28} />
            </span>
          </Link>
          <span className="topbar__title">
            {current ? TITLES[current] : 'WorkWell'}
          </span>
          <span className="topbar__spacer" />
          <div className="topbar__actions">
            <span
              className={plane === 'org' ? 'chip' : 'chip chip--accent'}
              title={badge.sub}
            >
              {badge.icon} {badge.label}
            </span>
            <SignOut compact />
          </div>
        </header>

        {/* Shown on narrow screens, where the chip alone is too quiet. */}
        <div className="plane-strip">
          <span aria-hidden="true">{badge.icon}</span>
          <span>{badge.sub}</span>
        </div>

        <main className="content">{children}</main>
      </div>

      <Link className="hub" href="/">
        <span className="hub__glyph" aria-hidden="true">
          🏠
        </span>
        The office
      </Link>
    </div>
  )
}

export function PageHead({ title, lead }: { title: string; lead?: string }) {
  return (
    <div className="page-head">
      <h1>{title}</h1>
      {lead && <p className="t-lead">{lead}</p>}
    </div>
  )
}
