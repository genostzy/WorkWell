import { createClient } from '@/lib/supabase/server'
import { Empty, LoadError, PageHead, PlaneBadge, PrivacyNote, RoleLocked } from '@/components/chrome'
import { OrgFilter } from '@/app/org/org-filter'

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

      <OrgFilter cohorts={all} metrics={metrics ?? []} />

      <PrivacyNote
        plane="org"
        detail="The threshold is applied when the figures are computed, not when they are displayed. A group under eight has no stored value at all, so there is nothing for a query or a bug to surface. Groups below the line are still named, because a gap that appears and disappears would itself be a signal."
      >
        <b>Groups of eight or more, only.</b>{' '}
      </PrivacyNote>
    </>
  )
}
