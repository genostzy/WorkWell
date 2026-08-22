'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function ResignationForm({ personId }: { personId: string }) {
  const router = useRouter()
  const [lastDay, setLastDay] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!lastDay) return setError('Select your last working day.')

    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('resignations').insert({
      person_id: personId,
      last_day: lastDay,
      reason: reason.trim() || null,
      status: 'submitted',
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
          <span>Resignation submitted. HR has been notified.</span>
        </div>
        <div className="mt-4">
          <button className="btn btn--secondary btn--sm" onClick={() => setSent(false)}>
            Submit another
          </button>
        </div>
      </div>
    )
  }

  return (
    <form className="card" onSubmit={submit}>
      <div className="card__title">Submit resignation</div>
      <p className="card__sub">
        This notifies HR. Your last day is subject to your notice period.
      </p>

      {error && (
        <div className="banner banner--error" role="alert">
          {error}
        </div>
      )}

      <div className="mt-4">
        <label className="field__label" htmlFor="last-day">
          Last working day
        </label>
        <input
          id="last-day"
          className="input"
          type="date"
          value={lastDay}
          onChange={(e) => setLastDay(e.target.value)}
        />
      </div>

      <div className="mt-4">
        <label className="field__label" htmlFor="reason">
          Reason (optional)
        </label>
        <textarea
          id="reason"
          className="textarea"
          value={reason}
          placeholder="You do not have to give a reason, but it helps HR."
          rows={3}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>

      <div className="mt-4">
        <button className="btn btn--primary btn--sm" type="submit" disabled={saving}>
          {saving ? 'Submitting…' : 'Submit resignation'}
        </button>
      </div>
    </form>
  )
}
