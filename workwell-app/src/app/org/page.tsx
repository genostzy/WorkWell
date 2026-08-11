import { createClient } from '@/lib/supabase/server'
import { Shell } from '@/components/chrome'

const METRICS = [
  { key: 'mood', label: 'Mood' },
  { key: 'energy', label: 'Energy' },
  { key: 'pressure', label: 'Pressure' },
]

export default async function Org() {
  const supabase = await createClient()

  const { data: roles } = await supabase.from('person_roles').select('role')
  const isHr = (roles ?? []).some((r) => r.role === 'hr')

  if (!isHr) {
    return (
      <Shell>
        <h1>Not available on this account</h1>
        <p className="lead">
          Organisation insights are for HR. Nothing here would identify you
          anyway — it only ever contains groups of eight or more.
        </p>
      </Shell>
    )
  }

  const { data: cohorts } = await supabase
    .from('org_cohorts')
    .select('cohort, headcount, suppressed')
    .order('headcount', { ascending: false })

  const { data: metrics } = await supabase
    .from('org_metrics')
    .select('cohort, metric, value, n')

  const shown = (cohorts ?? []).filter((c) => !c.suppressed)
  const hidden = (cohorts ?? []).filter((c) => c.suppressed)

  const valueFor = (cohort: string, metric: string) =>
    (metrics ?? []).find((m) => m.cohort === cohort && m.metric === metric)

  return (
    <Shell current="org" isHr>
      <h1>Structural load</h1>
      <p className="lead">
        Where workload sits heavy, by group. Never by person.
      </p>

      <p className="privacy" style={{ background: 'transparent' }}>
        <span aria-hidden="true">👥</span>
        <span>
          <b>Groups of eight or more, only.</b> Smaller groups are named below
          but carry no figures — the numbers are never computed for them, so
          there is nothing here to reveal.
        </span>
      </p>

      {shown.length === 0 && (
        <div className="card">
          <div className="state">
            <p>
              <b>Nothing can be shown yet.</b>
            </p>
            <p className="muted mt">
              Every group is currently under eight people. That is the rule
              working, not a failure.
            </p>
          </div>
        </div>
      )}

      {shown.map((c) => (
        <div className="card" key={c.cohort}>
          <div className="card__title">{c.cohort}</div>
          <p className="card__sub">{c.headcount} people contributing</p>
          <div className="bars mt">
            {METRICS.map((m) => {
              const v = valueFor(c.cohort, m.key)
              return (
                <div className="bar" key={m.key}>
                  <span>{m.label}</span>
                  <span className="bar__track">
                    <span
                      className="bar__fill"
                      style={{
                        width: v ? `${(Number(v.value) / 5) * 100}%` : '0%',
                      }}
                    />
                  </span>
                  <span>{v ? Number(v.value).toFixed(1) : '—'}</span>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {hidden.length > 0 && (
        <div className="card">
          <div className="card__title">Hidden: too few people</div>
          <p className="card__sub">
            Named so a gap is never mistaken for a signal. No figures exist for
            these groups.
          </p>
          <div className="rows mt">
            {hidden.map((c) => (
              <div className="bar" key={c.cohort}>
                <b style={{ color: 'var(--text)' }}>{c.cohort}</b>
                <span>{c.headcount} people — under the threshold of 8</span>
                <span />
              </div>
            ))}
          </div>
        </div>
      )}
    </Shell>
  )
}
