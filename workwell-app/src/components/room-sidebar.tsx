'use client'

import Script from 'next/script'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { initialsOf } from '@/components/office'

/**
 * The office, always in view — drawn as its own compact layout rather than
 * a shrunk copy of the office screen's room.
 *
 * That room is a wide floor plan (a 1000×720 viewBox) and this column is
 * the opposite shape — narrow and as tall as the viewport. Neither scaling
 * it to the width nor to the height alone fills the column: one leaves a
 * band empty, the other overflows or crops. The viewBox below is sized in
 * JS from the sidebar's own measured box, every render, so the SVG's own
 * aspect ratio always matches the space it has to fill exactly — no
 * letterboxing on either axis, and no guessing at a "typical" screen size.
 *
 * room.js stays untouched on purpose — see office.tsx — so this does not
 * reach for roomSVG() at all. Each stop is drawn as furniture with a name
 * tag beneath it, the same visual grammar as the office screen's room,
 * just stacked in one column instead of spread across a floor. It borrows
 * room.css's classes throughout (.spot, .furn, .spot__tagbg, …) so hover,
 * focus and quiet-hours dimming all work without any of that being
 * redefined here, and it still reads the clock from room.js rather than
 * duplicating that logic.
 */

type CompactSpot = {
  id: string
  href: string
  label: string
  sub: string
}

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
/** Where the tag pill sits within a zone, relative to its own top. Fixed
 *  regardless of zone width, since the pill's own size is fixed too. */
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
 *  reused here rather than redrawn, so a change to how a tag looks there
 *  keeps looking the same way here. */
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

function compactRoomSVG(opts: {
  minutes: number
  isHr: boolean
  aspect: number
  formatTime: (m: number) => string
}) {
  const spots = [...SPOTS]
  spots[3] = { ...spots[3], sub: opts.formatTime(opts.minutes) }

  const meeting: CompactSpot = {
    id: 'meeting',
    href: '/org',
    label: 'Meeting room',
    sub: 'Structural load',
  }
  const files: CompactSpot = {
    id: 'files',
    href: '/hr',
    label: 'HR office',
    sub: 'People & records',
  }

  const rows: { spot: CompactSpot; locked?: string }[] = [
    ...spots.map((spot) => ({ spot })),
    { spot: meeting, locked: opts.isHr ? undefined : 'Holds group data only.' },
    ...(opts.isHr ? [{ spot: files }] : []),
  ]

  const height = TOP_PAD + rows.length * ZONE_H + (rows.length - 1) * GAP + BOTTOM_PAD
  // The sidebar's own measured width÷height, so the viewBox always has the
  // same shape as the box it is about to fill — the fix for the empty
  // bands down each side that a fixed, guessed ratio left behind.
  const width = Math.round(height * opts.aspect)
  const cx = width / 2

  const zones = rows
    .map((r, i) => zone(r.spot, cx, TOP_PAD + i * (ZONE_H + GAP), opts.minutes, r.locked))
    .join('')

  return `
    <svg class="room__svg" viewBox="0 0 ${width} ${height}" role="img"
         aria-label="The office. Use the destination buttons, or open List view for the same links as text.">
      <rect class="floor" x="4" y="4" width="${width - 8}" height="${height - 8}" rx="18"/>
      <rect class="wall" x="4" y="4" width="${width - 8}" height="${height - 8}" rx="18"/>

      <g class="room-avatar" aria-hidden="true" style="opacity:1;transform:none">
        <circle class="room-avatar__dot" cx="${cx}" cy="42" r="24"/>
        <text class="room-avatar__initials" x="${cx}" y="48">?</text>
      </g>

      ${zones}
    </svg>`
}

/** Measures the sidebar's actual box, and only that — width and height in
 *  real pixels, from which the SVG derives its aspect ratio. Re-measures on
 *  resize rather than once at mount, since --sidebar-w changes at the
 *  1080px breakpoint and a phone rotating changes the height. */
function useAspect(ref: React.RefObject<HTMLElement | null>) {
  const [aspect, setAspect] = useState(0.42)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return

    const measure = () => {
      const { width, height } = el.getBoundingClientRect()
      if (width > 0 && height > 0) setAspect(width / height)
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])

  return aspect
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
  const asideRef = useRef<HTMLElement>(null)
  const roomRef = useRef<HTMLDivElement>(null)
  const [loaded, setLoaded] = useState(false)
  const aspect = useAspect(asideRef)

  const build = useCallback(() => {
    const WW = window.WW
    if (!WW?.room || !roomRef.current) return

    const minutes = WW.room.nowMinutes()
    const svg = compactRoomSVG({ minutes, isHr, aspect, formatTime: WW.room.formatTime })

    roomRef.current.innerHTML = svg
    roomRef.current.dataset.phase = WW.room.phaseAt(minutes)

    const mark = roomRef.current.querySelector('.room-avatar__initials')
    if (mark) mark.textContent = initials?.trim() || initialsOf(name)
    roomRef.current.dataset.avatarColour = colour

    setLoaded(true)
  }, [isHr, name, initials, colour, aspect])

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

  return (
    <>
      <Script src="/prototype/room.js" strategy="afterInteractive" onReady={build} />
      <aside className="room-sidebar" aria-label="The office, and where to go" ref={asideRef}>
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
