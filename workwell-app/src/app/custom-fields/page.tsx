import { createClient } from '@/lib/supabase/server'
import { Empty, LoadError, PageHead, PlaneBadge, PrivacyNote } from '@/components/chrome'
import { Shell } from '@/components/shell'
import { CustomFieldForm } from './custom-field-form'
import { CustomFieldValues } from './custom-field-values'

export default async function CustomFields() {
  const supabase = await createClient()

  const { data: roles } = await supabase.from('person_roles').select('role')
  const isHr = (roles ?? []).some((r) => r.role === 'hr')

  if (!isHr) {
    return (
      <Shell current="hr" plane="private">
        <PageHead title="Not available on this account" />
        <div className="card">
          <div className="state">
            <div className="state__icon" aria-hidden="true">🔒</div>
            <h2 className="state__title">This area is for HR</h2>
            <p className="state__text">
              Your own data lives on the private plane, which nobody here can
              read.
            </p>
          </div>
        </div>
      </Shell>
    )
  }

  const [
    { data: fieldDefs, error: defsError },
    { data: fieldValues, error: valuesError },
    { data: people },
  ] = await Promise.all([
    supabase.from('custom_field_defs').select('*').order('label'),
    supabase
      .from('custom_field_values')
      .select('*, people!inner(full_name)')
      .order('person_id'),
    supabase.from('people').select('id, full_name').order('full_name'),
  ])

  const readError = defsError ?? valuesError
  if (readError) {
    return (
      <Shell current="hr" plane="work">
        <PageHead title="Custom data fields" />
        <PlaneBadge plane="work" />
        <LoadError what="Custom fields" detail={readError.message} />
      </Shell>
    )
  }

  // Build the value matrix: person → fieldDef → value
  const valueMatrix = new Map<string, Map<string, string>>()
  for (const v of fieldValues ?? []) {
    if (!valueMatrix.has(v.person_id)) {
      valueMatrix.set(v.person_id, new Map())
    }
    valueMatrix.get(v.person_id)!.set(v.field_id, v.value ?? '')
  }

  return (
    <Shell current="hr" plane="work">
      <PageHead
        title="Custom data fields"
        lead="Add fields to an employment record beyond the built-in ones."
      />
      <PlaneBadge plane="work" />
      <PrivacyNote
        plane="work"
        detail="Custom field values are employment data. They are visible to HR and the person they belong to."
      >
        <b>Employment data only.</b>{' '}
      </PrivacyNote>

      <CustomFieldForm />

      {(fieldDefs ?? []).length === 0 ? (
        <Empty icon="🧩" title="No custom fields defined yet">
          Create your first field above to start collecting additional data.
        </Empty>
      ) : (
        <>
          <div className="card mb-5">
            <div className="card__head">
              <div>
                <div className="card__title">Defined fields</div>
                <div className="card__sub">
                  {(fieldDefs ?? []).length} field{(fieldDefs ?? []).length !== 1 && 's'}
                </div>
              </div>
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <caption className="sr-only">Custom field definitions</caption>
                <thead>
                  <tr>
                    <th scope="col">Label</th>
                    <th scope="col">Type</th>
                    <th scope="col">Required</th>
                    <th scope="col">Options</th>
                  </tr>
                </thead>
                <tbody>
                  {(fieldDefs ?? []).map((fd) => (
                    <tr key={fd.id}>
                      <th scope="row" style={{ fontWeight: 600 }}>{fd.label}</th>
                      <td><span className="chip">{fd.field_type}</span></td>
                      <td>{fd.required ? 'Yes' : 'No'}</td>
                      <td className="t-subtle">
                        {fd.options ? fd.options.join(', ') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {(people ?? []).length > 0 && (
            <CustomFieldValues
              fieldDefs={fieldDefs ?? []}
              people={people ?? []}
              valueMatrix={Object.fromEntries(
                [...valueMatrix.entries()].map(([k, v]) => [k, [...v.entries()]])
              )}
            />
          )}
        </>
      )}
    </Shell>
  )
}
