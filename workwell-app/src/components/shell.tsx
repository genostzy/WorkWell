import Link from 'next/link'
import { Suspense } from 'react'
import { SignOut } from '@/components/sign-out'
import { Brandmark } from '@/components/brandmark'
import { RoomSidebar } from '@/components/room-sidebar'
import { Notifications } from '@/components/notifications'
import { createClient } from '@/lib/supabase/server'
import { BADGE, type Page, type Plane } from '@/components/chrome'

const TITLES: Record<Page, string> = {
  home: 'The office',
  'check-in': 'Daily check-in',
  trends: 'Your trends',
  leave: 'Leave & profile',
  hr: 'People',
  org: 'Structural load',
}

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
    <div className="app app--room" data-plane={plane}>
      <Suspense fallback={<aside className="room-sidebar" aria-hidden="true" />}>
        <RoomSidebarData />
      </Suspense>

      <div className="main">
        <header className="topbar">
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
            <Notifications />
            <span
              className={plane === 'org' ? 'chip' : 'chip chip--accent'}
              title={badge.sub}
            >
              {badge.icon} {badge.label}
            </span>
            <SignOut compact />
          </div>
        </header>

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
