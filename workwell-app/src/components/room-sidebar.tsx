'use client'

import { useRouter, usePathname } from 'next/navigation'
import { Brandmark } from '@/components/brandmark'
import { initialsOf } from '@/components/office'

type Spot = {
  id: string
  href?: string
  label: string
  sub: string
}

/** Private-space items — only the employee sees these. */
const PRIVATE_SPOTS: Spot[] = [
  { id: 'desk', href: '/trends', label: 'Your desk', sub: 'Trends' },
  { id: 'journal', href: '/check-in', label: 'Journal', sub: 'Check in' },
  { id: 'cooler', href: '/nudges', label: 'Water cooler', sub: 'Nudges' },
  { id: 'clock', href: '/boundaries', label: 'The clock', sub: '' },
  { id: 'lounge', href: '/recognition', label: 'The sofa', sub: 'Recognition' },
  { id: 'shelf', href: '/workspace', label: 'Your shelf', sub: 'Workspace' },
]

/** Workplace items — self-service, private-plane accounts only. An HR/admin
 *  account never has these: it has no employment record of its own to see. */
const WORK_SPOTS: Spot[] = [
  { id: 'holidays', href: '/holidays', label: 'Holidays', sub: 'Calendar' },
  { id: 'attendance', href: '/attendance', label: 'Attendance', sub: 'Check-ins' },
  { id: 'payroll', href: '/payroll', label: 'Payroll', sub: 'Payslips' },
  { id: 'expenses', href: '/expenses', label: 'Expenses', sub: 'Claims' },
  { id: 'assets', href: '/assets', label: 'Assets', sub: 'On loan' },
  { id: 'company-policies', href: '/company-policies', label: 'Policies', sub: 'Read once' },
  { id: 'news', href: '/news', label: 'News', sub: 'Notices' },
  { id: 'complaints', href: '/complaints', label: 'Complaints', sub: 'File a case' },
  { id: 'resignations', href: '/resignations', label: 'Resignations', sub: 'Give notice' },
]

/** Administration — the whole of the HR/admin account's plane. There is no
 *  locked state here: every other tile a private-plane account might see
 *  locked, this list simply never renders for them at all. */
const ADMIN_SPOTS: Spot[] = [
  { id: 'org', href: '/org', label: 'Structural load', sub: 'Anonymous patterns' },
  { id: 'hr', href: '/hr', label: 'People', sub: 'Employment records' },
  { id: 'accounts', href: '/hr/accounts', label: 'Accounts', sub: 'Access & sign-in' },
  { id: 'decisions', href: '/hr/decisions', label: 'Decisions', sub: 'Audit trail' },
  { id: 'letter-heads', href: '/letter-heads', label: 'Letter heads', sub: 'Templates' },
  { id: 'custom-fields', href: '/custom-fields', label: 'Data fields', sub: 'Extra fields' },
  { id: 'offboarding', href: '/offboarding', label: 'Offboarding', sub: 'Checklist' },
  { id: 'warnings', href: '/warnings', label: 'Warnings', sub: 'Records' },
]

function SidebarTile({
  spot,
  active,
  index,
  onClick,
}: {
  spot: Spot
  active: boolean
  index: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className="sidebar-tile"
      aria-current={active ? 'page' : undefined}
      style={{ animationDelay: `${index * 30}ms` }}
      onClick={onClick}
    >
      <span className="sidebar-tile__label">{spot.label}</span>
      <span className="sidebar-tile__sub">{spot.sub}</span>
    </button>
  )
}

export function RoomSidebar({
  isHr,
  name,
  initials,
  colour = 'accent',
}: {
  isHr: boolean
  name: string
  initials?: string | null
  colour?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const displayInitials = initials?.trim() || initialsOf(name)

  // Two account kinds now, not two planes on one account: HR/admin has the
  // administration list and nothing else; everyone else has their own space
  // and the self-service list, and never sees administration at all.
  const spots = isHr ? ADMIN_SPOTS : WORK_SPOTS

  return (
    <aside className="room-sidebar" aria-label={isHr ? 'The admin dashboard, and where to go' : 'Your space, and where to go'}>
      <div className="sidebar-inner">
        {/* Brand */}
        <div className="sidebar-brand">
          <span className="sidebar-brand__mark">
            <Brandmark size={30} />
          </span>
          <span className="sidebar-brand__text">
            WorkWell
            <br />
            <span className="sidebar-brand__sub">by AxionHR</span>
          </span>
        </div>

        {/* Avatar — for a private-plane account, a link to Leave & profile.
            HR/admin has no employment record of its own for that page to
            show, so its avatar is a plain label, not a dead link. */}
        {isHr ? (
          <div className="sidebar-avatar">
            <div className="sidebar-avatar__circle" data-avatar-colour={colour}>
              <span className="sidebar-avatar__initials">{displayInitials}</span>
            </div>
            <span className="sidebar-avatar__name">{name}</span>
          </div>
        ) : (
          <button
            type="button"
            className="sidebar-avatar"
            onClick={() => router.push('/leave')}
          >
            <div className="sidebar-avatar__circle" data-avatar-colour={colour}>
              <span className="sidebar-avatar__initials">{displayInitials}</span>
            </div>
            <span className="sidebar-avatar__name">{name}</span>
          </button>
        )}

        <div className="sidebar-divider" />

        {!isHr && (
          <>
            <div className="sidebar-section">
              <span className="sidebar-section__label">Your space</span>
            </div>
            <nav className="sidebar-nav" aria-label="Personal navigation">
              {PRIVATE_SPOTS.map((s, i) => (
                <SidebarTile
                  key={s.id}
                  spot={s}
                  active={pathname === s.href}
                  index={i}
                  onClick={() => { if (s.href) router.push(s.href) }}
                />
              ))}
            </nav>
            <div className="sidebar-divider" />
          </>
        )}

        <div className="sidebar-section">
          <span className="sidebar-section__label">{isHr ? 'Administration' : 'Workplace'}</span>
        </div>
        <nav className="sidebar-nav" aria-label={isHr ? 'Administration navigation' : 'Workplace navigation'}>
          {spots.map((s, i) => (
            <SidebarTile
              key={s.id}
              spot={s}
              active={pathname === s.href}
              index={i}
              onClick={() => { if (s.href) router.push(s.href) }}
            />
          ))}
        </nav>

        {/* Footer */}
        <div className="sidebar-divider" />
        <div className="sidebar-foot">
          <span className="sidebar-foot__text">WorkWell &middot; Healthy You</span>
        </div>
      </div>
    </aside>
  )
}
