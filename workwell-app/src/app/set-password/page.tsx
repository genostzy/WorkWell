'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Wordmark } from '@/components/brandmark'
import { PasswordInput } from '@/components/password-input'

/**
 * Choosing your own password, once.
 *
 * Reached only by the middleware, which sends anyone carrying
 * must_change_password here and refuses to let them anywhere else. That is
 * the whole point of the flag: the password HR handed over was written down
 * and passed along, so it is a handoff token rather than a secret, and it
 * must not survive first contact.
 *
 * There is no "skip" and no way back to the office from here. Sign out is
 * the only other exit, so nobody is trapped.
 */

const MINIMUM = 8

export default function SetPassword() {
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()

    if (password.length < MINIMUM) {
      setError(`Use at least ${MINIMUM} characters.`)
      return
    }
    if (password !== again) {
      setError('Those two do not match.')
      return
    }

    setBusy(true)
    setError(null)

    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setBusy(false)
      setError(updateError.message)
      return
    }

    // Only clear the flag once the password actually changed. The other
    // order would let someone out of this screen still holding the password
    // HR read aloud to them.
    const { error: flagError } = await supabase.rpc('clear_password_change_flag')

    if (flagError) {
      setBusy(false)
      setError(
        `Your password was changed, but the account is still flagged: ${flagError.message}`
      )
      return
    }

    // Full navigation, so middleware re-reads the now-cleared flag rather
    // than bouncing straight back here from a cached decision.
    window.location.assign('/')
  }

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut({ scope: 'global' })
    window.location.assign('/')
  }

  return (
    <div className="app" data-plane="private">
      <div className="main">
        <main className="content" style={{ maxWidth: 460 }}>
          <div className="wordmark mb-5">
            <Wordmark size={34} />
          </div>

          <div className="page-head">
            <h1>Choose a password</h1>
            <p className="t-lead">
              The one you were given was handed to you by someone else. Pick
              your own before you go in.
            </p>
          </div>

          {error && (
            <div className="banner banner--error mb-4" role="alert">
              {error}
            </div>
          )}

          <form className="card" onSubmit={submit}>
            <div className="field">
              <label className="field__label" htmlFor="new-password">
                New password
              </label>
              <PasswordInput
                id="new-password"
                autoComplete="new-password"
                autoFocus
                required
                minLength={MINIMUM}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <span className="field__hint">
                At least {MINIMUM} characters. Nobody at your workplace can see
                it, including whoever set your account up.
              </span>
            </div>

            <div className="field mt-4">
              <label className="field__label" htmlFor="again-password">
                Type it again
              </label>
              <PasswordInput
                id="again-password"
                autoComplete="new-password"
                required
                value={again}
                onChange={(e) => setAgain(e.target.value)}
              />
            </div>

            <button
              className="btn btn--primary btn--block mt-5"
              type="submit"
              disabled={busy}
            >
              {busy ? 'Saving…' : 'Save and go in'}
            </button>
          </form>

          <button className="auth__alt mt-4" type="button" onClick={signOut}>
            Sign out instead
          </button>
        </main>
      </div>
    </div>
  )
}
