'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import { PageHead, PlaneBadge, PrivacyNote } from '@/components/chrome'
import { ConfirmButton } from '@/components/controls'

type Employee = { id: string; name: string; title: string }
type Template = { id: string; name: string; body: string }

const EMPTY_DRAFT = { name: '', body: '' }

function fill(body: string, name: string, title: string) {
  return body.replaceAll('{{name}}', name).replaceAll('{{title}}', title)
}

type LoadedData = { orgId: string | null; employees: Employee[]; templates: Template[] }

async function fetchLetterHeadsData(): Promise<LoadedData> {
  const supabase = createClient()
  const [{ data: me, error: meError }, { data: people, error: pError }, { data: employment }, { data: tmpl, error: tError }] =
    await Promise.all([
      supabase.from('me').select('org_id').maybeSingle(),
      supabase.from('people').select('id, full_name').order('full_name'),
      supabase.from('employment').select('person_id, job_title'),
      supabase.from('letter_heads').select('id, name, body').order('name'),
    ])
  const err = meError ?? pError ?? tError
  if (err) throw err
  const titles = new Map((employment ?? []).map((e) => [e.person_id, e.job_title]))
  const employees = (people ?? []).map((p) => ({
    id: p.id as string,
    name: p.full_name as string,
    title: titles.get(p.id) ?? '—',
  }))
  return { orgId: me?.org_id ?? null, employees, templates: (tmpl ?? []) as Template[] }
}

/**
 * Letter heads was the one mock page 0037's sweep missed — three templates
 * hardcoded in this file, with nowhere for HR to add a fourth or fix a typo
 * in one of the three. Templates now live in work.letter_heads; the
 * placeholders a template can use are exactly the two fields generation
 * has ever filled in, {{name}} and {{title}}.
 */
export default function LetterHeadsClient() {
  const { data, error: loadErrorObj, isLoading: loading, mutate } = useSWR('letter_heads:data', fetchLetterHeadsData)
  const [actionError, setActionError] = useState<string | null>(null)
  const loadError = actionError ?? loadErrorObj?.message ?? null
  const orgId = data?.orgId ?? null
  const employees = data?.employees ?? []
  const templates = data?.templates ?? []

  const [templateId, setTemplateId] = useState<string | null>(null)
  const [employeeId, setEmployeeId] = useState<string | null>(null)
  const [seeded, setSeeded] = useState(false)
  const [preview, setPreview] = useState<{ template: string; body: string } | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Default selections come from the fetch, then the person is free to pick
  // something else — re-running this on every revalidation would snap their
  // choice back, so it only ever seeds once. Done during render, not in a
  // useEffect, so nothing is ever painted with the empty defaults first.
  if (!loading && !seeded) {
    setSeeded(true)
    setEmployeeId(employees[0]?.id ?? null)
    setTemplateId(templates[0]?.id ?? null)
  }

  function generate(e: React.FormEvent) {
    e.preventDefault()
    const template = templates.find((t) => t.id === templateId)
    const employee = employees.find((e) => e.id === employeeId)
    if (!template || !employee) return
    setPreview({ template: template.name, body: fill(template.body, employee.name, employee.title) })
  }

  function startCreate() {
    setEditingId('new')
    setDraft(EMPTY_DRAFT)
    setFormError(null)
  }

  function startEdit(t: Template) {
    setEditingId(t.id)
    setDraft({ name: t.name, body: t.body })
    setFormError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setFormError(null)
  }

  async function save() {
    const name = draft.name.trim()
    const body = draft.body.trim()
    if (!name || !body) {
      setFormError('Name and body are both required.')
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
      const { data: row, error } = await supabase
        .from('letter_heads')
        .insert({ org_id: orgId, name, body })
        .select('id, name, body')
        .single()
      setSaving(false)
      if (error) return setFormError(error.message)
      const template = row as Template
      await mutate(
        (prev) =>
          prev && {
            ...prev,
            templates: [...prev.templates, template].sort((a, b) => a.name.localeCompare(b.name)),
          },
        { revalidate: false }
      )
      setTemplateId((current) => current ?? template.id)
      setEditingId(null)
      return
    }

    const { data: row, error } = await supabase
      .from('letter_heads')
      .update({ name, body })
      .eq('id', editingId)
      .select('id, name, body')
      .single()
    setSaving(false)
    if (error) return setFormError(error.message)
    await mutate(
      (prev) =>
        prev && {
          ...prev,
          templates: prev.templates
            .map((t) => (t.id === editingId ? (row as Template) : t))
            .sort((a, b) => a.name.localeCompare(b.name)),
        },
      { revalidate: false }
    )
    setEditingId(null)
  }

  async function remove(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('letter_heads').delete().eq('id', id)
    if (error) {
      setActionError(error.message)
      return
    }
    const fallback = templates.find((t) => t.id !== id)?.id ?? null
    await mutate(
      (prev) => prev && { ...prev, templates: prev.templates.filter((t) => t.id !== id) },
      { revalidate: false }
    )
    setTemplateId((current) => (current === id ? fallback : current))
    if (editingId === id) setEditingId(null)
  }

  return (
    <>
      <PageHead
        title="Letter heads"
        lead="Templates HR authors and generates from — offer letters, employment certificates, that kind of thing."
      />
      <PlaneBadge plane="work" />

      {loadError && (
        <div className="banner banner--error mb-5" role="alert">
          {loadError}
        </div>
      )}

      <div className="grid grid--sidebar-right">
        <div className="stack">
          <form className="card" onSubmit={generate}>
            <h2 className="card__title">Generate a letter</h2>
            <p className="card__sub">Fills a template from an employment record.</p>

            <div className="mt-4">
              <label className="field__label" htmlFor="ltpl">Template</label>
              <select
                id="ltpl"
                className="select"
                value={templateId ?? ''}
                disabled={loading || templates.length === 0}
                onChange={(e) => setTemplateId(e.target.value)}
              >
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>

            <div className="mt-4">
              <label className="field__label" htmlFor="lemp">Employee</label>
              <select
                id="lemp"
                className="select"
                value={employeeId ?? ''}
                disabled={loading || employees.length === 0}
                onChange={(e) => setEmployeeId(e.target.value)}
              >
                {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>

            <div className="mt-4">
              <button className="btn btn--primary" type="submit" disabled={!employeeId || !templateId}>
                Generate
              </button>
            </div>
          </form>

          <div className="card">
            <h2 className="card__title mb-3">
              {editingId && editingId !== 'new' ? 'Edit template' : 'Templates'}
            </h2>

            {editingId ? (
              <TemplateForm
                draft={draft}
                setDraft={setDraft}
                onSave={save}
                onCancel={cancelEdit}
                saving={saving}
                error={formError}
                submitLabel={editingId === 'new' ? 'Add' : 'Save changes'}
              />
            ) : (
              <>
                {loading ? (
                  <div className="skel skel--text" />
                ) : templates.length === 0 ? (
                  <p className="t-subtle">No templates yet.</p>
                ) : (
                  <div className="stack stack--tight">
                    {templates.map((t) => (
                      <div className="card card--quiet" key={t.id} style={{ margin: 0 }}>
                        <div className="row row--between">
                          <b>{t.name}</b>
                          <div className="row" style={{ gap: 'var(--s-2)' }}>
                            <button
                              type="button"
                              className="btn btn--secondary btn--sm"
                              onClick={() => startEdit(t)}
                            >
                              Edit
                            </button>
                            <ConfirmButton
                              label="Delete"
                              className="btn btn--ghost btn--sm"
                              onConfirm={() => remove(t.id)}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  className="btn btn--secondary btn--sm mt-3"
                  onClick={startCreate}
                >
                  New template
                </button>
              </>
            )}
          </div>
        </div>

        <div className="stack">
          {preview ? (
            <div className="card">
              <h2 className="card__title mb-1">{preview.template}</h2>
              <div className="card__sub mb-3">Preview — not sent or saved</div>
              <p style={{ whiteSpace: 'pre-wrap' }}>{preview.body}</p>
            </div>
          ) : (
            <div className="card card--quiet">
              <p className="t-subtle">Generate a letter to see a preview here.</p>
            </div>
          )}
        </div>
      </div>

      <PrivacyNote
        plane="work"
        detail="Templates are reference data shared across your organisation's HR account, the same as news posts or company policies. Generating a letter only ever fills one in on screen — nothing is sent, saved, or logged."
      >
        <b>Generating never sends or records anything.</b>{' '}
      </PrivacyNote>
    </>
  )
}

function TemplateForm({
  draft,
  setDraft,
  onSave,
  onCancel,
  saving,
  error,
  submitLabel,
}: {
  draft: { name: string; body: string }
  setDraft: (d: { name: string; body: string }) => void
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
        <label className="field__label" htmlFor="tmpl-name">
          Name
        </label>
        <input
          id="tmpl-name"
          className="input"
          value={draft.name}
          maxLength={120}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
      </div>
      <div className="field">
        <label className="field__label" htmlFor="tmpl-body">
          Body
        </label>
        <textarea
          id="tmpl-body"
          className="textarea"
          rows={6}
          value={draft.body}
          onChange={(e) => setDraft({ ...draft, body: e.target.value })}
        />
        <span className="field__hint">
          Use <code>{'{{name}}'}</code> and <code>{'{{title}}'}</code> — filled in from the employee chosen when generating.
        </span>
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
