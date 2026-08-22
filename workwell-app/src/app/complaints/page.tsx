import { createClient } from '@/lib/supabase/server'
import {
  Empty,
  LoadError,
  PageHead,
  PlaneBadge,
  PrivacyNote,
} from '@/components/chrome'
import { Shell } from '@/components/shell'
import { ComplaintForm } from './complaint-form'
import { ComplaintDecide } from './complaint-decide'

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const STATUS_CHIP: Record<string, string> = {
  open: 'chip',
  investigating: 'chip chip--accent',
  resolved: 'chip',
  closed: 'chip',
}

export default async function Complaints() {
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
        <PageHead title="Complaints" />
        <PlaneBadge plane="work" />
        <LoadError what="Your account" detail={meError.message} />
      </Shell>
    )
  }

  if (!me) {
    return (
      <Shell plane="work">
        <PageHead title="Complaints" lead="A formal grievance, tracked as a case." />
        <PlaneBadge plane="work" />
        <Empty icon="🔑" title="No employment record yet">
          Complaints belong to an employment record, which is created when HR
          approves your access.
        </Empty>
      </Shell>
    )
  }

  const { data: rows, error: listError } = isHr
    ? await supabase
        .from('complaints')
        .select('*, people!inner(full_name)')
        .order('created_at', { ascending: false })
    : await supabase
        .from('complaints')
        .select('*')
        .eq('person_id', me.id)
        .order('created_at', { ascending: false })

  if (listError) {
    return (
      <Shell plane="work">
        <PageHead title="Complaints" />
        <PlaneBadge plane="work" />
        <LoadError what="Your complaints" detail={listError.message} />
      </Shell>
    )
  }

  const complaints = rows ?? []

  return (
    <Shell plane="work">
      <PageHead
        title="Complaints"
        lead="A formal grievance, tracked as a case rather than a message."
      />
      <PlaneBadge plane="work" />

      <PrivacyNote
        plane="work"
        detail="Your complaint is visible to HR only. They will use it to investigate and resolve the issue."
      >
        <b>HR can see these records.</b>{' '}
      </PrivacyNote>

      {!isHr && <ComplaintForm personId={me.id} />}

      <div className="card card--flush mt-5">
        <div style={{ padding: 'var(--s-5) var(--s-5) var(--s-3)' }}>
          <div className="card__title">
            {isHr ? 'All complaints' : 'Your complaints'}
          </div>
        </div>
        {complaints.length === 0 ? (
          <p
            className="t-subtle"
            style={{ padding: '0 var(--s-5) var(--s-5)' }}
          >
            No complaints yet.
          </p>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <caption className="sr-only">Complaints</caption>
              <thead>
                <tr>
                  <th scope="col">Subject</th>
                  <th scope="col">Category</th>
                  <th scope="col">Status</th>
                  <th scope="col">Date</th>
                  <th scope="col">Decided By</th>
                </tr>
              </thead>
              <tbody>
                {complaints.map((c: Record<string, unknown>) => (
                  <tr key={c.id as string}>
                    <th scope="row" style={{ fontWeight: 600 }}>
                      {c.subject as string}
                    </th>
                    <td>
                      <span className="chip">{c.category as string}</span>
                    </td>
                    <td>
                      <span className={STATUS_CHIP[c.status as string] ?? 'chip'}>
                        {c.status as string}
                      </span>
                    </td>
                    <td>{fmt(c.created_at as string)}</td>
                    <td>{(c as Record<string, unknown>).decided_by
                      ? (c as Record<string, unknown>).decided_by as string
                      : '—'}</td>
                    {isHr && (
                      <td>
                        <ComplaintDecide id={c.id as string} />
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
