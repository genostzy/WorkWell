'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const KINDS = ['Annual', 'Sick', 'Unpaid', 'Bereavement'] as const

export function LeaveForm({ personId }: { personId: string | null }) {
  const router = useRouter()
  const [kind, setKind] = useState<string>('Annual')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    // Validate here so the failure is a sentence rather than a constraint
    // violation. The database enforces it too — this is the friendly half.
    if (!from || !to) return setError('Choose both a start and an end date.')
    if (to < from) return setError('The end date is before the start date.')
    if (!personId) return setError('This account is not linked to a person yet.')

    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('leave_requests').insert({
      person_id: personId,
      kind,
      starts_on: from,
      ends_on: to,
      note: note.trim() || null,
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
          <span>Request sent to your manager.</span>
        </div>
        <div className="mt-4">
          <button className="btn btn--secondary" onClick={() => setSent(false)}>
            Book more time
          </button>
        </div>
      </div>
    )
  }

  return (
    <form className="card" onSubmit={submit}>
      <div className="card__title">Request time off</div>
      <p className="card__sub">Goes to your manager for approval.</p>

      {error && (
        <div className="banner banner--error" role="alert">
          {error}
        </div>
      )}

      <div className="mt-4">
        <label className="field__label" htmlFor="kind">
          Type
        </label>
        <select
          id="kind"
          className="select"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          
        >
          {KINDS.map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
      </div>

      <div className="mt-4" style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <label className="field__label" htmlFor="from">
            From
          </label>
          <input
            id="from"
            className="input"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label className="field__label" htmlFor="to">
            To
          </label>
          <input
            id="to"
            className="input"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-4">
        <label className="field__label" htmlFor="lnote">
          Note (optional)
        </label>
        <textarea
          id="lnote"
          className="textarea"
          value={note}
          placeholder="Anything your manager should know."
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <div className="mt-4">
        <button className="btn btn--primary" type="submit" disabled={saving}>
          {saving ? 'Sending…' : 'Send request'}
        </button>
      </div>
    </form>
  )
}
