'use client'

import { useRouter, usePathname } from 'next/navigation'
import { Brandmark } from '@/components/brandmark'
import { initialsOf } from '@/components/office'

type Spot = {
  id: string
  href?: string
  label: string
  sub: string
  hrOnly?: boolean
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

/** Workplace items — visible to everyone, some HR-only. */
const WORK_SPOTS: Spot[] = [
  { id: 'meeting', href: '/org', label: 'Meeting room', sub: 'Structural load', hrOnly: true },
  { id: 'files', href: '/hr', label: 'HR office', sub: 'People & records', hrOnly: true },
  { id: 'holidays', href: '/holidays', label: 'Holidays', sub: 'Calendar' },
  { id: 'attendance', href: '/attendance', label: 'Attendance', sub: 'Check-ins' },
  { id: 'payroll', href: '/payroll', label: 'Payroll', sub: 'Payslips' },
  { id: 'expenses', href: '/expenses', label: 'Expenses', sub: 'Claims' },
  { id: 'assets', href: '/assets', label: 'Assets', sub: 'On loan' },
  { id: 'letter-heads', href: '/letter-heads', label: 'Letter heads', sub: 'Templates', hrOnly: true },
  { id: 'company-policies', href: '/company-policies', label: 'Policies', sub: 'Read once' },
  { id: 'custom-fields', href: '/custom-fields', label: 'Data fields', sub: 'Extra fields', hrOnly: true },
  { id: 'news', href: '/news', label: 'News', sub: 'Notices' },
  { id: 'complaints', href: '/complaints', label: 'Complaints', sub: 'File a case' },
  { id: 'resignations', href: '/resignations', label: 'Resignations', sub: 'Give notice' },
  { id: 'offboarding', href: '/offboarding', label: 'Offboarding', sub: 'Checklist', hrOnly: true },
  { id: 'warnings', href: '/warnings', label: 'Warnings', sub: 'Records', hrOnly: true },
]

function SidebarTile({
  spot,
  active,
  locked,
  index,
  onClick,
}: {
  spot: Spot
  active: boolean
  locked: boolean
  index: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`sidebar-tile${locked ? ' sidebar-tile--locked' : ''}`}
      disabled={locked}
      aria-current={active ? 'page' : undefined}
      style={{ animationDelay: `${index * 30}ms` }}
      onClick={onClick}
    >
      <span className="sidebar-tile__label">{spot.label}</span>
      <span className="sidebar-tile__sub">{locked ? 'HR only' : spot.sub}</span>
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

  return (
    <aside className="room-sidebar" aria-label="The office, and where to go">
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

        {/* Avatar — clickable, goes to Leave & profile */}
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

        <div className="sidebar-divider" />

        {/* Private section — an HR leader is an employee too, and their own
            check-ins are as unreadable to their employer as anyone else's,
            so this stays visible regardless of role. */}
        <div className="sidebar-section">
          <span className="sidebar-section__label">Your space</span>
        </div>
        <nav className="sidebar-nav" aria-label="Personal navigation">
          {PRIVATE_SPOTS.map((s, i) => (
            <SidebarTile
              key={s.id}
              spot={s}
              active={pathname === s.href}
              locked={false}
              index={i}
              onClick={() => { if (s.href) router.push(s.href) }}
            />
          ))}
        </nav>
        <div className="sidebar-divider" />

        {/* Workplace section — hrOnly destinations stay in the list and show
            locked rather than disappearing, matching room.js's own spots. */}
        <div className="sidebar-section">
          <span className="sidebar-section__label">Workplace</span>
        </div>
        <nav className="sidebar-nav" aria-label="Workplace navigation">
          {WORK_SPOTS.map((s, i) => {
            const locked = !!s.hrOnly && !isHr
            return (
              <SidebarTile
                key={s.id}
                spot={s}
                active={pathname === s.href}
                locked={locked}
                index={i}
                onClick={() => {
                  if (locked) return
                  if (s.href) router.push(s.href)
                }}
              />
            )
          })}
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
