'use client'

import Link from 'next/link'
import { useState } from 'react'
import { PageHead, PlaneBadge, PrivacyNote } from '@/components/chrome'

type Case = { id: string; summary: string; status: 'Submitted' | 'In review' | 'Resolved' }

export default function ComplaintsClient() {
  const [cases, setCases] = useState<Case[]>([])
  const [summary, setSummary] = useState('')
  const [error, setError] = useState<string | null>(null)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!summary.trim()) return setError('Say what happened, even briefly.')
    setError(null)
    setCases((c) => [{ id: crypto.randomUUID(), summary: summary.trim(), status: 'Submitted' }, ...c])
    setSummary('')
  }

  return (
    <>
      <PageHead
        title="Complaints"
        lead="A formal grievance, tracked as a case rather than a message."
      />
      <PlaneBadge plane="work" />

      <div className="banner banner--info mb-5" role="note">
        <span aria-hidden="true">💬</span>
        <span>
          <Link href="/recognition">Recognition &amp; connection</Link> already has a
          private, withdrawable way to ask HR or an external service for support —
          worth using that first if this doesn&apos;t need to be formal.
        </span>
      </div>

      <div className="grid grid--sidebar-right">
        <div className="stack">
          <div className="card card--flush">
            <div style={{ padding: 'var(--s-5) var(--s-5) var(--s-3)' }}>
              <h2 className="card__title">Your cases</h2>
            </div>
            {cases.length === 0 ? (
              <p className="t-subtle" style={{ padding: '0 var(--s-5) var(--s-5)' }}>
                Nothing filed.
              </p>
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <caption className="sr-only">Your complaint cases</caption>
                  <tbody>
                    {cases.map((c) => (
                      <tr key={c.id}>
                        <td>{c.summary}</td>
                        <td><span className="chip">{c.status}</span></td>
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
            <h2 className="card__title">File a case</h2>
            <p className="card__sub">Goes to HR as a tracked case, not a chat message.</p>

            {error && <div className="banner banner--error" role="alert">{error}</div>}

            <div className="mt-4">
              <label className="field__label" htmlFor="csum">What happened</label>
              <textarea
                id="csum"
                className="textarea"
                value={summary}
                placeholder="As much detail as you're comfortable giving."
                onChange={(e) => setSummary(e.target.value)}
              />
            </div>

            <div className="mt-4">
              <button className="btn btn--primary" type="submit">File case</button>
            </div>
          </form>
        </div>
      </div>

      <PrivacyNote
        plane="work"
        detail="A case is visible to HR from the moment you file it — there's no private, HR-only-on-request path here the way Recognition & connection has. Nothing you track privately (check-ins, mood, boundaries) is ever attached to a case."
      >
        <b>Goes straight to HR — not anonymous.</b>{' '}
      </PrivacyNote>
    </>
  )
}
