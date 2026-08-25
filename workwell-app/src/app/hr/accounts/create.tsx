'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/** Every account created here is private-plane. There is exactly one HR
 *  account for the organisation, and this form is not how it is made — see
 *  the database migration that enforces that, not just this omission. */
type Row = {
  key: string
  fullName: string
  email: string
  emailTouched: boolean
  jobTitle: string
  jobTitleCustom: boolean
  department: string
  departmentCustom: boolean
}

function blankRow(): Row {
  return {
    key: crypto.randomUUID(),
    fullName: '',
    email: '',
    emailTouched: false,
    jobTitle: '',
    jobTitleCustom: false,
    department: '',
    departmentCustom: false,
  }
}

/** Every account created here shares one domain — there is no per-person
 *  inbox behind it to get right, since the password is handed over on
 *  screen rather than emailed. Change this if the org's real domain
 *  differs. */
const EMAIL_DOMAIN = 'workwell.com'

/** "Celine Nolasco" → "celine.nolasco". Kept editable rather than final:
 *  two people sharing a first and last name would otherwise collide
 *  silently, so this is a starting point HR can overwrite, not a promise. */
function emailFromName(fullName: string) {
  const slug = fullName
    .trim()
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .join('.')
  return slug ? `${slug}@${EMAIL_DOMAIN}` : ''
}

const JOB_TITLES = [
  'Software Engineer',
  'Product Manager',
  'Designer',
  'Data Analyst',
  'Marketing Specialist',
  'Sales Representative',
  'Customer Support Specialist',
  'HR Specialist',
  'Operations Manager',
  'Finance Analyst',
  'Recruiter',
  'Administrative Assistant',
]

const CUSTOM = '__custom__'

/** A select with an escape hatch. Job title and department both need one:
 *  a fixed list covers the common case, but nobody's list covers everyone,
 *  and a dropdown with no way out is worse than a plain text field. */
function PickOrCustom({
  idPrefix,
  label,
  value,
  custom,
  options,
  customOptionLabel,
  onChange,
  onToggleCustom,
  onCustomBlur,
}: {
  idPrefix: string
  label: string
  value: string
  custom: boolean
  options: string[]
  customOptionLabel: string
  onChange: (value: string) => void
  onToggleCustom: (custom: boolean) => void
  onCustomBlur?: (value: string) => void
}) {
  if (custom) {
    return (
      <div className="field" style={{ flex: 1, minWidth: 140 }}>
        <label className="field__label" htmlFor={idPrefix}>
          {label}
        </label>
        <input
          id={idPrefix}
          className="input"
          value={value}
          autoFocus
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => onCustomBlur?.(e.target.value)}
        />
        <button
          className="btn btn--ghost btn--sm mt-2"
          type="button"
          onClick={() => {
            onToggleCustom(false)
            onChange('')
          }}
        >
          Choose from list instead
        </button>
      </div>
    )
  }

  return (
    <div className="field" style={{ flex: 1, minWidth: 140 }}>
      <label className="field__label" htmlFor={idPrefix}>
        {label}
      </label>
      <select
        id={idPrefix}
        className="select"
        value={value}
        onChange={(e) => {
          if (e.target.value === CUSTOM) {
            onToggleCustom(true)
            onChange('')
          } else {
            onChange(e.target.value)
          }
        }}
      >
        <option value="">Select…</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
        <option value={CUSTOM}>{customOptionLabel}</option>
      </select>
    </div>
  )
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
      <h2 className="card__title mb-2">
        {made.length} account{made.length === 1 ? '' : 's'} created
      </h2>

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

export function CreateAccount({ departments = [] }: { departments?: string[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<Row[]>([blankRow()])
  const [customDepartments, setCustomDepartments] = useState<string[]>([])
  const departmentOptions = [...new Set([...departments, ...customDepartments])].sort()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<Result[] | null>(null)

  const canSubmit = rows.every((r) => r.fullName.trim() && r.email.trim())

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
            <h2 className="card__title">Add someone</h2>
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
      <h2 className="card__title mb-2">Create account{rows.length > 1 ? 's' : ''}</h2>
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
                onChange={(e) =>
                  updateRow(row.key, {
                    fullName: e.target.value,
                    // Auto-filled from the name until HR types into the
                    // email field directly — after that it is theirs to
                    // keep, since two people can share a name.
                    email: row.emailTouched ? row.email : emailFromName(e.target.value),
                  })
                }
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
                onChange={(e) =>
                  updateRow(row.key, { email: e.target.value, emailTouched: true })
                }
              />
              <span className="field__hint">
                Filled in from the name — edit it if two people would collide.
              </span>
            </div>

            <div className="row mt-3" style={{ gap: 'var(--s-3)' }}>
              <PickOrCustom
                idPrefix={`job-${row.key}`}
                label="Job title"
                value={row.jobTitle}
                custom={row.jobTitleCustom}
                options={JOB_TITLES}
                customOptionLabel="Custom title…"
                onChange={(v) => updateRow(row.key, { jobTitle: v })}
                onToggleCustom={(c) => updateRow(row.key, { jobTitleCustom: c })}
              />
              <PickOrCustom
                idPrefix={`dept-${row.key}`}
                label="Department"
                value={row.department}
                custom={row.departmentCustom}
                options={departmentOptions}
                customOptionLabel="+ Add department"
                onChange={(v) => updateRow(row.key, { department: v })}
                onToggleCustom={(c) => updateRow(row.key, { departmentCustom: c })}
                onCustomBlur={(v) => {
                  const name = v.trim()
                  if (name) setCustomDepartments((ds) => [...new Set([...ds, name])])
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <button className="btn btn--secondary btn--sm mt-3" type="button" onClick={addRow}>
        + Add another
      </button>

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
