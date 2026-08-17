'use client'

import { PageHead, PlaneBadge } from '@/components/chrome'

type Holiday = { date: string; name: string }

// Illustrative company calendar — separate from the leave you book yourself.
const HOLIDAYS: Holiday[] = [
  { date: '2026-01-01', name: "New Year's Day" },
  { date: '2026-02-25', name: 'EDSA People Power Anniversary' },
  { date: '2026-04-03', name: 'Good Friday' },
  { date: '2026-05-01', name: 'Labour Day' },
  { date: '2026-06-12', name: 'Independence Day' },
  { date: '2026-08-21', name: 'Ninoy Aquino Day' },
  { date: '2026-08-31', name: 'National Heroes Day' },
  { date: '2026-11-30', name: 'Bonifacio Day' },
  { date: '2026-12-25', name: 'Christmas Day' },
  { date: '2026-12-30', name: 'Rizal Day' },
]

function fmt(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function daysUntil(iso: string) {
  const ms = +new Date(iso + 'T00:00:00') - +new Date(new Date().toDateString())
  return Math.round(ms / 86400000)
}

export default function HolidaysClient() {
  const today = new Date().toISOString().slice(0, 10)
  const upcoming = HOLIDAYS.filter((h) => h.date >= today)
  const past = HOLIDAYS.filter((h) => h.date < today)
  const next = upcoming[0]

  return (
    <>
      <PageHead
        title="Holidays"
        lead="The company calendar — the days nobody is expected in."
      />
      <PlaneBadge plane="work" />

      {next && (
        <div className="card card--accent mb-5">
          <div className="stat">
            <span className="stat__value t-num">{daysUntil(next.date)}</span>
            <span className="stat__label">
              days until {next.name}, {fmt(next.date)}
            </span>
          </div>
        </div>
      )}

      <div className="card card--flush">
        <div style={{ padding: 'var(--s-5) var(--s-5) var(--s-3)' }}>
          <div className="card__title">Upcoming</div>
        </div>
        {upcoming.length === 0 ? (
          <p className="t-subtle" style={{ padding: '0 var(--s-5) var(--s-5)' }}>
            Nothing left on the calendar this year.
          </p>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <caption className="sr-only">Upcoming holidays</caption>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Holiday</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map((h) => (
                  <tr key={h.date}>
                    <td>{fmt(h.date)}</td>
                    <th scope="row" style={{ fontWeight: 600 }}>
                      {h.name}
                    </th>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {past.length > 0 && (
        <div className="card card--flush card--quiet mt-4">
          <div style={{ padding: 'var(--s-5) var(--s-5) var(--s-3)' }}>
            <div className="card__title">Already passed this year</div>
          </div>
          <div className="table-scroll">
            <table className="data-table">
              <caption className="sr-only">Past holidays</caption>
              <tbody>
                {past.map((h) => (
                  <tr key={h.date}>
                    <td className="t-subtle">{fmt(h.date)}</td>
                    <th scope="row" className="t-subtle" style={{ fontWeight: 500 }}>
                      {h.name}
                    </th>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}
