import { createClient } from '@/lib/supabase/server'
import { PageHead, PlaneBadge, PrivacyNote, Shell } from '@/components/chrome'

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
      <Shell current="org" plane="private">
        <PageHead title="Not available on this account" />
        <div className="card">
          <div className="state">
            <div className="state__icon" aria-hidden="true">
              🔒
            </div>
            <h2 className="state__title">This area is for HR</h2>
            <p className="state__text">
              Nothing in it would identify you in any case — it only ever
              contains groups of eight or more.
            </p>
          </div>
        </div>
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
    <Shell current="org" plane="org">
      <PageHead
        title="Structural load"
        lead="Where workload sits heavy, by group. Never by person."
      />

      <PlaneBadge plane="org" />

      <PrivacyNote
        plane="org"
        detail="The threshold is applied when the figures are computed, not when they are displayed. A group under eight has no stored value at all, so there is nothing for a query or a bug to surface. Groups below the line are still named, because a gap that appears and disappears would itself be a signal."
      >
        <b>Groups of eight or more, only.</b>{' '}
      </PrivacyNote>

      <div className="grid grid--4 mb-5">
        <div className="stat">
          <span className="stat__label">Groups reporting</span>
          <span className="stat__value t-num">{shown.length}</span>
        </div>
        <div className="stat">
          <span className="stat__label">Groups hidden</span>
          <span className="stat__value t-num">{hidden.length}</span>
        </div>
        <div className="stat">
          <span className="stat__label">Threshold</span>
          <span className="stat__value t-num">8</span>
        </div>
        <div className="stat">
          <span className="stat__label">People counted</span>
          <span className="stat__value t-num">
            {(cohorts ?? []).reduce((s, c) => s + c.headcount, 0)}
          </span>
        </div>
      </div>

      {shown.length === 0 && (
        <div className="card">
          <div className="state">
            <div className="state__icon" aria-hidden="true">
              👥
            </div>
            <h2 className="state__title">Nothing can be shown yet</h2>
            <p className="state__text">
              Every group is currently under eight people. That is the rule
              working, not a failure.
            </p>
          </div>
        </div>
      )}

      {shown.map((c) => (
        <div className="card" key={c.cohort}>
          <div className="card__head">
            <div>
              <div className="card__title">{c.cohort}</div>
              <div className="card__sub">{c.headcount} people contributing</div>
            </div>
            <span className="chip chip--accent">Reporting</span>
          </div>
          {METRICS.map((m) => {
            const v = valueFor(c.cohort, m.key)
            return (
              <div className="metric" key={m.key}>
                <span>{m.label}</span>
                <span className="meter__track">
                  <span
                    className="meter__fill"
                    style={{
                      width: v ? `${(Number(v.value) / 5) * 100}%` : '0%',
                    }}
                  />
                </span>
                <b className="t-num">
                  {v ? Number(v.value).toFixed(1) : '—'}
                </b>
              </div>
            )
          })}
        </div>
      ))}

      {hidden.length > 0 && (
        <div className="card card--quiet">
          <div className="card__title mb-2">Hidden: too few people</div>
          <p className="t-subtle mb-4">
            Named so that a gap is never mistaken for a signal. No figures exist
            for these groups.
          </p>
          <div className="stack stack--tight">
            {hidden.map((c) => (
              <div className="row row--between" key={c.cohort}>
                <b>{c.cohort}</b>
                <span className="chip">
                  {c.headcount} {c.headcount === 1 ? 'person' : 'people'} — under 8
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Shell>
  )
}
