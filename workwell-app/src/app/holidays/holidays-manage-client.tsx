'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHead, PlaneBadge, PrivacyNote } from '@/components/chrome'
import { fmtDate } from '@/lib/format-date'

type Holiday = { id: string; observed_on: string; name: string }

const EMPTY_DRAFT = { observed_on: '', name: '' }

/**
 * HR's side of Holidays. The table always allowed HR to write it (see
 * 0037_wire_mock_pages.sql) -- there was simply no page to do it from, so
 * this account was locked out of a page the schema was built for it to
 * manage. No delete: the grant was never there for it, matching every
 * other reference-data table here -- fix a wrong entry in place instead.
 */
export default function HolidaysManageClient() {
  const [orgId, setOrgId] = useState<string | null>(null)
  const [holidays, setHolidays] = useState<Holiday[]>([])
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
        supabase.from('holidays').select('id, observed_on, name').order('observed_on'),
      ])
      if (cancelled) return
      if (meError ?? error) setLoadError((meError ?? error)!.message)
      setOrgId(me?.org_id ?? null)
      setHolidays((data ?? []) as Holiday[])
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

  function startEdit(h: Holiday) {
    setEditingId(h.id)
    setDraft({ observed_on: h.observed_on, name: h.name })
    setFormError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setFormError(null)
  }

  async function save() {
    const name = draft.name.trim()
    if (!draft.observed_on) {
      setFormError('Choose the date.')
      return
    }
    if (!name) {
      setFormError('Give it a name.')
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
        .from('holidays')
        .insert({ org_id: orgId, observed_on: draft.observed_on, name })
        .select('id, observed_on, name')
        .single()
      setSaving(false)
      if (error) return setFormError(error.message)
      setHolidays((prev) =>
        [...prev, data as Holiday].sort((a, b) => (a.observed_on < b.observed_on ? -1 : 1))
      )
      setEditingId(null)
      return
    }

    const { data, error } = await supabase
      .from('holidays')
      .update({ observed_on: draft.observed_on, name })
      .eq('id', editingId)
      .select('id, observed_on, name')
      .single()
    setSaving(false)
    if (error) return setFormError(error.message)
    setHolidays((prev) =>
      prev
        .map((h) => (h.id === editingId ? (data as Holiday) : h))
        .sort((a, b) => (a.observed_on < b.observed_on ? -1 : 1))
    )
    setEditingId(null)
  }

  return (
    <>
      <PageHead
        title="Holidays"
        lead="The company calendar — add or correct the days nobody is expected in."
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
          ) : holidays.length === 0 ? (
            <div className="card card--quiet">
              <p className="t-subtle">Nothing on the calendar yet.</p>
            </div>
          ) : (
            holidays.map((h) => (
              <div className="card" key={h.id}>
                {editingId === h.id ? (
                  <HolidayForm
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
                      <h2 className="card__title">{h.name}</h2>
                      <div className="card__sub">{fmtDate(h.observed_on, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}</div>
                    </div>
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm"
                      onClick={() => startEdit(h)}
                    >
                      Edit
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="stack">
          <div className="card">
            <h2 className="card__title mb-3">Add a holiday</h2>
            {editingId === 'new' ? (
              <HolidayForm
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
                New holiday
              </button>
            )}
          </div>
        </div>
      </div>

      <PrivacyNote
        plane="work"
        detail="The calendar is visible to everyone at your organisation the moment you save it. There's no delete here — correct a wrong date or name in place rather than removing it."
      >
        <b>Visible to your whole organisation.</b>{' '}
      </PrivacyNote>
    </>
  )
}

function HolidayForm({
  draft,
  setDraft,
  onSave,
  onCancel,
  saving,
  error,
  submitLabel,
}: {
  draft: { observed_on: string; name: string }
  setDraft: (d: { observed_on: string; name: string }) => void
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
        <label className="field__label" htmlFor="hol-date">
          Date
        </label>
        <input
          id="hol-date"
          className="input"
          type="date"
          value={draft.observed_on}
          onChange={(e) => setDraft({ ...draft, observed_on: e.target.value })}
        />
      </div>
      <div className="field">
        <label className="field__label" htmlFor="hol-name">
          Name
        </label>
        <input
          id="hol-name"
          className="input"
          value={draft.name}
          maxLength={120}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
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
