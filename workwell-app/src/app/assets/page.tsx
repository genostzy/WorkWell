import { createClient } from '@/lib/supabase/server'
import { Empty, LoadError, PageHead, PlaneBadge } from '@/components/chrome'
import { Shell } from '@/components/shell'
import { AssetForm } from './asset-form'

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

export default async function Assets() {
  const supabase = await createClient()

  const [
    { data: me },
    { data: roles },
  ] = await Promise.all([
    supabase.from('me').select('id').maybeSingle(),
    supabase.from('person_roles').select('role'),
  ])

  const isHr = (roles ?? []).some((r) => r.role === 'hr')

  const [ownResult, allResult] = me
    ? await Promise.all([
        supabase
          .from('assets')
          .select('*')
          .eq('person_id', me.id)
          .order('issued_on', { ascending: false }),
        isHr
          ? supabase
              .from('assets')
              .select('*, people!inner(full_name)')
              .order('issued_on', { ascending: false })
          : null,
      ])
    : [null, null]

  const readError = ownResult?.error ?? allResult?.error ?? null
  if (readError) {
    return (
      <Shell plane="work">
        <PageHead title="Assets" />
        <PlaneBadge plane="work" />
        <LoadError what="Your assets" detail={readError.message} />
      </Shell>
    )
  }

  if (!me) {
    return (
      <Shell plane="work">
        <PageHead title="Assets" lead="Equipment issued to you — laptops, badges, anything else on loan." />
        <PlaneBadge plane="work" />
        <Empty icon="🔑" title="No employment record yet">
          Assets are tied to your employment record, which is created when HR
          approves your access.
        </Empty>
      </Shell>
    )
  }

  const ownRows = ownResult?.data ?? []
  const allRows = (allResult?.data ?? []) as Array<{
    id: string
    name: string
    kind: string | null
    serial_number: string | null
    issued_on: string | null
    returned_on: string | null
    people: { full_name: string } | null
  }>

  return (
    <Shell plane="work">
      <PageHead
        title="Assets"
        lead="Equipment issued to you — laptops, badges, anything else on loan."
      />
      <PlaneBadge plane="work" />

      <div className="card card--flush mb-5">
        <div style={{ padding: 'var(--s-5) var(--s-5) var(--s-3)' }}>
          <div className="card__title">Your equipment</div>
        </div>
        {ownRows.length === 0 ? (
          <p className="t-subtle" style={{ padding: '0 var(--s-5) var(--s-5)' }}>
            No equipment has been issued to you yet.
          </p>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <caption className="sr-only">Your issued assets</caption>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Type</th>
                  <th scope="col">Serial</th>
                  <th scope="col">Issued</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {ownRows.map((a) => (
                  <tr key={a.id}>
                    <th scope="row" style={{ fontWeight: 600 }}>
                      {a.name}
                    </th>
                    <td>{a.kind || '—'}</td>
                    <td><code style={{ fontSize: 'var(--fs-sm)' }}>{a.serial_number || '—'}</code></td>
                    <td>{fmt(a.issued_on)}</td>
                    <td>
                      <span className={a.returned_on ? 'chip' : 'chip chip--accent'}>
                        {a.returned_on ? 'Returned' : 'Issued'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isHr && (
        <>
          <AssetForm />

          <div className="card card--flush">
            <div style={{ padding: 'var(--s-5) var(--s-5) var(--s-3)' }}>
              <div className="card__title">All issued equipment</div>
              <div className="card__sub">Every asset in the organisation.</div>
            </div>
            {allRows.length === 0 ? (
              <p className="t-subtle" style={{ padding: '0 var(--s-5) var(--s-5)' }}>
                No assets have been assigned yet.
              </p>
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <caption className="sr-only">All issued assets</caption>
                  <thead>
                    <tr>
                      <th scope="col">Person</th>
                      <th scope="col">Name</th>
                      <th scope="col">Type</th>
                      <th scope="col">Serial</th>
                      <th scope="col">Issued</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allRows.map((a) => (
                      <tr key={a.id}>
                        <td style={{ fontWeight: 600 }}>
                          {a.people?.full_name ?? '—'}
                        </td>
                        <th scope="row" style={{ fontWeight: 600 }}>
                          {a.name}
                        </th>
                        <td>{a.kind || '—'}</td>
                        <td><code style={{ fontSize: 'var(--fs-sm)' }}>{a.serial_number || '—'}</code></td>
                        <td>{fmt(a.issued_on)}</td>
                        <td>
                          <span className={a.returned_on ? 'chip' : 'chip chip--accent'}>
                            {a.returned_on ? 'Returned' : 'Issued'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </Shell>
  )
}
