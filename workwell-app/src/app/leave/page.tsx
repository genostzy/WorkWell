import { createClient } from '@/lib/supabase/server'
import { Shell } from '@/components/chrome'
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
    .select('job_title, department, team, manager_name, contract_type, location, started_on, entitlement')
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

  return (
    <Shell current="leave" isHr={isHr}>
      <h1>Leave and profile</h1>
      <p className="lead">
        The one part of WorkWell your employer does see — and only this part.
      </p>

      <p className="privacy" style={{ background: 'transparent' }}>
        <span aria-hidden="true">🏢</span>
        <span>
          <b>Your employer sees this.</b> Leave has to be approved, so dates and
          balances go to HR. Your check-ins never travel with them.
        </span>
      </p>

      <div className="card">
        <div className="card__title">Balance</div>
        <p className="card__sub">
          {entitlement - taken} of {entitlement} days left
        </p>
        <div className="bar mt">
          <span>Used</span>
          <span className="bar__track">
            <span
              className="bar__fill"
              style={{ width: `${Math.min(100, (taken / entitlement) * 100)}%` }}
            />
          </span>
          <span>{taken}</span>
        </div>
      </div>

      <LeaveForm personId={me?.id ?? null} />

      <div className="card">
        <div className="card__title">Your requests</div>
        {rows.length === 0 ? (
          <p className="card__sub">Nothing booked yet.</p>
        ) : (
          <div className="rows mt">
            {rows.map((r) => (
              <div key={r.id} className="card" style={{ margin: 0, padding: 14 }}>
                <div className="card__title">
                  {r.kind} · {days(r.starts_on, r.ends_on)} day
                  {days(r.starts_on, r.ends_on) === 1 ? '' : 's'}
                </div>
                <p className="card__sub">
                  {fmt(r.starts_on)} – {fmt(r.ends_on)} · <b>{r.status}</b>
                </p>
                {r.note && <p className="muted">{r.note}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {employment && (
        <div className="card">
          <div className="card__title">Employment record</div>
          <p className="card__sub">Held by HR. Ask them to correct anything wrong.</p>
          <div className="rows mt">
            {[
              ['Job title', employment.job_title],
              ['Department', employment.department],
              ['Team', employment.team],
              ['Manager', employment.manager_name],
              ['Contract', employment.contract_type],
              ['Location', employment.location],
              ['Started', fmt(employment.started_on)],
            ].map(([k, v]) => (
              <div className="bar" key={k as string}>
                <span style={{ width: 100 }}>{k}</span>
                <b style={{ color: 'var(--text)' }}>{v || '—'}</b>
                <span />
              </div>
            ))}
          </div>
        </div>
      )}
    </Shell>
  )
}
