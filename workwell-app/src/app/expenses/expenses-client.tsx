'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHead, PlaneBadge, PrivacyNote } from '@/components/chrome'
import { fmtDate } from '@/lib/format-date'

type Claim = {
  id: string
  category: string
  amount: number
  spent_on: string
  note: string | null
  status: 'Submitted' | 'Approved' | 'Reimbursed' | 'Declined'
}

const CATEGORIES = ['Travel', 'Meals', 'Equipment', 'Training', 'Other'] as const

function peso(n: number) {
  return `₱${n.toLocaleString('en-PH')}`
}

export default function ExpensesClient() {
  const [personId, setPersonId] = useState<string | null>(null)
  const [claims, setClaims] = useState<Claim[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [category, setCategory] = useState<string>(CATEGORIES[0])
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const { data: me, error: meError } = await supabase
        .from('me')
        .select('id')
        .maybeSingle()
      if (cancelled) return
      if (meError) {
        setLoadError(meError.message)
        setLoading(false)
        return
      }
      setPersonId(me?.id ?? null)

      const { data, error } = await supabase
        .from('expenses')
        .select('id, category, amount, spent_on, note, status')
        .order('created_at', { ascending: false })
      if (cancelled) return
      if (error) setLoadError(error.message)
      else setClaims((data ?? []) as Claim[])
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!personId) return setError('This account is not linked to a person yet.')
    const value = Number(amount)
    if (!amount || Number.isNaN(value) || value <= 0) return setError('Enter an amount greater than zero.')
    if (!date) return setError('Choose the date of the expense.')

    setSending(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('expenses')
      .insert({
        person_id: personId,
        category,
        amount: value,
        spent_on: date,
        note: note.trim() || null,
      })
      .select('id, category, amount, spent_on, note, status')
      .single()
    setSending(false)

    if (error) return setError(error.message)

    setClaims((c) => [data as Claim, ...c])
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
              <h2 className="card__title">Your claims</h2>
            </div>
            {loadError && (
              <div className="banner banner--error" style={{ margin: '0 var(--s-5) var(--s-5)' }} role="alert">
                {loadError}
              </div>
            )}
            {loading ? (
              <div style={{ padding: '0 var(--s-5) var(--s-5)' }}>
                <div className="skel skel--text" />
              </div>
            ) : claims.length === 0 ? (
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
                        <td>{fmtDate(c.spent_on)}</td>
                        <td className="t-num">{peso(c.amount)}</td>
                        <td>
                          <span className={c.status === 'Reimbursed' || c.status === 'Approved' ? 'chip chip--accent' : 'chip'}>
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
            <h2 className="card__title">Submit a claim</h2>
            <p className="card__sub">Goes to HR for approval.</p>

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
              {/* flex: 3/2 alone sets flex-basis:0%, so the 3:2 ratio only
                  governed growth from nothing — each field's default
                  min-width:auto then decided the real floor, and a
                  type="date" input's min-content (fixed calendar chrome)
                  can't shrink the way a number input's digits can. Date
                  was winning that floor fight and squeezing Amount down to
                  the reverse of the declared ratio. A real basis fixes it. */}
              <div style={{ flex: '3 1 160px', minWidth: 140 }}>
                <label className="field__label" htmlFor="eamt">Amount</label>
                <input id="eamt" className="input" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div style={{ flex: '2 1 140px' }}>
                <label className="field__label" htmlFor="edate">Date</label>
                <input id="edate" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>

            <div className="mt-4">
              <label className="field__label" htmlFor="enote">Note (optional)</label>
              <textarea id="enote" className="textarea" value={note} placeholder="What it was for." onChange={(e) => setNote(e.target.value)} />
            </div>

            <div className="mt-4">
              <button className="btn btn--primary" type="submit" disabled={sending}>
                {sending ? 'Sending…' : 'Submit claim'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <PrivacyNote
        plane="work"
        detail="A claim is visible to you and to HR of your organisation from the moment you submit it — the same access as leave requests. Nothing about it reaches the private plane, and nothing you record elsewhere (check-ins, mood, boundaries) is ever attached to a claim."
      >
        <b>Seen by HR the moment you submit it.</b>{' '}
      </PrivacyNote>
    </>
  )
}
