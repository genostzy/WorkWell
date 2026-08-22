'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function LetterHeadForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)

    const supabase = createClient()
    const { error: insertError } = await supabase.from('letter_heads').insert({
      name,
      body,
    })

    setBusy(false)
    if (insertError) {
      setError(insertError.message)
    } else {
      setName('')
      setBody('')
      setOpen(false)
      router.refresh()
    }
  }

  if (!open) {
    return (
      <button className="btn btn--primary btn--sm mb-5" onClick={() => setOpen(true)}>
        New letter head template
      </button>
    )
  }

  return (
    <div className="card mb-5">
      <div className="card__head">
        <div className="card__title">New letter head template</div>
      </div>
      <form onSubmit={submit} className="stack" style={{ gap: 'var(--s-3)' }}>
        {error && (
          <div className="banner banner--error" role="alert">{error}</div>
        )}
        <label className="field">
          <span className="field__label">Name</span>
          <input
            className="field__input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g. Offer letter"
          />
        </label>
        <label className="field">
          <span className="field__label">Body</span>
          <textarea
            className="field__input"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            rows={8}
            placeholder="Template text. Use placeholders like {{full_name}}, {{job_title}}, {{start_date}} for values to be filled in later."
          />
        </label>
        <div className="row">
          <button className="btn btn--primary btn--sm" type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save template'}
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
