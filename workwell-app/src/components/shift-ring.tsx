'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { labelTime, ringState, type DayLog, type Shift } from '@/lib/shift'

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
    </defs>
    <path class="shift-ring__track" d="${RING_PATH}"/>
    <path class="shift-ring__glow shift-ring__glow--wide" d="${RING_PATH}" pathLength="1"/>
    <path class="shift-ring__glow shift-ring__glow--mid" d="${RING_PATH}" pathLength="1"/>
    <path class="shift-ring__fill" d="${RING_PATH}" pathLength="1"/>
    <g mask="url(#shift-ring-filled)">
      <path class="shift-ring__shimmer" d="${RING_PATH}" pathLength="1"/>
    </g>
    <g class="shift-ring__tip" hidden>
      <circle class="shift-ring__tip-halo" r="12"/>
      <circle class="shift-ring__tip-dot" r="5.5"/>
    </g>
    <g class="shift-ring__ends">
      <circle class="shift-ring__end is-start" cx="482" cy="696" r="6"/>
      <circle class="shift-ring__end is-finish" cx="518" cy="696" r="6"/>
      <text class="shift-ring__label is-start" x="468" y="696">in ${labelTime(shift.time_in)}</text>
      <text class="shift-ring__label is-finish" x="532" y="696">out ${labelTime(shift.time_out)}</text>
    </g>`
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

      const [{ data: assignment }, { data: attendance }] = await Promise.all([
        supabase
          .from('shift_assignments')
          .select('shifts(id, name, time_in, meal_start, meal_end, time_out)')
          .maybeSingle(),
        supabase
          .from('attendance')
          .select('time_in, lunch_start, lunch_end, time_out')
          .eq('day', today)
          .maybeSingle(),
      ])
      if (cancelled) return

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

    read()
    const id = window.setInterval(read, 60000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [])

  // Draws and re-draws. Runs every second so the fill creeps rather than
  // stepping, and so a rebuild by room.js is repaired within a second of it
  // happening rather than leaving the wall blank until the next minute.
  useEffect(() => {
    if (!shift) return

    const paint = () => {
      const svg = roomRef.current?.querySelector<SVGSVGElement>('svg.room__svg')
      const log = logRef.current
      if (!svg || !log) return

      let ring = svg.querySelector<SVGGElement>('.shift-ring')
      if (!ring) {
        ring = document.createElementNS('http://www.w3.org/2000/svg', 'g')
        ring.setAttribute('class', 'shift-ring')
        ring.setAttribute('aria-hidden', 'true')
        ring.innerHTML = skeleton(shift)
        // Last child: over the floor and the furniture, under nothing. The
        // group takes no pointer events, so the spots underneath it stay
        // clickable.
        svg.appendChild(ring)
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
