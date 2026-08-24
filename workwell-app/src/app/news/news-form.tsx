'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function NewsForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [pinned, setPinned] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!title.trim()) return setError('Give the announcement a title.')
    if (!body.trim()) return setError('Write the body of the announcement.')

    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('news').insert({
      title: title.trim(),
      body: body.trim(),
      pinned,
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
          <span>Announcement published.</span>
        </div>
        <div className="mt-4">
          <button
            className="btn btn--secondary"
            onClick={() => {
              setSent(false)
              setTitle('')
              setBody('')
              setPinned(false)
            }}
          >
            Post another
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
            <div className="card__title">Post an announcement</div>
            <div className="card__sub">Visible to everyone in the organisation.</div>
          </div>
        </div>
        <button
          className="btn btn--primary btn--sm mt-3"
          type="button"
          onClick={() => setOpen(true)}
        >
          New announcement
        </button>
      </div>
    )
  }

  return (
    <form className="card mb-5" onSubmit={submit}>
      <div className="card__title">New announcement</div>
      <p className="card__sub">Appears at the top of everyone&apos;s news feed.</p>

      {error && (
        <div className="banner banner--error" role="alert">
          {error}
        </div>
      )}

      <div className="mt-4">
        <label className="field__label" htmlFor="news-title">
          Title
        </label>
        <input
          id="news-title"
          className="input"
          value={title}
          placeholder="What people need to know"
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className="mt-4">
        <label className="field__label" htmlFor="news-body">
          Body
        </label>
        <textarea
          id="news-body"
          className="textarea"
          rows={6}
          value={body}
          placeholder="The details of the announcement."
          onChange={(e) => setBody(e.target.value)}
        />
      </div>

      <div className="mt-4">
        <label className="pick">
          <input
            type="checkbox"
            checked={pinned}
            onChange={(e) => setPinned(e.target.checked)}
          />
          <span>Pin to the top of the feed</span>
        </label>
      </div>

      <div className="row mt-4">
        <button className="btn btn--primary" type="submit" disabled={saving}>
          {saving ? 'Publishing…' : 'Publish'}
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
