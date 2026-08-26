'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHead, PlaneBadge, PrivacyNote } from '@/components/chrome'
import { ConfirmButton } from '@/components/controls'

type Field = { id: string; name: string; field_type: 'Text' | 'Number' | 'Date' | 'Select' }

const TYPES = ['Text', 'Number', 'Date', 'Select'] as const

const EMPTY_DRAFT = { name: '', field_type: TYPES[0] as string }

export default function CustomFieldsClient() {
  const [orgId, setOrgId] = useState<string | null>(null)
  const [fields, setFields] = useState<Field[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

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

  function startCreate() {
    setEditingId('new')
    setDraft(EMPTY_DRAFT)
    setFormError(null)
  }

  function startEdit(f: Field) {
    setEditingId(f.id)
    setDraft({ name: f.name, field_type: f.field_type })
    setFormError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setFormError(null)
  }

  async function save() {
    const name = draft.name.trim()
    if (!name) {
      setFormError('Give the field a name.')
      return
    }

    setSaving(true)
    setFormError(null)
    const supabase = createClient()

    if (editingId === 'new') {
      if (!orgId) {
        setSaving(false)
        setFormError('This account is not linked to an organisation yet.')
        return
      }
      const { data, error } = await supabase
        .from('custom_fields')
        .insert({ org_id: orgId, name, field_type: draft.field_type })
        .select('id, name, field_type')
        .single()
      setSaving(false)
      if (error) return setFormError(error.message)
      setFields((prev) => [...prev, data as Field])
      setEditingId(null)
      return
    }

    const { data, error } = await supabase
      .from('custom_fields')
      .update({ name, field_type: draft.field_type })
      .eq('id', editingId)
      .select('id, name, field_type')
      .single()
    setSaving(false)
    if (error) return setFormError(error.message)
    setFields((prev) => prev.map((f) => (f.id === editingId ? (data as Field) : f)))
    setEditingId(null)
  }

  async function remove(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('custom_fields').delete().eq('id', id)
    if (error) {
      setLoadError(error.message)
      return
    }
    setFields((prev) => prev.filter((f) => f.id !== id))
    if (editingId === id) setEditingId(null)
  }

  return (
    <>
      <PageHead
        title="Custom data fields"
        lead="Define fields beyond the built-in ones on an employment record."
      />
      <PlaneBadge plane="work" />

      <div className="grid grid--sidebar-right">
        <div className="stack">
          <div className="card card--flush">
            <div style={{ padding: 'var(--s-5) var(--s-5) var(--s-3)' }}>
              <h2 className="card__title">Defined fields</h2>
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
            ) : editingId && editingId !== 'new' ? (
              <div style={{ padding: '0 var(--s-5) var(--s-5)' }}>
                <FieldForm
                  draft={draft}
                  setDraft={setDraft}
                  onSave={save}
                  onCancel={cancelEdit}
                  saving={saving}
                  error={formError}
                  submitLabel="Save changes"
                />
              </div>
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <caption className="sr-only">Custom employment record fields</caption>
                  <thead>
                    <tr>
                      <th scope="col">Field</th>
                      <th scope="col">Type</th>
                      <th scope="col">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((f) => (
                      <tr key={f.id}>
                        <th scope="row" style={{ fontWeight: 600 }}>{f.name}</th>
                        <td><span className="chip">{f.field_type}</span></td>
                        <td>
                          <div className="row" style={{ gap: 'var(--s-2)', flexWrap: 'nowrap' }}>
                            <button
                              type="button"
                              className="btn btn--secondary btn--sm"
                              onClick={() => startEdit(f)}
                            >
                              Edit
                            </button>
                            <ConfirmButton
                              label="Delete"
                              className="btn btn--ghost btn--sm"
                              onConfirm={() => remove(f.id)}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <h2 className="card__title mb-3">Add a field</h2>
            {editingId === 'new' ? (
              <FieldForm
                draft={draft}
                setDraft={setDraft}
                onSave={save}
                onCancel={cancelEdit}
                saving={saving}
                error={formError}
                submitLabel="Add"
              />
            ) : (
              <button type="button" className="btn btn--primary" onClick={startCreate}>
                New field
              </button>
            )}
          </div>
        </div>
      </div>

      <PrivacyNote
        plane="work"
        detail="This defines a field, not where it's filled in — no employment record anywhere in the product has a place to enter a value for one yet. Nothing here is shown on People or anywhere else until that's built."
      >
        <b>Definitions only — nothing is filled in yet.</b>{' '}
      </PrivacyNote>
    </>
  )
}

function FieldForm({
  draft,
  setDraft,
  onSave,
  onCancel,
  saving,
  error,
  submitLabel,
}: {
  draft: { name: string; field_type: string }
  setDraft: (d: { name: string; field_type: string }) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
  error: string | null
  submitLabel: string
}) {
  return (
    <div className="stack stack--tight">
      {error && (
        <div className="banner banner--error" role="alert">
          {error}
        </div>
      )}
      <div className="field">
        <label className="field__label" htmlFor="cfname">Name</label>
        <input
          id="cfname"
          className="input"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
      </div>
      <div className="field">
        <label className="field__label" htmlFor="cftype">Type</label>
        <select
          id="cftype"
          className="select"
          value={draft.field_type}
          onChange={(e) => setDraft({ ...draft, field_type: e.target.value })}
        >
          {TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>
      <div className="row" style={{ gap: 'var(--s-2)' }}>
        <button
          type="button"
          className="btn btn--primary btn--sm"
          disabled={saving}
          onClick={onSave}
        >
          {saving ? 'Saving…' : submitLabel}
        </button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}
