import Link from 'next/link'

export type Tab = {
  /** Also the `?tab=` value. Absent from the URL for the first tab, which
   *  keeps the merged page's canonical address the plain path. */
  id: string
  label: string
}

/**
 * Sections of one page, addressed by URL rather than held in state.
 *
 * These are links, not a scripted tablist. Everything they switch between
 * is already a server component that reads the database, so making them
 * client-side would mean shipping and re-fetching all of it up front to
 * avoid a navigation Next already makes instant. It also means every
 * section keeps an address: the room can point two pieces of furniture at
 * two tabs of the same page, a notification can deep-link the tab it is
 * about, and the back button does what it looks like it does.
 *
 * Marked with aria-current rather than the tab/tablist roles for the same
 * reason — those describe panels swapped in place without navigating, and
 * claiming them for links tells a screen reader something untrue.
 *
 * Sits above each section rather than replacing its heading: every one of
 * these sections was a whole page an hour ago and still carries its own
 * title, privacy note and error states. Merging the routes is the point;
 * rewriting twelve working screens to do it is not.
 */
export function PageTabs({
  tabs,
  active,
  basePath,
}: {
  tabs: Tab[]
  active: string
  basePath: string
}) {
  // A single section is not a choice, and a strip of one tab is furniture
  // pretending to be navigation. HR and employees see different sections
  // here, so this is a real case, not a defensive one.
  if (tabs.length < 2) return null

  const current = tabs.find((t) => t.id === active) ?? tabs[0]

  return (
    <nav className="tabs" aria-label="Sections">
      {tabs.map((t, i) => (
        <Link
          key={t.id}
          href={i === 0 ? basePath : `${basePath}?tab=${t.id}`}
          className={t.id === current.id ? 'tabs__tab is-active' : 'tabs__tab'}
          aria-current={t.id === current.id ? 'page' : undefined}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  )
}

/**
 * Which section a request is asking for.
 *
 * An unknown or missing `?tab=` lands on the first one rather than on an
 * error: a stale bookmark to a tab that has since been renamed, or one a
 * different role cannot see, should open the page rather than refuse to.
 */
export function activeTab(tabs: Tab[], raw: string | string[] | undefined) {
  const asked = Array.isArray(raw) ? raw[0] : raw
  return tabs.find((t) => t.id === asked)?.id ?? tabs[0].id
}
