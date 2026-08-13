'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export type Account = {
  id: string
  full_name: string
  status: string
  isHr: boolean
  jobTitle: string | null
  department: string | null
  isSelf: boolean
}

/** The two consequential changes, each behind the word that names it.
 *
 *  Same safeguard as approving a request, for the same reason: granting HR
 *  by a mis-click hands someone the whole directory, and closing an account
 *  by a mis-click locks a colleague out of their own week. Neither looks
 *  wrong afterwards, so neither gets a bare button. */
type Action = 'hr' | 'private' | 'close' | 'reopen' | 'reset'

const WORD: Record<Action, string> = {
  hr: 'hr',
  private: 'private',
  close: 'close',
  reopen: 'reopen',
  reset: 'reset',
}

const ASKS: Record<Action, string> = {
  hr: 'They will see every colleague’s employment record and the group patterns. Never anyone’s check-ins.',
  private: 'They keep their own private plane and lose the directory, leave decisions and group patterns.',
  close: 'They stop being able to open WorkWell. Their own check-ins are not deleted — they are theirs, and closing an account is not permission to destroy them.',
  reopen: 'They can open WorkWell again, with whatever access they had.',
  reset: 'Their current password stops working immediately, and they choose a new one the next time they sign in. Nothing they have recorded is touched.',
}

function Confirm({
  action,
  person,
  onCancel,
  onDone,
  onPassword,
}: {
  action: Action
  person: Account
  onCancel: () => void
  onDone: () => void
  onPassword: (password: string) => void
}) {
  const router = useRouter()
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const word = WORD[action]
  const ok = typed.trim().toLowerCase() === word

  async function run() {
    if (!ok) return
    setBusy(true)
    setError(null)

    // A reset needs the Admin API, so it goes through the route that holds
    // the service-role key rather than straight at the database like the
    // other three.
    if (action === 'reset') {
      let res: Response
      try {
        res = await fetch('/api/hr/accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'reset', personId: person.id }),
        })
      } catch {
        setBusy(false)
        setError('Could not reach the server. Check your connection.')
        return
      }
      const body = await res.json().catch(() => ({}))
      setBusy(false)
      if (!res.ok) {
        setError(body.error ?? 'The password could not be reset.')
        return
      }
      onPassword(body.password)
      router.refresh()
      return
    }

    const supabase = createClient()
    const { error } =
      action === 'hr' || action === 'private'
        ? await supabase.rpc('set_person_access', {
            p_person_id: person.id,
            p_is_hr: action === 'hr',
          })
        : await supabase.rpc('set_person_status', {
            p_person_id: person.id,
            p_status: action === 'close' ? 'left' : 'active',
          })

    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    onDone()
    router.refresh()
  }

  return (
    <div className="card card--quiet mt-3" style={{ margin: 0 }}>
      <p className="t-subtle">{ASKS[action]}</p>

      {error && (
        <div className="banner banner--error mt-3" role="alert">
          {error}
        </div>
      )}

      <div className="field mt-3">
        <label className="field__label" htmlFor={`c-${action}-${person.id}`}>
          Type <code>{word}</code> to continue
        </label>
        <input
          id={`c-${action}-${person.id}`}
          className="input"
          value={typed}
          autoFocus
          autoComplete="off"
          spellCheck={false}
          placeholder={word}
          onChange={(e) => setTyped(e.target.value)}
        />
      </div>

      <div className="row mt-3">
        <button
          className="btn btn--primary btn--sm"
          type="button"
          disabled={!ok || busy}
          onClick={run}
        >
          {busy ? 'Saving…' : 'Confirm'}
        </button>
        <button
          className="btn btn--ghost btn--sm"
          type="button"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function Manage({ person }: { person: Account }) {
  const [action, setAction] = useState<Action | null>(null)
  const [password, setPassword] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // You cannot change your own access or close your own account. The
  // database refuses both, so this is not the guard — it is the reason the
  // buttons are not there to press.
  if (person.isSelf) {
    return <span className="t-subtle">This is you</span>
  }

  if (password) {
    return (
      <div className="card card--accent mt-3" style={{ margin: 0 }}>
        <div className="card__title mb-2">New temporary password</div>
        <div className="row" style={{ gap: 'var(--s-2)' }}>
          <code className="input" style={{ flex: 1, letterSpacing: '0.04em' }}>
            {password}
          </code>
          <button
            className="btn btn--secondary btn--sm"
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(password)
                setCopied(true)
              } catch {
                setCopied(false)
              }
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <p className="field__hint mt-3">
          <b>Shown once.</b> {person.full_name} chooses their own the next
          time they sign in.
        </p>
        <button
          className="btn btn--primary btn--sm mt-3"
          type="button"
          onClick={() => {
            setPassword(null)
            setCopied(false)
            setAction(null)
          }}
        >
          Done
        </button>
      </div>
    )
  }

  if (action) {
    return (
      <Confirm
        action={action}
        person={person}
        onCancel={() => setAction(null)}
        onDone={() => setAction(null)}
        onPassword={setPassword}
      />
    )
  }

  const closed = person.status === 'left'

  return (
    <div className="row" style={{ gap: 'var(--s-2)' }}>
      <button
        className="btn btn--secondary btn--sm"
        type="button"
        onClick={() => setAction(person.isHr ? 'private' : 'hr')}
      >
        {person.isHr ? 'Remove HR access' : 'Give HR access'}
      </button>
      <button
        className="btn btn--secondary btn--sm"
        type="button"
        onClick={() => setAction('reset')}
      >
        Reset password
      </button>
      <button
        className="btn btn--ghost btn--sm"
        type="button"
        onClick={() => setAction(closed ? 'reopen' : 'close')}
      >
        {closed ? 'Reopen account' : 'Close account'}
      </button>
    </div>
  )
}

export function Accounts({ accounts }: { accounts: Account[] }) {
  if (accounts.length === 0) {
    return (
      <div className="card">
        <div className="card__title">Accounts</div>
        <p className="t-subtle mt-2">Nobody has an account yet.</p>
      </div>
    )
  }

  return (
    <div className="stack">
      {accounts.map((a) => (
        <div className="card" key={a.id} style={{ margin: 0 }}>
          <div className="row row--between">
            <div style={{ minWidth: 0 }}>
              <b>{a.full_name}</b>
              <p className="t-subtle">
                {a.jobTitle ?? 'No job title'}
                {a.department ? ` · ${a.department}` : ''}
              </p>
            </div>
            <div className="row" style={{ gap: 'var(--s-2)' }}>
              <span className={a.isHr ? 'chip chip--accent' : 'chip'}>
                {a.isHr ? 'HR' : 'Private'}
              </span>
              <span className="chip">{a.status}</span>
            </div>
          </div>
          <div className="mt-3">
            <Manage person={a} />
          </div>
        </div>
      ))}
    </div>
  )
}
