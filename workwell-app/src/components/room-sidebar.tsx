'use client'

import Script from 'next/script'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ROUTES, initialsOf } from '@/components/office'

/**
 * The office, always in view.
 *
 * A compact, non-interactive-camera copy of the same room drawn on the
 * office screen — same script, same SVG, just scaled to whatever width the
 * sidebar column is (its viewBox does the scaling; nothing here crops or
 * fixes a size). Every spot still navigates, so the room stays the way
 * around the app rather than a picture of one screen among many.
 *
 * No sky here: that is a full-viewport backdrop meant for the office screen
 * itself, and painting it behind a few hundred pixels of sidebar would just
 * be a rectangle of gradient with no room in view to justify it.
 */
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

  const build = useCallback(() => {
    const WW = window.WW
    if (!WW?.room || !roomRef.current) return

    const minutes = WW.room.nowMinutes()
    const caps = { own: true, org: isHr }

    roomRef.current.innerHTML = WW.room.roomSVG({ minutes, ...caps })
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

  // Keeps the sidebar's lighting in step with the clock, same as the room
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
      </aside>
    </>
  )
}
