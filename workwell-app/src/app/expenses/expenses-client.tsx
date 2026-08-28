'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHead, PlaneBadge, PrivacyNote } from '@/components/chrome'
import { fmtDate } from '@/lib/format-date'
import {
  RECEIPTS_BUCKET,
  RECEIPT_MAX_BYTES,
  RECEIPT_TYPES,
  signReceipts,
} from '@/lib/receipts'

type Claim = {
  id: string
  category: string
  amount: number
  spent_on: string
  note: string | null
  status: 'Submitted' | 'Approved' | 'Reimbursed' | 'Declined'
  receipt_path: string | null
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

  const [receipt, setReceipt] = useState<File | null>(null)
  const receiptRef = useRef<HTMLInputElement>(null)
  // path → signed URL. Signed in one batch per load rather than per row.
  const [receiptUrls, setReceiptUrls] = useState<Map<string, string>>(new Map())

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
        .select('id, category, amount, spent_on, note, status, receipt_path')
        .order('created_at', { ascending: false })
      if (cancelled) return
      if (error) {
        setLoadError(error.message)
        setLoading(false)
        return
      }

      const rows = (data ?? []) as Claim[]
      setClaims(rows)
      setLoading(false)

      const urls = await signReceipts(supabase, rows.map((r) => r.receipt_path))
      if (!cancelled) setReceiptUrls(urls)
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
    if (receipt) {
      if (!RECEIPT_TYPES.includes(receipt.type as (typeof RECEIPT_TYPES)[number]))
        return setError('A receipt must be a PNG, JPEG, WebP, or PDF.')
      if (receipt.size > RECEIPT_MAX_BYTES)
        return setError('Keep the receipt under 5MB.')
    }

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
      .select('id, category, amount, spent_on, note, status, receipt_path')
      .single()

    if (error) {
      setSending(false)
      return setError(error.message)
    }

    let claim = data as Claim

    // The claim goes in first and the file is named for it, because the
    // bucket's policy checks the object name against a real, undecided
    // claim of yours — there is nothing to attach a receipt to until the
    // claim exists. A claim whose receipt fails to upload is still a
    // claim: it is submitted either way, and saying so is more honest than
    // rolling back work the person has already done.
    if (receipt) {
      const path = `${personId}/${claim.id}`
      const { error: uploadError } = await supabase.storage
        .from(RECEIPTS_BUCKET)
        .upload(path, receipt, { upsert: true, contentType: receipt.type })

      if (uploadError) {
        setError(`Claim submitted, but the receipt did not upload: ${uploadError.message}`)
      } else {
        await supabase.from('expenses').update({ receipt_path: path }).eq('id', claim.id)
        claim = { ...claim, receipt_path: path }
        const urls = await signReceipts(supabase, [path])
        setReceiptUrls((m) => new Map([...m, ...urls]))
      }
    }

    setSending(false)
    setClaims((c) => [claim, ...c])
    setCategory(CATEGORIES[0])
    setAmount('')
    setDate('')
    setNote('')
    setReceipt(null)
    if (receiptRef.current) receiptRef.current.value = ''
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
                      <th scope="col">Receipt</th>
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
                          {c.receipt_path && receiptUrls.get(c.receipt_path) ? (
                            <a
                              href={receiptUrls.get(c.receipt_path)}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              View
                            </a>
                          ) : (
                            <span className="t-subtle" aria-label="No receipt attached">
                              —
                            </span>
                          )}
                        </td>
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

            {/* These two wrap rather than share a line, because in this
                column they cannot both be comfortable at once.

                A type="date" input's min-width:auto floor is its min-content,
                and the calendar chrome makes that around 205px — it will not
                shrink past it no matter what flex says. Tuning the ratio (the
                previous attempt here) therefore changed nothing: Date took its
                floor first and Amount was left with whatever remained, which
                in this ~385px column is under 175px. Giving both a basis wider
                than half the column makes the line break instead, so each
                field gets the column's full width and neither is squeezed.
                Side by side returns on its own wherever the column is wide
                enough to seat both. */}
            <div className="mt-4" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 220px' }}>
                <label className="field__label" htmlFor="eamt">Amount</label>
                <input id="eamt" className="input" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div style={{ flex: '1 1 220px' }}>
                <label className="field__label" htmlFor="edate">Date</label>
                <input id="edate" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>

            <div className="mt-4">
              <label className="field__label" htmlFor="enote">Note (optional)</label>
              <textarea id="enote" className="textarea" value={note} placeholder="What it was for." onChange={(e) => setNote(e.target.value)} />
            </div>

            <div className="mt-4">
              <label className="field__label" htmlFor="ercpt">Receipt (optional)</label>
              <input
                id="ercpt"
                ref={receiptRef}
                className="input"
                type="file"
                accept={RECEIPT_TYPES.join(',')}
                onChange={(e) => setReceipt(e.target.files?.[0] ?? null)}
              />
              <p className="t-subtle mt-2">
                Photo or PDF, up to 5MB. Can be replaced until HR decides.
              </p>
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
