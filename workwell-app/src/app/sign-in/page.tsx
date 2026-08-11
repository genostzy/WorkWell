'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function SignIn() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function send(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    // Read `next` from the URL directly rather than with useSearchParams,
    // which would force this page dynamic or need a Suspense boundary for
    // no benefit — it is only needed at submit time, on the client.
    const next = new URLSearchParams(location.search).get('next')
    const callback = new URL('/auth/callback', location.origin)
    if (next) callback.searchParams.set('next', next)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callback.toString() },
    })
    if (error) setError(error.message)
    else setSent(true)
  }

  if (sent)
    return (
      <div className="app" data-plane="private">
        <div className="main">
          <main className="content">
            <div className="card">
              <div className="state state--info">
                <div className="state__icon" aria-hidden="true">✉️</div>
                <h1 className="state__title">Check your email</h1>
                <p className="state__text" role="status">
                  We sent a sign-in link to {email}. It opens WorkWell directly —
                  there is no password to remember.
                </p>
              </div>
            </div>
          </main>
        </div>
      </div>
    )

  return (
    <div className="app" data-plane="private">
      <div className="main">
        <main className="content">
          <div className="page-head">
            <h1>Sign in</h1>
            <p className="t-lead">
              We will email you a link. Nothing to remember, nothing to leak.
            </p>
          </div>

          {error && (
            <div className="banner banner--error" role="alert">
              {error}
            </div>
          )}

          <form className="card" onSubmit={send}>
            <div className="field">
              <label className="field__label" htmlFor="email">
                Work email
              </label>
              <input
                className="input"
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <button className="btn btn--primary btn--block mt-4" type="submit">
              Send me a link
            </button>
          </form>
        </main>
      </div>
    </div>
  )
}
