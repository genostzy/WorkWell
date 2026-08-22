'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const CATEGORIES = ['Travel', 'Meals', 'Equipment', 'Software', 'Other'] as const

export function ClaimForm({ personId }: { personId: string | null }) {
  const router = useRouter()
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<string>('Travel')
  const [saving, setSaving] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!description.trim()) return setError('Describe what you spent on.')
    if (!amount || Number(amount) <= 0) return setError('Enter a valid amount.')
    if (!personId) return setError('This account is not linked to a person yet.')

    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('expenses').insert({
      person_id: personId,
      description: description.trim(),
      amount: Number(amount),
      category,
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
          <span>Claim submitted for review.</span>
        </div>
        <div className="mt-4">
          <button className="btn btn--secondary" onClick={() => {
            setSent(false)
            setDescription('')
            setAmount('')
            setCategory('Travel')
          }}>
            Submit another
          </button>
        </div>
      </div>
    )
  }

  return (
    <form className="card" onSubmit={submit}>
      <div className="card__title">Submit a claim</div>
      <p className="card__sub">Goes to HR for approval.</p>

      {error && (
        <div className="banner banner--error" role="alert">
          {error}
        </div>
      )}

      <div className="mt-4">
        <label className="field__label" htmlFor="edesc">
          Description
        </label>
        <input
          id="edesc"
          className="input"
          type="text"
          value={description}
          placeholder="What was this expense for?"
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="mt-4" style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <label className="field__label" htmlFor="eamount">
            Amount
          </label>
          <input
            id="eamount"
            className="input"
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            placeholder="0.00"
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label className="field__label" htmlFor="ecat">
            Category
          </label>
          <select
            id="ecat"
            className="select"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4">
        <button className="btn btn--primary btn--sm" type="submit" disabled={saving}>
          {saving ? 'Submitting…' : 'Submit claim'}
        </button>
      </div>
    </form>
  )
}
