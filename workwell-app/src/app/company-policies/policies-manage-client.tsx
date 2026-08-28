'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHead, PlaneBadge, PrivacyNote } from '@/components/chrome'
import { ConfirmButton } from '@/components/controls'
import { fmtDate } from '@/lib/format-date'

type Policy = { id: string; title: string; updated_on: string; body: string | null }

function today() {
  return new Date().toISOString().slice(0, 10)
}

const EMPTY_DRAFT = { title: '', updated_on: today(), body: '' }

/**
 * HR's side of Company policies: the list employees acknowledge, minus the
 * acknowledging.
 *
 * A policy is a title, a date and its text. The text is new — until 0057
 * the table held a heading and nothing else, so people were acknowledging
 * a name and the document itself lived somewhere this system could not
 * show them. An acknowledgement of something unreadable is not worth much.
 *
 * Deleting one takes everybody's acknowledgement of it with it (the table's
 * own foreign key cascades that), so a fresh acknowledgement record is the
 * only way to make people re-confirm a policy that changed — editing the
 * title or date in place leaves existing acknowledgements standing.
 */
export function PoliciesManageClient() {
  const [orgId, setOrgId] = useState<string | null>(null)
  const [policies, setPolicies] = useState<Policy[]>([])
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
        supabase.from('policies').select('id, title, updated_on, body').order('title'),
      ])
      if (cancelled) return
      if (meError ?? error) setLoadError((meError ?? error)!.message)
      setOrgId(me?.org_id ?? null)
      setPolicies((data ?? []) as Policy[])
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

  function startEdit(p: Policy) {
    setEditingId(p.id)
    setDraft({ title: p.title, updated_on: p.updated_on, body: p.body ?? '' })
    setFormError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setFormError(null)
  }

  async function save() {
    const title = draft.title.trim()
    if (!title) {
      setFormError('Give the policy a title.')
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
        .from('policies')
        .insert({
          org_id: orgId,
          title,
          updated_on: draft.updated_on,
          // Empty stays null rather than '', so "no text yet" is one
          // state and not two.
          body: draft.body.trim() || null,
        })
        .select('id, title, updated_on, body')
        .single()
      setSaving(false)
      if (error) return setFormError(error.message)
      setPolicies((prev) =>
        [...prev, data as Policy].sort((a, b) => a.title.localeCompare(b.title))
      )
      setEditingId(null)
      return
    }

    const { data, error } = await supabase
      .from('policies')
      .update({ title, updated_on: draft.updated_on, body: draft.body.trim() || null })
      .eq('id', editingId)
      .select('id, title, updated_on, body')
      .single()
    setSaving(false)
    if (error) return setFormError(error.message)
    setPolicies((prev) =>
      prev
        .map((p) => (p.id === editingId ? (data as Policy) : p))
        .sort((a, b) => a.title.localeCompare(b.title))
    )
    setEditingId(null)
  }

  async function remove(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('policies').delete().eq('id', id)
    if (error) {
      setLoadError(error.message)
      return
    }
    setPolicies((prev) => prev.filter((p) => p.id !== id))
    if (editingId === id) setEditingId(null)
  }

  return (
    <>
      <PageHead
        title="Company policies"
        lead="Add, edit, or remove the documents everyone is expected to have read."
      />
      <PlaneBadge plane="work" />

      {loadError && (
        <div className="banner banner--error mb-5" role="alert">
          {loadError}
        </div>
      )}

      <div className="grid grid--sidebar-right">
        <div className="stack">
          {loading ? (
            <div className="card">
              <div className="skel skel--text" />
            </div>
          ) : policies.length === 0 ? (
            <div className="card card--quiet">
              <p className="t-subtle">No policies defined yet.</p>
            </div>
          ) : (
            policies.map((p) => (
              <div className="card" key={p.id}>
                {editingId === p.id ? (
                  <PolicyForm
                    draft={draft}
                    setDraft={setDraft}
                    onSave={save}
                    onCancel={cancelEdit}
                    saving={saving}
                    error={formError}
                    submitLabel="Save changes"
                  />
                ) : (
                  <div className="row row--between">
                    <div>
                      <h2 className="card__title">{p.title}</h2>
                      <div className="card__sub">Updated {fmtDate(p.updated_on)}</div>
                    </div>
                    <div className="row" style={{ gap: 'var(--s-2)', flexWrap: 'nowrap' }}>
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm"
                        onClick={() => startEdit(p)}
                      >
                        Edit
                      </button>
                      <ConfirmButton
                        label="Delete"
                        className="btn btn--ghost btn--sm"
                        onConfirm={() => remove(p.id)}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="stack">
          <div className="card">
            <h2 className="card__title mb-3">Add a policy</h2>
            {editingId === 'new' ? (
              <PolicyForm
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
                New policy
              </button>
            )}
          </div>
        </div>
      </div>

      <PrivacyNote
        plane="work"
        detail="Deleting a policy deletes everyone's acknowledgement of it along with it — there is no way to remove just the policy and keep the read history. Editing a title or date leaves existing acknowledgements standing; if the document itself changed and people should re-confirm it, delete and re-add it instead."
      >
        <b>Removing a policy clears its acknowledgement history.</b>{' '}
      </PrivacyNote>
    </>
  )
}

function PolicyForm({
  draft,
  setDraft,
  onSave,
  onCancel,
  saving,
  error,
  submitLabel,
}: {
  draft: { title: string; updated_on: string; body: string }
  setDraft: (d: { title: string; updated_on: string; body: string }) => void
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
        <label className="field__label" htmlFor="policy-title">
          Title
        </label>
        <input
          id="policy-title"
          className="input"
          value={draft.title}
          maxLength={120}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        />
      </div>
      <div className="field" style={{ maxWidth: 200 }}>
        <label className="field__label" htmlFor="policy-date">
          Updated on
        </label>
        <input
          id="policy-date"
          className="input"
          type="date"
          value={draft.updated_on}
          onChange={(e) => setDraft({ ...draft, updated_on: e.target.value })}
        />
      </div>
      <div className="field">
        <label className="field__label" htmlFor="policy-body">
          The policy
        </label>
        <textarea
          id="policy-body"
          className="textarea"
          rows={10}
          value={draft.body}
          placeholder="Paste or write the policy here. Blank lines start a new paragraph."
          onChange={(e) => setDraft({ ...draft, body: e.target.value })}
        />
        <p className="t-subtle mt-2">
          What people read when they open it. Leaving it empty keeps the old
          behaviour — a title with nothing behind it.
        </p>
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
