import { createClient } from '@/lib/supabase/server'
import { LoadError, PageHead, PlaneBadge, PrivacyNote } from '@/components/chrome'
import { Shell } from '@/components/shell'
import { WarningForm } from './warning-form'

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

const LEVEL_CLASS: Record<string, string> = {
  verbal: 'chip',
  written: 'chip',
  final: 'chip chip--accent',
}

export default async function Warnings() {
  const supabase = await createClient()

  const { data: roles } = await supabase.from('person_roles').select('role')
  const isHr = (roles ?? []).some((r) => r.role === 'hr')

  if (!isHr) {
    return (
      <Shell plane="work">
        <PageHead title="Not available on this account" />
        <div className="card">
          <div className="state">
            <div className="state__icon" aria-hidden="true">
              🔒
            </div>
            <h2 className="state__title">This area is for HR</h2>
            <p className="state__text">
              Warnings are formal disciplinary records that only HR can manage.
            </p>
          </div>
        </div>
      </Shell>
    )
  }

  const [{ data: warnings, error: warningsError }, { data: people, error: peopleError }] =
    await Promise.all([
      supabase
        .from('warnings')
        .select('*, people!inner(full_name)')
        .order('issued_on', { ascending: false }),
      supabase.from('people').select('id, full_name'),
    ])

  const readError = warningsError ?? peopleError
  if (readError) {
    return (
      <Shell plane="work">
        <PageHead title="Warnings" />
        <PlaneBadge plane="work" />
        <LoadError what="Warning records" detail={readError.message} />
      </Shell>
    )
  }

  const rows = warnings ?? []
  const peopleList = people ?? []

  return (
    <Shell plane="work">
      <PageHead title="Warnings" lead="Formal disciplinary records." />
      <PlaneBadge plane="work" />

      <PrivacyNote
        plane="work"
        detail="Every other work-plane record here is neutral fact HR needs to run the place — a job title, a leave balance. A warning is a judgement about a person, and putting it next to the same private-plane data this product goes out of its way to wall off is worth deciding on purpose, with whoever owns HR policy, rather than shipping because the word appeared on a list."
      >
        <b>A different kind of record than the rest of this list.</b>{' '}
      </PrivacyNote>

      <div className="grid grid--sidebar-right">
        <div className="stack">
          <WarningForm people={peopleList} />

          <div className="card card--flush">
            <div style={{ padding: 'var(--s-5) var(--s-5) var(--s-3)' }}>
              <div className="card__title">Warning history</div>
              <div className="card__sub">
                {rows.length === 0
                  ? 'No warnings on record.'
                  : `${rows.length} warning${rows.length === 1 ? '' : 's'}`}
              </div>
            </div>
            {rows.length === 0 ? (
              <p className="t-subtle" style={{ padding: '0 var(--s-5) var(--s-5)' }}>
                No warnings have been issued yet.
              </p>
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <caption className="sr-only">Warnings issued</caption>
                  <thead>
                    <tr>
                      <th scope="col">Person</th>
                      <th scope="col">Level</th>
                      <th scope="col">Reason</th>
                      <th scope="col">Issued On</th>
                      <th scope="col">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((w) => (
                      <tr key={w.id}>
                        <th scope="row" style={{ fontWeight: 600 }}>
                          {w.people?.full_name ?? '—'}
                        </th>
                        <td>
                          <span className={LEVEL_CLASS[w.level] ?? 'chip'}>
                            {w.level}
                          </span>
                        </td>
                        <td>{w.reason}</td>
                        <td className="t-subtle">{fmt(w.issued_on)}</td>
                        <td className="t-subtle">{w.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="stack">
          <div className="card card--accent">
            <div className="card__title mb-3">About warnings</div>
            <ul className="stack stack--tight" style={{ fontSize: 'var(--fs-sm)' }}>
              {[
                'Verbal — a first, informal notice',
                'Written — documented formal warning',
                'Final — last step before further action',
              ].map((t) => (
                <li className="row" key={t} style={{ gap: 'var(--s-2)', flexWrap: 'nowrap' }}>
                  <span aria-hidden="true">•</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Shell>
  )
}
