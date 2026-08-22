import { createClient } from '@/lib/supabase/server'
import {
  Empty,
  LoadError,
  PageHead,
  PlaneBadge,
  PrivacyNote,
} from '@/components/chrome'
import { Shell } from '@/components/shell'
import { PolicyForm } from './policy-form'

function fmt(iso: string) {
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

export default async function CompanyPolicies() {
  const supabase = await createClient()

  const { data: roles } = await supabase.from('person_roles').select('role')
  const isHr = (roles ?? []).some((r) => r.role === 'hr')

  const { data: policies, error: listError } = await supabase
    .from('company_policies')
    .select('*')
    .order('category')
    .order('title')

  if (listError) {
    return (
      <Shell plane="work">
        <PageHead title="Company policies" />
        <PlaneBadge plane="work" />
        <LoadError what="The policy list" detail={listError.message} />
      </Shell>
    )
  }

  const all = policies ?? []

  const grouped = new Map<string, typeof all>()
  for (const p of all) {
    const cat = p.category ?? 'General'
    if (!grouped.has(cat)) grouped.set(cat, [])
    grouped.get(cat)!.push(p)
  }

  return (
    <Shell plane="work">
      <PageHead
        title="Company policies"
        lead="The documents everyone is expected to have read."
      />
      <PlaneBadge plane="work" />

      <PrivacyNote
        plane="work"
        detail="These are company-wide documents shared with all employees."
      >
        <b>Visible to everyone.</b>{' '}
      </PrivacyNote>

      {isHr && <PolicyForm />}

      {all.length === 0 ? (
        <Empty icon="📘" title="No policies yet">
          {isHr
            ? 'Add the first policy document above.'
            : 'HR has not published any policies yet.'}
        </Empty>
      ) : (
        Array.from(grouped.entries()).map(([category, items]) => (
          <div key={category} className="mb-5">
            <h2 className="card__title mb-3">{category}</h2>
            <div className="grid grid--3">
              {items.map((p) => (
                <div key={p.id} className="card card--quiet">
                  <div className="row row--between mb-2">
                    <span className="chip">{p.category}</span>
                    <span className="t-subtle" style={{ fontSize: 'var(--fs-xs)' }}>
                      v{p.version ?? '1'}
                    </span>
                  </div>
                  <h3 style={{ fontSize: 'var(--fs-sm)', fontWeight: 600 }}>
                    {p.title}
                  </h3>
                  {p.description && (
                    <p className="t-subtle mt-2" style={{ fontSize: 'var(--fs-xs)' }}>
                      {p.description}
                    </p>
                  )}
                  {p.effective_on && (
                    <p className="mt-2" style={{ fontSize: 'var(--fs-xs)' }}>
                      Effective {fmt(p.effective_on)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </Shell>
  )
}
