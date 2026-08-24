'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface FieldDef {
  id: string
  label: string
  field_type: string
  options: string[] | null
  required: boolean
}

interface Person {
  id: string
  full_name: string
}

export function CustomFieldValues({
  fieldDefs,
  people,
  valueMatrix,
}: {
  fieldDefs: FieldDef[]
  people: Person[]
  valueMatrix: Record<string, [string, string][]>
}) {
  const router = useRouter()
  const [editing, setEditing] = useState<{ personId: string; fieldId: string } | null>(null)
  const [tempValue, setTempValue] = useState('')
  const [busy, setBusy] = useState(false)

  function getValue(personId: string, fieldId: string): string {
    const entries = valueMatrix[personId]
    if (!entries) return ''
    const found = entries.find(([fid]) => fid === fieldId)
    return found?.[1] ?? ''
  }

  async function saveValue(personId: string, fieldId: string, value: string) {
    setBusy(true)
    const supabase = createClient()

    const { data: existing } = await supabase
      .from('custom_field_values')
      .select('id')
      .eq('person_id', personId)
      .eq('field_def_id', fieldId)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('custom_field_values')
        .update({ value })
        .eq('id', existing.id)
    } else {
      await supabase.from('custom_field_values').insert({
        person_id: personId,
        field_def_id: fieldId,
        value,
      })
    }

    setBusy(false)
    setEditing(null)
    router.refresh()
  }

  return (
    <div className="card card--flush">
      <div style={{ padding: 'var(--s-5) var(--s-5) var(--s-3)' }}>
        <div className="card__title">Values by person</div>
        <div className="card__sub">Click a cell to edit</div>
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <caption className="sr-only">Custom field values</caption>
          <thead>
            <tr>
              <th scope="col">Person</th>
              {fieldDefs.map((fd) => (
                <th key={fd.id} scope="col">{fd.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {people.map((p) => (
              <tr key={p.id}>
                <th scope="row" style={{ fontWeight: 600 }}>{p.full_name}</th>
                {fieldDefs.map((fd) => {
                  const isEditing = editing?.personId === p.id && editing?.fieldId === fd.id
                  const value = getValue(p.id, fd.id)

                  if (isEditing) {
                    return (
                      <td key={fd.id}>
                        <div className="row" style={{ gap: 'var(--s-2)' }}>
                          {fd.field_type === 'select' && fd.options ? (
                            <select
                              className="field__input"
                              value={tempValue}
                              onChange={(e) => setTempValue(e.target.value)}
                              disabled={busy}
                              style={{ minWidth: 0 }}
                            >
                              <option value="">—</option>
                              {fd.options.map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          ) : fd.field_type === 'boolean' ? (
                            <select
                              className="field__input"
                              value={tempValue}
                              onChange={(e) => setTempValue(e.target.value)}
                              disabled={busy}
                              style={{ minWidth: 0 }}
                            >
                              <option value="">—</option>
                              <option value="true">Yes</option>
                              <option value="false">No</option>
                            </select>
                          ) : (
                            <input
                              className="field__input"
                              type={fd.field_type === 'number' ? 'number' : fd.field_type === 'date' ? 'date' : 'text'}
                              value={tempValue}
                              onChange={(e) => setTempValue(e.target.value)}
                              disabled={busy}
                              style={{ minWidth: 0 }}
                            />
                          )}
                          <button
                            className="btn btn--primary btn--sm"
                            disabled={busy}
                            onClick={() => saveValue(p.id, fd.id, tempValue)}
                          >
                            Save
                          </button>
                          <button
                            className="btn btn--secondary btn--sm"
                            disabled={busy}
                            onClick={() => setEditing(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    )
                  }

                  return (
                    <td
                      key={fd.id}
                      className="t-subtle"
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        setEditing({ personId: p.id, fieldId: fd.id })
                        setTempValue(value)
                      }}
                    >
                      {value || '—'}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
