'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Wordmark } from '@/components/brandmark'

/**
 * Choosing your own password.
 *
 * Reached two ways: an invite or reset link, carrying a fresh session as an
 * access/refresh token pair in the URL fragment (Supabase's invite/recovery
 * verification does not support PKCE, so there is no code for the server to
 * exchange — see route.ts), or already signed in and flagged by middleware
 * with must_change_password. This is the one route reachable without an
 * existing session for the first case; the effect below turns the fragment
 * into a real session before anything renders, then middleware treats it
 * like any other visit here.
 *
 * There is no "skip" and no way back to the office until the flag clears.
 * Sign out is the only other exit, so nobody is trapped.
 */

const MINIMUM = 8

type Stage = 'checking' | 'ready' | 'expired'

export default function SetPassword() {
  const [stage, setStage] = useState<Stage>('checking')
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const hash = window.location.hash
    const supabase = createClient()

    async function bootstrap() {
      if (hash) {
        const params = new URLSearchParams(hash.slice(1))
        // The fragment is gone the moment it is read — leaving it in the
        // address bar would keep a copy of these tokens sitting in history.
        window.history.replaceState(null, '', window.location.pathname)

        if (params.get('error')) {
          setStage('expired')
          return
        }

        const access_token = params.get('access_token')
        const refresh_token = params.get('refresh_token')
        if (access_token && refresh_token) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          })
          if (!sessionError) {
            setStage('ready')
            return
          }
        }
      }

      // No fragment, or it did not carry a session: fall back to whatever
      // session already exists (the middleware-redirect case). No session
      // at all means this page was opened directly, not via a link.
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        setStage('ready')
      } else {
        window.location.assign('/sign-in')
      }
    }

    bootstrap()
  }, [])

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

          {stage === 'checking' && (
            <p className="t-lead">Checking your link…</p>
          )}

          {stage === 'expired' && (
            <>
              <div className="page-head">
                <h1>That link has had it</h1>
                <p className="t-lead">
                  It already expired or was already used. Ask whoever set up
                  your account to send a new one.
                </p>
              </div>
              <a className="btn btn--secondary" href="/sign-in">
                Back to sign in
              </a>
            </>
          )}

          {stage === 'ready' && (
            <>
              <div className="page-head">
                <h1>Choose a password</h1>
                <p className="t-lead">Pick your own before you go in.</p>
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
                  <input
                    className="input"
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    autoFocus
                    required
                    minLength={MINIMUM}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <span className="field__hint">
                    At least {MINIMUM} characters.
                  </span>
                </div>

                <div className="field mt-4">
                  <label className="field__label" htmlFor="again-password">
                    Type it again
                  </label>
                  <input
                    className="input"
                    id="again-password"
                    type="password"
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
            </>
          )}
        </main>
      </div>
    </div>
  )
}
