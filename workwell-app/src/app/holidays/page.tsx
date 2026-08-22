import { createClient } from '@/lib/supabase/server'
import { Empty, LoadError, PageHead, PlaneBadge } from '@/components/chrome'
import { Shell } from '@/components/shell'
import { HolidayForm } from './holiday-form'

function fmt(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso + 'T00:00:00')
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
}

export default async function Holidays() {
  const supabase = await createClient()

  const [
    { data: holidays, error: holidaysError },
    { data: roles },
  ] = await Promise.all([
    supabase.from('holidays').select('*').order('starts_on', { ascending: false }),
    supabase.from('person_roles').select('role'),
  ])

  const isHr = (roles ?? []).some((r) => r.role === 'hr')

  if (holidaysError) {
    return (
      <Shell plane="work">
        <PageHead title="Holidays" />
        <PlaneBadge plane="work" />
        <LoadError what="The holiday calendar" detail={holidaysError.message} />
      </Shell>
    )
  }

  const rows = holidays ?? []
  const today = new Date().toISOString().slice(0, 10)
  const upcoming = rows.filter((h) => h.ends_on >= today)
  const past = rows.filter((h) => h.ends_on < today)

  return (
    <Shell plane="work">
      <PageHead
        title="Holidays"
        lead="The company calendar — the days nobody is expected in."
      />
      <PlaneBadge plane="work" />

      {isHr && <HolidayForm />}

      {rows.length === 0 ? (
        <Empty icon="📅" title="No holidays yet">
          {isHr
            ? 'Add the first company holiday using the form above.'
            : 'No holidays have been added yet. Check back later.'}
        </Empty>
      ) : (
        <>
          {upcoming.length > 0 && (
            <div className="card card--flush mb-5">
              <div style={{ padding: 'var(--s-5) var(--s-5) var(--s-3)' }}>
                <div className="card__title">Upcoming</div>
              </div>
              <div className="table-scroll">
                <table className="data-table">
                  <caption className="sr-only">Upcoming holidays</caption>
                  <thead>
                    <tr>
                      <th scope="col">Holiday</th>
                      <th scope="col">Dates</th>
                      <th scope="col">Recurring</th>
                    </tr>
                  </thead>
                  <tbody>
                    {upcoming.map((h) => (
                      <tr key={h.id}>
                        <th scope="row" style={{ fontWeight: 600 }}>
                          {h.name}
                        </th>
                        <td>
                          {fmt(h.starts_on)}
                          {h.starts_on !== h.ends_on && (
                            <> – {fmt(h.ends_on)}</>
                          )}
                        </td>
                        <td>
                          {h.recurring ? (
                            <span className="chip chip--accent">Recurring</span>
                          ) : (
                            <span className="chip">One-off</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {past.length > 0 && (
            <div className="card card--flush">
              <div style={{ padding: 'var(--s-5) var(--s-5) var(--s-3)' }}>
                <div className="card__title">Past</div>
              </div>
              <div className="table-scroll">
                <table className="data-table">
                  <caption className="sr-only">Past holidays</caption>
                  <thead>
                    <tr>
                      <th scope="col">Holiday</th>
                      <th scope="col">Dates</th>
                      <th scope="col">Recurring</th>
                    </tr>
                  </thead>
                  <tbody>
                    {past.map((h) => (
                      <tr key={h.id}>
                        <th scope="row" style={{ fontWeight: 600 }}>
                          {h.name}
                        </th>
                        <td>
                          {fmt(h.starts_on)}
                          {h.starts_on !== h.ends_on && (
                            <> – {fmt(h.ends_on)}</>
                          )}
                        </td>
                        <td>
                          {h.recurring ? (
                            <span className="chip chip--accent">Recurring</span>
                          ) : (
                            <span className="chip">One-off</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </Shell>
  )
}
