import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { LoadError, PageHead, PlaneBadge, PrivacyNote, RoleLocked } from '@/components/chrome'
import { Decide } from '../../hr/decide'
import { DecideAttendanceReset } from '../../hr/decide-attendance-reset'
import { DecideExpense } from '../../hr/decide-expense'
import { DecidePayrollRequest } from '../../hr/decide-payroll-request'
import { DecideComplaint } from '../../hr/decide-complaint'
import { DecideResignation } from '../../hr/decide-resignation'
import { DecideSupportRequest } from '../../hr/decide-support-request'

function fmt(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  })
}

export default async function Hr() {
  const supabase = await createClient()

  const { data: roles } = await supabase.from('person_roles').select('role')
  const isHr = (roles ?? []).some((r) => r.role === 'hr')

  if (!isHr) {
    return (
      <>
        <PageHead title="Not available on this account" />
        <RoleLocked audience="hr" />
      </>
    )
  }

  const [
    { data: people, error: peopleError },
    { data: employment },
    { data: leave, error: leaveError },
    { data: resets, error: resetsError },
    { data: resetAttendance },
    { data: expenses, error: expensesError },
    { data: payrollRequests, error: payrollRequestsError },
    { data: complaints, error: complaintsError },
    { data: resignations, error: resignationsError },
    { data: supportRequests, error: supportRequestsError },
  ] = await Promise.all([
    supabase.from('people').select('id, full_name, status').order('full_name'),
    supabase.from('employment').select('person_id, job_title, department'),
    supabase
      .from('leave_requests')
      .select('id, person_id, kind, starts_on, ends_on, note, status')
      .order('created_at', { ascending: false }),
    supabase
      .from('attendance_reset_requests')
      .select('id, person_id, day, reason, status')
      .order('created_at', { ascending: false }),
    supabase.from('attendance').select('person_id, day, time_in, lunch_start, lunch_end, time_out'),
    supabase
      .from('expenses')
      .select('id, person_id, category, amount, spent_on, note, status')
      .order('created_at', { ascending: false }),
    supabase
      .from('payroll_requests')
      .select('id, person_id, kind, note, status')
      .order('created_at', { ascending: false }),
    supabase
      .from('complaints')
      .select('id, person_id, summary, status')
      .order('created_at', { ascending: false }),
    supabase
      .from('resignations')
      .select('id, person_id, last_day, reason, status')
      .order('created_at', { ascending: false }),
    supabase
      .from('support_requests')
      .select('id, person_id, body, status, created_at')
      .eq('status', 'open')
      .order('created_at', { ascending: false }),
  ])

  // An empty directory and a directory that would not load look identical
  // once the rows are gone, and only one of them means "add someone".
  const readError =
    peopleError ?? leaveError ?? resetsError ?? expensesError ?? payrollRequestsError
    ?? complaintsError ?? resignationsError ?? supportRequestsError
  if (readError) {
    return (
      <>
        <PageHead title="People" />
        <PlaneBadge plane="work" />
        <LoadError what="The directory" detail={readError.message} />
      </>
    )
  }

  const byPerson = new Map((employment ?? []).map((e) => [e.person_id, e]))
  const names = new Map((people ?? []).map((p) => [p.id, p.full_name]))
  const pending = (leave ?? []).filter((l) => l.status === 'pending')

  const pendingResets = (resets ?? []).filter((r) => r.status === 'pending')
  const attendanceFor = new Map(
    (resetAttendance ?? []).map((a) => [`${a.person_id}:${a.day}`, a])
  )

  // Approved sits alongside Submitted here — both still need something from
  // HR (a decision, then a reimbursement), unlike Reimbursed and Declined
  // which are the two states nothing more ever happens to.
  const openExpenses = (expenses ?? []).filter(
    (e) => e.status === 'Submitted' || e.status === 'Approved'
  )
  const pendingPayrollRequests = (payrollRequests ?? []).filter(
    (r) => r.status === 'Pending'
  )
  const openComplaints = (complaints ?? []).filter((c) => c.status !== 'Resolved')
  const pendingResignations = (resignations ?? []).filter((r) => r.status === 'Submitted')

  return (
    <>
      <PageHead
        title="People"
        lead="Employment records for everyone at your organisation."
      />

      <PlaneBadge plane="work" />

      <div className="card">
        <div className="card__head">
          <div>
            <h2 className="card__title">Accounts &amp; access</h2>
            <div className="card__sub">
              Create accounts, and choose what each one can open
            </div>
          </div>
        </div>
        <Link className="btn btn--secondary btn--sm mt-3" href="/hr/accounts">
          Manage accounts
        </Link>
      </div>

      <div className="grid grid--4 mb-5">
        <div className="stat">
          <span className="stat__label">Headcount</span>
          <span className="stat__value t-num">{(people ?? []).length}</span>
        </div>
        <div className="stat">
          <span className="stat__label">Leave to approve</span>
          <span className="stat__value t-num">{pending.length}</span>
        </div>
        <div className="stat">
          <span className="stat__label">Attendance resets to review</span>
          <span className="stat__value t-num">{pendingResets.length}</span>
        </div>
        <div className="stat">
          <span className="stat__label">Wellbeing records visible</span>
          <span className="stat__value t-num">0</span>
        </div>
      </div>

      <div className="card">
        <div className="card__head">
          <div>
            <h2 className="card__title">Leave to approve</h2>
            <div className="card__sub">Awaiting a decision from you</div>
          </div>
        </div>
        {pending.length === 0 ? (
          <p className="t-subtle">Nothing waiting on you.</p>
        ) : (
          <div className="stack">
            {pending.map((l) => (
              <div className="card card--quiet" key={l.id} style={{ margin: 0 }}>
                <div className="row row--between">
                  <b>{names.get(l.person_id) ?? 'Someone'}</b>
                  <span className="chip">{l.kind}</span>
                </div>
                <p className="t-subtle mt-2">
                  {fmt(l.starts_on)} – {fmt(l.ends_on)}
                </p>
                {l.note && <p className="t-subtle">{l.note}</p>}
                <Decide id={l.id} personId={l.person_id} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card__head">
          <div>
            <h2 className="card__title">Attendance resets to review</h2>
            <div className="card__sub">Requested with a reason, awaiting your decision</div>
          </div>
        </div>
        {pendingResets.length === 0 ? (
          <p className="t-subtle">Nothing waiting on you.</p>
        ) : (
          <div className="stack">
            {pendingResets.map((r) => {
              const att = attendanceFor.get(`${r.person_id}:${r.day}`)
              return (
                <div className="card card--quiet" key={r.id} style={{ margin: 0 }}>
                  <div className="row row--between">
                    <b>{names.get(r.person_id) ?? 'Someone'}</b>
                    <span className="chip">{fmt(r.day)}</span>
                  </div>
                  <p className="t-subtle mt-2">{r.reason}</p>
                  <DecideAttendanceReset
                    requestId={r.id}
                    personId={r.person_id}
                    day={r.day}
                    initial={{
                      timeIn: att?.time_in ?? null,
                      lunchStart: att?.lunch_start ?? null,
                      lunchEnd: att?.lunch_end ?? null,
                      timeOut: att?.time_out ?? null,
                    }}
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card__head">
          <div>
            <h2 className="card__title">Expenses to review</h2>
            <div className="card__sub">Submitted claims, and approved ones waiting to be marked paid</div>
          </div>
        </div>
        {openExpenses.length === 0 ? (
          <p className="t-subtle">Nothing waiting on you.</p>
        ) : (
          <div className="stack">
            {openExpenses.map((e) => (
              <div className="card card--quiet" key={e.id} style={{ margin: 0 }}>
                <div className="row row--between">
                  <b>{names.get(e.person_id) ?? 'Someone'}</b>
                  <span className="chip">{e.category}</span>
                </div>
                <p className="t-subtle mt-2">
                  {fmt(e.spent_on)} · ₱{Number(e.amount).toLocaleString('en-PH')}
                </p>
                {e.note && <p className="t-subtle">{e.note}</p>}
                <DecideExpense id={e.id} personId={e.person_id} status={e.status} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card__head">
          <div>
            <h2 className="card__title">Payroll requests to review</h2>
            <div className="card__sub">Awaiting a decision from you</div>
          </div>
        </div>
        {pendingPayrollRequests.length === 0 ? (
          <p className="t-subtle">Nothing waiting on you.</p>
        ) : (
          <div className="stack">
            {pendingPayrollRequests.map((r) => (
              <div className="card card--quiet" key={r.id} style={{ margin: 0 }}>
                <div className="row row--between">
                  <b>{names.get(r.person_id) ?? 'Someone'}</b>
                  <span className="chip">{r.kind}</span>
                </div>
                <p className="t-subtle mt-2">{r.note}</p>
                <DecidePayrollRequest id={r.id} personId={r.person_id} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card__head">
          <div>
            <h2 className="card__title">Complaints to review</h2>
            <div className="card__sub">Filed cases, not yet resolved</div>
          </div>
        </div>
        {openComplaints.length === 0 ? (
          <p className="t-subtle">Nothing waiting on you.</p>
        ) : (
          <div className="stack">
            {openComplaints.map((c) => (
              <div className="card card--quiet" key={c.id} style={{ margin: 0 }}>
                <div className="row row--between">
                  <b>{names.get(c.person_id) ?? 'Someone'}</b>
                  <span className="chip">{c.status}</span>
                </div>
                <p className="t-subtle mt-2">{c.summary}</p>
                <DecideComplaint id={c.id} personId={c.person_id} status={c.status} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card__head">
          <div>
            <h2 className="card__title">Resignations to acknowledge</h2>
            <div className="card__sub">Notice given, awaiting your acknowledgement</div>
          </div>
        </div>
        {pendingResignations.length === 0 ? (
          <p className="t-subtle">Nothing waiting on you.</p>
        ) : (
          <div className="stack">
            {pendingResignations.map((r) => (
              <div className="card card--quiet" key={r.id} style={{ margin: 0 }}>
                <div className="row row--between">
                  <b>{names.get(r.person_id) ?? 'Someone'}</b>
                  <span className="chip">{fmt(r.last_day)}</span>
                </div>
                {r.reason && <p className="t-subtle mt-2">{r.reason}</p>}
                <DecideResignation id={r.id} personId={r.person_id} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card__head">
          <div>
            <h2 className="card__title">Support requests</h2>
            <div className="card__sub">Routed to you from Recognition &amp; connection, still open</div>
          </div>
        </div>
        {(supportRequests ?? []).length === 0 ? (
          <p className="t-subtle">Nothing waiting on you.</p>
        ) : (
          <div className="stack">
            {(supportRequests ?? []).map((r) => (
              <div className="card card--quiet" key={r.id} style={{ margin: 0 }}>
                <b>{names.get(r.person_id) ?? 'Someone'}</b>
                <p className="t-subtle mt-2">{r.body}</p>
                <DecideSupportRequest id={r.id} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card card--flush mt-5">
        <div style={{ padding: 'var(--s-5) var(--s-5) var(--s-3)' }}>
          <h2 className="card__title">Directory</h2>
          <div className="card__sub">
            {(people ?? []).length === 1
              ? '1 person'
              : `${(people ?? []).length} people`}
          </div>
        </div>
        {(people ?? []).length === 0 ? (
          <p className="t-subtle" style={{ padding: '0 var(--s-5) var(--s-5)' }}>
            Nobody has been added yet. Approve someone on{' '}
            <Link href="/hr/accounts">Accounts</Link> and they appear here.
          </p>
        ) : (
        <div className="table-scroll">
          <table className="data-table">
            <caption className="sr-only">Employee directory</caption>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Title</th>
                <th scope="col">Department</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {(people ?? []).map((p) => {
                const e = byPerson.get(p.id)
                return (
                  <tr key={p.id}>
                    <th scope="row" style={{ fontWeight: 600 }}>
                      {p.full_name}
                    </th>
                    <td>{e?.job_title ?? '—'}</td>
                    <td>{e?.department ?? '—'}</td>
                    <td>
                      <span
                        className={
                          p.status === 'active' ? 'chip chip--accent' : 'chip'
                        }
                      >
                        {p.status}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        )}
      </div>

      <PrivacyNote
        plane="work"
        detail="Mood, energy, pressure, notes and check-in history live on each person's private plane. There is no policy anywhere granting this account access to them — not a filtered view, no access at all. Asking for a day off says nothing about how someone is."
      >
        <b>Employment data only.</b>{' '}
      </PrivacyNote>
    </>
  )
}
