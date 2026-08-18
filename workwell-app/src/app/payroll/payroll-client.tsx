'use client'

import { useState } from 'react'
import { PageHead, PlaneBadge, PrivacyNote } from '@/components/chrome'

type Payslip = { month: string; gross: number; net: number; status: 'Paid' | 'Processing' }
type Request = { id: string; kind: string; note: string; status: 'Pending' }

const PAYSLIPS: Payslip[] = [
  { month: 'July 2026', gross: 65000, net: 54200, status: 'Paid' },
  { month: 'June 2026', gross: 65000, net: 54200, status: 'Paid' },
  { month: 'May 2026', gross: 62000, net: 51900, status: 'Paid' },
  { month: 'April 2026', gross: 62000, net: 51900, status: 'Paid' },
]

const KINDS = ['Pay advance', 'Increment review', 'Payslip correction'] as const

function peso(n: number) {
  return `₱${n.toLocaleString('en-PH')}`
}

export default function PayrollClient() {
  const [kind, setKind] = useState<string>(KINDS[0])
  const [note, setNote] = useState('')
  const [requests, setRequests] = useState<Request[]>([])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setRequests((r) => [{ id: crypto.randomUUID(), kind, note: note.trim(), status: 'Pending' }, ...r])
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
                  {PAYSLIPS.map((p) => (
                    <tr key={p.month}>
                      <th scope="row" style={{ fontWeight: 600 }}>{p.month}</th>
                      <td className="t-num">{peso(p.gross)}</td>
                      <td className="t-num">{peso(p.net)}</td>
                      <td>
                        <span className={p.status === 'Paid' ? 'chip chip--accent' : 'chip'}>
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
