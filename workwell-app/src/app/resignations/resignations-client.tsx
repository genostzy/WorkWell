'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHead, PlaneBadge, PrivacyNote } from '@/components/chrome'
import { ConfirmButton } from '@/components/controls'
import { fmtDate } from '@/lib/format-date'

type Resignation = {
  id: string
  last_day: string
  status: 'Submitted' | 'Acknowledged' | 'Withdrawn'
}

export default function ResignationsClient() {
  const [personId, setPersonId] = useState<string | null>(null)
  const [current, setCurrent] = useState<Resignation | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [lastDay, setLastDay] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const { data: me, error: meError } = await supabase.from('me').select('id').maybeSingle()
      if (cancelled) return
      if (meError) {
        setLoadError(meError.message)
        setLoading(false)
        return
      }
      setPersonId(me?.id ?? null)

      const { data, error } = await supabase
        .from('resignations')
        .select('id, last_day, status')
        .neq('status', 'Withdrawn')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (cancelled) return
      if (error) setLoadError(error.message)
      setCurrent((data as Resignation) ?? null)
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
    if (!lastDay) return setError('Choose your proposed last day.')

    setSending(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('resignations')
      .insert({ person_id: personId, last_day: lastDay, reason: reason.trim() || null })
      .select('id, last_day, status')
      .single()
    setSending(false)

    if (error) return setError(error.message)
    setCurrent(data as Resignation)
  }

  async function withdraw() {
    if (!current) return
    setWithdrawing(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('resignations')
      .update({ status: 'Withdrawn' })
      .eq('id', current.id)
    setWithdrawing(false)

    if (error) return setLoadError(error.message)
    setCurrent(null)
    setLastDay('')
    setReason('')
  }

  if (loading) {
    return (
      <>
        <PageHead title="Resignations" lead="Hand in notice, and see where it stands." />
        <PlaneBadge plane="work" />
        <div className="card">
          <div className="skel skel--text" />
        </div>
      </>
    )
  }

  if (current) {
    return (
      <>
        <PageHead title="Resignations" lead="Hand in notice, and see where it stands." />
        <PlaneBadge plane="work" />

        {loadError && (
          <div className="banner banner--error mb-5" role="alert">
            {loadError}
          </div>
        )}

        <div className="card">
          <h2 className="card__title mb-3">Notice submitted</h2>
          <div className="table-scroll">
            <table className="data-table">
              <caption className="sr-only">Resignation status</caption>
              <tbody>
                <tr>
                  <th scope="row" style={{ fontWeight: 600 }}>Submitted</th>
                  <td><span className="chip chip--accent">Done</span></td>
                </tr>
                <tr>
                  <th scope="row" style={{ fontWeight: 600 }}>Acknowledged by HR</th>
                  <td>
                    <span className={current.status === 'Acknowledged' ? 'chip chip--accent' : 'chip'}>
                      {current.status === 'Acknowledged' ? 'Done' : 'Pending'}
                    </span>
                  </td>
                </tr>
                <tr>
                  <th scope="row" style={{ fontWeight: 600 }}>Last day agreed</th>
                  <td>
                    {fmtDate(current.last_day, { day: 'numeric', month: 'long', year: 'numeric' })}{' '}
                    <span className="t-subtle">(proposed)</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          {current.status === 'Submitted' && (
            <ConfirmButton
              label="Withdraw notice"
              confirmLabel="Withdraw"
              className="btn btn--secondary mt-4"
              onConfirm={withdraw}
              disabled={withdrawing}
            />
          )}
        </div>

        <PrivacyNote
          plane="work"
          detail="Notice goes to your manager and HR together the moment you submit it — there's no draft or private stage. The reason field is optional and stays off the record if you leave it blank; nothing here touches the private plane."
        >
          <b>Sent to your manager and HR immediately.</b>{' '}
        </PrivacyNote>
      </>
    )
  }

  return (
    <>
      <PageHead title="Resignations" lead="Hand in notice, and see where it stands." />
      <PlaneBadge plane="work" />

      <form className="card" onSubmit={submit}>
        <h2 className="card__title">Give notice</h2>
        <p className="card__sub">Sent to your manager and HR together.</p>

        {error && <div className="banner banner--error" role="alert">{error}</div>}

        <div className="mt-4">
          <label className="field__label" htmlFor="rday">Proposed last day</label>
          <input id="rday" className="input" type="date" value={lastDay} onChange={(e) => setLastDay(e.target.value)} />
        </div>

        <div className="mt-4">
          <label className="field__label" htmlFor="rreason">Reason (optional)</label>
          <textarea
            id="rreason"
            className="textarea"
            value={reason}
            placeholder="Shared with HR only if you want to."
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        <div className="mt-4">
          <button className="btn btn--primary" type="submit" disabled={sending}>
            {sending ? 'Sending…' : 'Submit notice'}
          </button>
        </div>
      </form>

      <PrivacyNote
        plane="work"
        detail="Notice goes to your manager and HR together the moment you submit it — there's no draft or private stage. The reason field is optional and stays off the record if you leave it blank; nothing here touches the private plane."
      >
        <b>Sent to your manager and HR immediately.</b>{' '}
      </PrivacyNote>
    </>
  )
}
