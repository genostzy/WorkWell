import { createClient } from '@/lib/supabase/server'
import { PageHead, PlaneBadge, PrivacyNote, Shell } from '@/components/chrome'
import { LeaveForm } from './form'

function fmt(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function days(a: string, b: string) {
  const ms = +new Date(b + 'T00:00:00') - +new Date(a + 'T00:00:00')
  return Math.round(ms / 86400000) + 1
}

export default async function Leave() {
  const supabase = await createClient()

  const { data: me } = await supabase.from('me').select('id').maybeSingle()

  const { data: employment } = await supabase
    .from('employment')
    .select(
      'job_title, department, team, manager_name, contract_type, location, started_on, entitlement'
    )
    .eq('person_id', me?.id ?? '')
    .maybeSingle()

  const { data: requests } = await supabase
    .from('leave_requests')
    .select('id, kind, starts_on, ends_on, note, status')
    .order('starts_on', { ascending: false })

  const { data: roles } = await supabase.from('person_roles').select('role')
  const isHr = (roles ?? []).some((r) => r.role === 'hr')

  const rows = requests ?? []
  const taken = rows
    .filter((r) => r.status === 'approved')
    .reduce((sum, r) => sum + days(r.starts_on, r.ends_on), 0)
  const entitlement = employment?.entitlement ?? 20
  const left = entitlement - taken

  return (
    <Shell current="leave" plane="work" isHr={isHr}>
      <PageHead
        title="Leave and profile"
        lead="The one part of WorkWell your employer does see — and only this part."
      />

      <PlaneBadge plane="work" />

      <PrivacyNote
        plane="work"
        detail="Your check-ins, mood, notes and trends stay on the private plane and are never attached to a leave request. Asking for a day off says nothing about how you are."
      >
        <b>Your employer does see this one.</b>{' '}
      </PrivacyNote>

      <div className="grid grid--sidebar-right">
        <div className="stack">
          <LeaveForm personId={me?.id ?? null} />

          <div className="card card--flush">
            <div style={{ padding: 'var(--s-5) var(--s-5) var(--s-3)' }}>
              <div className="card__title">Your requests</div>
            </div>
            {rows.length === 0 ? (
              <p className="t-subtle" style={{ padding: '0 var(--s-5) var(--s-5)' }}>
                Nothing booked yet.
              </p>
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <caption className="sr-only">Your leave requests</caption>
                  <thead>
                    <tr>
                      <th scope="col">Type</th>
                      <th scope="col">Dates</th>
                      <th scope="col">Days</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id}>
                        <th scope="row" style={{ fontWeight: 600 }}>
                          {r.kind}
                        </th>
                        <td>
                          {fmt(r.starts_on)} – {fmt(r.ends_on)}
                        </td>
                        <td className="t-num">
                          {days(r.starts_on, r.ends_on)}
                        </td>
                        <td>
                          <span
                            className={
                              r.status === 'approved'
                                ? 'chip chip--accent'
                                : 'chip'
                            }
                          >
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card__title mb-4">Balance</div>
            <div className="stat mb-4">
              <span className="stat__value t-num">{left}</span>
              <span className="stat__label">
                days left of {entitlement}
              </span>
            </div>
            <div className="meter">
              <div className="meter__track">
                <div
                  className="meter__fill"
                  style={{
                    width: `${Math.min(100, (taken / entitlement) * 100)}%`,
                  }}
                />
              </div>
              <div className="row row--between t-subtle">
                <span>{taken} taken</span>
                <span>{left} left</span>
              </div>
            </div>
          </div>

          {employment && (
            <div className="card card--flush">
              <div style={{ padding: 'var(--s-5) var(--s-5) var(--s-3)' }}>
                <div className="card__title">Employment record</div>
                <div className="card__sub">
                  Held by HR. Ask them to correct anything wrong.
                </div>
              </div>
              <div className="table-scroll">
                <table className="data-table">
                  <caption className="sr-only">Your employment record</caption>
                  <tbody>
                    {[
                      ['Job title', employment.job_title],
                      ['Department', employment.department],
                      ['Team', employment.team],
                      ['Manager', employment.manager_name],
                      ['Contract', employment.contract_type],
                      ['Location', employment.location],
                      ['Started', fmt(employment.started_on)],
                    ].map(([k, v]) => (
                      <tr key={k as string}>
                        <th
                          scope="row"
                          style={{
                            fontWeight: 600,
                            color: 'var(--text-muted)',
                            width: '42%',
                          }}
                        >
                          {k}
                        </th>
                        <td style={{ fontWeight: 600, color: 'var(--text)' }}>
                          {v || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </Shell>
  )
}
