import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { LoadError, PageHead, PlaneBadge, PrivacyNote, RoleLocked } from '@/components/chrome'
import { Shell } from '@/components/shell'
import { Decide } from './decide'
import { DecideAttendanceReset } from './decide-attendance-reset'

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
      <Shell current="hr" plane="private">
        <PageHead title="Not available on this account" />
        <RoleLocked audience="hr" />
      </Shell>
    )
  }

  const [
    { data: people, error: peopleError },
    { data: employment },
    { data: leave, error: leaveError },
    { data: resets, error: resetsError },
    { data: resetAttendance },
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
    // RLS on attendance already scopes this to exactly the rows tied to a
    // pending reset request for HR's own org — nothing further to filter
    // here, and nothing more than that is ever readable this way.
    supabase.from('attendance').select('person_id, day, time_in, lunch_start, lunch_end, time_out'),
  ])

  // An empty directory and a directory that would not load look identical
  // once the rows are gone, and only one of them means "add someone".
  const readError = peopleError ?? leaveError ?? resetsError
  if (readError) {
    return (
      <Shell current="hr" plane="org" isHr>
        <PageHead title="People" />
        <PlaneBadge plane="work" />
        <LoadError what="The directory" detail={readError.message} />
      </Shell>
    )
  }

  const byPerson = new Map((employment ?? []).map((e) => [e.person_id, e]))
  const names = new Map((people ?? []).map((p) => [p.id, p.full_name]))
  const pending = (leave ?? []).filter((l) => l.status === 'pending')

  const pendingResets = (resets ?? []).filter((r) => r.status === 'pending')
  const attendanceFor = new Map(
    (resetAttendance ?? []).map((a) => [`${a.person_id}:${a.day}`, a])
  )

  return (
    <Shell current="hr" plane="org" isHr>
      <PageHead
        title="People"
        lead="Employment records for everyone at your organisation."
      />

      <PlaneBadge plane="work" />

      {/* Access decisions all live on Accounts. Two screens able to create
          or change the same account is how one of them ends up stale. */}
      <div className="card">
        <div className="card__head">
          <div>
            <div className="card__title">Accounts &amp; access</div>
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
            <div className="card__title">Leave to approve</div>
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
                <Decide id={l.id} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* HR only ever reaches this one day's attendance record while a
          request for it is open — the RLS policy that makes that true
          (attendance_hr_review, 0031) is what attendanceFor is reading
          through, not a general grant this page happens not to use. */}
      <div className="card">
        <div className="card__head">
          <div>
            <div className="card__title">Attendance resets to review</div>
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

      <div className="card card--flush mt-5">
        <div style={{ padding: 'var(--s-5) var(--s-5) var(--s-3)' }}>
          <div className="card__title">Directory</div>
          <div className="card__sub">
            {(people ?? []).length === 1
              ? '1 person'
              : `${(people ?? []).length} people`}
          </div>
        </div>
        {(people ?? []).length === 0 ? (
          // A table of headers with no rows under them reads as a failure.
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
    </Shell>
  )
}
