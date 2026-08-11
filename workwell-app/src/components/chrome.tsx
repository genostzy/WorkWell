import Link from 'next/link'

export type Page = 'home' | 'check-in' | 'trends' | 'leave' | 'hr' | 'org'

/** Which plane a screen belongs to. This drives the accent — teal-green for
 *  the employee's own data, terracotta for anything the employer sees — and
 *  the badge below. The prototype validated that pair for colour-vision
 *  separation, which is why plane identity is never carried by colour
 *  alone: there is always an icon and a sentence too. */
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

const LINKS: { href: string; label: string; id: Page }[] = [
  { href: '/', label: 'Home', id: 'home' },
  { href: '/check-in', label: 'Check in', id: 'check-in' },
  { href: '/trends', label: 'Trends', id: 'trends' },
  { href: '/leave', label: 'Leave', id: 'leave' },
]

/** HR links are shown only to HR. Presentation, not protection — the pages
 *  gate on the role and RLS gates the data. Hiding them just stops an
 *  employee clicking into a wall. */
const HR_LINKS: { href: string; label: string; id: Page }[] = [
  { href: '/hr', label: 'People', id: 'hr' },
  { href: '/org', label: 'Org', id: 'org' },
]

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
 *  reading it, so detail sits behind a disclosure. */
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

export function Shell({
  children,
  current,
  plane = 'private',
  isHr = false,
}: {
  children: React.ReactNode
  current?: Page
  plane?: Plane
  isHr?: boolean
}) {
  const links = isHr ? [...LINKS, ...HR_LINKS] : LINKS

  return (
    <div className="app" data-plane={plane}>
      <header className="topbar">
        <Link href="/" className="topbar__brand">
          <span aria-hidden="true">🌿</span> WorkWell
        </Link>
        <div className="topbar__spacer" />
        <nav className="topbar__nav" aria-label="Sections">
          {links.map((l) => (
            <Link
              key={l.id}
              href={l.href}
              aria-current={current === l.id ? 'page' : undefined}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </header>

      <div className="main">
        <main className="content">{children}</main>
      </div>
    </div>
  )
}

export function PageHead({
  title,
  lead,
}: {
  title: string
  lead?: string
}) {
  return (
    <div className="page-head">
      <h1>{title}</h1>
      {lead && <p className="t-lead">{lead}</p>}
    </div>
  )
}
