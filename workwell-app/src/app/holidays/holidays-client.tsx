'use client'

import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import { PageHead, PlaneBadge } from '@/components/chrome'
import { fmtDate } from '@/lib/format-date'

type Holiday = { id: string; observed_on: string; name: string }

function daysUntil(iso: string) {
  const ms = +new Date(iso + 'T00:00:00') - +new Date(new Date().toDateString())
  return Math.round(ms / 86400000)
}

async function fetchHolidays() {
  const { data, error } = await createClient()
    .from('holidays')
    .select('id, observed_on, name')
    .order('observed_on')
  if (error) throw error
  return (data ?? []) as Holiday[]
}

export default function HolidaysClient() {
  const { data: holidays, error: loadErrorObj, isLoading: loading } = useSWR('holidays:all', fetchHolidays)
  const loadError = loadErrorObj?.message ?? null

  const today = new Date().toISOString().slice(0, 10)
  const upcoming = (holidays ?? []).filter((h) => h.observed_on >= today)
  const past = (holidays ?? []).filter((h) => h.observed_on < today)
  const next = upcoming[0]

  return (
    <>
      <PageHead
        title="Holidays"
        lead="The company calendar — the days nobody is expected in."
      />
      <PlaneBadge plane="work" />

      {loadError && (
        <div className="banner banner--error mb-5" role="alert">
          {loadError}
        </div>
      )}

      {loading ? (
        <div className="card mb-5">
          <div className="skel skel--text" />
        </div>
      ) : (
        <>
          {next && (
            <div className="card card--accent mb-5">
              <div className="stat">
                <span className="stat__value t-num">{daysUntil(next.observed_on)}</span>
                <span className="stat__label">
                  days until {next.name}, {fmtDate(next.observed_on, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              </div>
            </div>
          )}

          <div className="card card--flush">
            <div style={{ padding: 'var(--s-5) var(--s-5) var(--s-3)' }}>
              <h2 className="card__title">Upcoming</h2>
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
                      <tr key={h.id}>
                        <td>{fmtDate(h.observed_on, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}</td>
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
                <h2 className="card__title">Already passed this year</h2>
              </div>
              <div className="table-scroll">
                <table className="data-table">
                  <caption className="sr-only">Past holidays</caption>
                  <tbody>
                    {past.map((h) => (
                      <tr key={h.id}>
                        <td className="t-subtle">{fmtDate(h.observed_on, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}</td>
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
      )}
    </>
  )
}
