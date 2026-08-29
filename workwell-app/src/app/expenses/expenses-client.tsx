'use client'

import { useEffect, useState } from 'react'
import { PageHead, PlaneBadge } from '@/components/chrome'
import { createClient } from '@/lib/supabase/client'
import { fmtDate } from '@/lib/format-date'

type Claim = {
  id: string
  category: string
  amount: number
  date: string
  note: string
  status: string
}

const CATEGORIES = ['Travel', 'Meals', 'Equipment', 'Training', 'Other'] as const

function peso(n: number) {
  return `₱${n.toLocaleString('en-PH')}`
}

export default function ExpensesClient() {
  const [claims, setClaims] = useState<Claim[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState<string>(CATEGORIES[0])
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('expenses').select('id, category, amount, created_at, description, status').order('created_at', { ascending: false }).then(({ data, error }) => {
      if (error) setError(error.message)
      else if (data) setClaims(data.map((r: { id: string; category: string; amount: number; created_at: string; description: string; status: string }) => ({ id: r.id, category: r.category, amount: Number(r.amount), date: r.created_at.slice(0,10), note: r.description, status: r.status })))
      setLoading(false)
    })
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const value = Number(amount)
    if (!amount || Number.isNaN(value) || value <= 0) return setError('Enter an amount greater than zero.')
    if (!date) return setError('Choose the date of the expense.')

    const supabase = createClient()
    const { data: me } = await supabase.from('me').select('id').maybeSingle()
    if (!me) return setError('Not linked to a person.')
    const { data, error } = await supabase.from('expenses').insert({ person_id: me.id, category, amount: value, description: note.trim() || category, status: 'pending' }).select('id, category, amount, created_at, description, status').single()
    if (error) return setError(error.message)
    if (data) setClaims((c) => [{ id: data.id, category: data.category, amount: Number(data.amount), date: data.created_at.slice(0,10), note: data.description, status: data.status }, ...c])
    setCategory(CATEGORIES[0])
    setAmount('')
    setDate('')
    setNote('')
    setSent(true)
  }

  return (
    <>
      <PageHead title="Expenses" lead="Claim something back, and see where it stands." />
      <PlaneBadge plane="work" />

      <div className="grid grid--sidebar-right">
        <div className="stack">
          <div className="card card--flush">
            <div style={{ padding: 'var(--s-5) var(--s-5) var(--s-3)' }}>
              <div className="card__title">Your claims</div>
            </div>
            {claims.length === 0 ? (
              <p className="t-subtle" style={{ padding: '0 var(--s-5) var(--s-5)' }}>
                Nothing claimed yet.
              </p>
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <caption className="sr-only">Your expense claims</caption>
                  <thead>
                    <tr>
                      <th scope="col">Category</th>
                      <th scope="col">Date</th>
                      <th scope="col">Amount</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {claims.map((c) => (
                      <tr key={c.id}>
                        <th scope="row" style={{ fontWeight: 600 }}>{c.category}</th>
                        <td>{fmtDate(c.date)}</td>
                        <td className="t-num">{peso(c.amount)}</td>
                        <td>
                          <span className={c.status === 'Reimbursed' ? 'chip chip--accent' : 'chip'}>
                            {c.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="stack">
          <form className="card" onSubmit={submit}>
            <div className="card__title">Submit a claim</div>
            <p className="card__sub">Goes to your manager for approval.</p>

            {error && (
              <div className="banner banner--error" role="alert">{error}</div>
            )}
            {sent && !error && (
              <div className="confirmed mt-3" role="status">
                <span aria-hidden="true">✓</span>
                <span>Claim submitted.</span>
              </div>
            )}

            <div className="mt-4">
              <label className="field__label" htmlFor="ecat">Category</label>
              <select id="ecat" className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>

            <div className="mt-4" style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 3 }}>
                <label className="field__label" htmlFor="eamt">Amount</label>
                <input id="eamt" className="input" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div style={{ flex: 2 }}>
                <label className="field__label" htmlFor="edate">Date</label>
                <input id="edate" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>

            <div className="mt-4">
              <label className="field__label" htmlFor="enote">Note (optional)</label>
              <textarea id="enote" className="textarea" value={note} placeholder="What it was for." onChange={(e) => setNote(e.target.value)} />
            </div>

            <div className="mt-4">
              <button className="btn btn--primary" type="submit">Submit claim</button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
