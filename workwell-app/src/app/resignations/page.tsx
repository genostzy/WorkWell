import { createClient } from '@/lib/supabase/server'
import {
  Empty,
  LoadError,
  PageHead,
  PlaneBadge,
  PrivacyNote,
} from '@/components/chrome'
import { Shell } from '@/components/shell'
import { ResignationForm } from './resignation-form'
import { ResignationDecide } from './resignation-decide'

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

function fmtFull(iso: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
}

const STATUS_CHIP: Record<string, string> = {
  submitted: 'chip',
  acknowledged: 'chip chip--accent',
  accepted: 'chip chip--accent',
}

export default async function Resignations() {
  const supabase = await createClient()

  const { data: roles } = await supabase.from('person_roles').select('role')
  const isHr = (roles ?? []).some((r) => r.role === 'hr')

  const { data: me, error: meError } = await supabase
    .from('me')
    .select('id')
    .maybeSingle()

  if (meError) {
    return (
      <Shell plane="work">
        <PageHead title="Resignations" />
        <PlaneBadge plane="work" />
        <LoadError what="Your account" detail={meError.message} />
      </Shell>
    )
  }

  if (!me) {
    return (
      <Shell plane="work">
        <PageHead title="Resignations" lead="Hand in notice, and see where it stands." />
        <PlaneBadge plane="work" />
        <Empty icon="🔑" title="No employment record yet">
          Resignations belong to an employment record, which is created when HR
          approves your access.
        </Empty>
      </Shell>
    )
  }

  const { data: rows, error: listError } = isHr
    ? await supabase
        .from('resignations')
        .select('*, people!inner(full_name)')
        .order('created_at', { ascending: false })
    : await supabase
        .from('resignations')
        .select('*')
        .eq('person_id', me.id)
        .order('created_at', { ascending: false })

  if (listError) {
    return (
      <Shell plane="work">
        <PageHead title="Resignations" />
        <PlaneBadge plane="work" />
        <LoadError what="Your resignations" detail={listError.message} />
      </Shell>
    )
  }

  const resignations = rows ?? []

  return (
    <Shell plane="work">
      <PageHead
        title="Resignations"
        lead="Hand in notice, and see where it stands."
      />
      <PlaneBadge plane="work" />

      <PrivacyNote
        plane="work"
        detail="Your resignation is visible to HR. They will acknowledge and process it."
      >
        <b>HR can see these records.</b>{' '}
      </PrivacyNote>

      {!isHr && <ResignationForm personId={me.id} />}

      <div className="card card--flush mt-5">
        <div style={{ padding: 'var(--s-5) var(--s-5) var(--s-3)' }}>
          <div className="card__title">
            {isHr ? 'All resignations' : 'Your resignations'}
          </div>
        </div>
        {resignations.length === 0 ? (
          <p
            className="t-subtle"
            style={{ padding: '0 var(--s-5) var(--s-5)' }}
          >
            No resignations yet.
          </p>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <caption className="sr-only">Resignations</caption>
              <thead>
                <tr>
                  {isHr && <th scope="col">Name</th>}
                  <th scope="col">Last Day</th>
                  <th scope="col">Status</th>
                  <th scope="col">Date Submitted</th>
                  {isHr && <th scope="col">Action</th>}
                </tr>
              </thead>
              <tbody>
                {resignations.map((r: Record<string, unknown>) => (
                  <tr key={r.id as string}>
                    {isHr && (
                      <th scope="row" style={{ fontWeight: 600 }}>
                        {(r as Record<string, unknown>).people
                          ? ((r as Record<string, unknown>).people as Record<string, unknown>).full_name as string
                          : '—'}
                      </th>
                    )}
                    <td>{fmt(r.last_day as string)}</td>
                    <td>
                      <span className={STATUS_CHIP[r.status as string] ?? 'chip'}>
                        {r.status as string}
                      </span>
                    </td>
                    <td>{fmtFull(r.created_at as string)}</td>
                    {isHr && (
                      <td>
                        <ResignationDecide
                          id={r.id as string}
                          status={r.status as string}
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Shell>
  )
}
