'use client'

import Script from 'next/script'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Wordmark } from '@/components/brandmark'
import { reducedMotion } from '@/components/office'
import { hideSky, showSky } from '@/lib/sky'

/**
 * Signing in.
 *
 * A proper login screen, not a dialog raised from a picture: the form sits
 * on the left the whole time, and the locked office sits beside it on the
 * right — visible, not a thing you have to click a door to reveal. There is
 * no sign-up. Accounts are made by HR, which is why the form asks for a
 * password rather than emailing a link, and why an address it does not
 * recognise is pointed at HR rather than offered a way to make one.
 *
 * What happens on success depends on which of the two kinds of account this
 * is. A private-plane account gets the room it was standing next to: the
 * panel collapses away and the room settles into the space it leaves,
 * unlocked. An HR/admin account has no room here at all, so the whole split
 * slides off to the right instead — there is nothing on this screen to
 * unlock for it, only somewhere else to go.
 */

const REMEMBER = 'ww.email'

function readable(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('rate limit') || /after \d+ seconds/.test(m))
    return 'Too many attempts just now. Give it a minute and try again.'
  if (m.includes('invalid login credentials'))
    return 'That email and password do not match an account. If you have never signed in, ask HR — they create the accounts here.'
  if (m.includes('email not confirmed'))
    return 'That account is not active yet. Ask whoever set it up.'
  return message
}

export function SignInRoom({ notice }: { notice?: string }) {
  const roomRef = useRef<HTMLDivElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(notice ?? null)
  const [leaving, setLeaving] = useState<'private' | 'hr' | null>(null)

  /* ------------------------------------------------------------- The room */

  const build = useCallback(() => {
    const WW = window.WW
    if (!WW?.room || !roomRef.current) return

    const minutes = WW.room.nowMinutes()
    roomRef.current.innerHTML =
      WW.room.roomSVG({ role: 'employee', minutes }) +
      '<div class="room__dim"></div>'

    // The room is dark at night whether or not anyone has come in yet.
    roomRef.current.dataset.phase = WW.room.phaseAt(minutes)

    // The room is scenery here, not a second way in — the form beside it
    // is the only way in. room.js's spots are tabindex="0" because the
    // signed-in office needs them to be; this is the one screen where
    // that would just be twenty focus stops that do nothing, ahead of the
    // password field, so they're stripped for this instance only.
    roomRef.current
      .querySelectorAll('[tabindex]')
      .forEach((el) => el.removeAttribute('tabindex'))
  }, [])

  useEffect(() => {
    if (window.WW?.room) build()
    showSky()
    // Hidden rather than removed — see lib/sky for why removing it is what
    // left the office with no background on the way back.
    return hideSky
  }, [build])

  useEffect(() => {
    emailRef.current?.focus()
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      let saved: string | null = null
      try {
        saved = localStorage.getItem(REMEMBER)
      } catch {
        // Private browsing. Not remembering an address is not an error.
      }
      if (!cancelled && saved) setEmail(saved)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const signIn = useCallback(async (address: string, secret: string) => {
    const clean = address.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      setError('That does not look like an email address.')
      return
    }
    if (!secret) {
      setError('Enter your password.')
      return
    }

    setError(null)
    setBusy(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: clean,
      password: secret,
    })

    if (error) {
      setBusy(false)
      setError(readable(error.message))
      return
    }

    try {
      localStorage.setItem(REMEMBER, clean)
    } catch {
      // Private browsing again. Nothing to do.
    }

    // Which side of the plane boundary this account is on decides which
    // way the screen goes. A failed read defaults to private rather than
    // blocking the sign-in that already succeeded on it.
    const { data: roles } = await supabase.from('person_roles').select('role')
    const isHr = (roles ?? []).some((r) => r.role === 'hr')

    if (!isHr) {
      // The room was locked because nobody had opened the door yet. Someone
      // just did — the same flip the room already knows how to fade in on.
      roomRef.current?.setAttribute('data-open', 'true')
    }
    setLeaving(isHr ? 'hr' : 'private')

    // A full navigation rather than router.push: the session cookie was
    // just set, and proxy has to see it to choose the destination. `next`
    // is read from the URL rather than with useSearchParams, which would
    // make the page dynamic for something only needed at submit.
    const next = new URLSearchParams(location.search).get('next')
    const to =
      next && next.startsWith('/') && !next.startsWith('//') ? next : '/'

    // Long enough to read as the screen actually moving, short enough that
    // nobody is left waiting on a page that already knows where it's going.
    // Someone who asked for less motion gets neither.
    window.setTimeout(
      () => window.location.assign(to),
      reducedMotion() ? 20 : 600
    )
  }, [])

  return (
    <>
      {/* room before sky: sky.js reads WW.room for the current minute. */}
      <Script src="/prototype/room.js" strategy="afterInteractive" />
      <Script src="/prototype/sky.js" strategy="afterInteractive" onReady={build} />

      <div
        className={`signin-split${leaving ? ` is-leaving-${leaving}` : ''}`}
      >
        <aside className="signin-panel">
          <div className="wordmark mb-5">
            <Wordmark size={34} />
          </div>

          <h1 className="auth__title">Welcome back</h1>
          <p className="auth__sub">
            Sign in with the email and password your workplace gave you.
          </p>

          {error && (
            <div className="banner banner--error mb-4" role="alert">
              {error}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault()
              signIn(email, password)
            }}
          >
            <div className="field">
              <label className="field__label" htmlFor="signin-email">
                Work email
              </label>
              <input
                className="input"
                id="signin-email"
                ref={emailRef}
                type="email"
                name="email"
                autoComplete="username"
                inputMode="email"
                spellCheck={false}
                placeholder="you@company.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="field mt-4">
              <label className="field__label" htmlFor="signin-password">
                Password
              </label>
              <input
                className="input"
                id="signin-password"
                type="password"
                name="password"
                autoComplete="current-password"
                enterKeyHint="go"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button
              className="btn btn--primary btn--block mt-4"
              type="submit"
              disabled={busy || leaving !== null}
            >
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          {/* No self-service reset, on purpose: HR decides who gets in,
              and that carries through to who gets back in. Saying where
              to go beats a dead "forgot password?" link. */}
          <p className="auth__foot mt-4">
            Forgotten it, or never had one? Ask whoever runs WorkWell where
            you work — they create the accounts.
          </p>

          <p className="auth__foot mt-3">
            🔒 What you record in WorkWell is yours. Your employer never
            sees it.
          </p>
        </aside>

        <div className="room-shell is-fit signin-room-pane" aria-hidden="true">
          <main className="room-stage">
            {/* .room-views.is-on[data-view-panel="room"] isn't just the old
                Room/List toggle's visibility switch — it's also what gives
                .room its height (.room itself sets none). Dropping it
                collapses the room to nothing, which is exactly what
                happened here until this was put back. */}
            <div className="room-views is-on" data-view-panel="room">
              <div
                className="room"
                data-room
                data-open="false"
                ref={roomRef}
              />
            </div>
          </main>
        </div>
      </div>
    </>
  )
}
