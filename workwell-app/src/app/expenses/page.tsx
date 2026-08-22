import { createClient } from '@/lib/supabase/server'
import { Empty, LoadError, PageHead, PlaneBadge } from '@/components/chrome'
import { Shell } from '@/components/shell'
import { ClaimForm } from './claim-form'
import { ExpenseDecide } from './expense-decide'

function fmt(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
}

export default async function Expenses() {
  const supabase = await createClient()

  const [{ data: me, error: meError }, { data: expenses, error: expensesError }] = await Promise.all([
    supabase.from('me').select('id').maybeSingle(),
    supabase.from('expenses').select('*').order('created_at', { ascending: false }),
  ])

  const readError = meError ?? expensesError
  if (readError) {
    return (
      <Shell plane="work">
        <PageHead title="Expenses" />
        <PlaneBadge plane="work" />
        <LoadError what="Your expenses" detail={readError.message} />
      </Shell>
    )
  }

  if (!me) {
    return (
      <Shell plane="work">
        <PageHead title="Expenses" />
        <PlaneBadge plane="work" />
        <Empty icon="🔑" title="No employment record yet">
          Expenses belong to an employment record, and yours is created when HR
          approves your access.
        </Empty>
      </Shell>
    )
  }

  const rows = expenses ?? []

  return (
    <Shell plane="work">
      <PageHead
        title="Expenses"
        lead="Claim something back, and see where it stands."
      />
      <PlaneBadge plane="work" />

      <div className="grid grid--sidebar-right">
        <div className="stack">
          <ClaimForm personId={me.id} />

          <div className="card card--flush">
            <div style={{ padding: 'var(--s-5) var(--s-5) var(--s-3)' }}>
              <div className="card__title">Your claims</div>
            </div>
            {rows.length === 0 ? (
              <p className="t-subtle" style={{ padding: '0 var(--s-5) var(--s-5)' }}>
                No claims submitted yet.
              </p>
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <caption className="sr-only">Your expense claims</caption>
                  <thead>
                    <tr>
                      <th scope="col">Description</th>
                      <th scope="col">Amount</th>
                      <th scope="col">Category</th>
                      <th scope="col">Status</th>
                      <th scope="col">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id}>
                        <th scope="row" style={{ fontWeight: 600 }}>
                          {r.description}
                        </th>
                        <td className="t-num">
                          {typeof r.amount === 'number'
                            ? r.amount.toLocaleString('en-GB', { style: 'currency', currency: 'GBP' })
                            : r.amount}
                        </td>
                        <td>{r.category}</td>
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
                        <td className="t-subtle">{fmt(r.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="stack">
          {/* Show pending expenses for HR to decide */}
          {rows.filter((r) => r.status === 'pending').length > 0 && (
            <div className="card card--flush">
              <div style={{ padding: 'var(--s-5) var(--s-5) var(--s-3)' }}>
                <div className="card__title">Pending approval</div>
                <div className="card__sub">Awaiting a decision</div>
              </div>
              <div className="stack">
                {rows
                  .filter((r) => r.status === 'pending')
                  .map((r) => (
                    <div className="card card--quiet" key={r.id} style={{ margin: 0 }}>
                      <div className="row row--between">
                        <b>{r.description}</b>
                        <span className="chip">{r.category}</span>
                      </div>
                      <p className="t-subtle mt-2">
                        {typeof r.amount === 'number'
                          ? r.amount.toLocaleString('en-GB', { style: 'currency', currency: 'GBP' })
                          : r.amount}
                      </p>
                      <ExpenseDecide id={r.id} />
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Shell>
  )
}
