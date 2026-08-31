import { describe, expect, it } from 'vitest'
import {
  attendanceFlags,
  dockState,
  forwardMinutes,
  hoursLeft,
  inWindow,
  labelTime,
  mealFraction,
  minutesInZone,
  minutesSinceMidnight,
  ringState,
  spanMinutes,
  timeInWindow,
  toHHMM,
  toMinutes,
  workingMinutes,
  type DayLog,
  type Shift,
} from './shift'

/**
 * The two rostered shifts this app actually runs, both of which cross
 * midnight. Wrapping is the normal case here, so it is the normal case in
 * these tests too — a suite built only on a 9-to-5 would pass while every
 * real shift in the database was measured wrong.
 */
const NIGHT: Shift = {
  id: 'night',
  name: 'Night',
  time_in: '15:00:00',
  meal_start: '19:00:00',
  meal_end: '20:00:00',
  time_out: '00:00:00',
}

const GRAVEYARD: Shift = {
  id: 'graveyard',
  name: 'Graveyard',
  time_in: '17:00:00',
  meal_start: '21:00:00',
  meal_end: '22:00:00',
  time_out: '02:00:00',
}

/** A day shift, for the non-wrapping half of every wrap-aware function. */
const DAY: Shift = {
  id: 'day',
  name: 'Day',
  time_in: '09:00:00',
  meal_start: '12:00:00',
  meal_end: '13:00:00',
  time_out: '18:00:00',
}

const NO_LOG: DayLog = {
  timeIn: null,
  lunchStart: null,
  lunchEnd: null,
  timeOut: null,
}

/** The org runs on Asia/Manila (UTC+8, no DST), so an absolute instant maps
 *  to one predictable wall-clock minute no matter where the test runs. */
const ZONE = 'Asia/Manila'
const manila = (hhmm: string, day = '02') =>
  new Date(`2026-03-${day}T${toHHMM(toMinutes(hhmm))}:00+08:00`)

describe('toMinutes', () => {
  it('reads the HH:MM:SS Postgres hands back', () => {
    expect(toMinutes('19:00:00')).toBe(1140)
  })

  it('reads the HH:MM an <input type="time"> hands back', () => {
    expect(toMinutes('19:00')).toBe(1140)
  })

  it('treats midnight as minute zero, not 1440', () => {
    expect(toMinutes('00:00:00')).toBe(0)
  })
})

describe('toHHMM', () => {
  it('pads both halves', () => {
    expect(toHHMM(540)).toBe('09:00')
    expect(toHHMM(5)).toBe('00:05')
  })

  it('wraps past the end of the day rather than reading 24:00', () => {
    expect(toHHMM(1440)).toBe('00:00')
    expect(toHHMM(1500)).toBe('01:00')
  })

  it('wraps negatives forward instead of emitting a minus sign', () => {
    expect(toHHMM(-30)).toBe('23:30')
  })
})

describe('labelTime', () => {
  // Asserted by shape, not by exact string: the separator between the time
  // and the day period is an ICU detail that has changed between Node
  // releases, and pinning it here would fail on an upgrade that broke
  // nothing.
  it('renders a 12-hour clock time with a day period', () => {
    expect(labelTime('15:30:00')).toMatch(/^3:30\s*[ap]m$/i)
  })

  it('renders midnight as 12, not 0', () => {
    expect(labelTime('00:00:00')).toMatch(/^12:00\s*[ap]m$/i)
  })
})

describe('hoursLeft', () => {
  it('splits minutes into hours and minutes', () => {
    expect(hoursLeft(465)).toBe('7h 45m left')
  })

  it('drops the hours entirely under an hour', () => {
    expect(hoursLeft(45)).toBe('45m left')
  })

  it('keeps a zero minute part rather than reading as a bare hour count', () => {
    expect(hoursLeft(480)).toBe('8h 0m left')
  })

  it('says the day is over at nought and below', () => {
    expect(hoursLeft(0)).toBe('Shift complete')
    expect(hoursLeft(-10)).toBe('Shift complete')
  })
})

describe('spanMinutes', () => {
  it('measures forward within one day', () => {
    expect(spanMinutes(540, 1080)).toBe(540)
  })

  it('takes the wrap when the end is the smaller number', () => {
    // 15:00 → 00:00 is nine hours, not minus fifteen.
    expect(spanMinutes(900, 0)).toBe(540)
    // 17:00 → 02:00.
    expect(spanMinutes(1020, 120)).toBe(540)
  })

  it('reads start === end as a full day, because nobody works nought minutes', () => {
    expect(spanMinutes(900, 900)).toBe(1440)
  })
})

describe('inWindow', () => {
  it('includes the start and excludes the end', () => {
    expect(inWindow(540, 540, 1080)).toBe(true)
    expect(inWindow(1080, 540, 1080)).toBe(false)
  })

  it('is wrap-aware on both sides of midnight', () => {
    expect(inWindow(1380, 1020, 120)).toBe(true) // 23:00 inside 17:00→02:00
    expect(inWindow(60, 1020, 120)).toBe(true) // 01:00, past midnight
    expect(inWindow(600, 1020, 120)).toBe(false) // 10:00, well outside
  })

  it('holds nothing when the window has no width', () => {
    expect(inWindow(540, 540, 540)).toBe(false)
  })
})

describe('minutesInZone', () => {
  it('reads the wall clock in the given zone, not the machine one', () => {
    // 07:00Z is 15:00 in Manila — the night shift's start.
    expect(minutesInZone(new Date('2026-03-02T07:00:00Z'), ZONE)).toBe(900)
  })

  it('reads midnight as 0 rather than 1440', () => {
    // 16:00Z is 00:00 the next day in Manila.
    expect(minutesInZone(new Date('2026-03-02T16:00:00Z'), ZONE)).toBe(0)
  })

  it('falls back to the machine clock when no zone is known', () => {
    const d = new Date('2026-03-02T07:00:00Z')
    expect(minutesInZone(d, null)).toBe(minutesSinceMidnight(d))
    expect(minutesInZone(d, undefined)).toBe(minutesSinceMidnight(d))
    expect(minutesInZone(d, '')).toBe(minutesSinceMidnight(d))
  })

  it('falls back rather than throwing on a zone that does not exist', () => {
    const d = new Date('2026-03-02T07:00:00Z')
    expect(minutesInZone(d, 'Not/AZone')).toBe(minutesSinceMidnight(d))
  })
})

describe('workingMinutes', () => {
  it('is the roster span less the meal', () => {
    expect(workingMinutes(NIGHT)).toBe(480)
    expect(workingMinutes(GRAVEYARD)).toBe(480)
    expect(workingMinutes(DAY)).toBe(480)
  })

  it('never returns nought, so nothing downstream divides by zero', () => {
    const swallowed: Shift = {
      ...DAY,
      meal_start: '09:00:00',
      meal_end: '18:00:00',
    }
    expect(workingMinutes(swallowed)).toBe(1)
  })
})

describe('mealFraction', () => {
  it('puts a mid-shift break at the middle of the ring', () => {
    // Four hours worked of eight before the night shift's break.
    expect(mealFraction(NIGHT)).toBeCloseTo(0.5)
    expect(mealFraction(GRAVEYARD)).toBeCloseTo(0.5)
  })

  it('stays on the ring when the break is rostered outside the shift', () => {
    const odd: Shift = { ...DAY, meal_start: '08:00:00', meal_end: '09:00:00' }
    const f = mealFraction(odd)
    expect(f).toBeGreaterThanOrEqual(0)
    expect(f).toBeLessThanOrEqual(1)
  })
})

describe('forwardMinutes', () => {
  it('measures forward around the clock', () => {
    expect(forwardMinutes(1380, 60)).toBe(120) // 23:00 → 01:00
  })

  it('reads the same minute as nought apart, unlike spanMinutes', () => {
    expect(forwardMinutes(900, 900)).toBe(0)
    expect(spanMinutes(900, 900)).toBe(1440)
  })
})

describe('timeInWindow', () => {
  it('stays open all day for an account with no roster', () => {
    const w = timeInWindow(null, manila('10:00'), ZONE)
    expect(w.open).toBe(true)
    expect(w.opensAt).toBeNull()
  })

  it('opens half an hour before the rostered start', () => {
    expect(timeInWindow(NIGHT, manila('14:29'), ZONE).open).toBe(false)
    expect(timeInWindow(NIGHT, manila('14:30'), ZONE).open).toBe(true)
    expect(timeInWindow(NIGHT, manila('14:30'), ZONE).opensAt).toBe(870)
  })

  it('stays open for someone who is late, right up to the rostered end', () => {
    expect(timeInWindow(NIGHT, manila('22:00'), ZONE).open).toBe(true)
  })

  it('follows a shift across midnight instead of shutting at 00:00', () => {
    // The graveyard shift's window opens at 16:30 and runs to 02:00.
    expect(timeInWindow(GRAVEYARD, manila('16:30'), ZONE).open).toBe(true)
    expect(timeInWindow(GRAVEYARD, manila('01:00', '03'), ZONE).open).toBe(true)
    expect(timeInWindow(GRAVEYARD, manila('03:00', '03'), ZONE).open).toBe(false)
  })

  it('opens across midnight for a shift that starts just after it', () => {
    const early: Shift = { ...DAY, time_in: '00:15:00', time_out: '09:00:00' }
    // 23:45 the night before is inside the grace period.
    expect(timeInWindow(early, manila('23:45', '01'), ZONE).open).toBe(true)
    expect(timeInWindow(early, manila('23:45', '01'), ZONE).opensAt).toBe(1425)
  })
})

describe('ringState', () => {
  it('sits at the start line before anyone times in', () => {
    const s = ringState(NIGHT, NO_LOG, manila('15:00'))
    expect(s).toEqual({
      progress: 0,
      paused: false,
      running: false,
      done: false,
      clockedOut: false,
      remaining: 480,
    })
  })

  it('measures from the actual time in, not the rostered one', () => {
    // Rostered 15:00, actually in at 16:00, now 18:00 — two hours, not three.
    const log = { ...NO_LOG, timeIn: manila('16:00').toISOString() }
    const s = ringState(NIGHT, log, manila('18:00'))
    expect(s.progress).toBeCloseTo(120 / 480)
    expect(s.remaining).toBe(360)
    expect(s.running).toBe(true)
  })

  it('holds the ring where it is across the meal break', () => {
    const log = {
      timeIn: manila('15:00').toISOString(),
      lunchStart: manila('19:00').toISOString(),
      lunchEnd: null,
      timeOut: null,
    }
    const atStart = ringState(NIGHT, log, manila('19:00'))
    const halfAnHourLater = ringState(NIGHT, log, manila('19:30'))
    expect(atStart.progress).toBeCloseTo(halfAnHourLater.progress)
    expect(halfAnHourLater.paused).toBe(true)
    expect(halfAnHourLater.running).toBe(false)
  })

  it('subtracts the real meal, not the rostered one', () => {
    // A two-hour break where the roster allowed one.
    const log = {
      timeIn: manila('15:00').toISOString(),
      lunchStart: manila('19:00').toISOString(),
      lunchEnd: manila('21:00').toISOString(),
      timeOut: null,
    }
    const s = ringState(NIGHT, log, manila('23:00'))
    // 15:00→23:00 is eight hours, less two eaten = six worked.
    expect(s.progress).toBeCloseTo(360 / 480)
    expect(s.remaining).toBe(120)
  })

  it('stops the clock at the time out rather than at now', () => {
    const log = {
      timeIn: manila('15:00').toISOString(),
      lunchStart: manila('19:00').toISOString(),
      lunchEnd: manila('20:00').toISOString(),
      timeOut: manila('00:00', '03').toISOString(),
    }
    const s = ringState(NIGHT, log, manila('06:00', '03'))
    expect(s.progress).toBe(1)
    expect(s.remaining).toBe(0)
    expect(s.running).toBe(false)
    expect(s.clockedOut).toBe(true)
    expect(s.done).toBe(true)
  })

  it('never runs past full, however long someone stays', () => {
    const log = { ...NO_LOG, timeIn: manila('15:00').toISOString() }
    expect(ringState(NIGHT, log, manila('12:00', '03')).progress).toBe(1)
  })

  // The distinction the dock depends on, pinned here so nothing collapses
  // the two fields back together: a full ring is not a finished day.
  it('separates a full ring from an actual time out', () => {
    const log = { ...NO_LOG, timeIn: manila('15:00').toISOString() }
    const s = ringState(NIGHT, log, manila('01:00', '03'))
    expect(s.progress).toBe(1)
    expect(s.done).toBe(true)
    expect(s.clockedOut).toBe(false)
    expect(s.running).toBe(true)
  })
})

describe('dockState', () => {
  const at = (now: Date, log: DayLog, shift = NIGHT) =>
    dockState(shift, ringState(shift, log, now), log, now, ZONE)

  it('offers the day once the window opens', () => {
    expect(at(manila('15:00'), NO_LOG)).toEqual({
      label: 'Time in',
      action: 'in',
      mode: 'ready',
    })
  })

  it('says when the window opens rather than offering a dead button', () => {
    const d = at(manila('10:00'), NO_LOG)
    expect(d.action).toBeNull()
    expect(d.mode).toBe('shut')
    expect(d.label).toMatch(/^Opens 2:30\s*[ap]m$/i)
  })

  it('offers the way out once someone is in', () => {
    const log = { ...NO_LOG, timeIn: manila('15:00').toISOString() }
    expect(at(manila('18:00'), log)).toEqual({
      label: 'Time out',
      action: 'out',
      mode: 'working',
    })
  })

  it('still offers the way out on the meal break, in its own mode', () => {
    const log = {
      timeIn: manila('15:00').toISOString(),
      lunchStart: manila('19:00').toISOString(),
      lunchEnd: null,
      timeOut: null,
    }
    expect(at(manila('19:30'), log)).toEqual({
      label: 'Time out',
      action: 'out',
      mode: 'paused',
    })
  })

  it('closes the day only on the time-out stamp', () => {
    const log = {
      timeIn: manila('15:00').toISOString(),
      lunchStart: null,
      lunchEnd: null,
      timeOut: manila('23:00').toISOString(),
    }
    expect(at(manila('23:30'), log)).toEqual({
      label: 'Done for today',
      action: null,
      mode: 'done',
    })
  })

  // The bug this function was written around. Reading RingState.done here
  // would say "Done for today" and take away the only control that can
  // actually record the end of the day.
  it('still offers a way out after a full shift with no time out', () => {
    const log = { ...NO_LOG, timeIn: manila('15:00').toISOString() }
    const now = manila('01:00', '03')
    expect(ringState(NIGHT, log, now).done).toBe(true)
    expect(at(now, log)).toEqual({
      label: 'Time out',
      action: 'out',
      mode: 'working',
    })
  })
})

describe('attendanceFlags', () => {
  it('flags nothing for a day with no stamps at all', () => {
    expect(attendanceFlags(DAY, NO_LOG)).toEqual([])
  })

  it('flags nothing within the grace window either side of the roster', () => {
    const log = { ...NO_LOG, timeIn: manila('09:03').toISOString() }
    expect(attendanceFlags(DAY, log)).toEqual([])
  })

  it('does not flag a stamp exactly on the grace boundary', () => {
    const log = { ...NO_LOG, timeIn: manila('09:05').toISOString() }
    expect(attendanceFlags(DAY, log)).toEqual([])
  })

  it('flags late_in once a time_in is more than grace minutes after the roster', () => {
    const log = { ...NO_LOG, timeIn: manila('09:10').toISOString() }
    expect(attendanceFlags(DAY, log)).toEqual(['late_in'])
  })

  it('flags early_in once a time_in is more than grace minutes before the roster', () => {
    const log = { ...NO_LOG, timeIn: manila('08:40').toISOString() }
    expect(attendanceFlags(DAY, log)).toEqual(['early_in'])
  })

  it('flags late_out once a time_out is more than grace minutes after the roster', () => {
    const log = { ...NO_LOG, timeOut: manila('18:20').toISOString() }
    expect(attendanceFlags(DAY, log)).toEqual(['late_out'])
  })

  it('flags early_out once a time_out is more than grace minutes before the roster', () => {
    const log = { ...NO_LOG, timeOut: manila('17:30').toISOString() }
    expect(attendanceFlags(DAY, log)).toEqual(['early_out'])
  })

  it('judges time_in before time_out is known -- a day can be late_in with no time_out yet', () => {
    const log = { ...NO_LOG, timeIn: manila('09:10').toISOString() }
    expect(attendanceFlags(DAY, log)).toEqual(['late_in'])
  })

  it('flags both edges of the same day independently', () => {
    const log = {
      ...NO_LOG,
      timeIn: manila('09:10').toISOString(),
      timeOut: manila('17:30').toISOString(),
    }
    expect(attendanceFlags(DAY, log)).toEqual(['late_in', 'early_out'])
  })

  it('wraps past midnight for an overnight shift, into the next calendar day', () => {
    const log = {
      ...NO_LOG,
      timeIn: manila('15:00').toISOString(),
      timeOut: manila('00:10', '03').toISOString(),
    }
    expect(attendanceFlags(NIGHT, log)).toEqual(['late_out'])
  })

  it('reads an early arrival on an overnight shift the same way as a day shift', () => {
    const log = { ...NO_LOG, timeIn: manila('14:40').toISOString() }
    expect(attendanceFlags(NIGHT, log)).toEqual(['early_in'])
  })
})
