'use client'

import { useState } from 'react'
import { PageHead, PlaneBadge, PrivacyNote } from '@/components/chrome'
import { ConfirmButton } from '@/components/controls'
import { fmtDate } from '@/lib/format-date'

export default function ResignationsClient() {
  const [lastDay, setLastDay] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<{ lastDay: string } | null>(null)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!lastDay) return setError('Choose your proposed last day.')
    setError(null)
    setSent({ lastDay })
  }

  if (sent) {
    return (
      <>
        <PageHead title="Resignations" lead="Hand in notice, and see where it stands." />
        <PlaneBadge plane="work" />

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
                  <td><span className="chip">Pending</span></td>
                </tr>
                <tr>
                  <th scope="row" style={{ fontWeight: 600 }}>Last day agreed</th>
                  <td>
                    {fmtDate(sent.lastDay, { day: 'numeric', month: 'long', year: 'numeric' })}{' '}
                    <span className="t-subtle">(proposed)</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <ConfirmButton
            label="Withdraw notice"
            confirmLabel="Withdraw"
            className="btn btn--secondary mt-4"
            onConfirm={() => setSent(null)}
          />
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
          <button className="btn btn--primary" type="submit">Submit notice</button>
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
