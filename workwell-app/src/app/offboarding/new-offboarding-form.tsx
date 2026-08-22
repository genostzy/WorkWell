'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function NewOffboardingForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [personId, setPersonId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [people, setPeople] = useState<{ id: string; full_name: string }[]>([])
  const [loadingPeople, setLoadingPeople] = useState(false)

  async function loadPeople() {
    if (people.length > 0) return
    setLoadingPeople(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('people')
      .select('id, full_name')
      .eq('status', 'active')
      .order('full_name')
    setPeople(data ?? [])
    setLoadingPeople(false)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)

    const supabase = createClient()
    const { error: insertError } = await supabase.from('offboarding_checklists').insert({
      person_id: personId,
      asset_returned: false,
      access_revoked: false,
      last_day_confirmed: false,
      equipment_returned: false,
      handover_done: false,
    })

    setBusy(false)
    if (insertError) {
      setError(insertError.message)
    } else {
      setPersonId('')
      setOpen(false)
      router.refresh()
    }
  }

  if (!open) {
    return (
      <button
        className="btn btn--primary btn--sm mb-5"
        onClick={() => {
          setOpen(true)
          loadPeople()
        }}
      >
        New offboarding checklist
      </button>
    )
  }

  return (
    <div className="card mb-5">
      <div className="card__head">
        <div className="card__title">New offboarding checklist</div>
      </div>
      <form onSubmit={submit} className="stack" style={{ gap: 'var(--s-3)' }}>
        {error && (
          <div className="banner banner--error" role="alert">{error}</div>
        )}
        <label className="field">
          <span className="field__label">Person</span>
          {loadingPeople ? (
            <p className="t-subtle">Loading people…</p>
          ) : (
            <select
              className="field__input"
              value={personId}
              onChange={(e) => setPersonId(e.target.value)}
              required
            >
              <option value="">Select a person</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
          )}
        </label>
        <div className="row">
          <button className="btn btn--primary btn--sm" type="submit" disabled={busy || loadingPeople}>
            {busy ? 'Creating…' : 'Create checklist'}
          </button>
          <button
            className="btn btn--secondary btn--sm"
            type="button"
            onClick={() => {
              setOpen(false)
              setError(null)
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
