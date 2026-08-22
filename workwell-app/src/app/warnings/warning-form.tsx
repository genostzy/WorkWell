'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const LEVELS = ['verbal', 'written', 'final'] as const

export function WarningForm({
  people,
}: {
  people: { id: string; full_name: string }[]
}) {
  const router = useRouter()
  const [personId, setPersonId] = useState('')
  const [level, setLevel] = useState<string>('verbal')
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!personId) return setError('Select a person.')
    if (!reason.trim()) return setError('Provide a reason for the warning.')

    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('warnings').insert({
      person_id: personId,
      level,
      reason: reason.trim(),
      notes: notes.trim() || null,
      issued_on: new Date().toISOString().slice(0, 10),
    })
    setSaving(false)

    if (error) setError(error.message)
    else {
      setSent(true)
      router.refresh()
    }
  }

  if (sent) {
    return (
      <div className="card">
        <div className="confirmed" role="status">
          <span aria-hidden="true">✓</span>
          <span>Warning issued.</span>
        </div>
        <div className="mt-4">
          <button className="btn btn--secondary" onClick={() => {
            setSent(false)
            setPersonId('')
            setLevel('verbal')
            setReason('')
            setNotes('')
          }}>
            Issue another
          </button>
        </div>
      </div>
    )
  }

  return (
    <form className="card" onSubmit={submit}>
      <div className="card__title">Issue a warning</div>

      {error && (
        <div className="banner banner--error" role="alert">
          {error}
        </div>
      )}

      <div className="mt-4">
        <label className="field__label" htmlFor="wperson">
          Person
        </label>
        <select
          id="wperson"
          className="select"
          value={personId}
          onChange={(e) => setPersonId(e.target.value)}
        >
          <option value="">Select…</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4">
        <label className="field__label" htmlFor="wlevel">
          Level
        </label>
        <select
          id="wlevel"
          className="select"
          value={level}
          onChange={(e) => setLevel(e.target.value)}
        >
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {l.charAt(0).toUpperCase() + l.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4">
        <label className="field__label" htmlFor="wreason">
          Reason
        </label>
        <textarea
          id="wreason"
          className="textarea"
          value={reason}
          placeholder="What prompted this warning."
          onChange={(e) => setReason(e.target.value)}
        />
      </div>

      <div className="mt-4">
        <label className="field__label" htmlFor="wnotes">
          Notes (optional)
        </label>
        <textarea
          id="wnotes"
          className="textarea"
          value={notes}
          placeholder="Additional context or expectations."
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div className="mt-4">
        <button className="btn btn--primary btn--sm" type="submit" disabled={saving}>
          {saving ? 'Issuing…' : 'Issue warning'}
        </button>
      </div>
    </form>
  )
}
