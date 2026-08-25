import { createClient } from '@/lib/supabase/server'
import { LoadError, PageHead, PlaneBadge, PrivacyNote } from '@/components/chrome'

export default async function DecisionHistory() {
  const supabase = await createClient()

  const { data: roles } = await supabase.from('person_roles').select('role')
  const isHr = (roles ?? []).some((r) => r.role === 'hr')

  if (!isHr) {
    return (
      <>
        <PageHead title="Not available on this account" />
        <div className="card">
          <div className="state">
            <div className="state__icon" aria-hidden="true">&#x1f512;</div>
            <h2 className="state__title">This area is for HR</h2>
            <p className="state__text">
              Decision history is only visible to HR.
            </p>
          </div>
        </div>
      </>
    )
  }

  const [{ data: decisions, error: decError }, { data: people }] = await Promise.all([
    supabase
      .from('decision_history')
      .select('*')
      .order('decided_at', { ascending: false }),
    supabase.from('people').select('id, full_name'),
  ])

  if (decError) {
    return (
      <>
        <PageHead title="Decision history" />
        <PlaneBadge plane="org" />
        <LoadError what="Decision history" detail={decError.message} />
      </>
    )
  }

  const nameMap = new Map((people ?? []).map((p) => [p.id, p.full_name]))

  const rows = (decisions ?? []).map((d) => ({
    ...d,
    person_name: nameMap.get(d.person_id) ?? '—',
    decider_name: nameMap.get(d.decided_by) ?? '—',
  }))

  return (
    <>
      <PageHead
        title="Decision history"
        lead="All decisions made across the product."
      />

      <PlaneBadge plane="org" />

      <PrivacyNote plane="org" detail="Decisions are stored with the person and decider for audit purposes.">
        <b>HR access only.</b>{' '}
      </PrivacyNote>

      <div className="card card--flush mt-5">
        <div style={{ padding: 'var(--s-5) var(--s-5) var(--s-3)' }}>
          <h2 className="card__title">All decisions</h2>
          <div className="card__sub">
            {rows.length === 1 ? '1 decision' : `${rows.length} decisions`}
          </div>
        </div>
        {rows.length === 0 ? (
          <p className="t-subtle" style={{ padding: '0 var(--s-5) var(--s-5)' }}>
            No decisions have been recorded yet.
          </p>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <caption className="sr-only">Decision history</caption>
              <thead>
                <tr>
                  <th scope="col">Domain</th>
                  <th scope="col">Person</th>
                  <th scope="col">Status</th>
                  <th scope="col">Decided At</th>
                  <th scope="col">Decided By</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={`${d.domain}-${d.id}`}>
                    <td>
                      <span className="chip">{d.domain}</span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{d.person_name}</td>
                    <td>
                      <span
                        className={
                          d.status === 'approved'
                            ? 'chip chip--accent'
                            : d.status === 'declined'
                              ? 'chip'
                              : 'chip'
                        }
                      >
                        {d.status}
                      </span>
                    </td>
                    <td className="t-subtle">
                      {d.decided_at
                        ? new Date(d.decided_at).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : '—'}
                    </td>
                    <td>{d.decider_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
