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
/** Which planes the new account gets. Deliberately not a checkbox: an
 *  unticked box is a default nobody chose, and the difference between these
 *  two is the difference between an account that can only see its own week
 *  and one that can see the whole directory. */
type Grant = 'private' | 'hr'

const GRANTS: Record<Grant, { title: string; word: string; desc: string }> = {
  private: {
    title: 'Private',
    word: 'private',
    desc: 'Their own check-ins, trends, nudges and leave. Nobody else can read any of it.',
  },
  hr: {
    title: 'HR',
    word: 'hr',
    desc: 'All of the above, plus the directory, leave decisions and group patterns. Still never anyone’s check-ins.',
  },
}

function Row({ req }: { req: AccessRequest }) {
  const router = useRouter()
  const [jobTitle, setJobTitle] = useState('')
  const [department, setDepartment] = useState('')
  const [grant, setGrant] = useState<Grant | null>(null)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<'approved' | 'declined' | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Case is not the point — deliberateness is. Someone who types "HR" has
  // read the word either way.
  const confirmed =
    grant !== null && typed.trim().toLowerCase() === GRANTS[grant].word

  async function decide(approve: boolean) {
    if (approve && !confirmed) return

    setBusy(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.rpc('decide_access_request', {
      p_request_id: req.id,
      p_approve: approve,
      p_job_title: jobTitle || null,
      p_department: department || null,
      p_is_hr: grant === 'hr',
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
              ? `${req.full_name} now has ${
                  grant === 'hr' ? 'HR' : 'private'
                } access.`
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

      <fieldset className="mt-4" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="field__label">What should this account be?</legend>
        <div className="stack stack--tight mt-2">
          {(Object.keys(GRANTS) as Grant[]).map((g) => (
            <label
              className={`pick${grant === g ? ' is-on' : ''}`}
              key={g}
              htmlFor={`grant-${g}-${req.id}`}
            >
              <input
                type="radio"
                id={`grant-${g}-${req.id}`}
                name={`grant-${req.id}`}
                checked={grant === g}
                onChange={() => {
                  setGrant(g)
                  setTyped('')
                }}
              />
              <span>
                <b>{GRANTS[g].title}</b>
                <span className="t-subtle" style={{ display: 'block' }}>
                  {GRANTS[g].desc}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Typing the word is the whole safeguard. Granting HR by mis-clicking
          a radio is the one mistake here that hands someone the directory,
          and it is silent — nothing looks wrong afterwards. */}
      {grant && (
        <div className="field mt-4">
          <label className="field__label" htmlFor={`confirm-${req.id}`}>
            Type <code>{GRANTS[grant].word}</code> to continue
          </label>
          <input
            id={`confirm-${req.id}`}
            className="input"
            value={typed}
            autoComplete="off"
            spellCheck={false}
            placeholder={GRANTS[grant].word}
            onChange={(e) => setTyped(e.target.value)}
          />
          <p className="field__hint">
            {grant === 'hr'
              ? 'This one sees every colleague’s employment record.'
              : 'Nobody, including you, will be able to read their check-ins.'}
          </p>
        </div>
      )}

      <div className="row mt-4">
        <button
          className="btn btn--primary btn--sm"
          disabled={busy || !confirmed}
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
