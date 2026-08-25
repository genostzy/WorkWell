'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHead, PlaneBadge } from '@/components/chrome'

type Field = { id: string; name: string; field_type: 'Text' | 'Number' | 'Date' | 'Select' }

const TYPES = ['Text', 'Number', 'Date', 'Select'] as const

export default function CustomFieldsClient() {
  const [orgId, setOrgId] = useState<string | null>(null)
  const [fields, setFields] = useState<Field[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [type, setType] = useState<string>(TYPES[0])
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const [{ data: me, error: meError }, { data, error }] = await Promise.all([
        supabase.from('me').select('org_id').maybeSingle(),
        supabase.from('custom_fields').select('id, name, field_type').order('created_at'),
      ])
      if (cancelled) return
      if (meError ?? error) setLoadError((meError ?? error)!.message)
      setOrgId(me?.org_id ?? null)
      setFields((data ?? []) as Field[])
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!orgId) return setError('This account is not linked to an organisation yet.')
    if (!name.trim()) return setError('Give the field a name.')

    setSending(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('custom_fields')
      .insert({ org_id: orgId, name: name.trim(), field_type: type })
      .select('id, name, field_type')
      .single()
    setSending(false)

    if (error) return setError(error.message)

    setFields((f) => [...f, data as Field])
    setName('')
    setType(TYPES[0])
  }

  return (
    <>
      <PageHead
        title="Custom data fields"
        lead="Add fields to an employment record beyond the built-in ones."
      />
      <PlaneBadge plane="work" />

      <div className="grid grid--sidebar-right">
        <div className="stack">
          <div className="card card--flush">
            <div style={{ padding: 'var(--s-5) var(--s-5) var(--s-3)' }}>
              <h2 className="card__title">Defined fields</h2>
              <div className="card__sub">Shown on every record, on People</div>
            </div>
            {loadError && (
              <div className="banner banner--error" style={{ margin: '0 var(--s-5) var(--s-5)' }} role="alert">
                {loadError}
              </div>
            )}
            {loading ? (
              <div style={{ padding: '0 var(--s-5) var(--s-5)' }}>
                <div className="skel skel--text" />
              </div>
            ) : fields.length === 0 ? (
              <p className="t-subtle" style={{ padding: '0 var(--s-5) var(--s-5)' }}>
                No fields defined yet.
              </p>
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <caption className="sr-only">Custom employment record fields</caption>
                  <thead>
                    <tr>
                      <th scope="col">Field</th>
                      <th scope="col">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((f) => (
                      <tr key={f.id}>
                        <th scope="row" style={{ fontWeight: 600 }}>{f.name}</th>
                        <td><span className="chip">{f.field_type}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="stack">
          <form className="card" onSubmit={submit}>
            <h2 className="card__title">Add a field</h2>

            {error && <div className="banner banner--error" role="alert">{error}</div>}

            <div className="mt-4">
              <label className="field__label" htmlFor="cfname">Name</label>
              <input id="cfname" className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="mt-4">
              <label className="field__label" htmlFor="cftype">Type</label>
              <select id="cftype" className="select" value={type} onChange={(e) => setType(e.target.value)}>
                {TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>

            <div className="mt-4">
              <button className="btn btn--primary" type="submit" disabled={sending}>
                {sending ? 'Adding…' : 'Add field'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
