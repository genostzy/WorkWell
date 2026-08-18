import { createClient } from '@/lib/supabase/server'
import { readIsHr } from '@/lib/role'
import { Empty, LoadError, PageHead, PlaneBadge, PrivacyNote, RoleLocked } from '@/components/chrome'
import { Shell } from '@/components/shell'
import { LeaveForm } from './form'
import { OwnProfile } from './profile'

// A missing or unparseable date must not reach the page as the string
// "Invalid Date", which is what toLocaleDateString returns for one and
// reads like a bug in the record rather than an empty field.
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

function days(a: string, b: string) {
  const ms = +new Date(b + 'T00:00:00') - +new Date(a + 'T00:00:00')
  return Math.round(ms / 86400000) + 1
}

export default async function Leave() {
  const supabase = await createClient()

  // Independent reads — run together rather than paying two round trips
  // for a page that used to need only one.
  const [{ isHr, error: roleError }, { data: me, error: meError }] =
    await Promise.all([
      readIsHr(supabase),
      supabase.from('me').select('id, full_name').maybeSingle(),
    ])

  if (roleError) {
    return (
      <Shell plane="work">
        <PageHead title="Leave and profile" />
        <LoadError what="Your account" detail={roleError} />
      </Shell>
    )
  }

  if (isHr) {
    return (
      <Shell plane="work" isHr>
        <PageHead title="Not available on this account" />
        <RoleLocked audience="employee" />
      </Shell>
    )
  }

  // Without a person row there is no employment record to read and nothing
  // to book against, so ask for neither — an .eq on an empty id is a query
  // that can only ever come back empty.
  const [employmentResult, requestResult] = me
    ? await Promise.all([
        supabase
          .from('employment')
          .select(
            'job_title, department, team, manager_name, contract_type, location, started_on, entitlement'
          )
          .eq('person_id', me.id)
          .maybeSingle(),
        supabase
          .from('leave_requests')
          .select('id, kind, starts_on, ends_on, note, status')
          .order('starts_on', { ascending: false }),
      ])
    : [null, null]

  const readError = meError ?? requestResult?.error ?? null
  if (readError) {
    return (
      <Shell current="leave" plane="work">
        <PageHead title="Leave and profile" />
        <PlaneBadge plane="work" />
        <LoadError what="Your leave record" detail={readError.message} />
      </Shell>
    )
  }

  if (!me) {
    return (
      <Shell current="leave" plane="work">
        <PageHead title="Leave and profile" />
        <PlaneBadge plane="work" />
        <Empty icon="🔑" title="No employment record yet">
          Leave belongs to an employment record, and yours is created when HR
          approves your access. Nothing is missing — it does not exist yet.
        </Empty>
      </Shell>
    )
  }

  const fullName = me.full_name
  const employment = employmentResult?.data ?? null
  const rows = requestResult?.data ?? []
  const taken = rows
    .filter((r) => r.status === 'approved')
    .reduce((sum, r) => sum + days(r.starts_on, r.ends_on), 0)
  const entitlement = employment?.entitlement ?? 20
  const left = entitlement - taken
  // Guard the bar's own arithmetic rather than the value: an entitlement of
  // zero is a legitimate record (a contractor, say) and 0/0 is NaN, which
  // reaches CSS as `width: NaN%` and silently paints nothing.
  const usedPct = entitlement > 0 ? Math.min(100, (taken / entitlement) * 100) : 0

  return (
    <Shell current="leave" plane="work">
      <PageHead
        title="Leave and profile"
        lead="The one part of WorkWell your employer does see — and only this part."
      />

      <PlaneBadge plane="work" />

      <div className="grid grid--sidebar-right">
        <div className="stack">
          <OwnProfile legalName={fullName} />

          <LeaveForm personId={me.id} />

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
          {/* Straight from the prototype's my-profile: the clearest possible
              statement of the split, on the screen someone would come
              looking for it — this is the one place where the employer does
              see something, so it is where the line has to be drawn. */}
          <div className="card card--accent">
            <div className="card__title mb-3">What your employer holds</div>
            <ul className="stack stack--tight" style={{ fontSize: 'var(--fs-sm)' }}>
              {[
                'Your job, team, manager and start date',
                'Leave dates and balance',
                'Whether your account is open',
              ].map((t) => (
                <li className="row" key={t} style={{ gap: 'var(--s-2)', flexWrap: 'nowrap' }}>
                  <span aria-hidden="true">✓</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>

            <div className="hr" />

            <div className="card__title mb-3">What it never holds</div>
            <ul className="stack stack--tight" style={{ fontSize: 'var(--fs-sm)' }}>
              {[
                'Your check-ins, mood, energy or pressure',
                'Your quiet hours, or when you were active — unless you ask HR to fix a day',
                'Which nudges you use, or whether you use WorkWell at all',
                'What you called yourself, or the colour above',
              ].map((t) => (
                <li className="row" key={t} style={{ gap: 'var(--s-2)', flexWrap: 'nowrap' }}>
                  <span aria-hidden="true">✕</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>

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
                  style={{ width: `${usedPct}%` }}
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

      <PrivacyNote
        plane="work"
        detail="Your check-ins, mood, notes and trends stay on the private plane and are never attached to a leave request. Asking for a day off says nothing about how you are."
      >
        <b>Your employer does see this one.</b>{' '}
      </PrivacyNote>
    </Shell>
  )
}
