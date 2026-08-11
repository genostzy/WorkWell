'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export type AccessRequest = {
  id: string
  email: string
  full_name: string
  note: string | null
  created_at: string
}

/** One pending request, with the detail HR fills in while approving.
 *  Job title and department are asked for here rather than later because a
 *  person with no department never appears in any cohort, and would sit
 *  invisibly outside the org dashboard. */
function Row({ req }: { req: AccessRequest }) {
  const router = useRouter()
  const [jobTitle, setJobTitle] = useState('')
  const [department, setDepartment] = useState('')
  const [isHr, setIsHr] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<'approved' | 'declined' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function decide(approve: boolean) {
    setBusy(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.rpc('decide_access_request', {
      p_request_id: req.id,
      p_approve: approve,
      p_job_title: jobTitle || null,
      p_department: department || null,
      p_is_hr: isHr,
    })

    setBusy(false)
    if (error) setError(error.message)
    else {
      setDone(approve ? 'approved' : 'declined')
      router.refresh()
    }
  }

  if (done) {
    return (
      <div className="card card--quiet" style={{ margin: 0 }}>
        <p className="confirmed" role="status">
          <span aria-hidden="true">✓</span>
          <span>
            {done === 'approved'
              ? `${req.full_name} now has access.`
              : `${req.full_name} was not approved.`}
          </span>
        </p>
      </div>
    )
  }

  return (
    <div className="card card--quiet" style={{ margin: 0 }}>
      <div className="row row--between">
        <b>{req.full_name}</b>
        <span className="chip">
          {new Date(req.created_at).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
          })}
        </span>
      </div>
      <p className="t-subtle mt-2">{req.email}</p>
      {req.note && <p className="t-subtle">“{req.note}”</p>}

      {error && (
        <div className="banner banner--error mt-3" role="alert">
          {error}
        </div>
      )}

      <div className="row mt-4" style={{ gap: 'var(--s-3)' }}>
        <div className="field" style={{ flex: 1, minWidth: 140 }}>
          <label className="field__label" htmlFor={`job-${req.id}`}>
            Job title
          </label>
          <input
            id={`job-${req.id}`}
            className="input"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
          />
        </div>
        <div className="field" style={{ flex: 1, minWidth: 140 }}>
          <label className="field__label" htmlFor={`dept-${req.id}`}>
            Department
          </label>
          <input
            id={`dept-${req.id}`}
            className="input"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          />
        </div>
      </div>

      <label className="row mt-3" style={{ gap: 'var(--s-2)' }}>
        <input
          type="checkbox"
          checked={isHr}
          onChange={(e) => setIsHr(e.target.checked)}
        />
        <span className="t-subtle">
          Also give them HR access — they will see the directory and group
          patterns, never anyone’s check-ins
        </span>
      </label>

      <div className="row mt-4">
        <button
          className="btn btn--primary btn--sm"
          disabled={busy}
          onClick={() => decide(true)}
        >
          Approve
        </button>
        <button
          className="btn btn--secondary btn--sm"
          disabled={busy}
          onClick={() => decide(false)}
        >
          Decline
        </button>
      </div>
    </div>
  )
}

export function AccessRequests({ requests }: { requests: AccessRequest[] }) {
  if (requests.length === 0) {
    return (
      <div className="card">
        <div className="card__head">
          <div>
            <div className="card__title">Access requests</div>
            <div className="card__sub">People asking to join</div>
          </div>
        </div>
        <p className="t-subtle">Nobody is waiting.</p>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="card__head">
        <div>
          <div className="card__title">Access requests</div>
          <div className="card__sub">
            {requests.length} waiting on a decision
          </div>
        </div>
        <span className="chip chip--accent">{requests.length}</span>
      </div>
      <p className="t-subtle mb-4">
        Approving creates their record and links the account they already
        signed in with — they will not need to sign in again.
      </p>
      <div className="stack">
        {requests.map((r) => (
          <Row key={r.id} req={r} />
        ))}
      </div>
    </div>
  )
}
