'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const CATEGORIES = [
  'workplace',
  'management',
  'harassment',
  'safety',
  'other',
] as const

export function ComplaintForm({ personId }: { personId: string }) {
  const router = useRouter()
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [category, setCategory] = useState<string>('workplace')
  const [saving, setSaving] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!subject.trim()) return setError('Enter a subject.')
    if (!body.trim()) return setError('Describe the issue.')

    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('complaints').insert({
      person_id: personId,
      subject: subject.trim(),
      body: body.trim(),
      category,
      status: 'open',
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
          <span>Complaint submitted. HR will review it.</span>
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
      <div className="card__title">Submit a complaint</div>
      <p className="card__sub">
        This goes directly to HR for investigation.
      </p>

      {error && (
        <div className="banner banner--error" role="alert">
          {error}
        </div>
      )}

      <div className="mt-4">
        <label className="field__label" htmlFor="category">
          Category
        </label>
        <select
          id="category"
          className="select"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4">
        <label className="field__label" htmlFor="subject">
          Subject
        </label>
        <input
          id="subject"
          className="input"
          type="text"
          value={subject}
          placeholder="Brief title for this complaint"
          onChange={(e) => setSubject(e.target.value)}
        />
      </div>

      <div className="mt-4">
        <label className="field__label" htmlFor="body">
          Description
        </label>
        <textarea
          id="body"
          className="textarea"
          value={body}
          placeholder="Describe the issue in detail."
          rows={5}
          onChange={(e) => setBody(e.target.value)}
        />
      </div>

      <div className="mt-4">
        <button className="btn btn--primary btn--sm" type="submit" disabled={saving}>
          {saving ? 'Submitting…' : 'Submit complaint'}
        </button>
      </div>
    </form>
  )
}
