import { createClient } from '@/lib/supabase/server'
import { LoadError, PageHead, PlaneBadge, PrivacyNote } from '@/components/chrome'
import { Shell } from '@/components/shell'
import { SalaryRequestForm } from './salary-request-form'

function fmtPeriod(start: string, end: string) {
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  const fmtD = (d: Date) =>
    Number.isNaN(d.getTime())
      ? '—'
      : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${fmtD(s)} – ${fmtD(e)}`
}

function fmtMoney(v: number | null | undefined) {
  if (v == null) return '—'
  return v.toLocaleString('en-GB', { style: 'currency', currency: 'GBP' })
}

export default async function Payroll() {
  const supabase = await createClient()

  const [{ data: payslips, error: payslipsError }, { data: salaryRequests, error: srError }] =
    await Promise.all([
      supabase.from('payslips').select('*').order('period_start', { ascending: false }),
      supabase.from('salary_requests').select('*').order('created_at', { ascending: false }),
    ])

  const readError = payslipsError ?? srError
  if (readError) {
    return (
      <Shell plane="work">
        <PageHead title="Payroll" />
        <PlaneBadge plane="work" />
        <LoadError what="Payroll records" detail={readError.message} />
      </Shell>
    )
  }

  const pays = payslips ?? []
  const requests = salaryRequests ?? []

  return (
    <Shell plane="work">
      <PageHead
        title="Payroll"
        lead="Payslips, advances, and increments or promotions — together, since they're all the same salary record."
      />
      <PlaneBadge plane="work" />

      <PrivacyNote
        plane="work"
        detail="Salary is the most sensitive record HR holds. Whatever is built here needs to be readable by the person it belongs to and by whoever actually runs payroll — nobody else, including other HR functions that don't need it."
      >
        <b>Needs its own, narrower access — not the general HR role.</b>{' '}
      </PrivacyNote>

      <div className="grid grid--sidebar-right">
        <div className="stack">
          <SalaryRequestForm />

          <div className="card card--flush">
            <div style={{ padding: 'var(--s-5) var(--s-5) var(--s-3)' }}>
              <div className="card__title">Your salary requests</div>
            </div>
            {requests.length === 0 ? (
              <p className="t-subtle" style={{ padding: '0 var(--s-5) var(--s-5)' }}>
                No requests submitted yet.
              </p>
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <caption className="sr-only">Your salary requests</caption>
                  <thead>
                    <tr>
                      <th scope="col">Type</th>
                      <th scope="col">Detail</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((r) => (
                      <tr key={r.id}>
                        <th scope="row" style={{ fontWeight: 600 }}>
                          {r.type}
                        </th>
                        <td>{r.detail}</td>
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
          <div className="card card--flush">
            <div style={{ padding: 'var(--s-5) var(--s-5) var(--s-3)' }}>
              <div className="card__title">Payslips</div>
              <div className="card__sub">Payment history</div>
            </div>
            {pays.length === 0 ? (
              <p className="t-subtle" style={{ padding: '0 var(--s-5) var(--s-5)' }}>
                No payslips on record yet.
              </p>
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <caption className="sr-only">Payslip history</caption>
                  <thead>
                    <tr>
                      <th scope="col">Period</th>
                      <th scope="col">Gross</th>
                      <th scope="col">Deductions</th>
                      <th scope="col">Net</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pays.map((p) => (
                      <tr key={p.id}>
                        <td>{fmtPeriod(p.period_start, p.period_end)}</td>
                        <td className="t-num">{fmtMoney(p.gross)}</td>
                        <td className="t-num">{fmtMoney(p.deductions)}</td>
                        <td className="t-num">{fmtMoney(p.net)}</td>
                        <td>
                          <span
                            className={
                              p.status === 'paid'
                                ? 'chip chip--accent'
                                : 'chip'
                            }
                          >
                            {p.status}
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
      </div>
    </Shell>
  )
}
