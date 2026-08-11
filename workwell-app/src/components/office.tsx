'use client'

import Script from 'next/script'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

/** The prototype's room is vendored unmodified from workwell-prototype, so
 *  it stays easy to re-sync. It still speaks in the prototype's filenames,
 *  which this maps onto the app's routes. Anything not built yet is absent
 *  here and its spot is rendered as coming soon rather than as a dead
 *  link — a room object that does nothing is worse than one that says so. */
const ROUTES: Record<string, string> = {
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
}

declare global {
  interface Window {
    WW?: {
      room?: {
        roomSVG: (o: { role: string; minutes: number }) => string
        roomList: (role: string, locked: boolean) => string
        nowMinutes: () => number
        phaseAt: (m: number) => string
        formatTime: (m: number) => string
      }
      sky?: { paint: () => void }
    }
  }
}

export function Office({ isHr, name }: { isHr: boolean; name: string }) {
  const router = useRouter()
  const roomRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<'room' | 'list'>('room')
  const [loaded, setLoaded] = useState(false)
  const [phase, setPhase] = useState<string | null>(null)
  const [clock, setClock] = useState<string | null>(null)

  const build = useCallback(() => {
    const WW = window.WW
    if (!WW?.room || !roomRef.current) return

    const role = isHr ? 'hr' : 'employee'
    const minutes = WW.room.nowMinutes()

    roomRef.current.innerHTML = WW.room.roomSVG({ role, minutes })
    if (listRef.current) {
      listRef.current.innerHTML = WW.room.roomList(role, false)
    }

    setPhase(WW.room.phaseAt(minutes))
    setClock(WW.room.formatTime(minutes))
    setLoaded(true)
  }, [isHr])

  useEffect(() => {
    // The scripts may already be present on a client-side navigation back
    // to this page, in which case onReady never fires again.
    if (window.WW?.room) build()

    // sky.js appends its element straight to document.body and never takes
    // it away. React does not own that node, so navigating to another
    // screen used to leave a fixed, full-viewport sky painting over it —
    // the page was there, buried. The sky belongs to the office; it leaves
    // when the office does.
    return () => {
      document.querySelectorAll('.sky').forEach((el) => el.remove())
      document.body.classList.remove('has-sky')
    }
  }, [build])

  // Keep the room in step with the clock the way the prototype does: the
  // lighting and the wall clock both follow the time of day.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (window.WW?.room) build()
    }, 60000)
    return () => window.clearInterval(id)
  }, [build])

  const navigate = useCallback(
    (e: React.MouseEvent | React.KeyboardEvent) => {
      const target = e.target as HTMLElement
      const el = target.closest<HTMLElement>('[data-go], a[href]')
      if (!el) return

      const href = el.dataset.go ?? el.getAttribute('href') ?? ''
      const route = ROUTES[href.replace(/^\.?\//, '')]

      e.preventDefault()

      // Every spot in the room now has a screen behind it. If that ever
      // stops being true, say so rather than navigating somewhere wrong.
      if (!route) {
        el.setAttribute('data-unbuilt', 'true')
        window.setTimeout(() => el.removeAttribute('data-unbuilt'), 1600)
        return
      }
      router.push(route)
    },
    [router]
  )

  const onKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== ' ') return
      const el = (e.target as HTMLElement).closest('[data-go], a[href]')
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

      <div className="room-shell is-fit">
        <header className="room-top">
          <div className="room-top__brand">
            <span aria-hidden="true">🌿</span> WorkWell
          </div>
          <span className="room-top__spacer" />
          <div className="segmented" role="group" aria-label="How to navigate">
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
        </header>

        <main className="room-stage">
          <div
            className={`room-views${view === 'room' ? ' is-on' : ''}`}
            data-view-panel="room"
            hidden={view !== 'room'}
          >
            <p className="t-subtle" style={{ textAlign: 'center' }}>
              {clock
                ? `${name.split(' ')[0]} · ${clock}${
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

          {/* A picture must never be the only way to navigate. */}
          <div
            className="room-views"
            data-view-panel="list"
            hidden={view !== 'list'}
            style={{ width: 'min(560px, 100%)' }}
          >
            <div ref={listRef} onClick={navigate} onKeyDown={onKey} />
          </div>
        </main>
      </div>
    </>
  )
}
