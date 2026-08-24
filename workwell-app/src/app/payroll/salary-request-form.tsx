'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const TYPES = ['advance', 'increment', 'promotion'] as const

export function SalaryRequestForm() {
  const router = useRouter()
  const [type, setType] = useState<string>('advance')
  const [detail, setDetail] = useState('')
  const [saving, setSaving] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!detail.trim()) return setError('Please provide details for your request.')

    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('salary_requests').insert({
      type,
      detail: detail.trim(),
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
          <span>Request submitted for review.</span>
        </div>
        <div className="mt-4">
          <button className="btn btn--secondary" onClick={() => {
            setSent(false)
            setType('advance')
            setDetail('')
          }}>
            Submit another
          </button>
        </div>
      </div>
    )
  }

  return (
    <form className="card" onSubmit={submit}>
      <div className="card__title">Request a salary change</div>
      <p className="card__sub">Goes to HR for review.</p>

      {error && (
        <div className="banner banner--error" role="alert">
          {error}
        </div>
      )}

      <div className="mt-4">
        <label className="field__label" htmlFor="srtype">
          Type
        </label>
        <select
          id="srtype"
          className="select"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4">
        <label className="field__label" htmlFor="srdetail">
          Details
        </label>
        <textarea
          id="srdetail"
          className="textarea"
          value={detail}
          placeholder="Explain your request — amount, reason, supporting context."
          onChange={(e) => setDetail(e.target.value)}
        />
      </div>

      <div className="mt-4">
        <button className="btn btn--primary btn--sm" type="submit" disabled={saving}>
          {saving ? 'Submitting…' : 'Submit request'}
        </button>
      </div>
    </form>
  )
}
