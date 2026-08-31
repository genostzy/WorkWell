'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { PageHead, PlaneBadge, PrivacyNote } from '@/components/chrome'
import { ConfirmButton } from '@/components/controls'
import { createClient } from '@/lib/supabase/client'
import { fmtDate } from '@/lib/format-date'
import { attendanceFlags, type AttendanceFlag, type Shift } from '@/lib/shift'

// Lunch is not something you clock — the app pauses it for you. Read from
// the rostered shift's own meal window (wall-clock minutes), not a fixed
// 12:00-13:00 that was wrong for every non-day shift (night is 19:00-20:00,
// graveyard is 21:00-22:00, morning is 12:00-13:00). Falls back to 12-13
// only until the shift loads.
const FALLBACK_LUNCH_START = 12 * 60
const FALLBACK_LUNCH_END = 13 * 60

function toMinutes(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

type DayLog = {
  timeIn: string | null
  lunchStart: string | null
  lunchEnd: string | null
  timeOut: string | null
}

const EMPTY_LOG: DayLog = { timeIn: null, lunchStart: null, lunchEnd: null, timeOut: null }

type Row = {
  day: string
  time_in: string | null
  lunch_start: string | null
  lunch_end: string | null
  time_out: string | null
}

function toLog(r?: Row): DayLog {
  if (!r) return EMPTY_LOG
  return { timeIn: r.time_in, lunchStart: r.lunch_start, lunchEnd: r.lunch_end, timeOut: r.time_out }
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const

function weekDates() {
  const now = new Date()
  const day = now.getDay() || 7
  const monday = new Date(now)
  monday.setDate(now.getDate() - day + 1)
  return DAYS.map((label, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return { label, iso: d.toISOString().slice(0, 10), isToday: d.toDateString() === now.toDateString() }
  })
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
}

function minutesSinceMidnight(d: Date) {
  return d.getHours() * 60 + d.getMinutes()
}

function hoursWorked(log: DayLog) {
  if (!log.timeIn || !log.timeOut) return null
  let ms = +new Date(log.timeOut) - +new Date(log.timeIn)
  if (log.lunchStart && log.lunchEnd) ms -= +new Date(log.lunchEnd) - +new Date(log.lunchStart)
  return Math.max(0, ms / 3600000)
}

function statusOf(log: DayLog) {
  if (log.timeOut) return 'Done for the day'
  if (log.lunchStart && !log.lunchEnd) return 'On lunch (auto)'
  if (log.timeIn) return 'Working'
  return 'Not timed in'
}

type ResetRequest = {
  id: string
  day: string
  reason: string
  status: 'pending' | 'approved' | 'declined' | 'withdrawn'
}

export default function AttendanceClient() {
  const week = weekDates()
  const today = week.find((d) => d.isToday)
  const [logs, setLogs] = useState<Record<string, DayLog>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [mealWindow, setMealWindow] = useState<{ start: number; end: number }>({ start: FALLBACK_LUNCH_START, end: FALLBACK_LUNCH_END })
  // Null until the roster loads (or for an account with none) -- attendanceFlags
  // has nothing to compare a stamp against without it, so the flags below stay
  // empty rather than guessing at a shift nobody was actually given.
  const [shift, setShift] = useState<Shift | null>(null)

  const [resetRequests, setResetRequests] = useState<ResetRequest[]>([])
  const [resetDay, setResetDay] = useState(today?.iso ?? week[0].iso)
  const [resetReason, setResetReason] = useState('')
  const [requesting, setRequesting] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null)

  const reloadResetRequests = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('attendance_reset_requests')
      .select('id, day, reason, status')
      .order('created_at', { ascending: false })
    if (error) {
      setResetError(error.message)
      return
    }
    setResetRequests((data ?? []) as ResetRequest[])
  }, [])

  const reloadToday = useCallback(async () => {
    if (!today) return
    const supabase = createClient()
    const { data, error } = await supabase
      .from('attendance')
      .select('day, time_in, lunch_start, lunch_end, time_out')
      .eq('day', today.iso)
      .maybeSingle()
    if (error) {
      setActionError(error.message)
      return
    }
    setLogs((s) => ({ ...s, [today.iso]: toLog(data as Row | undefined) }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today?.iso])

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      const supabase = createClient()
      const [{ data, error }, { data: resets, error: resetsError }, { data: shiftRow }] = await Promise.all([
        supabase
          .from('attendance')
          .select('day, time_in, lunch_start, lunch_end, time_out')
          .gte('day', week[0].iso)
          .lte('day', week[week.length - 1].iso),
        supabase
          .from('attendance_reset_requests')
          .select('id, day, reason, status')
          .order('created_at', { ascending: false }),
        supabase
          .from('shift_assignments')
          .select('shifts(id, name, time_in, meal_start, meal_end, time_out)')
          .maybeSingle(),
      ])
      if (!cancelled && shiftRow) {
        const s = (shiftRow as unknown as { shifts?: Shift | null })?.shifts
        // Supabase may return shifts as array if relationship not singular; handle both.
        const roster = Array.isArray(s) ? (s as unknown as Shift[])[0] : s
        if (roster?.meal_start && roster?.meal_end) {
          setMealWindow({ start: toMinutes(roster.meal_start), end: toMinutes(roster.meal_end) })
        }
        if (roster?.time_in && roster?.time_out) setShift(roster)
      }

      if (cancelled) return
      if (error) {
        setLoadError(error.message)
        setLoading(false)
        return
      }
      const byDay: Record<string, DayLog> = {}
      for (const r of (data ?? []) as Row[]) byDay[r.day] = toLog(r)
      setLogs(byDay)
      if (resetsError) setResetError(resetsError.message)
      else setResetRequests((resets ?? []) as ResetRequest[])
      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const todayLog = today ? logs[today.iso] ?? EMPTY_LOG : EMPTY_LOG
  const todayFlags = shift ? attendanceFlags(shift, todayLog) : []
  const flagLabel: Record<AttendanceFlag, string> = {
    late_in: 'Late',
    early_in: 'Early',
    late_out: 'Late',
    early_out: 'Early',
  }

  const logsRef = useRef(logs)
  useEffect(() => { logsRef.current = logs }, [logs])

  // The auto-pause: nothing to click, nothing to forget. While timed in and
  // not yet out, the tick checks the wall clock against the rostered meal
  // window and asks the server to stamp the pause and its resume. The RPCs guard
  // their own idempotency, so a tick firing again before the reload lands
  // is harmless. Handles wrap-around (e.g. 19:00-20:00) and updates when the
  // shift assignment does.
  useEffect(() => {
    if (!today) return
    const supabase = createClient()
    const inWindow = (mins: number, start: number, end: number) => {
      if (start === end) return false
      if (start < end) return mins >= start && mins < end
      return mins >= start || mins < end
    }
    const tick = async () => {
      const log = (logsRef.current as Record<string, DayLog>)[today.iso]
      if (!log?.timeIn || log.timeOut) return
      const mins = minutesSinceMidnight(new Date())
      const { start, end } = mealWindow

      if (!log.lunchStart && inWindow(mins, start, end)) {
        const { error } = await supabase.rpc('attendance_lunch_start')
        if (error) setActionError(error.message)
        else reloadToday()
        return
      }
      if (log.lunchStart && !log.lunchEnd && !inWindow(mins, start, end)) {
        const { error } = await supabase.rpc('attendance_lunch_end')
        if (error) setActionError(error.message)
        else reloadToday()
      }
    }
    tick()
    const id = window.setInterval(tick, 30000)
    return () => window.clearInterval(id)
  }, [today?.iso, reloadToday, logsRef, mealWindow])

  async function timeIn() {
    setActionError(null)
    const supabase = createClient()
    const { error } = await supabase.rpc('attendance_time_in')
    if (error) setActionError(error.message)
    else reloadToday()
  }

  async function timeOut() {
    setActionError(null)
    const supabase = createClient()
    const { error } = await supabase.rpc('attendance_time_out')
    if (error) setActionError(error.message)
    else reloadToday()
  }

  async function submitReset(e: React.FormEvent) {
    e.preventDefault()
    setResetError(null)
    if (!resetReason.trim()) {
      setResetError('A reason is required — it’s what HR reviews before touching anything.')
      return
    }

    setRequesting(true)
    const supabase = createClient()
    const { error } = await supabase.rpc('request_attendance_reset', {
      p_day: resetDay,
      p_reason: resetReason.trim(),
    })
    setRequesting(false)

    if (error) setResetError(error.message)
    else {
      setResetReason('')
      setResetSent(true)
      reloadResetRequests()
    }
  }

  async function withdrawRequest(id: string) {
    setWithdrawingId(id)
    setResetError(null)
    const supabase = createClient()
    const { error } = await supabase.rpc('withdraw_attendance_reset', { p_id: id })
    setWithdrawingId(null)

    if (error) setResetError(error.message)
    else reloadResetRequests()
  }

  const daysLogged = week.filter((d) => logs[d.iso]?.timeOut).length

  return (
    <>
      <PageHead title="Attendance" lead="Time in, time out — lunch pauses itself." />
      <PlaneBadge plane="work" />

      {(loadError || actionError) && (
        <div className="banner banner--error mb-5" role="alert">
          {loadError ?? actionError}
        </div>
      )}

      <div className="card mb-5">
        <div className="card__head">
          <div>
            <div className="card__title">Today</div>
            <div className="card__sub">{loading ? 'Loading…' : statusOf(todayLog)}</div>
          </div>
          {!loading && !todayLog.timeIn && (
            <button className="btn btn--primary btn--sm" type="button" onClick={timeIn}>
              Time in
            </button>
          )}
          {!loading && todayLog.timeIn && !todayLog.timeOut && (
            <ConfirmButton label="Time out" confirmLabel="Time out" onConfirm={timeOut} />
          )}
        </div>

        <div className="row row--between mt-4" style={{ flexWrap: 'wrap', gap: 'var(--s-4)' }}>
          <div className="stat">
            <span className="stat__value t-num">
              {todayLog.timeIn ? fmtTime(todayLog.timeIn) : '—'}
              {(todayFlags.includes('late_in') || todayFlags.includes('early_in')) && (
                <span className="chip" style={{ marginLeft: 'var(--s-2)' }}>
                  {flagLabel[todayFlags.includes('late_in') ? 'late_in' : 'early_in']}
                </span>
              )}
            </span>
            <span className="stat__label">Time in</span>
          </div>
          <div className="stat">
            <span className="stat__value t-num">
              {todayLog.lunchStart ? fmtTime(todayLog.lunchStart) : '—'}
              {todayLog.lunchEnd ? ` – ${fmtTime(todayLog.lunchEnd)}` : todayLog.lunchStart ? ' –' : ''}
            </span>
            <span className="stat__label">Lunch (auto)</span>
          </div>
          <div className="stat">
            <span className="stat__value t-num">
              {todayLog.timeOut ? fmtTime(todayLog.timeOut) : '—'}
              {(todayFlags.includes('late_out') || todayFlags.includes('early_out')) && (
                <span className="chip" style={{ marginLeft: 'var(--s-2)' }}>
                  {flagLabel[todayFlags.includes('late_out') ? 'late_out' : 'early_out']}
                </span>
              )}
            </span>
            <span className="stat__label">Time out</span>
          </div>
        </div>

        <p className="field__hint mt-3">
          {daysLogged} of {week.length} days completed this week.
        </p>
      </div>

      <div className="card card--flush">
        <div style={{ padding: 'var(--s-5) var(--s-5) var(--s-3)' }}>
          <div className="card__title">This week</div>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <caption className="sr-only">This week&apos;s time in / time out</caption>
            <thead>
              <tr>
                <th scope="col">Day</th>
                <th scope="col">Time in</th>
                <th scope="col">Lunch</th>
                <th scope="col">Time out</th>
                <th scope="col">Hours</th>
              </tr>
            </thead>
            <tbody>
              {week.map((d) => {
                const log = logs[d.iso] ?? EMPTY_LOG
                const hrs = hoursWorked(log)
                return (
                  <tr key={d.iso}>
                    <th scope="row" style={{ fontWeight: d.isToday ? 700 : 600 }}>
                      {d.label} {d.isToday && <span className="t-subtle">(today)</span>}
                    </th>
                    <td>{log.timeIn ? fmtTime(log.timeIn) : '—'}</td>
                    <td>{log.lunchStart ? `${fmtTime(log.lunchStart)}–${log.lunchEnd ? fmtTime(log.lunchEnd) : '…'}` : '—'}</td>
                    <td>{log.timeOut ? fmtTime(log.timeOut) : '—'}</td>
                    <td className="t-num">{hrs != null ? `${hrs.toFixed(1)}h` : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card mt-5">
        <div className="card__title mb-1">Something wrong with a day?</div>
        <p className="card__sub mb-4">
          Say what happened. HR can only see and fix the one day you name, and only until your request is decided.
        </p>

        {resetError && (
          <div className="banner banner--error mb-4" role="alert">
            {resetError}
          </div>
        )}
        {resetSent && !resetError && (
          <p className="confirmed mb-4" role="status">
            <span aria-hidden="true">✓</span>
            <span>Sent to HR for review.</span>
          </p>
        )}

        <form onSubmit={submitReset}>
          <div className="field">
            <label className="field__label" htmlFor="reset-day">
              Which day
            </label>
            <select
              id="reset-day"
              className="select"
              value={resetDay}
              onChange={(e) => {
                setResetDay(e.target.value)
                setResetSent(false)
              }}
            >
              {week.map((d) => (
                <option key={d.iso} value={d.iso}>
                  {d.label}
                  {d.isToday ? ' (today)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="field mt-4">
            <label className="field__label" htmlFor="reset-reason">
              Reason
            </label>
            <textarea
              id="reset-reason"
              className="textarea"
              value={resetReason}
              placeholder="What went wrong, so HR knows what to fix."
              onChange={(e) => {
                setResetReason(e.target.value)
                setResetSent(false)
              }}
            />
          </div>

          <button className="btn btn--secondary mt-4" type="submit" disabled={requesting}>
            {requesting ? 'Sending…' : 'Request a reset'}
          </button>
        </form>

        {resetRequests.length > 0 && (
          <div className="stack stack--tight mt-5">
            <span className="field__label">Your requests</span>
            {resetRequests.map((r) => (
              <div className="row row--between" key={r.id} style={{ alignItems: 'flex-start' }}>
                <div>
                  <b>{fmtDate(r.day, { day: 'numeric', month: 'short' })}</b>
                  <p className="t-subtle mt-1">{r.reason}</p>
                </div>
                <div className="row" style={{ flexWrap: 'nowrap', gap: 'var(--s-2)' }}>
                  <span className={r.status === 'approved' ? 'chip chip--accent' : 'chip'}>
                    {r.status}
                  </span>
                  {r.status === 'pending' && (
                    <ConfirmButton
                      label="Withdraw"
                      confirmLabel="Withdraw"
                      className="btn btn--ghost btn--sm"
                      disabled={withdrawingId === r.id}
                      onConfirm={() => withdrawRequest(r.id)}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <PrivacyNote
        plane="work"
        detail="A per-minute time record is a real change from the confirmation-only design this screen used to mock — worth knowing it's here. Lunch is paused automatically during your rostered meal window rather than clocked, so it never counts as worked time and never needs a separate button. This record is yours alone by default — never visible to HR, individually or aggregated. The one exception: if you request a reset with a reason below, HR can see and correct that single day while your request is open, and nothing else. Approve, decline, or withdraw it and the door closes again."
      >
        <b>Self-only, with one narrow exception you control.</b>{' '}
      </PrivacyNote>
    </>
  )
}
