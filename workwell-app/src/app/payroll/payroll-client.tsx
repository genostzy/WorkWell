'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHead, PlaneBadge, PrivacyNote } from '@/components/chrome'

type Payslip = {
  id: string
  period_month: string
  gross: number
  net: number
  status: 'Processing' | 'Paid'
}
type Request = {
  id: string
  kind: string
  note: string
  status: 'Pending' | 'Reviewing' | 'Resolved' | 'Declined'
}

const KINDS = ['Pay advance', 'Increment review', 'Payslip correction'] as const

function peso(n: number) {
  return `₱${n.toLocaleString('en-PH')}`
}

function monthLabel(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  })
}

export default function PayrollClient() {
  const [personId, setPersonId] = useState<string | null>(null)
  const [payslips, setPayslips] = useState<Payslip[]>([])
  const [requests, setRequests] = useState<Request[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [kind, setKind] = useState<string>(KINDS[0])
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

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

      const [{ data: slips, error: slipsError }, { data: reqs, error: reqsError }] =
        await Promise.all([
          supabase
            .from('payslips')
            .select('id, period_month, gross, net, status')
            .order('period_month', { ascending: false }),
          supabase
            .from('payroll_requests')
            .select('id, kind, note, status')
            .order('created_at', { ascending: false }),
        ])
      if (cancelled) return
      if (slipsError ?? reqsError) setLoadError((slipsError ?? reqsError)!.message)
      setPayslips((slips ?? []) as Payslip[])
      setRequests((reqs ?? []) as Request[])
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
    if (!note.trim()) return setError('Say what you need.')

    setSending(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('payroll_requests')
      .insert({ person_id: personId, kind, note: note.trim() })
      .select('id, kind, note, status')
      .single()
    setSending(false)

    if (error) return setError(error.message)

    setRequests((r) => [data as Request, ...r])
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
              <h2 className="card__title">Payslip history</h2>
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
            ) : payslips.length === 0 ? (
              <p className="t-subtle" style={{ padding: '0 var(--s-5) var(--s-5)' }}>
                Nothing issued yet.
              </p>
            ) : (
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
                      <tr key={p.id}>
                        <th scope="row" style={{ fontWeight: 600 }}>{monthLabel(p.period_month)}</th>
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
            )}
          </div>

          {requests.length > 0 && (
            <div className="card card--flush">
              <div style={{ padding: 'var(--s-5) var(--s-5) var(--s-3)' }}>
                <h2 className="card__title">Your requests</h2>
              </div>
              <div className="table-scroll">
                <table className="data-table">
                  <caption className="sr-only">Your payroll requests</caption>
                  <tbody>
                    {requests.map((r) => (
                      <tr key={r.id}>
                        <th scope="row" style={{ fontWeight: 600 }}>{r.kind}</th>
                        <td>{r.note || '—'}</td>
                        <td><span className={r.status === 'Resolved' ? 'chip chip--accent' : 'chip'}>{r.status}</span></td>
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
            <h2 className="card__title">Request something</h2>
            <p className="card__sub">Goes to HR — there&rsquo;s no separate payroll-only role yet.</p>

            {error && (
              <div className="banner banner--error" role="alert">{error}</div>
            )}

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
              <button className="btn btn--primary" type="submit" disabled={sending}>
                {sending ? 'Sending…' : 'Send request'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <PrivacyNote
        plane="work"
        detail="Salary is the most sensitive record HR holds, and this page's access hasn't actually been narrowed yet — it's read by you and by HR under the same general HR role as every other work-plane record, not a separate payroll-only account. A narrower role is real future work, not something to claim is already true."
      >
        <b>Same HR access as the rest of this plane — not narrowed yet.</b>{' '}
      </PrivacyNote>
    </>
  )
}
