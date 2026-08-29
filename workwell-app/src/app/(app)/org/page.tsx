import { createClient } from '@/lib/supabase/server'
import { Empty, LoadError, PageHead, PlaneBadge, PrivacyNote, RoleLocked } from '@/components/chrome'

const METRICS = [
  { key: 'mood', label: 'Mood' },
  { key: 'energy', label: 'Energy' },
  { key: 'pressure', label: 'Pressure' },
  { key: 'workload', label: 'Workload' },
]

const CONCERN = { key: 'concern', label: 'Team concern raised' }

export default async function Org() {
  const supabase = await createClient()

  const { data: roles } = await supabase.from('person_roles').select('role')
  const isHr = (roles ?? []).some((r) => r.role === 'hr')

  if (!isHr) {
    return (
      <>
        <PageHead title="Not available on this account" />
        <RoleLocked
          audience="hr"
          detail="Nothing in it would identify you in any case — it only ever contains groups of eight or more."
        />
      </>
    )
  }

  const [{ data: cohorts, error: cohortError }, { data: metrics }] =
    await Promise.all([
      supabase
        .from('org_cohorts')
        .select('cohort, headcount, suppressed')
        .order('headcount', { ascending: false }),
      supabase.from('org_metrics').select('cohort, metric, value, n'),
    ])

  if (cohortError) {
    return (
      <>
        <PageHead title="Structural load" />
        <PlaneBadge plane="org" />
        <LoadError what="The group figures" detail={cohortError.message} />
      </>
    )
  }

  const all = cohorts ?? []
  const shown = all.filter((c) => !c.suppressed)
  const hidden = all.filter((c) => c.suppressed)

  const valueFor = (cohort: string, metric: string) =>
    (metrics ?? []).find((m) => m.cohort === cohort && m.metric === metric)

  return (
    <>
      <PageHead
        title="Structural load"
        lead="Where workload sits heavy, by group. Never by person."
      />

      <PlaneBadge plane="org" />

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
          <span className="stat__value t-num" title={hidden.length > 0 ? "Total hidden when any group is suppressed — prevents subtraction" : undefined}>
            {hidden.length > 0 ? "—" : all.reduce((s, c) => s + c.headcount, 0)}
          </span>
        </div>
      </div>
      {hidden.length > 0 && <p className="t-subtle mb-4" style={{ fontSize: 'var(--fs-sm)' }}>Totals hidden while any group is suppressed — this prevents inferring a hidden group by subtraction.</p>}

      {all.length === 0 && (
        <Empty icon="&#x1f465;" title="No groups yet">
          Groups are built from the department on each person&apos;s
          employment record. Once colleagues are added with one, they appear
          here — the figures follow at eight people per group.
        </Empty>
      )}

      {all.length > 0 && shown.length === 0 && (
        <Empty icon="&#x1f465;" title="Nothing can be shown yet">
          Every group is currently under eight people. That is the rule
          working, not a failure.
        </Empty>
      )}

      {shown.map((c) => (
        <div className="card" key={c.cohort}>
          <div className="card__head">
            <div>
              <h2 className="card__title">{c.cohort}</h2>
              <div className="card__sub">{c.headcount} people contributing</div>
            </div>
            <span className="chip chip--accent">Reporting</span>
          </div>
          {METRICS.map((m) => {
            const v = valueFor(c.cohort, m.key)
            return (
              <div className="metric" key={m.key}>
                <span>{m.label}</span>
                <span className="meter__track" role="meter" aria-valuenow={v ? Number(v.value) : 0} aria-valuemin={0} aria-valuemax={5} aria-label={`${m.label} ${v ? Number(v.value).toFixed(1) : 'no data'}`}>
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
          {(() => {
            const v = valueFor(c.cohort, CONCERN.key)
            return (
              <div className="metric">
                <span>{CONCERN.label}</span>
                <span className="meter__track" role="meter" aria-valuenow={v ? Number(v.value) : 0} aria-valuemin={0} aria-valuemax={1} aria-label={`${CONCERN.label} ${v ? Math.round(Number(v.value) * 100)+'%' : 'no data'}`}>
                  <span
                    className="meter__fill"
                    style={{ width: v ? `${Number(v.value) * 100}%` : '0%' }}
                  />
                </span>
                <b className="t-num">
                  {v ? `${Math.round(Number(v.value) * 100)}%` : '—'}
                </b>
              </div>
            )
          })()}
        </div>
      ))}

      {hidden.length > 0 && (
        <div className="card card--quiet">
          <h2 className="card__title mb-2">Hidden: too few people</h2>
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

      <PrivacyNote
        plane="org"
        detail="The threshold is applied when the figures are computed, not when they are displayed. A group under eight has no stored value at all, so there is nothing for a query or a bug to surface. Groups below the line are still named, because a gap that appears and disappears would itself be a signal."
      >
        <b>Groups of eight or more, only.</b>{' '}
      </PrivacyNote>
    </>
  )
}
