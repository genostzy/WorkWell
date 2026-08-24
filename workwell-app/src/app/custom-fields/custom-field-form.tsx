'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Select (dropdown)' },
  { value: 'boolean', label: 'Yes / No' },
]

export function CustomFieldForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [fieldType, setFieldType] = useState('text')
  const [options, setOptions] = useState('')
  const [required, setRequired] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)

    const supabase = createClient()
    const parsedOptions = options
      ? options.split(',').map((o) => o.trim()).filter(Boolean)
      : null

    const { error: insertError } = await supabase.from('custom_field_defs').insert({
      label,
      field_type: fieldType,
      options: parsedOptions,
      required,
    })

    setBusy(false)
    if (insertError) {
      setError(insertError.message)
    } else {
      setLabel('')
      setFieldType('text')
      setOptions('')
      setRequired(false)
      setOpen(false)
      router.refresh()
    }
  }

  if (!open) {
    return (
      <button className="btn btn--primary btn--sm mb-5" onClick={() => setOpen(true)}>
        New custom field
      </button>
    )
  }

  return (
    <div className="card mb-5">
      <div className="card__head">
        <div className="card__title">New custom field</div>
      </div>
      <form onSubmit={submit} className="stack" style={{ gap: 'var(--s-3)' }}>
        {error && (
          <div className="banner banner--error" role="alert">{error}</div>
        )}
        <label className="field">
          <span className="field__label">Label</span>
          <input
            className="field__input"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            required
            placeholder="e.g. Certifications"
          />
        </label>
        <label className="field">
          <span className="field__label">Type</span>
          <select
            className="field__input"
            value={fieldType}
            onChange={(e) => setFieldType(e.target.value)}
          >
            {FIELD_TYPES.map((ft) => (
              <option key={ft.value} value={ft.value}>{ft.label}</option>
            ))}
          </select>
        </label>
        {fieldType === 'select' && (
          <label className="field">
            <span className="field__label">Options (comma-separated)</span>
            <input
              className="field__input"
              value={options}
              onChange={(e) => setOptions(e.target.value)}
              placeholder="e.g. AWS, Azure, GCP"
            />
          </label>
        )}
        <label className="field">
          <input
            type="checkbox"
            checked={required}
            onChange={(e) => setRequired(e.target.checked)}
          />
          <span className="field__label" style={{ marginLeft: 'var(--s-2)' }}>
            Required
          </span>
        </label>
        <div className="row">
          <button className="btn btn--primary btn--sm" type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save field'}
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
