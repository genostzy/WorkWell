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

export function Shell({
  children,
  current,
}: {
  children: React.ReactNode
  current?: 'home' | 'check-in' | 'trends'
}) {
  return (
    <div className="shell">
      <header className="topbar">
        <Link href="/" className="brand">
          WorkWell
        </Link>
        <nav className="nav">
          <Link href="/" aria-current={current === 'home' ? 'page' : undefined}>
            Home
          </Link>
          <Link
            href="/check-in"
            aria-current={current === 'check-in' ? 'page' : undefined}
          >
            Check in
          </Link>
          <Link
            href="/trends"
            aria-current={current === 'trends' ? 'page' : undefined}
          >
            Trends
          </Link>
        </nav>
      </header>
      <main>{children}</main>
    </div>
  )
}
