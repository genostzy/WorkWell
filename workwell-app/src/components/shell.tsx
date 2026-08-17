import Link from 'next/link'
import { Suspense } from 'react'
import { SignOut } from '@/components/sign-out'
import { Brandmark } from '@/components/brandmark'
import { RoomSidebar } from '@/components/room-sidebar'
import { createClient } from '@/lib/supabase/server'
import { BADGE, type Page, type Plane } from '@/components/chrome'

/**
 * Reads the database — for the room sidebar's account data — which is why
 * this file is separate from chrome.tsx. Several screens (check-in, nudges,
 * recognition, boundaries, workspace) are fully client-rendered and import
 * PageHead and friends from chrome.tsx directly; if Shell lived there too,
 * their build would try to pull this file's `next/headers` usage into the
 * browser bundle and fail. Import Shell only from a page.tsx.
 */

/** 'home' is deliberately absent — its title depends on isHr, handled
 *  inline below rather than duplicated here. */
const TITLES: Record<Exclude<Page, 'home'>, string> = {
  'check-in': 'Daily check-in',
  trends: 'Your trends',
  leave: 'Leave & profile',
  hr: 'People',
  org: 'Structural load',
}

/**
 * Fetches what the sidebar room needs and renders it, isolated behind its
 * own Suspense boundary so a slow read here never holds up the rest of the
 * screen — Shell itself stays synchronous, which is what lets loading.tsx's
 * skeleton keep appearing instantly on navigation.
 *
 * Nothing is rendered for an account with no active person behind it (a
 * signed-in auth user waiting on HR, or a closed account) — there is no one
 * for the room to represent, and `.app` only reserves the sidebar column
 * when a `.room-sidebar` actually exists, so those screens just stay full
 * width rather than showing a hollow column.
 */
async function RoomSidebarData() {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  if (!claims) return null

  const [{ data: me }, { data: roles }, { data: profile }] = await Promise.all([
    supabase.from('me').select('full_name, status').maybeSingle(),
    supabase.from('person_roles').select('role'),
    supabase
      .from('profile')
      .select('preferred_name, avatar_initials, avatar_colour')
      .maybeSingle(),
  ])

  if (!me || me.status === 'left') return null

  return (
    <RoomSidebar
      isHr={(roles ?? []).some((r) => r.role === 'hr')}
      name={profile?.preferred_name || me.full_name}
      initials={profile?.avatar_initials ?? null}
      colour={profile?.avatar_colour ?? 'accent'}
    />
  )
}

/**
 * The shell for every screen that is not the office itself.
 *
 * The office room now rides along on the left of every one of these too —
 * the same picture, scaled down, doubling as navigation the whole time
 * rather than only when you go back to it. The floating hub button still
 * carries that job on narrow screens, where the room does not fit.
 */
export function Shell({
  children,
  current,
  plane = 'private',
  isHr = false,
}: {
  children: React.ReactNode
  current?: Page
  plane?: Plane
  /** Swaps the "back to the office" chrome for "back to the dashboard" —
   *  an HR/admin account has no office, only the administration screens. */
  isHr?: boolean
}) {
  const badge = BADGE[plane]

  return (
    <div className="app app--room" data-plane={plane}>
      <Suspense
        fallback={
          <aside className="room-sidebar" aria-hidden="true">
            <div className="sidebar-inner">
              <div className="sidebar-brand">
                <div className="skel" style={{ width: 30, height: 30, borderRadius: 'var(--r-xs)' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div className="skel skel--title" style={{ width: 80 }} />
                  <div className="skel skel--text" style={{ width: 60 }} />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 'var(--s-2)', gap: 6 }}>
                <div className="skel" style={{ width: 48, height: 48, borderRadius: '50%' }} />
                <div className="skel skel--text" style={{ width: 72 }} />
              </div>
              <div className="skel" style={{ height: 1, margin: 'var(--s-2) var(--s-2)' }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, padding: '0 var(--s-3)' }}>
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="skel" style={{ height: 52, borderRadius: 'var(--r-sm)' }} />
                ))}
              </div>
            </div>
          </aside>
        }
      >
        <RoomSidebarData />
      </Suspense>

      <div className="main">
        <header className="topbar">
          {/* The mark is the way back — except on the dashboard itself,
              where "back" has nowhere to go, same as the office never
              needed one on its own home screen. */}
          {current === 'home' ? (
            <span className="topbar__home topbar__home--static">
              <span className="sidebar__mark">
                <Brandmark size={28} />
              </span>
            </span>
          ) : (
            <Link
              className="topbar__home"
              href="/"
              aria-label={isHr ? 'Back to the dashboard' : 'Back to the office'}
            >
              <svg
                className="topbar__back"
                viewBox="0 0 24 24"
                width="17"
                height="17"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m15 6-6 6 6 6" />
              </svg>
              <span className="sidebar__mark">
                <Brandmark size={28} />
              </span>
              <span className="topbar__backword">{isHr ? 'Dashboard' : 'The office'}</span>
            </Link>
          )}
          <span className="topbar__title">
            {current === 'home'
              ? isHr ? 'Administration' : 'The office'
              : current
                ? TITLES[current]
                : 'WorkWell'}
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
          {isHr ? '📋' : '🏠'}
        </span>
        {isHr ? 'Dashboard' : 'The office'}
      </Link>
    </div>
  )
}
