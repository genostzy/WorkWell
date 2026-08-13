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
 * the opposite shape — narrow and as tall as the viewport. Scaled down to
 * fit the width, most of a tall sidebar sat empty above or below it; scaled
 * to fill the height, it would have to overflow the width or crop most of
 * the furniture off the sides. Reusing the same shapes but stacking them
 * in a single column, sized for this shape specifically, is what actually
 * fills the space.
 *
 * room.js stays untouched on purpose — see office.tsx — so this does not
 * reach for roomSVG() at all. It borrows room.css's classes (.spot,
 * .furn, .spot__tagbg, …) so hover, focus and quiet-hours dimming all work
 * without any of that being redefined here, and it still uses room.js for
 * the one thing that is genuinely shared state: the clock.
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

const W = 280
const TILE_H = 76
const GAP = 16
const TOP_PAD = 76
const BOTTOM_PAD = 20
const TILE_X = 20
const TILE_W = W - TILE_X * 2
const ICON_X = TILE_X + 14

function hand(cx: number, cy: number, lenPx: number, deg: number) {
  const a = ((deg - 90) * Math.PI) / 180
  return { x: cx + lenPx * Math.cos(a), y: cy + lenPx * Math.sin(a) }
}

/** Each icon draws inside its own ~48×48 box at (ix, iy) — small, simple
 *  shapes rather than the office screen's fuller illustrations, since a
 *  shape that is only ever seen at sidebar width does not need the detail
 *  that one shown at full page width does. */
function icon(id: string, ix: number, iy: number, minutes: number) {
  switch (id) {
    case 'desk':
      return `
        <rect class="screen" x="${ix + 6}" y="${iy}" width="32" height="10" rx="3"/>
        <rect class="furn" x="${ix}" y="${iy + 12}" width="44" height="26" rx="6"/>`
    case 'journal':
      return `
        <rect class="furn-3" x="${ix + 8}" y="${iy}" width="28" height="38" rx="5"/>
        <line class="ink" x1="${ix + 14}" y1="${iy + 12}" x2="${ix + 34}" y2="${iy + 12}"/>
        <line class="ink" x1="${ix + 14}" y1="${iy + 22}" x2="${ix + 34}" y2="${iy + 22}"/>`
    case 'cooler':
      return `
        <rect class="furn" x="${ix}" y="${iy + 2}" width="24" height="36" rx="6"/>
        <circle class="plant" cx="${ix + 38}" cy="${iy + 22}" r="14"/>`
    case 'clock': {
      const cx = ix + 24
      const cy = iy + 24
      const hEnd = hand(cx, cy, 10, ((minutes / 60) % 12) * 30)
      const mEnd = hand(cx, cy, 15, (minutes % 60) * 6)
      return `
        <circle class="furn" cx="${cx}" cy="${cy}" r="22"/>
        <circle class="furn-3" cx="${cx}" cy="${cy}" r="16"/>
        <line class="ink-2" x1="${cx}" y1="${cy}" x2="${hEnd.x.toFixed(1)}" y2="${hEnd.y.toFixed(1)}"/>
        <line class="ink-2" x1="${cx}" y1="${cy}" x2="${mEnd.x.toFixed(1)}" y2="${mEnd.y.toFixed(1)}" stroke-width="2.5"/>
        <circle class="ink-dot" cx="${cx}" cy="${cy}" r="2.5"/>`
    }
    case 'lounge':
      return `
        <rect class="furn" x="${ix}" y="${iy}" width="40" height="24" rx="10"/>
        <ellipse class="furn-3" cx="${ix + 20}" cy="${iy + 34}" rx="20" ry="12"/>`
    case 'shelf':
      return `
        <rect class="furn" x="${ix + 10}" y="${iy}" width="20" height="44" rx="6"/>
        <line class="ink" x1="${ix + 14}" y1="${iy + 14}" x2="${ix + 26}" y2="${iy + 14}"/>
        <line class="ink" x1="${ix + 14}" y1="${iy + 28}" x2="${ix + 26}" y2="${iy + 28}"/>`
    case 'locker':
      return `
        <rect class="furn" x="${ix + 8}" y="${iy}" width="24" height="42" rx="6"/>
        <line class="ink" x1="${ix + 13}" y1="${iy + 18}" x2="${ix + 29}" y2="${iy + 18}"/>`
    case 'meeting':
      return `
        <circle class="furn-2" cx="${ix + 22}" cy="${iy + 2}" r="6"/>
        <ellipse class="furn" cx="${ix + 22}" cy="${iy + 18}" rx="20" ry="13"/>
        <circle class="furn-2" cx="${ix + 4}" cy="${iy + 18}" r="6"/>
        <circle class="furn-2" cx="${ix + 40}" cy="${iy + 18}" r="6"/>`
    case 'files':
      return `
        <rect class="furn" x="${ix + 2}" y="${iy}" width="40" height="42" rx="6"/>
        <line class="ink" x1="${ix + 9}" y1="${iy + 12}" x2="${ix + 35}" y2="${iy + 12}"/>
        <line class="ink" x1="${ix + 9}" y1="${iy + 22}" x2="${ix + 35}" y2="${iy + 22}"/>
        <line class="ink" x1="${ix + 9}" y1="${iy + 32}" x2="${ix + 35}" y2="${iy + 32}"/>`
    default:
      return ''
  }
}

function tile(spot: CompactSpot, y: number, minutes: number, locked?: string) {
  const textX = ICON_X + 62
  const label = `
    <text class="spot__tagtext" x="${textX}" y="${y + TILE_H / 2 - 4}" style="text-anchor:start">${spot.label}</text>
    <text class="spot__tagsub" x="${textX}" y="${y + TILE_H / 2 + 15}" style="text-anchor:start">${locked ? 'Locked' : spot.sub}</text>`
  const attrs = locked
    ? `aria-disabled="true" aria-label="${spot.label}, locked. ${locked}"`
    : `data-go="${spot.href}" aria-label="${spot.label} — ${spot.sub}"`
  return `
    <g class="spot${locked ? ' spot--locked' : ''}" data-spot="${spot.id}" tabindex="0" role="button" ${attrs}>
      <rect class="spot__tagbg" x="${TILE_X}" y="${y}" width="${TILE_W}" height="${TILE_H}" rx="16"/>
      <g class="spot__art">${icon(spot.id, ICON_X, y + 14, minutes)}</g>
      ${label}
    </g>`
}

function compactRoomSVG(opts: { minutes: number; isHr: boolean; formatTime: (m: number) => string }) {
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
    {
      spot: meeting,
      locked: opts.isHr ? undefined : 'Holds group data only.',
    },
    ...(opts.isHr ? [{ spot: files }] : []),
  ]

  const height = TOP_PAD + rows.length * TILE_H + (rows.length - 1) * GAP + BOTTOM_PAD

  const tiles = rows
    .map((r, i) => tile(r.spot, TOP_PAD + i * (TILE_H + GAP), opts.minutes, r.locked))
    .join('')

  return {
    height,
    svg: `
    <svg class="room__svg" viewBox="0 0 ${W} ${height}" role="img"
         aria-label="The office. Use the destination buttons, or open List view for the same links as text.">
      <rect class="floor" x="4" y="4" width="${W - 8}" height="${height - 8}" rx="18"/>
      <rect class="wall" x="4" y="4" width="${W - 8}" height="${height - 8}" rx="18"/>

      <g class="room-avatar" aria-hidden="true" style="opacity:1;transform:none">
        <circle class="room-avatar__dot" cx="${W / 2}" cy="38" r="22"/>
        <text class="room-avatar__initials" x="${W / 2}" y="44">?</text>
      </g>

      ${tiles}
    </svg>`,
  }
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
  const roomRef = useRef<HTMLDivElement>(null)
  const [loaded, setLoaded] = useState(false)

  const build = useCallback(() => {
    const WW = window.WW
    if (!WW?.room || !roomRef.current) return

    const minutes = WW.room.nowMinutes()
    const { svg } = compactRoomSVG({ minutes, isHr, formatTime: WW.room.formatTime })

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
