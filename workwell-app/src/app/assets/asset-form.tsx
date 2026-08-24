'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Person = { id: string; full_name: string }

export function AssetForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [people, setPeople] = useState<Person[]>([])
  const [personId, setPersonId] = useState('')
  const [name, setName] = useState('')
  const [kind, setKind] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    if (!open) return
    const supabase = createClient()
    supabase
      .from('people')
      .select('id, full_name')
      .order('full_name')
      .then(({ data }) => setPeople(data ?? []))
  }, [open])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!personId) return setError('Select a person to assign this to.')
    if (!name.trim()) return setError('Give the asset a name.')

    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('assets').insert({
      person_id: personId,
      name: name.trim(),
      kind: kind.trim() || null,
      serial_number: serialNumber.trim() || null,
      issued_on: new Date().toISOString().slice(0, 10),
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
          <span>Asset assigned.</span>
        </div>
        <div className="mt-4">
          <button
            className="btn btn--secondary"
            onClick={() => {
              setSent(false)
              setPersonId('')
              setName('')
              setKind('')
              setSerialNumber('')
            }}
          >
            Assign another
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
            <div className="card__title">Assign equipment</div>
            <div className="card__sub">Issue a new asset to someone in the organisation.</div>
          </div>
        </div>
        <button
          className="btn btn--primary btn--sm mt-3"
          type="button"
          onClick={() => setOpen(true)}
        >
          Assign asset
        </button>
      </div>
    )
  }

  return (
    <form className="card mb-5" onSubmit={submit}>
      <div className="card__title">New asset</div>
      <p className="card__sub">Record equipment being issued to an employee.</p>

      {error && (
        <div className="banner banner--error" role="alert">
          {error}
        </div>
      )}

      <div className="mt-4">
        <label className="field__label" htmlFor="asset-person">
          Assign to
        </label>
        <select
          id="asset-person"
          className="select"
          value={personId}
          onChange={(e) => setPersonId(e.target.value)}
        >
          <option value="">Select person…</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4">
        <label className="field__label" htmlFor="asset-name">
          Name
        </label>
        <input
          id="asset-name"
          className="input"
          value={name}
          placeholder="e.g. MacBook Pro 14-inch"
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="mt-4" style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <label className="field__label" htmlFor="asset-kind">
            Type
          </label>
          <input
            id="asset-kind"
            className="input"
            value={kind}
            placeholder="e.g. Laptop"
            onChange={(e) => setKind(e.target.value)}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label className="field__label" htmlFor="asset-serial">
            Serial number
          </label>
          <input
            id="asset-serial"
            className="input"
            value={serialNumber}
            placeholder="e.g. C02Z1234ABCD"
            onChange={(e) => setSerialNumber(e.target.value)}
          />
        </div>
      </div>

      <div className="row mt-4">
        <button className="btn btn--primary" type="submit" disabled={saving}>
          {saving ? 'Assigning…' : 'Assign asset'}
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
