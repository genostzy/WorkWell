'use client'

import { useEffect, useState } from 'react'
import { PageHead, PlaneBadge, PrivacyNote } from '@/components/chrome'

// Lunch is not something you clock — the app pauses it for you. Two fixed
// hours, matching the standard PH lunch block; a real rollout would read
// this from company policy instead of a constant.
const LUNCH_START_MIN = 12 * 60
const LUNCH_END_MIN = 13 * 60

type DayLog = {
  timeIn?: string
  lunchStart?: string
  lunchEnd?: string
  timeOut?: string
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

export default function AttendanceClient() {
  const week = weekDates()
  const today = week.find((d) => d.isToday)
  const [logs, setLogs] = useState<Record<string, DayLog>>({})

  const todayLog = today ? logs[today.iso] ?? {} : {}

  // The auto-pause: nothing to click, nothing to forget. While timed in and
  // not yet out, the tick checks the wall clock against the lunch window and
  // stamps the pause and its resume on its own.
  useEffect(() => {
    if (!today) return
    const tick = () => {
      const log = logs[today.iso]
      if (!log?.timeIn || log.timeOut) return
      const mins = minutesSinceMidnight(new Date())
      setLogs((s) => {
        const cur = s[today.iso] ?? {}
        if (!cur.timeIn || cur.timeOut) return s
        if (!cur.lunchStart && mins >= LUNCH_START_MIN && mins < LUNCH_END_MIN) {
          return { ...s, [today.iso]: { ...cur, lunchStart: new Date().toISOString() } }
        }
        if (cur.lunchStart && !cur.lunchEnd && mins >= LUNCH_END_MIN) {
          return { ...s, [today.iso]: { ...cur, lunchEnd: new Date().toISOString() } }
        }
        return s
      })
    }
    tick()
    const id = window.setInterval(tick, 30000)
    return () => window.clearInterval(id)
  }, [today, logs])

  function timeIn() {
    if (!today) return
    setLogs((s) => ({ ...s, [today.iso]: { timeIn: new Date().toISOString() } }))
  }

  function timeOut() {
    if (!today) return
    setLogs((s) => ({ ...s, [today.iso]: { ...s[today.iso], timeOut: new Date().toISOString() } }))
  }

  const daysLogged = week.filter((d) => logs[d.iso]?.timeOut).length

  return (
    <>
      <PageHead title="Attendance" lead="Time in, time out — lunch pauses itself." />
      <PlaneBadge plane="work" />

      <PrivacyNote
        plane="work"
        detail="A per-minute time record is a real change from the confirmation-only design this screen used to mock — worth knowing it's here. Lunch is paused automatically between 12:00 pm and 1:00 pm rather than clocked, so it never counts as worked time and never needs a separate button."
      >
        <b>Illustrative only — times reset on refresh, nothing is stored yet.</b>{' '}
      </PrivacyNote>

      <div className="card mb-5">
        <div className="card__head">
          <div>
            <div className="card__title">Today</div>
            <div className="card__sub">{statusOf(todayLog)}</div>
          </div>
          {!todayLog.timeIn && (
            <button className="btn btn--primary btn--sm" type="button" onClick={timeIn}>
              Time in
            </button>
          )}
          {todayLog.timeIn && !todayLog.timeOut && (
            <button className="btn btn--secondary btn--sm" type="button" onClick={timeOut}>
              Time out
            </button>
          )}
        </div>

        <div className="row row--between mt-4" style={{ flexWrap: 'wrap', gap: 'var(--s-4)' }}>
          <div className="stat">
            <span className="stat__value t-num">{todayLog.timeIn ? fmtTime(todayLog.timeIn) : '—'}</span>
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
            <span className="stat__value t-num">{todayLog.timeOut ? fmtTime(todayLog.timeOut) : '—'}</span>
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
                const log = logs[d.iso] ?? {}
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
    </>
  )
}
