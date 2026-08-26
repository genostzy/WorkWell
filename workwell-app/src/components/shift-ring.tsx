'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { labelTime, ringState, type DayLog, type Shift } from '@/lib/shift'

/**
 * The working day, drawn as the room's own wall.
 *
 * The path traces the floor plan's outer wall exactly — same rounded rect as
 * `.floor` in room.js (x24 y24, 952×672, r22) — with a gap left at bottom
 * centre so the two ends read as a beginning and an end rather than a closed
 * loop. It runs clockwise from that gap, which from the bottom of a circle
 * means heading left first, the way a clock's hand leaves six.
 *
 * Overlaid rather than drawn into the room because room.js writes its SVG
 * with innerHTML on every clock tick — anything React put inside would be
 * thrown away a minute later. Same viewBox and the same default
 * preserveAspectRatio as the room's SVG, in a box pinned to the same bounds,
 * so the two letterbox identically at every size.
 */

const RING_PATH =
  'M 482 696 L 46 696 A 22 22 0 0 1 24 674 L 24 46 A 22 22 0 0 1 46 24 ' +
  'L 954 24 A 22 22 0 0 1 976 46 L 976 674 A 22 22 0 0 1 954 696 L 518 696'

type Row = {
  time_in: string | null
  lunch_start: string | null
  lunch_end: string | null
  time_out: string | null
}

export function ShiftRing() {
  const [shift, setShift] = useState<Shift | null>(null)
  const [log, setLog] = useState<DayLog | null>(null)
  const [now, setNow] = useState(() => new Date())
  const pathRef = useRef<SVGPathElement>(null)
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null)

  // One read on mount, then a re-read every minute: the two RPCs that stamp
  // the meal pause fire from the attendance screen, so this view has to pick
  // their result up rather than assume the roster was followed.
  useEffect(() => {
    let cancelled = false

    const read = async () => {
      const supabase = createClient()
      const today = new Date().toISOString().slice(0, 10)

      const [{ data: assignment }, { data: attendance }] = await Promise.all([
        supabase
          .from('shift_assignments')
          .select('shift_id, shifts(id, name, time_in, meal_start, meal_end, time_out)')
          .maybeSingle(),
        supabase
          .from('attendance')
          .select('time_in, lunch_start, lunch_end, time_out')
          .eq('day', today)
          .maybeSingle(),
      ])
      if (cancelled) return

      // The embed comes back as an object for a to-one relationship, but the
      // generated types can't know that from the shape alone.
      const s = (assignment as { shifts?: Shift } | null)?.shifts ?? null
      setShift(s ?? null)

      const r = attendance as Row | null
      setLog(
        r
          ? {
              timeIn: r.time_in,
              lunchStart: r.lunch_start,
              lunchEnd: r.lunch_end,
              timeOut: r.time_out,
            }
          : { timeIn: null, lunchStart: null, lunchEnd: null, timeOut: null }
      )
    }

    read()
    const id = window.setInterval(read, 60000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [])

  // The fill has to creep, not step. A minute-granular tick would leave it
  // motionless for 59 seconds and then jump.
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const state = shift && log ? ringState(shift, log, now) : null

  // The head of the fill, in the path's own user units, so the droplet sits
  // exactly where the stroke ends at any progress.
  useEffect(() => {
    const path = pathRef.current
    if (!path || !state || state.progress <= 0) {
      setTip(null)
      return
    }
    try {
      const p = path.getPointAtLength(path.getTotalLength() * state.progress)
      setTip({ x: p.x, y: p.y })
    } catch {
      setTip(null)
    }
  }, [state?.progress, state])

  // No shift assigned is not a broken ring, it is a room with no roster on
  // it — draw nothing at all rather than an empty gauge that never moves.
  if (!shift || !state) return null

  const mode = state.done ? 'done' : state.paused ? 'paused' : state.running ? 'running' : 'waiting'

  return (
    <svg
      className="shift-ring"
      viewBox="0 0 1000 720"
      aria-hidden="true"
      data-mode={mode}
    >
      <defs>
        <linearGradient id="shift-ring-fill" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="55%" stopColor="#4ade80" />
          <stop offset="100%" stopColor="#86efac" />
        </linearGradient>

        {/* Confines the drifting highlight to the part of the wall the day
            has actually reached, so it never runs on ahead of the water. */}
        <mask id="shift-ring-filled">
          <path
            d={RING_PATH}
            pathLength={1}
            fill="none"
            stroke="#fff"
            strokeWidth={9}
            strokeLinecap="round"
            strokeDasharray={1}
            style={{ strokeDashoffset: 1 - state.progress }}
          />
        </mask>
      </defs>

      {/* The empty wall — where the day still has to go. */}
      <path className="shift-ring__track" d={RING_PATH} />

      {/* The glow is stacked translucent strokes rather than one blurred
          one. A CSS blur on a path this long builds a filter region the size
          of the whole room and re-runs it on every frame of an animation
          that never stops — it showed as a faint rectangular seam across the
          floor, and cost far more paint than the look is worth. Three
          widths of the same green falls off just as softly for nothing. */}
      <path
        className="shift-ring__glow shift-ring__glow--wide"
        d={RING_PATH}
        pathLength={1}
        style={{ strokeDashoffset: 1 - state.progress }}
      />
      <path
        className="shift-ring__glow shift-ring__glow--mid"
        d={RING_PATH}
        pathLength={1}
        style={{ strokeDashoffset: 1 - state.progress }}
      />
      <path
        ref={pathRef}
        className="shift-ring__fill"
        d={RING_PATH}
        pathLength={1}
        style={{ strokeDashoffset: 1 - state.progress }}
      />

      {/* A highlight drifting along the filled length — light moving on a
          surface that is itself moving. */}
      <g mask="url(#shift-ring-filled)">
        <path className="shift-ring__shimmer" d={RING_PATH} pathLength={1} />
      </g>

      {tip && (
        <g className="shift-ring__tip" transform={`translate(${tip.x} ${tip.y})`}>
          <circle className="shift-ring__tip-halo" r={9} />
          <circle className="shift-ring__tip-dot" r={4} />
        </g>
      )}

      {/* The two ends of the day, on either side of the gap. */}
      <g className="shift-ring__ends">
        <circle className="shift-ring__end is-start" cx={482} cy={696} r={5} />
        <circle className="shift-ring__end is-finish" cx={518} cy={696} r={5} />
        <text className="shift-ring__label is-start" x={468} y={696}>
          in {labelTime(shift.time_in)}
        </text>
        <text className="shift-ring__label is-finish" x={532} y={696}>
          out {labelTime(shift.time_out)}
        </text>
      </g>
    </svg>
  )
}
