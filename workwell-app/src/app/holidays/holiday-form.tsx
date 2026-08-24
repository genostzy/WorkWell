'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function HolidayForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [recurring, setRecurring] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!name.trim()) return setError('Give the holiday a name.')
    if (!from || !to) return setError('Choose both a start and an end date.')
    if (to < from) return setError('The end date is before the start date.')

    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('holidays').insert({
      name: name.trim(),
      starts_on: from,
      ends_on: to,
      recurring,
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
      <div className="card mb-5">
        <div className="confirmed" role="status">
          <span aria-hidden="true">✓</span>
          <span>Holiday added to the calendar.</span>
        </div>
        <div className="mt-4">
          <button className="btn btn--secondary" onClick={() => { setSent(false); setName(''); setFrom(''); setTo(''); setRecurring(false) }}>
            Add another
          </button>
        </div>
      </div>
    )
  }

  if (!open) {
    return (
      <div className="card mb-5">
        <div className="card__head">
          <div>
            <div className="card__title">Add a holiday</div>
            <div className="card__sub">Company-wide closures and public holidays.</div>
          </div>
        </div>
        <button
          className="btn btn--primary btn--sm mt-3"
          type="button"
          onClick={() => setOpen(true)}
        >
          Add holiday
        </button>
      </div>
    )
  }

  return (
    <form className="card mb-5" onSubmit={submit}>
      <div className="card__title">New holiday</div>
      <p className="card__sub">Appears on everyone&apos;s calendar.</p>

      {error && (
        <div className="banner banner--error" role="alert">
          {error}
        </div>
      )}

      <div className="mt-4">
        <label className="field__label" htmlFor="holiday-name">
          Name
        </label>
        <input
          id="holiday-name"
          className="input"
          value={name}
          placeholder="e.g. Christmas Day"
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="mt-4" style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <label className="field__label" htmlFor="holiday-from">
            From
          </label>
          <input
            id="holiday-from"
            className="input"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label className="field__label" htmlFor="holiday-to">
            To
          </label>
          <input
            id="holiday-to"
            className="input"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-4">
        <label className="pick">
          <input
            type="checkbox"
            checked={recurring}
            onChange={(e) => setRecurring(e.target.checked)}
          />
          <span>Repeats every year</span>
        </label>
      </div>

      <div className="row mt-4">
        <button className="btn btn--primary" type="submit" disabled={saving}>
          {saving ? 'Adding…' : 'Add holiday'}
        </button>
        <button
          className="btn btn--ghost"
          type="button"
          onClick={() => { setOpen(false); setError(null) }}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
