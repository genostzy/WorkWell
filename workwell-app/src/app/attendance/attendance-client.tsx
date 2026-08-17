'use client'

import { useState } from 'react'
import { PageHead, PlaneBadge, PrivacyNote } from '@/components/chrome'

// Not a clock-in/out log — that would contradict the private-plane promise
// this product makes elsewhere. A self-declared, core-hours confirmation
// with no per-minute record is the shape the placeholder copy suggested,
// so that is what this mocks. Still a policy decision to make for real.
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

export default function AttendanceClient() {
  const week = weekDates()
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({})

  const confirmedCount = week.filter((d) => confirmed[d.iso]).length
  const today = week.find((d) => d.isToday)

  return (
    <>
      <PageHead title="Attendance" lead="A confirmation, not a clock." />
      <PlaneBadge plane="work" />

      <PrivacyNote
        plane="work"
        detail="Boundaries — the private-plane screen for your working hours — exists specifically because no record of when you were active is kept anywhere in this product. A clock-in/out log is the opposite of that promise. What is mocked below is one option: a once-a-day, self-declared confirmation with no per-minute record. Shipping it for real is still a decision worth making deliberately."
      >
        <b>Illustrative only — worth a conversation before this is built for real.</b>{' '}
      </PrivacyNote>

      <div className="card mb-5">
        <div className="card__head">
          <div>
            <div className="card__title">This week</div>
            <div className="card__sub">{confirmedCount} of {week.length} confirmed</div>
          </div>
          {today && !confirmed[today.iso] && (
            <button
              className="btn btn--primary btn--sm"
              type="button"
              onClick={() => setConfirmed((c) => ({ ...c, [today.iso]: true }))}
            >
              Confirm today
            </button>
          )}
        </div>

        <div className="table-scroll mt-4">
          <table className="data-table">
            <caption className="sr-only">This week&apos;s confirmations</caption>
            <thead>
              <tr>
                <th scope="col">Day</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {week.map((d) => (
                <tr key={d.iso}>
                  <th scope="row" style={{ fontWeight: d.isToday ? 700 : 600 }}>
                    {d.label} {d.isToday && <span className="t-subtle">(today)</span>}
                  </th>
                  <td>
                    <span className={confirmed[d.iso] ? 'chip chip--accent' : 'chip'}>
                      {confirmed[d.iso] ? 'Confirmed' : d.iso > (new Date().toISOString().slice(0, 10)) ? 'Not due yet' : 'Unconfirmed'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="field__hint mt-3">
          A yes/no for the day, nothing else. No hours, no timestamps.
        </p>
      </div>
    </>
  )
}
