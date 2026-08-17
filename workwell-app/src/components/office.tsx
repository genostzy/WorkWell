'use client'

import Script from 'next/script'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { signOutEverywhere } from '@/components/sign-out'
import { hideSky, showSky } from '@/lib/sky'
import { Wordmark } from '@/components/brandmark'

/** The prototype's room is vendored unmodified from workwell-prototype, so
 *  it stays easy to re-sync. It still speaks in the prototype's filenames,
 *  which this maps onto the app's routes. Anything not built yet is absent
 *  here and its spot is rendered as coming soon rather than as a dead
 *  link — a room object that does nothing is worse than one that says so. */
export const ROUTES: Record<string, string> = {
  'trends.html': '/trends',
  'check-in.html': '/check-in',
  'onboarding.html': '/check-in',
  'my-leave.html': '/leave',
  'nudges.html': '/nudges',
  'boundary.html': '/boundaries',
  'recognition.html': '/recognition',
  'workspace.html': '/workspace',
  'hr-people.html': '/hr',
  'org-diagnostics.html': '/org',
  'holidays.html': '/holidays',
  'attendance.html': '/attendance',
  'payroll.html': '/payroll',
  'expenses.html': '/expenses',
  'assets.html': '/assets',
  'news.html': '/news',
  'complaints.html': '/complaints',
  'company-policies.html': '/company-policies',
  'resignations.html': '/resignations',
  'letter-heads.html': '/letter-heads',
  'custom-fields.html': '/custom-fields',
  'offboarding.html': '/offboarding',
  'warnings.html': '/warnings',
}

declare global {
  interface Window {
    WW?: {
      room?: {
        roomSVG: (o: {
          role?: string
          minutes: number
          own?: boolean
          org?: boolean
        }) => string
        roomList: (
          role: string,
          locked: boolean,
          caps?: { own?: boolean; org?: boolean }
        ) => string
        nowMinutes: () => number
        phaseAt: (m: number) => string
        formatTime: (m: number) => string
      }
      sky?: { paint: () => void }
      /** dragscale.js — builds a draggable scale into an empty element and
       *  dispatches a bubbling `ww:scale` from it on every change. */
      initDragScale?: (root: HTMLElement) => unknown
      onReady?: (fn: () => void) => void
    }
  }
}

/** The app's own data-motion attribute wins over the OS setting, matching
 *  what the prototype's stylesheets already do with it. */
export function reducedMotion() {
  const attr = document.documentElement.getAttribute('data-motion')
  if (attr === 'reduced') return true
  if (attr === 'full') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** "Wilson Dayrit" → "WD". One letter is better than a wrong two. */
export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0][0]
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase()
}

// React warns if useLayoutEffect runs during SSR; Office is a client
// component but still renders once on the server for the initial HTML, so
// this falls back to useEffect there and only prefers useLayoutEffect in
// the browser, where it matters: it runs before paint, so a returning
// visit — the scripts are already loaded — builds the room and flips
// `loaded` before the browser ever shows a frame. Without it, "Opening the
// office…" flashed for a frame on every single navigation back home, which
// read as the office reopening from scratch rather than just being shown.
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect

export function Office({
  name,
  initials,
  colour = 'accent',
  greeting = 'warm',
}: {
  /** Preferred name if one is set, otherwise the employment record's. */
  name: string
  /** An override; null means derive from the name. */
  initials?: string | null
  colour?: string
  greeting?: string
}) {
  const router = useRouter()
  const roomRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<'room' | 'list'>('room')
  // Lazy-init: on a client-side return to this screen room.js is already
  // loaded, so there is nothing to wait on — start "loaded" instead of
  // flashing the placeholder text for a frame before the effect below
  // catches up.
  const [loaded, setLoaded] = useState(
    () => typeof window !== 'undefined' && !!window.WW?.room
  )
  const [phase, setPhase] = useState<string | null>(null)
  const [clock, setClock] = useState<string | null>(null)

  const build = useCallback(() => {
    const WW = window.WW
    if (!WW?.room || !roomRef.current) return

    const minutes = WW.room.nowMinutes()

    // Office renders only for private-plane accounts now — HR/admin lands on
    // the dashboard instead (see page.tsx) and never reaches this component.
    // So `own` is unconditionally true and `org` unconditionally false: every
    // org-gated spot in the room always renders locked, because the single
    // account that could ever open it is never the one standing in the room.
    const caps = { own: true, org: false }

    roomRef.current.innerHTML = WW.room.roomSVG({ minutes, ...caps })

    // The whole time-of-day treatment in room.css hangs off this attribute —
    // the warm morning wash, the lights going down at night, the clock
    // staying legible through it. The prototype set it in page-office.js and
    // it was never ported, so the room has been drawn at noon at every hour
    // since. It is set here rather than in React's render because the SVG
    // above is written imperatively and the two must land together.
    roomRef.current.dataset.phase = WW.room.phaseAt(minutes)

    // The avatar shipped reading "?" because nothing ever filled it in.
    const mark = roomRef.current.querySelector('.room-avatar__initials')
    if (mark) mark.textContent = initials?.trim() || initialsOf(name)
    roomRef.current.dataset.avatarColour = colour

    if (listRef.current) {
      listRef.current.innerHTML = WW.room.roomList('employee', false, caps)
    }

    setPhase(WW.room.phaseAt(minutes))
    setClock(WW.room.formatTime(minutes))
    setLoaded(true)
  }, [name, initials, colour])

  useIsomorphicLayoutEffect(() => {
    // The scripts may already be present on a client-side navigation back
    // to this page, in which case onReady never fires again.
    if (window.WW?.room) build()
    showSky()

    // sky.js appends its element straight to document.body and never takes
    // it away. React does not own that node, so navigating to another
    // screen used to leave a fixed, full-viewport sky painting over it —
    // the page was there, buried. The sky belongs to the office, so it goes
    // when the office goes.
    return hideSky
  }, [build])

  // Keep the room in step with the clock the way the prototype does: the
  // lighting and the wall clock both follow the time of day.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (window.WW?.room) build()
    }, 60000)
    return () => window.clearInterval(id)
  }, [build])

  /**
   * Walk the avatar to a spot.
   *
   * The avatar is you, standing in your own office, and until now it stood
   * in one place no matter where you went — which made the room a picture
   * of an office rather than one you are in.
   *
   * Its resting position is baked into room.css as a translate from the
   * doorway, so the move is an inline transform, which wins over the class
   * rule. getBBox gives the art's box in the SVG's own user units, the same
   * units the transform is expressed in, so no screen-pixel conversion is
   * needed and it stays correct at every size the room is drawn at.
   */
  const walkTo = useCallback((spot: Element) => {
    const avatar = roomRef.current?.querySelector<SVGGElement>('.room-avatar')
    const art = spot.querySelector<SVGGraphicsElement>('.spot__art')
    if (!avatar || !art) return 0

    let box: DOMRect
    try {
      box = art.getBBox()
    } catch {
      // getBBox throws on a node that is not rendered. Nothing to walk to.
      return 0
    }

    // Stand just below the middle of the furniture rather than on top of it.
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2 + 26
    avatar.style.transform = `translate(${Math.round(x - 500)}px, ${Math.round(y - 672)}px)`

    // Long enough to read as crossing the room, short enough that nobody
    // waits on it. Someone who has asked for less motion gets neither.
    return reducedMotion() ? 0 : 420
  }, [])

  const navigate = useCallback(
    (e: React.MouseEvent | React.KeyboardEvent) => {
      const target = e.target as HTMLElement
      const el = target.closest<HTMLElement>('[data-go], [data-signout], a[href]')
      if (!el) return

      e.preventDefault()

      // The front door: same "important button" rule as everything else
      // that ends a session — confirm once before it fires.
      if (el.dataset.signout !== undefined) {
        if (!window.confirm('Sign out of WorkWell?')) return
        void signOutEverywhere().then(() => {
          router.push('/')
          router.refresh()
        })
        return
      }

      const href = el.dataset.go ?? el.getAttribute('href') ?? ''
      const route = ROUTES[href.replace(/^\.?\//, '')]

      // Every spot in the room now has a screen behind it. If that ever
      // stops being true, say so rather than navigating somewhere wrong.
      if (!route) {
        el.setAttribute('data-unbuilt', 'true')
        window.setTimeout(() => el.removeAttribute('data-unbuilt'), 1600)
        return
      }

      const spot = target.closest('.spot')
      const wait = spot ? walkTo(spot) : 0
      if (wait) window.setTimeout(() => router.push(route), wait)
      else router.push(route)
    },
    [router, walkTo]
  )

  const onKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== ' ') return
      const el = (e.target as HTMLElement).closest('[data-go], [data-signout], a[href]')
      if (el) navigate(e)
    },
    [navigate]
  )

  return (
    <>
      {/* room before sky: sky.js reads WW.room for the current minute. */}
      <Script src="/prototype/room.js" strategy="afterInteractive" />
      <Script
        src="/prototype/sky.js"
        strategy="afterInteractive"
        onReady={build}
      />

      {/* Only the room locks itself to the viewport; the list has to scroll. */}
      <div className={`room-shell${view === 'room' ? ' is-fit' : ''}`}>
        {/* No header bar — just the mark, pasted over the background top
            left, and the room/list switch floating to match. Signing out
            now happens at the front door, in the room itself. */}
        <div className="room-brand">
          <Wordmark />
        </div>

        <div className="room-nav-toggle segmented" role="group" aria-label="How to navigate">
          <button
            type="button"
            aria-pressed={view === 'room'}
            onClick={() => setView('room')}
          >
            Room
          </button>
          <button
            type="button"
            aria-pressed={view === 'list'}
            onClick={() => setView('list')}
          >
            List
          </button>
        </div>

        <main className="room-stage">
          <div
            className={`room-views${view === 'room' ? ' is-on' : ''}`}
            data-view-panel="room"
            hidden={view !== 'room'}
          >
            <p className="t-subtle" style={{ textAlign: 'center' }}>
              {clock
                ? `${greeting === 'warm' ? `${name.split(' ')[0]} · ` : ''}${clock}${
                    phase === 'quiet' ? ' · quiet hours' : ''
                  }`
                : ' '}
            </p>
            <div
              className="room"
              data-room
              data-open="true"
              ref={roomRef}
              onClick={navigate}
              onKeyDown={onKey}
            />
            {!loaded && (
              <p className="t-subtle" style={{ textAlign: 'center' }}>
                Opening the office…
              </p>
            )}
          </div>

          {/* A picture must never be the only way to navigate.
              `is-on` is not decoration here: .room-views is display:none
              until it has that class, so without it the List button
              switched to a panel that could never be shown. */}
          <div
            className={`room-views${view === 'list' ? ' is-on' : ''}`}
            data-view-panel="list"
            hidden={view !== 'list'}
            style={{ width: 'min(560px, 100%)' }}
          >
            <h1 className="mb-2" style={{ fontSize: 'var(--fs-xl)' }}>
              Where would you like to go?
            </h1>
            <p className="t-subtle mb-4">Everywhere you can go from here.</p>
            <div ref={listRef} onClick={navigate} onKeyDown={onKey} />
          </div>
        </main>
      </div>
    </>
  )
}
