'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Existing = { status: string; full_name: string } | null

/** Shown to an account that has signed in but is not linked to anyone.
 *  Having an account is not having access — this is how the person asks
 *  for it, and how HR gets someone to decide about. */
export function RequestAccess() {
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [existing, setExisting] = useState<Existing>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('access_requests')
      .select('status, full_name')
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setExisting(data)
          setName(data.full_name)
        }
        setLoading(false)
      })
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)

    const supabase = createClient()
    const { error } = await supabase.rpc('request_access', {
      p_full_name: name,
      p_note: note,
    })

    setSaving(false)
    if (error) setError(error.message)
    else setExisting({ status: 'pending', full_name: name })
  }

  if (loading) {
    return (
      <div className="card">
        <div className="skel skel--title" />
        <div className="skel skel--text" />
      </div>
    )
  }

  if (existing?.status === 'pending') {
    return (
      <div className="card">
        <div className="state state--info">
          <div className="state__icon" aria-hidden="true">
            ⏳
          </div>
          <h2 className="state__title">Waiting on HR</h2>
          <p className="state__text">
            Your request is with whoever runs WorkWell where you work. When
            they approve it, everything appears here — you will not need to
            sign in again.
          </p>
        </div>
      </div>
    )
  }

  if (existing?.status === 'declined') {
    return (
      <div className="card">
        <div className="state state--error">
          <div className="state__icon" aria-hidden="true">
            ✕
          </div>
          <h2 className="state__title">Not approved</h2>
          <p className="state__text">
            HR did not approve this request. If you think that is a mistake,
            speak to them directly — asking again here will not change it.
          </p>
        </div>
      </div>
    )
  }

  return (
    <form className="card" onSubmit={submit}>
      <div className="card__title">Ask for access</div>
      <p className="card__sub">
        Your email address is already known from signing in. HR decides who
        joins.
      </p>

      {error && (
        <div className="banner banner--error mt-4" role="alert">
          {error}
        </div>
      )}

      <div className="field mt-4">
        <label className="field__label" htmlFor="rname">
          Your name
        </label>
        <input
          id="rname"
          className="input"
          value={name}
          required
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="field mt-4">
        <label className="field__label" htmlFor="rnote">
          Anything HR should know? (optional)
        </label>
        <textarea
          id="rnote"
          className="textarea"
          value={note}
          placeholder="Which team you are joining, who your manager is…"
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <button className="btn btn--primary mt-5" type="submit" disabled={saving}>
        {saving ? 'Sending…' : 'Request access'}
      </button>
    </form>
  )
}
