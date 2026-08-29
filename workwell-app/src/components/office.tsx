'use client'

import Script from 'next/script'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { signOutEverywhere } from '@/components/sign-out'
import { hideSky, showSky } from '@/lib/sky'
import { Wordmark } from '@/components/brandmark'
import { ShiftRing } from '@/components/shift-ring'
import { usePrefs } from '@/lib/use-prefs'
import { createClient } from '@/lib/supabase/client'

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
  'tasks.html': '/tasks',
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

/** What the board can hold before it starts hiding things. Four rows, two
 *  under each heading — set by the drawn geometry in room.js, not by taste,
 *  so the two have to be changed together. */
const BOARD_ROWS = 4

/** How wide a row's text may be, in the room's own units: the board panel's
 *  right edge (x 930 in room.js) less where the text starts (x 722) and a
 *  little air. Both numbers live in room.js's drawn geometry — move the
 *  board and this moves with it. */
const BOARD_TEXT_WIDTH = 196

/**
 * Put a title on a row, trimmed to what the board can actually hold.
 *
 * Measured rather than counted. A character limit is the obvious way to do
 * this and it does not work: the type is proportional, so 22 narrow letters
 * fit comfortably while 22 wide ones run 60-odd units past the edge of the
 * board and out over the wall. getComputedTextLength asks the renderer what
 * it actually drew, which is the only thing that answers the question.
 *
 * It throws when the text is not being rendered — the room is in list view,
 * say — so a failure here falls back to a rough character cap and leaves the
 * next rebuild to do it properly, exactly as placeMarks does in shift-ring.
 */
function fitBoardText(el: SVGTextElement, title: string) {
  el.textContent = title
  let width: number
  try {
    width = el.getComputedTextLength()
  } catch {
    el.textContent = title.length > 22 ? `${title.slice(0, 21)}…` : title
    return
  }
  if (width <= BOARD_TEXT_WIDTH) return

  // Shorten a character at a time. Titles are a line long, so this is a
  // handful of measurements, and the alternative — guessing an average
  // glyph width — is the thing that was wrong in the first place.
  let cut = title.length
  while (cut > 1) {
    cut -= 1
    el.textContent = `${title.slice(0, cut).trimEnd()}…`
    try {
      if (el.getComputedTextLength() <= BOARD_TEXT_WIDTH) return
    } catch {
      return
    }
  }
}

type BoardTask = { title: string; done: boolean; overdue: boolean; assigned: boolean }

/**
 * Write the day's tasks onto the board room.js drew empty.
 *
 * Runs after every rebuild rather than once, because build() replaces the
 * room's whole innerHTML on the clock tick and takes the board with it.
 * That is also why nothing here holds a reference between calls: the nodes
 * it writes into are new every time.
 *
 * Open tasks only, and assigned before your own — the board is a reminder,
 * not a record, and the half somebody else is waiting on is the half worth
 * the space. Anything that will not fit is counted rather than dropped
 * silently, so the board never quietly under-reports the day.
 *
 * The rows are drawn at fixed positions but laid out here, because a
 * heading belongs to the rows under it and neither half is always present.
 * Filling the drawn rows in order and hiding the empty ones put "Yours"
 * underneath its own tasks the moment nothing was assigned. Each visible
 * section is placed in turn instead, from the top of the board down.
 */
function paintTaskBoard(root: HTMLElement, tasks: BoardTask[]) {
  const board = root.querySelector('.taskboard')
  if (!board) return

  const heads = board.querySelectorAll<SVGTextElement>('.taskboard__head')
  const rows = board.querySelectorAll<SVGGElement>('.taskboard__row')
  const more = board.querySelector<SVGTextElement>('.taskboard__more')
  if (heads.length < 2 || rows.length < BOARD_ROWS || !more) return

  const open = tasks.filter((t) => !t.done)
  const assigned = open.filter((t) => t.assigned)
  const own = open.filter((t) => !t.assigned)

  // Each side keeps at least half the board when it can fill it, and gives
  // up what it cannot use — a half-empty board beside a hidden task would
  // be the wrong trade.
  const half = Math.floor(BOARD_ROWS / 2)
  const takeAssigned = Math.min(
    assigned.length,
    own.length >= half ? half : BOARD_ROWS - Math.min(own.length, half)
  )
  const takeOwn = Math.min(own.length, BOARD_ROWS - takeAssigned)

  const sections = [
    { head: heads[0], items: assigned.slice(0, takeAssigned) },
    { head: heads[1], items: own.slice(0, takeOwn) },
  ].filter((sec) => sec.items.length > 0)

  /* Vertical rhythm, in the room's units. These match the positions room.js
     draws the empty board at, so the untouched board and a fully laid-out
     one sit at exactly the same place. */
  const TOP = 466 // first heading's baseline
  const HEAD_TO_ROW = 10 // heading baseline down to the first box's top
  const ROW_PITCH = 24
  const SECTION_GAP = 22 // past the last box, down to the next heading

  /** Slide an element from where it was drawn to where it belongs. The
   *  drawn y is never mutated, so this stays correct on a repaint. */
  const place = (el: Element, natural: number, target: number) => {
    const dy = target - natural
    if (dy === 0) el.removeAttribute('transform')
    else el.setAttribute('transform', `translate(0 ${dy})`)
  }

  heads.forEach((h) => h.classList.add('is-empty'))
  rows.forEach((r) => r.classList.add('is-empty'))

  let y = TOP
  let used = 0
  for (const section of sections) {
    section.head.classList.remove('is-empty')
    place(section.head, Number(section.head.getAttribute('y')), y)
    y += HEAD_TO_ROW

    for (const task of section.items) {
      const row = rows[used]
      const box = row?.querySelector<SVGRectElement>('.taskboard__box')
      const text = row?.querySelector<SVGTextElement>('.taskboard__text')
      if (!row || !box || !text) break

      row.classList.remove('is-empty')
      row.setAttribute('data-done', String(task.done))
      row.setAttribute('data-overdue', String(task.overdue))
      // Trimmed here rather than by CSS: SVG text has no ellipsis, and an
      // untrimmed title runs straight off the board and over the wall.
      fitBoardText(text, task.title)
      place(row, Number(box.getAttribute('y')), y)

      y += ROW_PITCH
      used += 1
    }
    y += SECTION_GAP
  }

  const hidden = open.length - used
  more.textContent =
    open.length === 0 ? 'Nothing open' : hidden > 0 ? `+${hidden} more` : ''
  // Straight under the last row, or at the top of an empty board rather
  // than floating in the middle of nothing.
  place(more, Number(more.getAttribute('y')), sections.length ? y - SECTION_GAP : TOP)
}


export function Office({
  name,
  initials,
  colour = 'accent',
  greeting = 'warm',
  avatarUrl = null,
  avatarOffsetX = 50,
  avatarOffsetY = 50,
}: {
  /** Preferred name if one is set, otherwise the employment record's. */
  name: string
  /** An override; null means derive from the name. */
  initials?: string | null
  colour?: string
  greeting?: string
  /** A signed URL for the figure's photo; null draws the colour dot instead. */
  avatarUrl?: string | null
  /** Where within the photo the crop is centred, 0-100 each axis. */
  avatarOffsetX?: number
  avatarOffsetY?: number
}) {
  const router = useRouter()
  const roomRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  // Which view the person chose, not which one they're stuck with — same
  // account-scoped table as the rest of the workspace's display prefs
  // (theme, contrast, motion), so it follows them through a refresh, a
  // sign-out and back in, or a trip to another screen and back, instead of
  // resetting to Room on every visit.
  const { value: homePrefs, update: updateHomePrefs } = usePrefs(
    'workspace_prefs',
    { home_view: 'room' as 'room' | 'list' }
  )
  const { value: boundaryPrefs } = usePrefs('boundaries', {
    quiet_from: '18:30:00',
    quiet_to: '08:30:00',
    quiet_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as string[],
  })
  const setView = useCallback(
    (home_view: 'room' | 'list') => updateHomePrefs({ home_view }),
    [updateHomePrefs]
  )
  // Starts false and flips before first paint (see the layout effect below)
  // rather than reading matchMedia in the initializer — that would answer
  // differently on the server (no window) than on the client's first render
  // and React would flag the mismatch.
  const [isMobile, setIsMobile] = useState(false)
  // The room is a scene to walk around in; on a phone there is no room to
  // walk around in, only a screen too small to see one in. The list was
  // already the non-optional fallback for exactly this — mobile just never
  // gets offered the choice. This never writes back to the stored
  // preference: a phone visit must not quietly overwrite a desktop choice.
  const activeView = isMobile ? 'list' : homePrefs.home_view
  // Lazy-init: on a client-side return to this screen room.js is already
  // loaded, so there is nothing to wait on — start "loaded" instead of
  // flashing the placeholder text for a frame before the effect below
  // catches up.
  const [loaded, setLoaded] = useState(
    () => typeof window !== 'undefined' && !!window.WW?.room
  )
  const [phase, setPhase] = useState<string | null>(null)
  const [clock, setClock] = useState<string | null>(null)
  const [boardTasks, setBoardTasks] = useState<BoardTask[]>([])
  const [confirmingSignOut, setConfirmingSignOut] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const doorRef = useRef<Element | null>(null)

  const build = useCallback(() => {
    const WW = window.WW
    if (!WW?.room || !roomRef.current) return

    const minutes = WW.room.nowMinutes()

    // Office renders only for private-plane accounts now — HR/admin lands on
    // /org instead (see page.tsx) and never reaches this component.
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
    // Prefer the DB-backed boundaries (Boundary assistant) over the prototype's
    // localStorage fallback, so saving Quiet Hours 10:24 am–02:30 pm is
    // reflected immediately on the dashboard as "Kkena · 10:35 am · quiet hours".
    const toMins = (t: string) => {
      const [h, m] = (t ?? '').slice(0, 5).split(':').map(Number)
      return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0)
    }
    let phase = WW.room.phaseAt(minutes)
    try {
      const b = boundaryPrefs as unknown as { quiet_from?: string; quiet_to?: string; quiet_days?: string[] }
      if (b?.quiet_from && b?.quiet_to) {
        const from = toMins(b.quiet_from)
        const to = toMins(b.quiet_to)
        const days = b.quiet_days as string[] | undefined
        // If days is set, respect it; otherwise fall back to time-only check (prototype behaviour)
        const todayIdx = new Date().getDay() // 0 Sun
        const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][todayIdx]
        const inDays = !days || days.length === 0 ? true : days.includes(dayName)
        const inWindow = from > to ? (minutes >= from || minutes < to) : (minutes >= from && minutes < to)
        phase = inDays && inWindow ? 'quiet' : inDays ? (minutes < 12 * 60 ? 'morning' : 'day') : WW.room.phaseAt(minutes)
      }
    } catch {}
    roomRef.current.dataset.phase = phase

    // The avatar shipped reading "?" because nothing ever filled it in.
    const mark = roomRef.current.querySelector('.room-avatar__initials')
    if (mark) mark.textContent = avatarUrl ? '' : initials?.trim() || initialsOf(name)
    roomRef.current.dataset.avatarColour = colour

    // A photo, clipped into the same circle the colour dot already draws —
    // sized a touch smaller than the dot so the avatar colour still shows
    // through as a ring. innerHTML above rebuilds this group from scratch
    // every call, so there is never a stale image node to clean up first.
    // Radius matches .room-avatar__dot's own CSS-set r (room.css) minus a
    // few px for the ring — keep the two in step if that size changes.
    //
    // A foreignObject rather than an SVG <image>: preserveAspectRatio only
    // offers nine fixed alignment points, not the continuous position
    // Profile settings' sliders produce. A plain HTML <img> with the same
    // object-fit/object-position the sidebar and profile card use gets an
    // identical crop everywhere the photo appears, from one shared rule.
    const avatarGroup = roomRef.current.querySelector('.room-avatar')
    if (avatarGroup && avatarUrl) {
      const svgNS = 'http://www.w3.org/2000/svg'
      const photoRadius = 21
      const photoSize = photoRadius * 2

      const clip = document.createElementNS(svgNS, 'clipPath')
      clip.setAttribute('id', 'room-avatar-clip')
      const clipCircle = document.createElementNS(svgNS, 'circle')
      clipCircle.setAttribute('cx', '500')
      clipCircle.setAttribute('cy', '672')
      clipCircle.setAttribute('r', String(photoRadius))
      clip.appendChild(clipCircle)
      avatarGroup.appendChild(clip)

      const fo = document.createElementNS(svgNS, 'foreignObject')
      fo.setAttribute('x', String(500 - photoRadius))
      fo.setAttribute('y', String(672 - photoRadius))
      fo.setAttribute('width', String(photoSize))
      fo.setAttribute('height', String(photoSize))
      fo.setAttribute('clip-path', 'url(#room-avatar-clip)')

      const image = document.createElement('img')
      image.className = 'room-avatar__photo'
      image.alt = ''
      image.src = avatarUrl
      image.style.width = '100%'
      image.style.height = '100%'
      image.style.display = 'block'
      image.style.objectFit = 'cover'
      image.style.objectPosition = `${avatarOffsetX}% ${avatarOffsetY}%`
      fo.appendChild(image)
      avatarGroup.appendChild(fo)
    }

    paintTaskBoard(roomRef.current, boardTasks)

    if (listRef.current) {
      listRef.current.innerHTML = WW.room.roomList('employee', false, caps)
    }

    // Mirror the phase logic used for the room's dataset above (DB-backed quiet hours)
    let nextPhase = WW.room.phaseAt(minutes)
    try {
      const b = boundaryPrefs as unknown as { quiet_from?: string; quiet_to?: string; quiet_days?: string[] }
      if (b?.quiet_from && b?.quiet_to) {
        const hm = (t: string) => {
          const [h, m] = (t ?? '').slice(0, 5).split(':').map(Number)
          return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0)
        }
        const from = hm(b.quiet_from)
        const to = hm(b.quiet_to)
        const days = b.quiet_days as string[] | undefined
        const todayIdx = new Date().getDay()
        const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][todayIdx]
        const inDays = !days || days.length === 0 ? true : days.includes(dayName)
        const inWindow = from > to ? (minutes >= from || minutes < to) : (minutes >= from && minutes < to)
        if (inDays && inWindow) nextPhase = 'quiet'
        else if (inDays) nextPhase = minutes < 12 * 60 ? 'morning' : 'day'
      }
    } catch {}
    setPhase(nextPhase)
    setClock(WW.room.formatTime(minutes))
    setLoaded(true)
  }, [name, initials, colour, avatarUrl, avatarOffsetX, avatarOffsetY, boardTasks, boundaryPrefs])

  // Read once on arrival. The board is a glance at the day, not a live
  // view of it — and the room already rebuilds itself every minute, which
  // would make a subscription here the second thing keeping this component
  // busy for a picture nobody is watching.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const today = new Date()
      const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

      const [own, given] = await Promise.all([
        supabase.from('tasks').select('title, due_on, done_at'),
        supabase.from('assigned_tasks').select('title, due_on, done_at'),
      ])
      if (cancelled) return

      // A board that cannot be drawn is left blank rather than made into an
      // error: nothing else in the room can fail loudly, and this is the
      // one piece that reads from a table.
      if (own.error || given.error) return

      const shape = (
        rows: { title: string; due_on: string | null; done_at: string | null }[],
        assigned: boolean
      ) =>
        rows.map((r) => ({
          title: r.title,
          done: Boolean(r.done_at),
          overdue: Boolean(!r.done_at && r.due_on && r.due_on < iso),
          assigned,
        }))

      setBoardTasks([
        ...shape(given.data ?? [], true),
        ...shape(own.data ?? [], false),
      ])
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useIsomorphicLayoutEffect(() => {
    const mq = window.matchMedia('(max-width: 860px)')
    setIsMobile(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

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
      // that ends a session — confirm once before it fires. A themed
      // dialog rather than window.confirm: the room is the one screen in
      // this app with no header, no chrome to match a browser-native
      // prompt against, and a plain confirm() reads like the app broke
      // rather than like part of it.
      if (el.dataset.signout !== undefined) {
        // The list's sign-out button has no `.frontdoor` ancestor — fall
        // back to the control itself so cancelling still returns focus
        // somewhere, instead of silently dropping it.
        doorRef.current = target.closest('.frontdoor') ?? el
        setConfirmingSignOut(true)
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

  const cancelSignOut = useCallback(() => {
    setConfirmingSignOut(false)
    // Focus goes back to the door, not lost to the body — the click that
    // opened this dialog came from a keyboard just as often as a mouse.
    ;(doorRef.current as HTMLElement | SVGElement | null)?.focus?.()
  }, [])

  const confirmSignOut = useCallback(() => {
    setSigningOut(true)
    void signOutEverywhere().then(() => {
      router.push('/')
      router.refresh()
    })
  }, [router])

  useEffect(() => {
    if (!confirmingSignOut) return
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelSignOut()
    }
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [confirmingSignOut, cancelSignOut])

  return (
    <>
      {/* room before sky: sky.js reads WW.room for the current minute. Both
          get onReady={build}, not just sky's — afterInteractive scripts
          aren't guaranteed to finish loading in declaration order (a cold
          cache can have sky.js's request win the race), and without this
          build() would run once, too early, see WW.room still undefined,
          bail, and never get called again until the next-minute clock
          tick — up to a minute stuck on "Opening your space…". build()
          itself no-ops safely if room.js hasn't landed yet, so calling it
          from whichever script finishes first is harmless; it's the one
          that finishes last that actually builds the room. */}
      <Script src="/prototype/room.js" strategy="afterInteractive" onReady={build} />
      <Script
        src="/prototype/sky.js"
        strategy="afterInteractive"
        onReady={build}
      />

      {/* Only the room locks itself to the viewport; the list has to scroll. */}
      <div className={`room-shell${activeView === 'room' ? ' is-fit' : ''}`}>
        {/* No header bar — just the mark, pasted over the background top
            left, and the room/list switch floating to match. Signing out
            now happens at the front door, in the room itself. */}
        <div className="room-brand">
          <Wordmark />
        </div>

        {/* Nothing to switch between on a phone — there is no room, so
            offering a way back to it is offering a dead end. */}
        {!isMobile && (
          <div className="room-nav-toggle segmented" role="group" aria-label="How to navigate">
            <button
              type="button"
              aria-pressed={activeView === 'room'}
              onClick={() => setView('room')}
            >
              Room
            </button>
            <button
              type="button"
              aria-pressed={activeView === 'list'}
              onClick={() => setView('list')}
            >
              List
            </button>
          </div>
        )}

        <main className="room-stage">
          <div
            className={`room-views${activeView === 'room' ? ' is-on' : ''}`}
            data-view-panel="room"
            hidden={activeView !== 'room'}
          >
            <p className="room-clock t-subtle">
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
            {/* Draws into the room's own SVG rather than over it — see the
                note in shift-ring.tsx for why an overlay could not be made
                to land on the wall reliably. */}
            <ShiftRing roomRef={roomRef} />
            {!loaded && (
              <p className="t-subtle" style={{ textAlign: 'center' }}>
                Opening your space…
              </p>
            )}
          </div>

          {/* A picture must never be the only way to navigate.
              `is-on` is not decoration here: .room-views is display:none
              until it has that class, so without it the List button
              switched to a panel that could never be shown. */}
          <div
            className={`room-views${activeView === 'list' ? ' is-on' : ''}`}
            data-view-panel="list"
            hidden={activeView !== 'list'}
            style={{ width: 'min(560px, 100%)' }}
          >
            <h1 className="mb-2" style={{ fontSize: 'var(--fs-xl)' }}>
              Where would you like to go?
            </h1>
            <p className="t-subtle mb-4">Everywhere you can go from here.</p>
            <div ref={listRef} onClick={navigate} onKeyDown={onKey} />

            {/* The room has the front door; the list needs its own way to
                end a session, or it isn't really the room's equal. Same
                `data-signout` mechanism navigate() already listens for. */}
            <ul className="roomlist mt-4" onClick={navigate} onKeyDown={onKey}>
              <li>
                <button
                  type="button"
                  className="roomlist__item"
                  data-signout="true"
                >
                  <span className="roomlist__label">🚪 Sign out</span>
                  <span className="roomlist__sub">End your session</span>
                </button>
              </li>
            </ul>
          </div>
        </main>
      </div>

      {confirmingSignOut && (
        <div
          className="room-confirm"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="room-confirm-title"
          aria-describedby="room-confirm-sub"
          onClick={(e) => {
            if (e.target === e.currentTarget) cancelSignOut()
          }}
        >
          <div className="room-confirm__card">
            <p id="room-confirm-title" className="room-confirm__title">
              Heading out?
            </p>
            <p id="room-confirm-sub" className="room-confirm__sub">
              You&rsquo;ll need to sign back in to return to your space.
            </p>
            <div className="room-confirm__actions">
              <button
                className="btn btn--ghost"
                type="button"
                autoFocus
                onClick={cancelSignOut}
              >
                Stay
              </button>
              <button
                className="btn btn--danger"
                type="button"
                disabled={signingOut}
                onClick={confirmSignOut}
              >
                {signingOut ? 'Signing out…' : 'Sign out'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
