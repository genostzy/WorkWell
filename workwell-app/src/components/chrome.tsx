import Link from 'next/link'

/** The plane badge. Every private-plane screen says whose data this is,
 *  because "can my employer see this?" is the most consequential question
 *  in the product and it should never require a guess. */
export function PrivacyNote() {
  return (
    <p className="privacy">
      <span aria-hidden="true">🔒</span>
      <span>
        <b>Only you can see this.</b> Your check-ins never reach your
        employer — not as a name, not as a number.
      </span>
    </p>
  )
}

type Page = 'home' | 'check-in' | 'trends' | 'leave' | 'hr' | 'org'

const LINKS: { href: string; label: string; id: Page }[] = [
  { href: '/', label: 'Home', id: 'home' },
  { href: '/check-in', label: 'Check in', id: 'check-in' },
  { href: '/trends', label: 'Trends', id: 'trends' },
  { href: '/leave', label: 'Leave', id: 'leave' },
]

/** HR links are shown only to HR. This is presentation, not protection —
 *  the pages themselves gate on the role and RLS gates the data. Hiding
 *  them just stops an employee clicking into a wall. */
const HR_LINKS: { href: string; label: string; id: Page }[] = [
  { href: '/hr', label: 'People', id: 'hr' },
  { href: '/org', label: 'Org', id: 'org' },
]

export function Shell({
  children,
  current,
  isHr = false,
}: {
  children: React.ReactNode
  current?: Page
  isHr?: boolean
}) {
  const links = isHr ? [...LINKS, ...HR_LINKS] : LINKS

  return (
    <div className="shell">
      <header className="topbar">
        <Link href="/" className="brand">
          WorkWell
        </Link>
        <nav className="nav">
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
      <main>{children}</main>
    </div>
  )
}
