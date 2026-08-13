'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

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

/** Confirms the invite went out. No password ever passes through here — the
 *  employee sets their own by following the link in their inbox. */
function Sent({ name, email, onDone }: { name: string; email: string; onDone: () => void }) {
  return (
    <div className="card card--accent">
      <div className="card__title mb-2">Invite sent</div>
      <p className="t-subtle">
        {name} will get an email at <b>{email}</b> to set their password and
        sign in.
      </p>
      <button className="btn btn--primary btn--sm mt-4" type="button" onClick={onDone}>
        Done
      </button>
    </div>
  )
}

export function CreateAccount() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [department, setDepartment] = useState('')
  const [grant, setGrant] = useState<Grant | null>(null)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<{ name: string; email: string } | null>(null)

  // Case is not the point — deliberateness is. Someone who types "HR" has
  // read the word either way.
  const confirmed =
    grant !== null && typed.trim().toLowerCase() === GRANTS[grant].word

  function reset() {
    setFullName('')
    setEmail('')
    setJobTitle('')
    setDepartment('')
    setGrant(null)
    setTyped('')
    setError(null)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!confirmed || busy) return

    setBusy(true)
    setError(null)

    let res: Response
    try {
      res = await fetch('/api/hr/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          email,
          fullName,
          jobTitle,
          department,
          isHr: grant === 'hr',
        }),
      })
    } catch {
      setBusy(false)
      setError('Could not reach the server. Check your connection and try again.')
      return
    }

    const body = await res.json().catch(() => ({}))
    setBusy(false)

    if (!res.ok) {
      setError(body.error ?? 'The account could not be created.')
      return
    }

    setSent({ name: fullName, email: body.email })
    setOpen(false)
    reset()
    router.refresh()
  }

  if (sent) {
    return <Sent name={sent.name} email={sent.email} onDone={() => setSent(null)} />
  }

  if (!open) {
    return (
      <div className="card">
        <div className="card__head">
          <div>
            <div className="card__title">Add someone</div>
            <div className="card__sub">
              You create the account. Nobody can sign themselves up.
            </div>
          </div>
        </div>
        <button
          className="btn btn--primary btn--sm mt-3"
          type="button"
          onClick={() => setOpen(true)}
        >
          Create account
        </button>
      </div>
    )
  }

  return (
    <form className="card" onSubmit={submit}>
      <div className="card__title mb-2">Create account</div>
      <p className="card__sub mb-4">They get an email to set their password.</p>

      {error && (
        <div className="banner banner--error mb-4" role="alert">
          {error}
        </div>
      )}

      <div className="field">
        <label className="field__label" htmlFor="new-name">
          Full name
        </label>
        <input
          id="new-name"
          className="input"
          value={fullName}
          required
          autoFocus
          onChange={(e) => setFullName(e.target.value)}
        />
      </div>

      <div className="field mt-4">
        <label className="field__label" htmlFor="new-email">
          Work email
        </label>
        <input
          id="new-email"
          className="input"
          type="email"
          autoComplete="off"
          spellCheck={false}
          value={email}
          required
          onChange={(e) => setEmail(e.target.value)}
        />
        <span className="field__hint">
          This is what they sign in with. It cannot be changed here later.
        </span>
      </div>

      <div className="row mt-4" style={{ gap: 'var(--s-3)' }}>
        <div className="field" style={{ flex: 1, minWidth: 140 }}>
          <label className="field__label" htmlFor="new-job">
            Job title
          </label>
          <input
            id="new-job"
            className="input"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
          />
        </div>
        <div className="field" style={{ flex: 1, minWidth: 140 }}>
          <label className="field__label" htmlFor="new-dept">
            Department
          </label>
          <input
            id="new-dept"
            className="input"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          />
        </div>
      </div>
      <span className="field__hint">
        Both are needed for them to appear in a group on Structural load — a
        person with no department never joins a cohort.
      </span>

      <fieldset className="mt-4" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="field__label">What should this account be?</legend>
        <div className="stack stack--tight mt-2">
          {(Object.keys(GRANTS) as Grant[]).map((g) => (
            <label
              className={`pick${grant === g ? ' is-on' : ''}`}
              key={g}
              htmlFor={`new-grant-${g}`}
            >
              <input
                type="radio"
                id={`new-grant-${g}`}
                name="new-grant"
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
          <label className="field__label" htmlFor="new-confirm">
            Type <code>{GRANTS[grant].word}</code> to continue
          </label>
          <input
            id="new-confirm"
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

      <div className="row mt-5">
        <button
          className="btn btn--primary"
          type="submit"
          disabled={!confirmed || busy}
        >
          {busy ? 'Creating…' : 'Create account'}
        </button>
        <button
          className="btn btn--ghost"
          type="button"
          onClick={() => {
            setOpen(false)
            reset()
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
