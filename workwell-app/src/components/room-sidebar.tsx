'use client'

import Script from 'next/script'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { initialsOf } from '@/components/office'

/**
 * The office, always in view — drawn as its own compact layout rather than
 * a shrunk copy of the office screen's room, and in two parts.
 *
 * The top part is the room itself: the same seven personal stops the office
 * screen draws (desk, journal, water cooler, …) plus the meeting room and
 * HR office, built the same way — furniture with a name tag beneath it,
 * reusing room.css's classes so hover, focus and quiet-hours dimming all
 * work without any of that being redefined here. room.js stays untouched
 * on purpose (see office.tsx), so this does not reach for roomSVG() at
 * all; it borrows the classes, not the generator.
 *
 * Below it is a directory board — everything that is not a personal desk
 * or a floor-plan room in its own right (payroll, holidays, warnings, and
 * the rest of a full HR system's worth of destinations). Trying to draw
 * two dozen more pieces of furniture by hand, in coordinates nobody could
 * see rendered before shipping them, was the wrong place to spend that
 * risk — plain rows read perfectly well as a noticeboard on the same wall.
 */

type CompactSpot = { id: string; href: string; label: string; sub: string }

const SPOTS: CompactSpot[] = [
  { id: 'desk', href: '/trends', label: 'Your desk', sub: 'Trends' },
  { id: 'journal', href: '/check-in', label: 'Journal', sub: 'Check in' },
  { id: 'cooler', href: '/nudges', label: 'Water cooler', sub: 'Nudges' },
  { id: 'clock', href: '/boundaries', label: 'The clock', sub: '' },
  { id: 'lounge', href: '/recognition', label: 'The sofa', sub: 'Recognition' },
  { id: 'shelf', href: '/workspace', label: 'Your shelf', sub: 'Workspace' },
  { id: 'locker', href: '/leave', label: 'Your locker', sub: 'Leave & profile' },
]

const ZONE_H = 132
const GAP = 10
const TOP_PAD = 92
const BOTTOM_PAD = 24
const W = 280
const ICON_Y = 46
const TAG_Y = 100

function hand(cx: number, cy: number, lenPx: number, deg: number) {
  const a = ((deg - 90) * Math.PI) / 180
  return { x: cx + lenPx * Math.cos(a), y: cy + lenPx * Math.sin(a) }
}

/** Every icon is centred on (cx, cy) — a top-down piece of furniture, the
 *  same way the office screen draws one, just simplified: a shape this
 *  small does not carry the detail a full-page one does. */
function icon(id: string, cx: number, cy: number, minutes: number) {
  switch (id) {
    case 'desk':
      return `
        <rect class="screen" x="${cx - 16}" y="${cy - 18}" width="32" height="10" rx="3"/>
        <rect class="furn" x="${cx - 22}" y="${cy - 4}" width="44" height="26" rx="6"/>`
    case 'journal':
      return `
        <rect class="furn-3" x="${cx - 15}" y="${cy - 20}" width="30" height="40" rx="5"/>
        <line class="ink" x1="${cx - 9}" y1="${cy - 8}" x2="${cx + 11}" y2="${cy - 8}"/>
        <line class="ink" x1="${cx - 9}" y1="${cy + 2}" x2="${cx + 11}" y2="${cy + 2}"/>`
    case 'cooler':
      return `
        <rect class="furn" x="${cx - 22}" y="${cy - 18}" width="24" height="36" rx="6"/>
        <circle class="plant" cx="${cx + 15}" cy="${cy}" r="15"/>`
    case 'clock': {
      const hEnd = hand(cx, cy, 10, ((minutes / 60) % 12) * 30)
      const mEnd = hand(cx, cy, 15, (minutes % 60) * 6)
      return `
        <circle class="furn" cx="${cx}" cy="${cy}" r="24"/>
        <circle class="furn-3" cx="${cx}" cy="${cy}" r="17"/>
        <line class="ink-2" x1="${cx}" y1="${cy}" x2="${hEnd.x.toFixed(1)}" y2="${hEnd.y.toFixed(1)}"/>
        <line class="ink-2" x1="${cx}" y1="${cy}" x2="${mEnd.x.toFixed(1)}" y2="${mEnd.y.toFixed(1)}" stroke-width="2.5"/>
        <circle class="ink-dot" cx="${cx}" cy="${cy}" r="2.5"/>`
    }
    case 'lounge':
      return `
        <rect class="furn" x="${cx - 22}" y="${cy - 16}" width="44" height="24" rx="10"/>
        <ellipse class="furn-3" cx="${cx}" cy="${cy + 16}" rx="22" ry="13"/>`
    case 'shelf':
      return `
        <rect class="furn" x="${cx - 11}" y="${cy - 23}" width="22" height="46" rx="6"/>
        <line class="ink" x1="${cx - 6}" y1="${cy - 9}" x2="${cx + 6}" y2="${cy - 9}"/>
        <line class="ink" x1="${cx - 6}" y1="${cy + 5}" x2="${cx + 6}" y2="${cy + 5}"/>`
    case 'locker':
      return `
        <rect class="furn" x="${cx - 13}" y="${cy - 21}" width="26" height="42" rx="6"/>
        <line class="ink" x1="${cx - 8}" y1="${cy - 3}" x2="${cx + 8}" y2="${cy - 3}"/>`
    case 'meeting':
      return `
        <circle class="furn-2" cx="${cx}" cy="${cy - 17}" r="6"/>
        <ellipse class="furn" cx="${cx}" cy="${cy}" rx="22" ry="14"/>
        <circle class="furn-2" cx="${cx - 20}" cy="${cy}" r="6"/>
        <circle class="furn-2" cx="${cx + 20}" cy="${cy}" r="6"/>`
    case 'files':
      return `
        <rect class="furn" x="${cx - 20}" y="${cy - 21}" width="40" height="42" rx="6"/>
        <line class="ink" x1="${cx - 13}" y1="${cy - 9}" x2="${cx + 13}" y2="${cy - 9}"/>
        <line class="ink" x1="${cx - 13}" y1="${cy + 1}" x2="${cx + 13}" y2="${cy + 1}"/>
        <line class="ink" x1="${cx - 13}" y1="${cy + 11}" x2="${cx + 13}" y2="${cy + 11}"/>`
    default:
      return ''
  }
}

/** The office screen's own name-tag pill — same shape, same classes, just
 *  reused here rather than redrawn. */
function tag(cx: number, cy: number, label: string, sub: string) {
  return `
    <g class="spot__tag" transform="translate(${cx} ${cy})">
      <rect class="spot__tagbg" x="-58" y="-15" width="116" height="30" rx="15"/>
      <text class="spot__tagtext" x="0" y="-2">${label}</text>
      <text class="spot__tagsub" x="0" y="10">${sub}</text>
    </g>`
}

function zone(spot: CompactSpot, cx: number, top: number, minutes: number, locked?: string) {
  const attrs = locked
    ? `aria-disabled="true" aria-label="${spot.label}, locked. ${locked}"`
    : `data-go="${spot.href}" aria-label="${spot.label} — ${spot.sub}"`
  return `
    <g class="spot${locked ? ' spot--locked' : ''}" data-spot="${spot.id}" tabindex="0" role="button" ${attrs}>
      <g class="spot__art">${icon(spot.id, cx, top + ICON_Y, minutes)}</g>
      ${tag(cx, top + TAG_Y, spot.label, locked ? 'Locked' : spot.sub)}
    </g>`
}

function compactRoomSVG(opts: { minutes: number; isHr: boolean; formatTime: (m: number) => string }) {
  const spots = [...SPOTS]
  spots[3] = { ...spots[3], sub: opts.formatTime(opts.minutes) }

  const meeting: CompactSpot = { id: 'meeting', href: '/org', label: 'Meeting room', sub: 'Structural load' }
  const files: CompactSpot = { id: 'files', href: '/hr', label: 'HR office', sub: 'People & records' }

  const rows: { spot: CompactSpot; locked?: string }[] = [
    ...spots.map((spot) => ({ spot })),
    { spot: meeting, locked: opts.isHr ? undefined : 'Holds group data only.' },
    ...(opts.isHr ? [{ spot: files }] : []),
  ]

  const height = TOP_PAD + rows.length * ZONE_H + (rows.length - 1) * GAP + BOTTOM_PAD
  const cx = W / 2

  const zones = rows
    .map((r, i) => zone(r.spot, cx, TOP_PAD + i * (ZONE_H + GAP), opts.minutes, r.locked))
    .join('')

  return `
    <svg class="room__svg" viewBox="0 0 ${W} ${height}" role="img"
         aria-label="Your office. Use the destination buttons, or open List view for the same links as text.">
      <rect class="floor" x="4" y="4" width="${W - 8}" height="${height - 8}" rx="18"/>
      <rect class="wall" x="4" y="4" width="${W - 8}" height="${height - 8}" rx="18"/>

      <g class="room-avatar" aria-hidden="true" style="opacity:1;transform:none">
        <circle class="room-avatar__dot" cx="${cx}" cy="42" r="24"/>
        <text class="room-avatar__initials" x="${cx}" y="48">?</text>
      </g>

      ${zones}
    </svg>`
}

/* ------------------------------------------------------- Directory board */

type DirItem = {
  id: string
  href?: string
  action?: 'signout'
  label: string
  sub: string
  hrOnly?: boolean
}

type DirSection = { title: string; items: DirItem[] }

const DIRECTORY: DirSection[] = [
  {
    title: 'Time & leave',
    items: [
      { id: 'holidays', href: '/holidays', label: 'Holidays', sub: 'Company calendar' },
      { id: 'attendance', href: '/attendance', label: 'Attendance', sub: 'Details & summary' },
    ],
  },
  {
    title: 'Money',
    items: [
      { id: 'payroll', href: '/payroll', label: 'Payroll', sub: 'Pre-payments, increments' },
      { id: 'expenses', href: '/expenses', label: 'Expenses', sub: 'Claim something back' },
    ],
  },
  {
    title: 'Records',
    items: [
      { id: 'assets', href: '/assets', label: 'Assets', sub: 'Equipment on loan' },
      { id: 'letter-heads', href: '/letter-heads', label: 'Letter heads', sub: 'HR document templates', hrOnly: true },
      { id: 'company-policies', href: '/company-policies', label: 'Company policies', sub: 'What everyone reads once' },
      { id: 'custom-fields', href: '/custom-fields', label: 'Custom data fields', sub: 'Extend an employment record', hrOnly: true },
    ],
  },
  {
    title: 'Workplace',
    items: [
      { id: 'news', href: '/news', label: 'News', sub: 'Announcements' },
      { id: 'complaints', href: '/complaints', label: 'Complaints', sub: 'A formal, tracked case' },
    ],
  },
  {
    title: 'Leaving',
    items: [
      { id: 'resignations', href: '/resignations', label: 'Resignations', sub: 'Hand in notice' },
      { id: 'offboarding', href: '/offboarding', label: 'Offboarding', sub: 'HR checklist', hrOnly: true },
      { id: 'warnings', href: '/warnings', label: 'Warnings', sub: 'Disciplinary records', hrOnly: true },
    ],
  },
  {
    title: 'Account',
    items: [{ id: 'logout', action: 'signout', label: 'Log out', sub: 'Ends every session' }],
  },
]

/** Plain-shape line icons — rects, circles and straight-line paths only, no
 *  curves, so each one is simple enough to be confident is correct without
 *  seeing it rendered first. */
const DIR_ICON: Record<string, React.ReactNode> = {
  holidays: (
    <>
      <rect x="4" y="6" width="16" height="14" rx="2" />
      <path d="M4 10h16M8 4v4M16 4v4" />
    </>
  ),
  attendance: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2" />
    </>
  ),
  payroll: (
    <>
      <rect x="3" y="7" width="18" height="11" rx="2" />
      <circle cx="12" cy="12.5" r="2.6" />
      <path d="M6 7v11M18 7v11" />
    </>
  ),
  expenses: (
    <>
      <path d="M6 3h12v18l-2.5-1.5L13 21l-2.5-1.5L8 21l-2-1.5V3Z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
  assets: (
    <>
      <rect x="4" y="8" width="16" height="12" rx="1.5" />
      <path d="M4 8l8-4 8 4" />
    </>
  ),
  'letter-heads': (
    <>
      <rect x="5" y="3" width="14" height="18" rx="1.5" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </>
  ),
  'company-policies': (
    <>
      <path d="M4 5.5C4 4.7 4.7 4 5.5 4H12v16H5.5A1.5 1.5 0 0 1 4 18.5v-13Z" />
      <path d="M20 5.5c0-.8-.7-1.5-1.5-1.5H12v16h6.5a1.5 1.5 0 0 0 1.5-1.5v-13Z" />
    </>
  ),
  'custom-fields': (
    <>
      <path d="M6 4v16M12 4v16M18 4v16" />
      <circle cx="6" cy="9" r="2" />
      <circle cx="12" cy="15" r="2" />
      <circle cx="18" cy="7" r="2" />
    </>
  ),
  news: (
    <>
      <path d="M3 11v3a2 2 0 0 0 2 2h1l9 4V5L6 9H5a2 2 0 0 0-2 2Z" />
      <path d="M17 9.5a4 4 0 0 1 0 5" />
    </>
  ),
  complaints: (
    <>
      <path d="M5 3v18" />
      <path d="M5 4h11l-2.5 3.5L16 11H5" />
    </>
  ),
  resignations: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 6l9 7 9-7" />
    </>
  ),
  offboarding: (
    <>
      <rect x="4" y="3" width="12" height="18" rx="1.5" />
      <path d="M16 12h5M18 9.5 20.5 12 18 14.5" />
    </>
  ),
  warnings: (
    <>
      <path d="M12 3 2 20h20L12 3Z" />
      <path d="M12 10v4" />
      <circle cx="12" cy="17" r="0.5" />
    </>
  ),
  logout: (
    <>
      <path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" />
      <path d="M13 8l4 4-4 4M9 12h8" />
    </>
  ),
}

function DirIcon({ id }: { id: string }) {
  return (
    <svg
      className="room-tile__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {DIR_ICON[id] ?? <circle cx="12" cy="12" r="7" />}
    </svg>
  )
}

function Directory({
  isHr,
  onGo,
  onSignOut,
}: {
  isHr: boolean
  onGo: (href: string) => void
  onSignOut: () => void
}) {
  return (
    <nav className="room-directory" aria-label="Directory">
      <div className="room-directory__title">Building directory</div>
      {DIRECTORY.map((section) => (
        <div className="room-directory__section" key={section.title}>
          <div className="room-directory__heading">{section.title}</div>
          <div className="room-directory__tiles">
            {section.items.map((item) => {
              const locked = Boolean(item.hrOnly) && !isHr
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`room-tile${locked ? ' room-tile--locked' : ''}`}
                  disabled={locked}
                  aria-disabled={locked || undefined}
                  onClick={() => {
                    if (locked) return
                    if (item.action === 'signout') onSignOut()
                    else if (item.href) onGo(item.href)
                  }}
                >
                  <DirIcon id={item.id} />
                  <span className="room-tile__text">
                    <span className="room-tile__label">{item.label}</span>
                    <span className="room-tile__sub">
                      {locked ? 'HR only' : item.sub}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )
}

/* --------------------------------------------------------------- Sidebar */

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
  const roomRef = useRef<HTMLDivElement>(null)
  const [loaded, setLoaded] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const build = useCallback(() => {
    const WW = window.WW
    if (!WW?.room || !roomRef.current) return

    const minutes = WW.room.nowMinutes()
    const svg = compactRoomSVG({ minutes, isHr, formatTime: WW.room.formatTime })

    roomRef.current.innerHTML = svg
    roomRef.current.dataset.phase = WW.room.phaseAt(minutes)

    const mark = roomRef.current.querySelector('.room-avatar__initials')
    if (mark) mark.textContent = initials?.trim() || initialsOf(name)
    roomRef.current.dataset.avatarColour = colour

    setLoaded(true)
  }, [isHr, name, initials, colour])

  useEffect(() => {
    // The script may already be present on a client-side navigation to
    // another screen, in which case onReady never fires again.
    if (window.WW?.room) build()
  }, [build])

  // Keeps the clock tile and quiet-hours dimming in step, same as the room
  // on the office screen itself.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (window.WW?.room) build()
    }, 60000)
    return () => window.clearInterval(id)
  }, [build])

  const navigate = useCallback(
    (e: React.MouseEvent | React.KeyboardEvent) => {
      const target = e.target as HTMLElement
      const el = target.closest<HTMLElement>('[data-go]')
      if (!el?.dataset.go) return
      e.preventDefault()
      router.push(el.dataset.go)
    },
    [router]
  )

  const onKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== ' ') return
      const el = (e.target as HTMLElement).closest('[data-go]')
      if (el) navigate(e)
    },
    [navigate]
  )

  // Same scope as the SignOut button elsewhere in the app: every session,
  // not just this tab's.
  async function signOut() {
    if (signingOut) return
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut({ scope: 'global' })
    router.push('/')
    router.refresh()
  }

  return (
    <>
      <Script src="/prototype/room.js" strategy="afterInteractive" onReady={build} />
      <aside className="room-sidebar" aria-label="The office, and where to go">
        <div
          className="room"
          data-room
          data-open="true"
          ref={roomRef}
          onClick={navigate}
          onKeyDown={onKey}
        />
        {!loaded && <p className="sr-only">Loading the office…</p>}

        <Directory isHr={isHr} onGo={(href) => router.push(href)} onSignOut={signOut} />
      </aside>
    </>
  )
}
