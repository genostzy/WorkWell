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
