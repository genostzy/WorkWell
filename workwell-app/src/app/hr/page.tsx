import { createClient } from '@/lib/supabase/server'
import { Shell } from '@/components/chrome'
import { Decide } from './decide'

function fmt(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  })
}

export default async function Hr() {
  const supabase = await createClient()

  // Role gate. RLS would return nothing useful to a non-HR account anyway,
  // but an empty page reads like a bug — say why instead.
  const { data: roles } = await supabase.from('person_roles').select('role')
  const isHr = (roles ?? []).some((r) => r.role === 'hr')

  if (!isHr) {
    return (
      <Shell>
        <h1>Not available on this account</h1>
        <p className="lead">
          This area is for HR. Your own data lives on the private plane, which
          nobody here can read.
        </p>
      </Shell>
    )
  }

  const { data: people } = await supabase
    .from('people')
    .select('id, full_name, status')
    .order('full_name')

  const { data: employment } = await supabase
    .from('employment')
    .select('person_id, job_title, department')

  const { data: leave } = await supabase
    .from('leave_requests')
    .select('id, person_id, kind, starts_on, ends_on, note, status')
    .order('created_at', { ascending: false })

  const byPerson = new Map((employment ?? []).map((e) => [e.person_id, e]))
  const names = new Map((people ?? []).map((p) => [p.id, p.full_name]))
  const pending = (leave ?? []).filter((l) => l.status === 'pending')

  return (
    <Shell current="hr" isHr>
      <h1>People</h1>
      <p className="lead">
        Employment records for everyone at your organisation.
      </p>

      <p className="privacy" style={{ background: 'transparent' }}>
        <span aria-hidden="true">🏢</span>
        <span>
          <b>Employment data only.</b> No mood, check-ins or pressure appears
          here. Those live on each person&rsquo;s private plane and are not
          queryable from this side.
        </span>
      </p>

      <div className="card">
        <div className="card__title">Leave to approve</div>
        {pending.length === 0 ? (
          <p className="card__sub">Nothing waiting on you.</p>
        ) : (
          <div className="rows mt">
            {pending.map((l) => (
              <div key={l.id} className="card" style={{ margin: 0, padding: 14 }}>
                <div className="card__title">
                  {names.get(l.person_id) ?? 'Someone'} · {l.kind}
                </div>
                <p className="card__sub">
                  {fmt(l.starts_on)} – {fmt(l.ends_on)}
                </p>
                {l.note && <p className="muted">{l.note}</p>}
                <Decide id={l.id} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card__title">Directory</div>
        <p className="card__sub">{(people ?? []).length} people</p>
        <div className="rows mt">
          {(people ?? []).map((p) => {
            const e = byPerson.get(p.id)
            return (
              <div className="bar" key={p.id}>
                <b style={{ color: 'var(--text)' }}>{p.full_name}</b>
                <span>{e ? `${e.job_title} · ${e.department}` : '—'}</span>
                <span>{p.status}</span>
              </div>
            )
          })}
        </div>
      </div>
    </Shell>
  )
}
