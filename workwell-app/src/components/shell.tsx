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

const TITLES: Record<Page, string> = {
  home: 'The office',
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
}: {
  children: React.ReactNode
  current?: Page
  plane?: Plane
}) {
  const badge = BADGE[plane]

  return (
    <div className="app" data-plane={plane}>
      <Suspense fallback={<aside className="room-sidebar" aria-hidden="true" />}>
        <RoomSidebarData />
      </Suspense>

      <div className="main">
        <header className="topbar">
          {/* The mark is the way back. It was already a link to the office,
              but nothing about it said so — a logo in the top-left is read
              as a logo, and people looked for a back button instead. The
              chevron is what turns it into one. */}
          <Link className="topbar__home" href="/" aria-label="Back to the office">
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
            <span className="topbar__backword">The office</span>
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
