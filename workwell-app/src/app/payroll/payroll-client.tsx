'use client'

import { useEffect, useState } from 'react'
import { PageHead, PlaneBadge, PrivacyNote } from '@/components/chrome'
import { createClient } from '@/lib/supabase/client'

type Payslip = { month: string; gross: number; net: number; status: string }
type Request = { id: string; kind: string; note: string; status: string }

const KINDS = ['Pay advance', 'Increment review', 'Payslip correction'] as const

function peso(n: number) {
  return `₱${n.toLocaleString('en-PH')}`
}

export default function PayrollClient() {
  const [payslips, setPayslips] = useState<Payslip[]>([])
  const [loading, setLoading] = useState(true)
  const [kind, setKind] = useState<string>(KINDS[0])
  const [note, setNote] = useState('')
  const [requests, setRequests] = useState<Request[]>([])
  const [error, setError] = useState<string|null>(null)

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('payslips').select('period_month, gross, net, status').order('period_month', { ascending: false }),
      supabase.from('payroll_requests').select('id, kind, note, status').order('created_at', { ascending: false })
    ]).then(([{ data: ps, error: e1 }, { data: sr, error: e2 }]) => {
      // Schema cache can be stale right after a deploy — treat as empty rather than a blocking error.
      const isCacheMiss = (e: { message?: string } | null) => e?.message?.includes('schema cache')
      if (e1 && !isCacheMiss(e1)) setError(e1.message)
      else if (ps) setPayslips(ps.map((r: { period_month: string; gross: number; net: number; status: string }) => ({ month: r.period_month.slice(0,7), gross: Number(r.gross ?? 0), net: Number(r.net ?? 0), status: r.status })))
      if (e2 && !isCacheMiss(e2)) setError(e2.message)
      else if (sr) setRequests(sr.map((r: { id: string; kind: string; note: string; status: string }) => ({ id: r.id, kind: r.kind, note: r.note ?? '', status: r.status })))
      setLoading(false)
    })
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!note.trim()) return setError('Please add a note — what you need and by when.')
    const supabase = createClient()
    const { data: me } = await supabase.from('me').select('id').maybeSingle()
    if (!me) return setError('Not linked to a person.')
    const { data, error } = await supabase.from('payroll_requests').insert({ person_id: me.id, kind, note: note.trim(), status: 'Pending' }).select('id, kind, note, status').single()
    if (error) {
      if (error.message.includes('schema cache')) return setError('Payroll is updating — please refresh and try again in a moment.')
      return setError(error.message)
    }
    if (data) setRequests((r) => [{ id: data.id, kind: data.kind, note: data.note ?? '', status: data.status }, ...r])
    setNote('')
  }

  return (
    <>
      <PageHead
        title="Payroll"
        lead="Payslips, advances, and increments or promotions — together, since they're all the same salary record."
      />
      <PlaneBadge plane="work" />

      <div className="grid grid--sidebar-right">
        <div className="stack">
          <div className="card card--flush">
            <div style={{ padding: 'var(--s-5) var(--s-5) var(--s-3)' }}>
              <div className="card__title">Payslip history</div>
            </div>
            {loading ? <p className="t-subtle" style={{ padding: '0 var(--s-5) var(--s-5)' }}>Loading…</p> : payslips.length === 0 ? <p className="t-subtle" style={{ padding: '0 var(--s-5) var(--s-5)' }}>No payslips yet.</p> : (
            <div className="table-scroll">
              <table className="data-table">
                <caption className="sr-only">Your payslips</caption>
                <thead>
                  <tr>
                    <th scope="col">Month</th>
                    <th scope="col">Gross</th>
                    <th scope="col">Net</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payslips.map((p) => (
                    <tr key={p.month}>
                      <th scope="row" style={{ fontWeight: 600 }}>{p.month}</th>
                      <td className="t-num">{peso(p.gross)}</td>
                      <td className="t-num">{peso(p.net)}</td>
                      <td>
                        <span className={p.status === 'available' ? 'chip chip--accent' : 'chip'}>
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>)}
            {error && <div className="banner banner--error" role="alert" style={{ margin: 'var(--s-3) var(--s-5)' }}>{error}</div>}
          </div>

          {requests.length > 0 && (
            <div className="card card--flush">
              <div style={{ padding: 'var(--s-5) var(--s-5) var(--s-3)' }}>
                <div className="card__title">Your requests</div>
              </div>
              <div className="table-scroll">
                <table className="data-table">
                  <caption className="sr-only">Your payroll requests</caption>
                  <tbody>
                    {requests.map((r) => (
                      <tr key={r.id}>
                        <th scope="row" style={{ fontWeight: 600 }}>{r.kind}</th>
                        <td>{r.note || '—'}</td>
                        <td><span className="chip">{r.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="stack">
          <form className="card" onSubmit={submit}>
            <div className="card__title">Request something</div>
            <p className="card__sub">Goes to payroll, not general HR.</p>

            <div className="mt-4">
              <label className="field__label" htmlFor="rkind">Type</label>
              <select
                id="rkind"
                className="select"
                value={kind}
                onChange={(e) => setKind(e.target.value)}
              >
                {KINDS.map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </div>

            <div className="mt-4">
              <label className="field__label" htmlFor="rnote">Note</label>
              <textarea
                id="rnote"
                className="textarea"
                value={note}
                placeholder="What you need, and by when."
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            <div className="mt-4">
              <button className="btn btn--primary" type="submit">Send request</button>
            </div>
          </form>
        </div>
      </div>

      <PrivacyNote
        plane="work"
        detail="Salary is the most sensitive record HR holds. This page needs its own, narrower access in practice — readable by the person it belongs to and by whoever actually runs payroll, nobody else, including other HR functions that don't need it."
      >
        <b>Needs its own, narrower access — not the general HR role.</b>{' '}
      </PrivacyNote>
    </>
  )
}
