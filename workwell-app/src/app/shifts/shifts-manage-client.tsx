'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import { PageHead, PlaneBadge, PrivacyNote } from '@/components/chrome'
import { ConfirmButton } from '@/components/controls'
import { labelTime, spanMinutes, toHHMM, toMinutes, workingMinutes, type Shift } from '@/lib/shift'

type Person = { id: string; full_name: string }

/** Every zone the browser knows, so nothing has to be kept in step with a
 *  hardcoded list. Older engines without supportedValuesOf get the one that
 *  matters plus their own, which is enough to not be stuck. */
function zoneOptions(current: string | null) {
  const withIntl = Intl as typeof Intl & { supportedValuesOf?: (k: string) => string[] }
  const all = withIntl.supportedValuesOf?.('timeZone') ?? [
    'Asia/Manila',
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  ]
  return [...new Set([current, ...all].filter(Boolean) as string[])].sort()
}
type Assignment = { person_id: string; shift_id: string }

const EMPTY_DRAFT = {
  name: '',
  time_in: '09:00',
  meal_start: '12:00',
  meal_end: '13:00',
  time_out: '18:00',
}

function hours(mins: number) {
  const h = mins / 60
  return Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`
}

/** '15:00' → '3:00 pm – 12:00 am, meal 7:00 pm – 8:00 pm · 8h'. */
function describe(s: Shift) {
  return `${labelTime(s.time_in)} – ${labelTime(s.time_out)} · meal ${labelTime(
    s.meal_start
  )} – ${labelTime(s.meal_end)} · ${hours(workingMinutes(s))}`
}

type ShiftsData = {
  me: string | null
  orgId: string | null
  shifts: Shift[]
  people: Person[]
  assignments: Assignment[]
  timeZone: string | null
}

async function fetchShiftsData(): Promise<ShiftsData> {
  const supabase = createClient()
  const [{ data: mine }, { data: sh, error: shError }, { data: ppl, error: pplError }, { data: asg, error: asgError }, { data: org }] =
    await Promise.all([
      supabase.from('me').select('id, org_id').maybeSingle(),
      supabase.from('shifts').select('id, name, time_in, meal_start, meal_end, time_out').order('time_in'),
      supabase.from('people').select('id, full_name').order('full_name'),
      supabase.from('shift_assignments').select('person_id, shift_id'),
      supabase.from('org').select('timezone').maybeSingle(),
    ])
  const err = shError ?? pplError ?? asgError
  if (err) throw err
  return {
    me: mine?.id ?? null,
    orgId: mine?.org_id ?? null,
    shifts: (sh ?? []) as Shift[],
    people: (ppl ?? []) as Person[],
    assignments: (asg ?? []) as Assignment[],
    timeZone: org?.timezone ?? null,
  }
}

/**
 * Who works when.
 *
 * Attendance could always record when someone timed in; nothing could say
 * when they were *due* in, so the meal auto-pause was a hardcoded 12:00–13:00
 * for everyone — wrong for every shift but the morning one. A shift here is
 * a wall-clock pattern; assigning one is what makes the pause, and the ring
 * around the room, correct for a person who starts at 3pm.
 */
export default function ShiftsManageClient() {
  const { data, error: loadErrorObj, isLoading: loading, mutate } = useSWR('shifts:manage:data', fetchShiftsData)
  const [actionError, setActionError] = useState<string | null>(null)
  const loadError = actionError ?? loadErrorObj?.message ?? null

  const me = data?.me ?? null
  const orgId = data?.orgId ?? null
  const shifts = data?.shifts ?? []
  const people = data?.people ?? []
  const assignments = data?.assignments ?? []
  const timeZone = data?.timeZone ?? null
  const [savingZone, setSavingZone] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [busyPerson, setBusyPerson] = useState<string | null>(null)

  const shiftOf = new Map(assignments.map((a) => [a.person_id, a.shift_id]))
  const byId = new Map(shifts.map((s) => [s.id, s]))

  function startCreate() {
    setEditingId('new')
    setDraft(EMPTY_DRAFT)
    setFormError(null)
  }

  function startEdit(s: Shift) {
    setEditingId(s.id)
    setDraft({
      name: s.name,
      time_in: toHHMM(toMinutes(s.time_in)),
      meal_start: toHHMM(toMinutes(s.meal_start)),
      meal_end: toHHMM(toMinutes(s.meal_end)),
      time_out: toHHMM(toMinutes(s.time_out)),
    })
    setFormError(null)
  }

  async function save() {
    const name = draft.name.trim()
    if (!name) return setFormError('Give the shift a name.')

    // A shift that ends when it starts is a 24-hour shift, and a meal longer
    // than the shift leaves negative hours — both are almost certainly a
    // mistyped time rather than a real roster.
    const span = spanMinutes(toMinutes(draft.time_in), toMinutes(draft.time_out))
    const meal = spanMinutes(toMinutes(draft.meal_start), toMinutes(draft.meal_end))
    if (meal >= span) return setFormError('The meal break has to be shorter than the shift.')

    setSaving(true)
    setFormError(null)
    const supabase = createClient()
    const values = {
      name,
      time_in: draft.time_in,
      meal_start: draft.meal_start,
      meal_end: draft.meal_end,
      time_out: draft.time_out,
    }

    if (editingId === 'new') {
      if (!orgId) {
        setSaving(false)
        return setFormError('This account is not linked to an organisation yet.')
      }
      const { data: row, error } = await supabase
        .from('shifts')
        .insert({ org_id: orgId, ...values })
        .select('id, name, time_in, meal_start, meal_end, time_out')
        .single()
      setSaving(false)
      if (error) return setFormError(error.message)
      await mutate((prev) => prev && { ...prev, shifts: [...prev.shifts, row as Shift] }, { revalidate: false })
      setEditingId(null)
      return
    }

    const { data: row, error } = await supabase
      .from('shifts')
      .update(values)
      .eq('id', editingId)
      .select('id, name, time_in, meal_start, meal_end, time_out')
      .single()
    setSaving(false)
    if (error) return setFormError(error.message)
    await mutate(
      (prev) => prev && { ...prev, shifts: prev.shifts.map((s) => (s.id === editingId ? (row as Shift) : s)) },
      { revalidate: false }
    )
    setEditingId(null)
  }

  async function removeShift(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('shifts').delete().eq('id', id)
    if (error) return setActionError(error.message)
    // The assignment rows cascade in the database; mirror that here rather
    // than leaving the table showing hours nobody is on any more.
    await mutate(
      (prev) =>
        prev && {
          ...prev,
          shifts: prev.shifts.filter((s) => s.id !== id),
          assignments: prev.assignments.filter((a) => a.shift_id !== id),
        },
      { revalidate: false }
    )
    if (editingId === id) setEditingId(null)
  }

  async function saveZone(next: string) {
    const previous = timeZone
    // optimistic: the select should not lag the click
    await mutate((prev) => prev && { ...prev, timeZone: next }, { revalidate: false })
    setSavingZone(true)
    setActionError(null)
    const supabase = createClient()
    const { error } = await supabase.rpc('set_org_timezone', { p_timezone: next })
    setSavingZone(false)
    if (error) {
      await mutate((prev) => prev && { ...prev, timeZone: previous }, { revalidate: false })
      setActionError(error.message)
    }
  }

  async function assign(personId: string, shiftId: string) {
    setBusyPerson(personId)
    setActionError(null)
    const supabase = createClient()

    if (!shiftId) {
      const { error } = await supabase.from('shift_assignments').delete().eq('person_id', personId)
      setBusyPerson(null)
      if (error) return setActionError(error.message)
      await mutate(
        (prev) => prev && { ...prev, assignments: prev.assignments.filter((a) => a.person_id !== personId) },
        { revalidate: false }
      )
      return
    }

    const { error } = await supabase
      .from('shift_assignments')
      .upsert(
        { person_id: personId, shift_id: shiftId, assigned_by: me, assigned_at: new Date().toISOString() },
        { onConflict: 'person_id' }
      )
    setBusyPerson(null)
    if (error) return setActionError(error.message)
    await mutate(
      (prev) =>
        prev && {
          ...prev,
          assignments: [
            ...prev.assignments.filter((a) => a.person_id !== personId),
            { person_id: personId, shift_id: shiftId },
          ],
        },
      { revalidate: false }
    )
  }

  return (
    <>
      <PageHead
        title="Working hours"
        lead="Define the shifts your organisation runs, and put each person on one."
      />
      <PlaneBadge plane="work" />

      {loadError && (
        <div className="banner banner--error mb-5" role="alert">
          {loadError}
        </div>
      )}

      <div className="grid grid--sidebar-right">
        <div className="stack">
          <div className="card card--flush">
            <div style={{ padding: 'var(--s-5) var(--s-5) var(--s-3)' }}>
              <h2 className="card__title">Who works when</h2>
              <div className="card__sub">
                Sets the meal pause and the day ring for that person
              </div>
            </div>
            {loading ? (
              <div style={{ padding: '0 var(--s-5) var(--s-5)' }}>
                <div className="skel skel--text" />
              </div>
            ) : people.length === 0 ? (
              <p className="t-subtle" style={{ padding: '0 var(--s-5) var(--s-5)' }}>
                Nobody has an account yet.
              </p>
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <caption className="sr-only">Shift assignments</caption>
                  <thead>
                    <tr>
                      <th scope="col">Employee</th>
                      <th scope="col">Shift</th>
                      <th scope="col">Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {people.map((p) => {
                      const current = shiftOf.get(p.id) ?? ''
                      const s = current ? byId.get(current) : null
                      return (
                        <tr key={p.id}>
                          <th scope="row" style={{ fontWeight: 600 }}>
                            {p.full_name}
                          </th>
                          <td>
                            <select
                              className="select"
                              aria-label={`Shift for ${p.full_name}`}
                              value={current}
                              disabled={busyPerson === p.id || shifts.length === 0}
                              onChange={(e) => assign(p.id, e.target.value)}
                            >
                              <option value="">No shift set</option>
                              {shifts.map((o) => (
                                <option key={o.id} value={o.id}>
                                  {o.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="t-subtle">
                            {s
                              ? `${labelTime(s.time_in)} – ${labelTime(s.time_out)}`
                              : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="stack">
            {shifts.map((s) => (
              <div className="card" key={s.id}>
                {editingId === s.id ? (
                  <ShiftForm
                    draft={draft}
                    setDraft={setDraft}
                    onSave={save}
                    onCancel={() => setEditingId(null)}
                    saving={saving}
                    error={formError}
                    submitLabel="Save changes"
                  />
                ) : (
                  <div className="row row--between">
                    <div>
                      <h2 className="card__title">{s.name}</h2>
                      <div className="card__sub">{describe(s)}</div>
                    </div>
                    <div className="row" style={{ gap: 'var(--s-2)', flexWrap: 'nowrap' }}>
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm"
                        onClick={() => startEdit(s)}
                      >
                        Edit
                      </button>
                      <ConfirmButton
                        label="Delete"
                        className="btn btn--ghost btn--sm"
                        onConfirm={() => removeShift(s.id)}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <h2 className="card__title mb-1">Office timezone</h2>
            <p className="card__sub mb-3">
              The wall these hours are read off. Every shift time, meal pause and
              time-in window is measured here, not on anyone&rsquo;s laptop.
            </p>
            <select
              className="select"
              aria-label="Office timezone"
              value={timeZone ?? ''}
              disabled={loading || savingZone || !timeZone}
              onChange={(e) => saveZone(e.target.value)}
            >
              {zoneOptions(timeZone).map((z) => (
                <option key={z} value={z}>
                  {z.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
            {timeZone && (
              <p className="field__hint mt-2">
                It is currently{' '}
                <b>
                  {new Date().toLocaleTimeString('en-PH', {
                    timeZone,
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </b>{' '}
                there.
              </p>
            )}
          </div>

          <div className="card">
            <h2 className="card__title mb-3">Add a shift</h2>
            {editingId === 'new' ? (
              <ShiftForm
                draft={draft}
                setDraft={setDraft}
                onSave={save}
                onCancel={() => setEditingId(null)}
                saving={saving}
                error={formError}
                submitLabel="Add"
              />
            ) : (
              <button type="button" className="btn btn--primary" onClick={startCreate}>
                New shift
              </button>
            )}
          </div>
        </div>
      </div>

      <PrivacyNote
        plane="work"
        detail="A shift says when someone is rostered, not when they actually worked — their own time in and time out stay on their private plane, visible to them alone. Changing someone's shift changes the meal pause and the day ring they see from tomorrow; it never edits a day already recorded."
      >
        <b>This sets the roster, not the record.</b>{' '}
      </PrivacyNote>
    </>
  )
}

function ShiftForm({
  draft,
  setDraft,
  onSave,
  onCancel,
  saving,
  error,
  submitLabel,
}: {
  draft: typeof EMPTY_DRAFT
  setDraft: (d: typeof EMPTY_DRAFT) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
  error: string | null
  submitLabel: string
}) {
  const span = spanMinutes(toMinutes(draft.time_in), toMinutes(draft.time_out))
  const meal = spanMinutes(toMinutes(draft.meal_start), toMinutes(draft.meal_end))
  const overnight = toMinutes(draft.time_out) <= toMinutes(draft.time_in)

  return (
    <div className="stack stack--tight">
      {error && (
        <div className="banner banner--error" role="alert">
          {error}
        </div>
      )}
      <div className="field">
        <label className="field__label" htmlFor="shift-name">
          Name
        </label>
        <input
          id="shift-name"
          className="input"
          value={draft.name}
          maxLength={60}
          placeholder="Night shift"
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
      </div>
      <div className="row" style={{ gap: 'var(--s-3)' }}>
        <div className="field" style={{ flex: 1 }}>
          <label className="field__label" htmlFor="shift-in">
            Time in
          </label>
          <input
            id="shift-in"
            className="input"
            type="time"
            value={draft.time_in}
            onChange={(e) => setDraft({ ...draft, time_in: e.target.value })}
          />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label className="field__label" htmlFor="shift-out">
            Time out
          </label>
          <input
            id="shift-out"
            className="input"
            type="time"
            value={draft.time_out}
            onChange={(e) => setDraft({ ...draft, time_out: e.target.value })}
          />
        </div>
      </div>
      <div className="row" style={{ gap: 'var(--s-3)' }}>
        <div className="field" style={{ flex: 1 }}>
          <label className="field__label" htmlFor="shift-meal-start">
            Meal from
          </label>
          <input
            id="shift-meal-start"
            className="input"
            type="time"
            value={draft.meal_start}
            onChange={(e) => setDraft({ ...draft, meal_start: e.target.value })}
          />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label className="field__label" htmlFor="shift-meal-end">
            Meal until
          </label>
          <input
            id="shift-meal-end"
            className="input"
            type="time"
            value={draft.meal_end}
            onChange={(e) => setDraft({ ...draft, meal_end: e.target.value })}
          />
        </div>
      </div>
      <p className="field__hint">
        {hours(Math.max(0, span - meal))} of working time
        {overnight ? ' · runs past midnight' : ''}
      </p>
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
