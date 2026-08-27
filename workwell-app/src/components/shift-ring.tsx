'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  labelTime,
  mealFraction,
  ringState,
  timeInWindow,
  toHHMM,
  workingMinutes,
  type DayLog,
  type RingState,
  type Shift,
} from '@/lib/shift'

/**
 * The working day, drawn on the room's own wall.
 *
 * The path traces the floor plan's outer wall exactly — the same rounded
 * rect as `.floor` in room.js (x24 y24, 952×672, r22) — with a gap left at
 * bottom centre so the two ends read as a beginning and an end rather than a
 * closed loop. It runs clockwise from that gap, which from the bottom of a
 * loop means heading left first, the way a clock's hand leaves six.
 *
 * Injected into the room's own <svg> rather than layered over it in a second
 * one. An overlay has to be positioned to land on the wall, and the room's
 * SVG letterboxes inside its box, so the two only agree if their boxes agree
 * exactly — they did not, and the ring drew low, with its labels hanging off
 * the bottom of the room. Sharing the room's viewBox removes the question:
 * user units here are the same user units the wall was drawn in.
 *
 * That means living with room.js rewriting the room's innerHTML on every
 * clock tick, which throws these nodes away with everything else. Rather
 * than couple to when that happens, the tick below re-creates the group
 * whenever it finds it missing — self-healing, and cheap when it isn't.
 */

const RING_PATH =
  'M 482 696 L 46 696 A 22 22 0 0 1 24 674 L 24 46 A 22 22 0 0 1 46 24 ' +
  'L 954 24 A 22 22 0 0 1 976 46 L 976 674 A 22 22 0 0 1 954 696 L 518 696'

/* The dock: what's left of the day, and the one button that starts or ends
   it. Bottom centre, directly above the front door — the day is begun and
   ended in the same place you walk in and out.

   The band it sits in is the only clear strip along the bottom: the locker
   and policies tags own the bottom left, the ring's own in/out labels sit on
   the wall at y 696, and the front door owns everything below y 640 — not
   just its leaves and hit area but the soft pulse circle around it, which
   reaches up to y 640 and is the real constraint here. Sitting clear of that
   is what keeps the button off a glow that would muddy it.

   It does cross the rug, which is deliberate: a rug is flat floor art, not
   something a label can collide with. */
const BTN_W = 176
const BTN_H = 38
const DOCK_X = 500
const BTN_Y = 606
const HOURS_Y = 572

/** 465 → '7h 45m left'. Minutes alone read as a stopwatch, not a day. */
function hoursLeft(mins: number) {
  if (mins <= 0) return 'Shift complete'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h ? `${h}h ${m}m left` : `${m}m left`
}

type DockState = {
  label: string
  /** null when there is nothing to press — the button still says why. */
  action: 'in' | 'out' | null
  mode: 'ready' | 'working' | 'paused' | 'done' | 'shut'
}

/**
 * What the one button says and does right now.
 *
 * One button rather than two, because at any moment exactly one of them
 * would have been pressable — a permanently dead "Time out" sitting next to
 * "Time in" is a control that spends most of the day lying about what you
 * can do. When there is nothing to press it keeps the space and explains
 * itself instead of vanishing, so the dock never changes shape under the
 * cursor.
 */
function dockState(
  shift: Shift,
  s: RingState,
  log: DayLog,
  now: Date,
  timeZone: string | null
): DockState {
  // Keyed on the time-out stamp, not on RingState.done — that also goes true
  // the moment the ring fills, and someone who has worked their whole shift
  // without clocking out still has to be able to clock out. Reading it here
  // would have replaced their only way to do that with "Done for today".
  if (log.timeOut) return { label: 'Done for today', action: null, mode: 'done' }
  if (log.timeIn) {
    return {
      label: 'Time out',
      action: 'out',
      mode: s.paused ? 'paused' : 'working',
    }
  }
  const window_ = timeInWindow(shift, now, timeZone)
  if (!window_.open) {
    return {
      label: `Opens ${labelTime(toHHMM(window_.opensAt ?? 0))}`,
      action: null,
      mode: 'shut',
    }
  }
  return { label: 'Time in', action: 'in', mode: 'ready' }
}

/** Built once per injection; everything that changes is set as an attribute
 *  afterwards, so nothing here is re-parsed on a tick. */
function skeleton(shift: Shift) {
  return `
    <defs>
      <linearGradient id="shift-ring-grad" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0%" stop-color="#34d399"/>
        <stop offset="55%" stop-color="#4ade80"/>
        <stop offset="100%" stop-color="#86efac"/>
      </linearGradient>
      <!-- Wider than the shimmer it clips, so a round cap is never shaved. -->
      <mask id="shift-ring-filled">
        <path class="shift-ring__maskpath" d="${RING_PATH}" pathLength="1"
              fill="none" stroke="#fff" stroke-width="11" stroke-linecap="round"/>
      </mask>
      <!-- Keeps the button's own progress fill and its travelling sheen
           inside the pill instead of squaring off at its corners. -->
      <clipPath id="shift-dock-clip">
        <rect x="${-BTN_W / 2}" y="${-BTN_H / 2}" width="${BTN_W}" height="${BTN_H}" rx="${BTN_H / 2}"/>
      </clipPath>
      <linearGradient id="shift-dock-sheen-grad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#fff" stop-opacity="0"/>
        <stop offset="50%" stop-color="#fff" stop-opacity=".5"/>
        <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <path class="shift-ring__track" d="${RING_PATH}" aria-hidden="true"/>
    <path class="shift-ring__glow shift-ring__glow--wide" d="${RING_PATH}" pathLength="1" aria-hidden="true"/>
    <path class="shift-ring__glow shift-ring__glow--mid" d="${RING_PATH}" pathLength="1" aria-hidden="true"/>
    <path class="shift-ring__fill" d="${RING_PATH}" pathLength="1" aria-hidden="true"/>
    <g mask="url(#shift-ring-filled)" aria-hidden="true">
      <path class="shift-ring__shimmer" d="${RING_PATH}" pathLength="1"/>
    </g>
    <g class="shift-ring__hours" aria-hidden="true"></g>
    <g class="shift-ring__meal" hidden aria-hidden="true">
      <circle class="shift-ring__meal-dot" r="7"/>
      <text class="shift-ring__meal-label">meal ${labelTime(shift.meal_start)}</text>
      <text class="shift-ring__meal-hour"></text>
    </g>
    <g class="shift-ring__tip" hidden aria-hidden="true">
      <circle class="shift-ring__tip-halo" r="12"/>
      <circle class="shift-ring__tip-dot" r="5.5"/>
    </g>
    <g class="shift-ring__ends" aria-hidden="true">
      <circle class="shift-ring__end is-start" cx="482" cy="696" r="6"/>
      <circle class="shift-ring__end is-finish" cx="518" cy="696" r="6"/>
      <text class="shift-ring__label is-start" x="468" y="696">in ${labelTime(shift.time_in)}</text>
      <text class="shift-ring__label is-finish" x="532" y="696">out ${labelTime(shift.time_out)}</text>
    </g>
    <g class="shift-dock">
      <text class="shift-dock__hours" x="${DOCK_X}" y="${HOURS_Y}"></text>
      <!-- Positioned by attribute, scaled by CSS: a CSS transform on the same
           element would replace this translate rather than compose with it,
           and the button would spring to the room's top-left corner the
           moment it was hovered. -->
      <g transform="translate(${DOCK_X} ${BTN_Y})">
        <g class="shift-dock__btn" role="button" tabindex="0">
          <rect class="shift-dock__halo" x="${-BTN_W / 2 - 7}" y="${-BTN_H / 2 - 7}"
                width="${BTN_W + 14}" height="${BTN_H + 14}" rx="${BTN_H / 2 + 7}"/>
          <rect class="shift-dock__bg" x="${-BTN_W / 2}" y="${-BTN_H / 2}"
                width="${BTN_W}" height="${BTN_H}" rx="${BTN_H / 2}"/>
          <g clip-path="url(#shift-dock-clip)">
            <!-- The same water the ring is filling with, shown as how much of
                 the button is behind you. Width is set on the tick. -->
            <rect class="shift-dock__fill" x="${-BTN_W / 2}" y="${-BTN_H / 2}"
                  width="0" height="${BTN_H}"/>
            <rect class="shift-dock__sheen" x="${-BTN_W / 2}" y="${-BTN_H / 2}"
                  width="64" height="${BTN_H}" fill="url(#shift-dock-sheen-grad)"/>
          </g>
          <rect class="shift-dock__edge" x="${-BTN_W / 2}" y="${-BTN_H / 2}"
                width="${BTN_W}" height="${BTN_H}" rx="${BTN_H / 2}"/>
          <text class="shift-dock__label" y="1"></text>
        </g>
      </g>
    </g>`
}

const SVG_NS = 'http://www.w3.org/2000/svg'

/**
 * Where a label should sit so it leans into the room rather than out of it.
 *
 * Which way "in" is depends on the wall the mark landed on, so it is read
 * off the point's own coordinates rather than assumed — a label hung below
 * a mark on the *bottom* wall would sit outside the room entirely, which is
 * exactly the mistake the ring itself started out making. Bounds are
 * room.js's floor rect: x 24–976, y 24–696.
 */
function lean(pt: { x: number; y: number }) {
  if (pt.y <= 26) return { label: [0, 26], hour: [0, 43], anchor: 'middle' }
  if (pt.y >= 694) return { label: [0, -37], hour: [0, -20], anchor: 'middle' }
  if (pt.x <= 26) return { label: [19, -4], hour: [19, 13], anchor: 'start' }
  if (pt.x >= 974) return { label: [-19, -4], hour: [-19, 13], anchor: 'end' }
  // A corner arc — "inward" is diagonal and ambiguous, so drop below.
  return { label: [0, 26], hour: [0, 43], anchor: 'middle' }
}

/** The path's normal at a distance along it, for drawing a tick across it. */
function normalAt(path: SVGPathElement, dist: number, total: number) {
  const e = 0.75
  const a = path.getPointAtLength(Math.max(0, dist - e))
  const b = path.getPointAtLength(Math.min(total, dist + e))
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1
  return { nx: -(b.y - a.y) / len, ny: (b.x - a.x) / len }
}

/**
 * Draws the fixed marks: an hour tick for every worked hour, and the meal.
 *
 * The ring's whole length is the shift's *working* minutes, so an hour of
 * work is the same arc wherever it falls — the ticks are evenly spaced by
 * construction, and the meal always lands on one of them for any roster
 * whose break starts on the hour (all three of ours do). Run once, since
 * the roster fixes all of it; nothing here moves as the day passes.
 */
function placeMarks(ring: SVGGElement, shift: Shift) {
  const fill = ring.querySelector<SVGPathElement>('.shift-ring__fill')
  const hours = ring.querySelector<SVGGElement>('.shift-ring__hours')
  const meal = ring.querySelector<SVGGElement>('.shift-ring__meal')
  const label = ring.querySelector<SVGTextElement>('.shift-ring__meal-label')
  const hourText = ring.querySelector<SVGTextElement>('.shift-ring__meal-hour')
  if (!fill || !hours || !meal || !label || !hourText) return

  const worked = workingMinutes(shift)
  const mealF = mealFraction(shift)
  const mealHour = Math.round((mealF * worked) / 60)

  let total: number
  try {
    total = fill.getTotalLength()
    if (!total) return
  } catch {
    return
  }

  // Interior ticks only: hour 0 and the final hour are the two ends of the
  // day, which already carry their own markers on either side of the gap.
  hours.replaceChildren()
  for (let h = 1; h * 60 < worked; h++) {
    const f = (h * 60) / worked
    const d = total * f
    const p = fill.getPointAtLength(d)
    const { nx, ny } = normalAt(fill, d, total)
    // The hour the meal falls on is the one worth finding at a glance.
    const half = Math.abs(f - mealF) < 1e-6 ? 13 : 9
    const tick = document.createElementNS(SVG_NS, 'line')
    tick.setAttribute('class', 'shift-ring__hour-tick')
    tick.setAttribute('x1', String(p.x - nx * half))
    tick.setAttribute('y1', String(p.y - ny * half))
    tick.setAttribute('x2', String(p.x + nx * half))
    tick.setAttribute('y2', String(p.y + ny * half))
    hours.appendChild(tick)
  }

  const pt = fill.getPointAtLength(total * mealF)
  const put = lean(pt)
  meal.setAttribute('transform', `translate(${pt.x} ${pt.y})`)
  label.setAttribute('x', String(put.label[0]))
  label.setAttribute('y', String(put.label[1]))
  label.setAttribute('text-anchor', put.anchor)
  hourText.setAttribute('x', String(put.hour[0]))
  hourText.setAttribute('y', String(put.hour[1]))
  hourText.setAttribute('text-anchor', put.anchor)
  hourText.textContent = `${mealHour}h in, ${worked / 60 - mealHour}h to go`
  meal.removeAttribute('hidden')
}

type Row = {
  time_in: string | null
  lunch_start: string | null
  lunch_end: string | null
  time_out: string | null
}

export function ShiftRing({ roomRef }: { roomRef: React.RefObject<HTMLDivElement | null> }) {
  const [shift, setShift] = useState<Shift | null>(null)
  const logRef = useRef<DayLog | null>(null)
  // The roster is written in the office's hours, so the time-in window has to
  // be judged there too — the same rule attendance_time_in() enforces.
  const zoneRef = useRef<string | null>(null)
  // Lets the button re-read the moment it has stamped something, rather than
  // leaving the room a minute behind the press that changed it.
  const readRef = useRef<(() => Promise<void>) | null>(null)
  const busyRef = useRef(false)

  // One read on mount, then a re-read every minute: the two RPCs that stamp
  // the meal pause fire from the attendance screen, so this view has to pick
  // their result up rather than assume the roster was followed. Held in a
  // ref, not state — the tick below reads it directly, and re-rendering
  // React for a value only the DOM cares about would be wasted work.
  useEffect(() => {
    let cancelled = false

    const read = async () => {
      const supabase = createClient()
      const today = new Date().toISOString().slice(0, 10)

      const [{ data: assignment }, { data: attendance }, { data: org }] = await Promise.all([
        supabase
          .from('shift_assignments')
          .select('shifts(id, name, time_in, meal_start, meal_end, time_out)')
          .maybeSingle(),
        supabase
          .from('attendance')
          .select('time_in, lunch_start, lunch_end, time_out')
          .eq('day', today)
          .maybeSingle(),
        supabase.from('org').select('timezone').maybeSingle(),
      ])
      if (cancelled) return

      zoneRef.current = org?.timezone ?? null

      // The embed comes back as an object for a to-one relationship; the
      // generated types can't tell that from the shape alone.
      setShift((assignment as { shifts?: Shift } | null)?.shifts ?? null)

      const r = attendance as Row | null
      logRef.current = r
        ? {
            timeIn: r.time_in,
            lunchStart: r.lunch_start,
            lunchEnd: r.lunch_end,
            timeOut: r.time_out,
          }
        : { timeIn: null, lunchStart: null, lunchEnd: null, timeOut: null }
    }

    readRef.current = read
    read()
    const id = window.setInterval(read, 60000)
    return () => {
      cancelled = true
      readRef.current = null
      window.clearInterval(id)
    }
  }, [])

  // Draws and re-draws. Runs every second so the fill creeps rather than
  // stepping, and so a rebuild by room.js is repaired within a second of it
  // happening rather than leaving the wall blank until the next minute.
  useEffect(() => {
    if (!shift) return

    /**
     * The one button's press, whichever half of the day it is offering.
     *
     * Reads the state fresh at the moment of the click rather than closing
     * over what the last paint decided: a second may have passed, and the
     * server enforces the time-in window itself regardless, so acting on a
     * stale label is how you send a request that can only be refused.
     */
    const press = async () => {
      const log = logRef.current
      if (!log || busyRef.current) return
      const s = ringState(shift, log, new Date())
      const { action } = dockState(shift, s, log, new Date(), zoneRef.current)
      if (!action) return

      busyRef.current = true
      const supabase = createClient()
      const { error } = await supabase.rpc(
        action === 'in' ? 'attendance_time_in' : 'attendance_time_out'
      )
      busyRef.current = false
      if (error) {
        // The room has nowhere to put a sentence, so the button says it —
        // and the next read puts the real state back either way.
        const label = roomRef.current?.querySelector('.shift-dock__label')
        if (label) label.textContent = "Couldn't save"
        return
      }
      await readRef.current?.()
    }

    const paint = () => {
      const svg = roomRef.current?.querySelector<SVGSVGElement>('svg.room__svg')
      const log = logRef.current
      if (!svg || !log) return

      let ring = svg.querySelector<SVGGElement>('.shift-ring')
      if (!ring) {
        ring = document.createElementNS('http://www.w3.org/2000/svg', 'g')
        ring.setAttribute('class', 'shift-ring')
        // Not aria-hidden any more: the group now contains the day's one
        // real control, and hiding it from assistive tech would leave that
        // button unreachable. The decorative halves carry their own
        // aria-hidden instead.
        ring.innerHTML = skeleton(shift)
        // Last child: over the floor and the furniture, under nothing. The
        // group takes no pointer events, so the spots underneath it stay
        // clickable — the button re-enables them for itself.
        svg.appendChild(ring)

        // Bound here rather than on every tick: room.js rebuilds the room's
        // innerHTML on the clock tick and takes this group with it, so a
        // handler is attached exactly once per life of the group, alongside
        // the markup it belongs to.
        const btn = ring.querySelector<SVGGElement>('.shift-dock__btn')
        btn?.addEventListener('click', () => void press())
        btn?.addEventListener('keydown', (e) => {
          const k = (e as KeyboardEvent).key
          if (k !== 'Enter' && k !== ' ') return
          // Space scrolls the page otherwise, which on a bottom-of-the-room
          // control moves the thing you just aimed at.
          e.preventDefault()
          void press()
        })
      }

      // Placed here rather than once at injection: getPointAtLength throws
      // on a path that isn't being rendered, which is the case if the list
      // view was showing when the ring was built. Retrying while it is still
      // unplaced costs one attribute read a second and means switching back
      // to the room finds the mark there.
      if (ring.querySelector('.shift-ring__meal')?.hasAttribute('hidden')) {
        placeMarks(ring, shift)
      }

      const s = ringState(shift, log, new Date())
      const offset = String(1 - s.progress)

      ring.setAttribute(
        'data-mode',
        s.done ? 'done' : s.paused ? 'paused' : s.running ? 'running' : 'waiting'
      )
      ring
        .querySelectorAll<SVGPathElement>(
          '.shift-ring__fill, .shift-ring__glow, .shift-ring__maskpath'
        )
        .forEach((p) => p.style.setProperty('stroke-dashoffset', offset))

      // Behind the water, or still ahead of it.
      ring
        .querySelector('.shift-ring__meal')
        ?.setAttribute('data-passed', String(s.progress >= mealFraction(shift)))

      const tip = ring.querySelector<SVGGElement>('.shift-ring__tip')
      const fill = ring.querySelector<SVGPathElement>('.shift-ring__fill')
      if (tip && fill) {
        if (s.progress <= 0) {
          tip.setAttribute('hidden', '')
        } else {
          try {
            const pt = fill.getPointAtLength(fill.getTotalLength() * s.progress)
            tip.setAttribute('transform', `translate(${pt.x} ${pt.y})`)
            tip.removeAttribute('hidden')
          } catch {
            tip.setAttribute('hidden', '')
          }
        }
      }

      /* ---------------------------------------------------------- the dock */

      const now = new Date()
      const dock = dockState(shift, s, log, now, zoneRef.current)
      const dockEl = ring.querySelector<SVGGElement>('.shift-dock')
      const btn = ring.querySelector<SVGGElement>('.shift-dock__btn')
      const hours = ring.querySelector<SVGTextElement>('.shift-dock__hours')
      const label = ring.querySelector<SVGTextElement>('.shift-dock__label')
      const btnFill = ring.querySelector<SVGRectElement>('.shift-dock__fill')

      if (dockEl && btn && hours && label && btnFill) {
        dockEl.setAttribute('data-mode', dock.mode)
        hours.textContent = hoursLeft(s.remaining)

        // Only touch the label when it actually changes: writing the same
        // string every second would restart the cross-fade forever and leave
        // it permanently mid-transition.
        if (label.textContent !== dock.label) label.textContent = dock.label

        const pressable = dock.action !== null
        btn.setAttribute('aria-disabled', String(!pressable))
        btn.setAttribute('tabindex', pressable ? '0' : '-1')
        btn.setAttribute(
          'aria-label',
          pressable ? `${dock.label} — ${hoursLeft(s.remaining)}` : dock.label
        )

        // The day so far, shown as how much of the button is behind you —
        // the same measure the ring is drawing around the walls.
        btnFill.setAttribute('width', String(BTN_W * s.progress))
      }
    }

    paint()
    const id = window.setInterval(paint, 1000)
    return () => {
      window.clearInterval(id)
      // Leaving the room: take the ring with it, so a rebuild for someone
      // else's view never inherits this one's stale fill.
      roomRef.current?.querySelector('.shift-ring')?.remove()
    }
  }, [shift, roomRef])

  // Nothing rendered by React — the ring lives in the room's own SVG.
  return null
}
