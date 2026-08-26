/**
 * Working-hours maths, shared by the room's progress ring and the
 * attendance screen's auto-pause.
 *
 * A shift is a wall-clock pattern (`time` columns), not a set of instants,
 * so everything here works in minutes-since-midnight and only resolves
 * against a real date where it has to. `time_out < time_in` means the shift
 * crosses midnight — the night (15:00→00:00) and graveyard (17:00→02:00)
 * shifts both do, so wrapping is the normal case here, not an edge case.
 */

export type Shift = {
  id: string
  name: string
  time_in: string
  meal_start: string
  meal_end: string
  time_out: string
}

export type DayLog = {
  timeIn: string | null
  lunchStart: string | null
  lunchEnd: string | null
  timeOut: string | null
}

/** '19:00:00' → 1140. Postgres hands back HH:MM:SS; <input type="time"> HH:MM. */
export function toMinutes(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

/** 1140 → '19:00', for <input type="time">. */
export function toHHMM(mins: number) {
  const m = ((mins % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/** 1140 → '7:00 pm'. */
export function labelTime(t: string) {
  const mins = toMinutes(t)
  const d = new Date()
  d.setHours(Math.floor(mins / 60), mins % 60, 0, 0)
  return d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
}

/** Minutes from `start` forward to `end`, taking the wrap when end <= start.
 *  A shift that ends at the same clock time it starts is a 24-hour shift,
 *  not a zero-length one — nobody is rostered for zero minutes. */
export function spanMinutes(start: number, end: number) {
  const raw = end - start
  return raw > 0 ? raw : raw + 1440
}

/** Is a wall-clock minute inside [start, end)? Wrap-aware. */
export function inWindow(mins: number, start: number, end: number) {
  if (start === end) return false
  if (start < end) return mins >= start && mins < end
  return mins >= start || mins < end
}

export function minutesSinceMidnight(d: Date) {
  return d.getHours() * 60 + d.getMinutes()
}

/**
 * Minutes since midnight in the organisation's own zone.
 *
 * A roster is written in the workplace's hours, not the reader's, so every
 * comparison against one has to be made there — otherwise a laptop set to
 * another zone reads a different wall clock than the server does, and the
 * time-in window says open on screen while attendance_time_in() refuses it.
 * Falls back to the machine's own clock when no zone is known, which is what
 * this did everywhere before there was one to ask for.
 */
export function minutesInZone(d: Date, timeZone: string | null | undefined) {
  if (!timeZone) return minutesSinceMidnight(d)
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      // h23 rather than hour12:false — the latter still renders midnight as
      // 24 in some implementations, which would read as minute 1440.
      hourCycle: 'h23',
    }).formatToParts(d)
    const h = Number(parts.find((p) => p.type === 'hour')?.value)
    const m = Number(parts.find((p) => p.type === 'minute')?.value)
    if (Number.isNaN(h) || Number.isNaN(m)) return minutesSinceMidnight(d)
    return (h % 24) * 60 + m
  } catch {
    // An unknown zone throws rather than silently misreporting the hour.
    return minutesSinceMidnight(d)
  }
}

/** Total minutes actually owed on this shift: the roster span, less the meal. */
export function workingMinutes(shift: Shift) {
  const span = spanMinutes(toMinutes(shift.time_in), toMinutes(shift.time_out))
  const meal = spanMinutes(toMinutes(shift.meal_start), toMinutes(shift.meal_end))
  return Math.max(1, span - meal)
}

/**
 * Where the meal break falls on the ring, 0–1.
 *
 * A point, not a span. The ring measures *worked* minutes and the meal is
 * subtracted from them, so the break takes up no length of its own — work
 * stops at this mark and resumes at the same mark. On an eight-hour shift
 * with the break at its midpoint (both the night and graveyard shifts here)
 * that lands dead opposite the gap, which is a fair picture of the day.
 */
export function mealFraction(shift: Shift) {
  const toMeal = spanMinutes(toMinutes(shift.time_in), toMinutes(shift.meal_start))
  return Math.min(1, Math.max(0, toMeal / workingMinutes(shift)))
}

/** Minutes forward from a to b around the clock, 0–1439. Unlike
 *  spanMinutes, a == b is nought minutes apart rather than a full day. */
export function forwardMinutes(a: number, b: number) {
  return (((b - a) % 1440) + 1440) % 1440
}

/** How early someone may time in. Turning up a little before your shift is
 *  normal; turning up hours before it is padding the day. */
export const EARLY_GRACE_MIN = 30

/**
 * Whether timing in is open yet, and when it opens if not.
 *
 * Open from half an hour before the rostered start through to the rostered
 * end — early enough to cover arriving a bit before, late enough that being
 * late never locks you out of recording the day at all. An account with no
 * roster has nothing to be early for, so it stays open all day.
 *
 * Wall-clock throughout, so it wraps: the graveyard shift's window opens at
 * 16:30 and runs past midnight to 02:00.
 */
export function timeInWindow(
  shift: Shift | null,
  now: Date,
  timeZone?: string | null
) {
  if (!shift) return { open: true, opensAt: null as number | null }
  const start = toMinutes(shift.time_in)
  const opensAt = (start - EARLY_GRACE_MIN + 1440) % 1440
  const length = EARLY_GRACE_MIN + spanMinutes(start, toMinutes(shift.time_out))
  return {
    open: forwardMinutes(opensAt, minutesInZone(now, timeZone)) <= length,
    opensAt,
  }
}

export type RingState = {
  /** 0–1 around the room's border. */
  progress: number
  /** On the meal break right now — the ring holds where it is. */
  paused: boolean
  /** Timed in and still working. */
  running: boolean
  /** Timed out, or the full shift is behind them. */
  done: boolean
  /** Whole minutes of the shift still owed. */
  remaining: number
}

/**
 * How far round the room the day has got.
 *
 * Measured from the *actual* time in rather than the rostered one — the ring
 * is a picture of the day someone is having, not of the day they were
 * supposed to have. The meal is subtracted from real stamps where they
 * exist (attendance records both edges), so an early or late pause moves the
 * ring honestly instead of assuming the roster was followed.
 */
export function ringState(shift: Shift, log: DayLog, now: Date): RingState {
  const totalMs = workingMinutes(shift) * 60000

  if (!log.timeIn) {
    return { progress: 0, paused: false, running: false, done: false, remaining: workingMinutes(shift) }
  }

  const start = +new Date(log.timeIn)
  const end = log.timeOut ? +new Date(log.timeOut) : +now

  let mealMs = 0
  if (log.lunchStart) {
    const mealFrom = +new Date(log.lunchStart)
    const mealTo = log.lunchEnd ? +new Date(log.lunchEnd) : end
    mealMs = Math.max(0, mealTo - mealFrom)
  }

  const worked = Math.max(0, end - start - mealMs)
  const progress = Math.min(1, worked / totalMs)
  const paused = Boolean(log.lunchStart && !log.lunchEnd && !log.timeOut)

  return {
    progress,
    paused,
    running: Boolean(!log.timeOut && !paused),
    done: Boolean(log.timeOut) || progress >= 1,
    remaining: Math.max(0, Math.round((totalMs - worked) / 60000)),
  }
}
