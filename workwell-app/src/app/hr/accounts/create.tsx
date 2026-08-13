'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/** Which planes a new account gets. Deliberately not a checkbox: an
 *  unticked box is a default nobody chose, and the difference between these
 *  two is the difference between an account that can only see its own week
 *  and one that can see the whole directory. */
type Grant = 'private' | 'hr'

const GRANTS: Record<Grant, { title: string; desc: string }> = {
  private: {
    title: 'Private',
    desc: 'Their own check-ins, trends, nudges and leave. Nobody else can read any of it.',
  },
  hr: {
    title: 'HR',
    desc: 'All of the above, plus the directory, leave decisions and group patterns. Still never anyone’s check-ins.',
  },
}

type Row = {
  key: string
  fullName: string
  email: string
  jobTitle: string
  department: string
  grant: Grant | null
}

function blankRow(): Row {
  return {
    key: crypto.randomUUID(),
    fullName: '',
    email: '',
    jobTitle: '',
    department: '',
    grant: null,
  }
}

type Result = {
  email: string
  fullName: string
  password?: string
  error?: string
}

function formatForCopy(results: Result[]) {
  return results
    .filter((r) => r.password)
    .map((r) => `${r.fullName} — ${r.email} — ${r.password}`)
    .join('\n')
}

/** Shows what came back for every row in the batch: a password for each
 *  account that was made, an error for each one that was not. Nothing here
 *  is stored anywhere else — this screen and the clipboard are the only
 *  copies of these passwords that will ever exist. */
function Results({ results, onDone }: { results: Result[]; onDone: () => void }) {
  const [copiedAll, setCopiedAll] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const made = results.filter((r) => r.password)
  const failed = results.filter((r) => !r.password)

  async function copy(text: string, mark: () => void) {
    try {
      await navigator.clipboard.writeText(text)
      mark()
    } catch {
      // Clipboard can be blocked. The text is on screen either way.
    }
  }

  return (
    <div className="card card--accent">
      <div className="card__title mb-2">
        {made.length} account{made.length === 1 ? '' : 's'} created
      </div>

      {made.length > 0 && (
        <>
          <button
            className="btn btn--secondary btn--sm mb-3"
            type="button"
            onClick={() => copy(formatForCopy(made), () => setCopiedAll(true))}
          >
            {copiedAll ? 'Copied' : `Copy all ${made.length} email${made.length === 1 ? '' : 's'} + passwords`}
          </button>

          <div className="stack stack--tight">
            {made.map((r) => (
              <div className="card card--quiet" key={r.email} style={{ margin: 0 }}>
                <b>{r.fullName}</b>
                <div className="row row--between mt-1" style={{ gap: 'var(--s-2)' }}>
                  <code style={{ fontSize: 'var(--fs-sm)' }}>
                    {r.email} — {r.password}
                  </code>
                  <button
                    className="btn btn--ghost btn--sm"
                    type="button"
                    onClick={() =>
                      copy(`${r.fullName} — ${r.email} — ${r.password}`, () => setCopiedKey(r.email))
                    }
                  >
                    {copiedKey === r.email ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <p className="field__hint mt-3">
            <b>Shown once.</b> Send each password however you normally would —
            they choose their own the first time they sign in.
          </p>
        </>
      )}

      {failed.length > 0 && (
        <div className="banner banner--error mt-3" role="alert">
          <b>{failed.length} did not get made:</b>
          <ul className="mt-1">
            {failed.map((r) => (
              <li key={r.email || r.fullName}>
                {r.fullName || r.email || 'One row'}: {r.error}
              </li>
            ))}
          </ul>
        </div>
      )}

      <button className="btn btn--primary btn--sm mt-4" type="button" onClick={onDone}>
        Done
      </button>
    </div>
  )
}

export function CreateAccount() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<Row[]>([blankRow()])
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<Result[] | null>(null)

  const anyHr = rows.some((r) => r.grant === 'hr')
  // Case is not the point — deliberateness is. Someone who types "HR" has
  // read the word either way. One confirmation for the whole batch: typing
  // it once per row would not make anyone more careful, just more tired.
  const hrConfirmed = !anyHr || typed.trim().toLowerCase() === 'hr'
  const rowsReady = rows.every((r) => r.fullName.trim() && r.email.trim() && r.grant !== null)
  const canSubmit = rowsReady && hrConfirmed

  function updateRow(key: string, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  function addRow() {
    setRows((rs) => [...rs, blankRow()])
  }

  function removeRow(key: string) {
    setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.key !== key) : rs))
  }

  function reset() {
    setRows([blankRow()])
    setTyped('')
    setError(null)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || busy) return

    setBusy(true)
    setError(null)

    let res: Response
    try {
      res = await fetch('/api/hr/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          accounts: rows.map((r) => ({
            email: r.email,
            fullName: r.fullName,
            jobTitle: r.jobTitle,
            department: r.department,
            isHr: r.grant === 'hr',
          })),
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
      setError(body.error ?? 'The accounts could not be created.')
      return
    }

    setResults(body.results)
    setOpen(false)
    reset()
    router.refresh()
  }

  if (results) {
    return <Results results={results} onDone={() => setResults(null)} />
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
      <div className="card__title mb-2">Create account{rows.length > 1 ? 's' : ''}</div>
      <p className="card__sub mb-4">
        Each gets a one-time password and must choose their own on first sign-in.
      </p>

      {error && (
        <div className="banner banner--error mb-4" role="alert">
          {error}
        </div>
      )}

      <div className="stack">
        {rows.map((row, i) => (
          <div className="card card--quiet" key={row.key} style={{ margin: 0 }}>
            <div className="row row--between">
              <b className="t-subtle">Person {i + 1}</b>
              {rows.length > 1 && (
                <button
                  className="btn btn--ghost btn--sm"
                  type="button"
                  onClick={() => removeRow(row.key)}
                >
                  Remove
                </button>
              )}
            </div>

            <div className="field mt-2">
              <label className="field__label" htmlFor={`name-${row.key}`}>
                Full name
              </label>
              <input
                id={`name-${row.key}`}
                className="input"
                value={row.fullName}
                required
                autoFocus={i === 0}
                onChange={(e) => updateRow(row.key, { fullName: e.target.value })}
              />
            </div>

            <div className="field mt-3">
              <label className="field__label" htmlFor={`email-${row.key}`}>
                Work email
              </label>
              <input
                id={`email-${row.key}`}
                className="input"
                type="email"
                autoComplete="off"
                spellCheck={false}
                value={row.email}
                required
                onChange={(e) => updateRow(row.key, { email: e.target.value })}
              />
            </div>

            <div className="row mt-3" style={{ gap: 'var(--s-3)' }}>
              <div className="field" style={{ flex: 1, minWidth: 140 }}>
                <label className="field__label" htmlFor={`job-${row.key}`}>
                  Job title
                </label>
                <input
                  id={`job-${row.key}`}
                  className="input"
                  value={row.jobTitle}
                  onChange={(e) => updateRow(row.key, { jobTitle: e.target.value })}
                />
              </div>
              <div className="field" style={{ flex: 1, minWidth: 140 }}>
                <label className="field__label" htmlFor={`dept-${row.key}`}>
                  Department
                </label>
                <input
                  id={`dept-${row.key}`}
                  className="input"
                  value={row.department}
                  onChange={(e) => updateRow(row.key, { department: e.target.value })}
                />
              </div>
            </div>

            <fieldset className="mt-3" style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="field__label">What should this account be?</legend>
              <div className="stack stack--tight mt-2">
                {(Object.keys(GRANTS) as Grant[]).map((g) => (
                  <label
                    className={`pick${row.grant === g ? ' is-on' : ''}`}
                    key={g}
                    htmlFor={`grant-${row.key}-${g}`}
                  >
                    <input
                      type="radio"
                      id={`grant-${row.key}-${g}`}
                      name={`grant-${row.key}`}
                      checked={row.grant === g}
                      onChange={() => updateRow(row.key, { grant: g })}
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
          </div>
        ))}
      </div>

      <button className="btn btn--secondary btn--sm mt-3" type="button" onClick={addRow}>
        + Add another
      </button>

      {/* One gate for the whole batch. Granting HR by mis-clicking a radio is
          the one mistake here that hands someone the directory, and it is
          silent — nothing looks wrong afterwards. */}
      {anyHr && (
        <div className="field mt-4">
          <label className="field__label" htmlFor="new-confirm">
            Type <code>hr</code> to continue — at least one of these accounts
            gets HR access
          </label>
          <input
            id="new-confirm"
            className="input"
            value={typed}
            autoComplete="off"
            spellCheck={false}
            placeholder="hr"
            onChange={(e) => setTyped(e.target.value)}
          />
        </div>
      )}

      <div className="row mt-5">
        <button className="btn btn--primary" type="submit" disabled={!canSubmit || busy}>
          {busy ? 'Creating…' : `Create ${rows.length} account${rows.length === 1 ? '' : 's'}`}
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
