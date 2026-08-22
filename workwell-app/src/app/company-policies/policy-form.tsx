'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function PolicyForm() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [effectiveOn, setEffectiveOn] = useState('')
  const [version, setVersion] = useState('1')
  const [saving, setSaving] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!title.trim()) return setError('Enter a title.')
    if (!category.trim()) return setError('Enter a category.')

    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('company_policies').insert({
      title: title.trim(),
      description: description.trim() || null,
      category: category.trim(),
      effective_on: effectiveOn || null,
      version: version.trim() || '1',
    })
    setSaving(false)

    if (error) setError(error.message)
    else {
      setSent(true)
      setTitle('')
      setDescription('')
      setCategory('')
      setEffectiveOn('')
      setVersion('1')
      router.refresh()
    }
  }

  if (sent) {
    return (
      <div className="card">
        <div className="confirmed" role="status">
          <span aria-hidden="true">✓</span>
          <span>Policy published.</span>
        </div>
        <div className="mt-4">
          <button className="btn btn--secondary btn--sm" onClick={() => setSent(false)}>
            Add another
          </button>
        </div>
      </div>
    )
  }

  return (
    <form className="card" onSubmit={submit}>
      <div className="card__title">Add a policy</div>
      <p className="card__sub">Published to all employees immediately.</p>

      {error && (
        <div className="banner banner--error" role="alert">
          {error}
        </div>
      )}

      <div className="mt-4">
        <label className="field__label" htmlFor="policy-title">
          Title
        </label>
        <input
          id="policy-title"
          className="input"
          type="text"
          value={title}
          placeholder="e.g. Remote Work Policy"
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className="mt-4">
        <label className="field__label" htmlFor="policy-desc">
          Description
        </label>
        <textarea
          id="policy-desc"
          className="textarea"
          value={description}
          placeholder="Brief summary of what this policy covers."
          rows={3}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="mt-4" style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <label className="field__label" htmlFor="policy-category">
            Category
          </label>
          <input
            id="policy-category"
            className="input"
            type="text"
            value={category}
            placeholder="e.g. HR, IT, Health & Safety"
            onChange={(e) => setCategory(e.target.value)}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label className="field__label" htmlFor="policy-version">
            Version
          </label>
          <input
            id="policy-version"
            className="input"
            type="text"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-4">
        <label className="field__label" htmlFor="policy-effective">
          Effective date
        </label>
        <input
          id="policy-effective"
          className="input"
          type="date"
          value={effectiveOn}
          onChange={(e) => setEffectiveOn(e.target.value)}
        />
      </div>

      <div className="mt-4">
        <button className="btn btn--primary btn--sm" type="submit" disabled={saving}>
          {saving ? 'Publishing…' : 'Publish policy'}
        </button>
      </div>
    </form>
  )
}
