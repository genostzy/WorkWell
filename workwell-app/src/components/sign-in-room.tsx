'use client'

import Script from 'next/script'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Wordmark } from '@/components/brandmark'
import { hideSky, showSky } from '@/lib/sky'

/**
 * Signing in, as the Hi-Fi design draws it.
 *
 * The office is the product, so the signed-out state is the office seen
 * from outside: the plan is dimmed, every destination is inert, and the one
 * live thing is the front door. Clicking it raises the sign-in sheet. A
 * plain list sits beside the room for anyone who cannot use the picture,
 * with its own way in — the room must never be the only door.
 *
 * There is no sign-up. Accounts are made by HR, which is why the sheet asks
 * for a password rather than emailing a link, and why an address it does not
 * recognise is pointed at HR rather than offered a way to make one.
 */

const REMEMBER = 'ww.email'

/**
 * Supabase's messages are written for developers. These are the ones a
 * person at the door can act on.
 *
 * "Invalid login credentials" covers both a wrong password and an address
 * with no account at all — deliberately, so the form cannot be used to
 * discover who works here. The replacement has to stay just as vague while
 * still saying what to do next.
 */
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

export function SignInRoom({
  openOnLoad = false,
  notice,
}: {
  openOnLoad?: boolean
  /** Something that went wrong before this page loaded. */
  notice?: string
}) {
  const roomRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const doorRef = useRef<Element | null>(null)

  const [view, setView] = useState<'room' | 'list'>('room')
  const [open, setOpen] = useState(openOnLoad)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(notice ?? null)

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

    // `locked` here is the same gate the room honours: before sign-in these
    // must not be live links, or the list is a way around the front door.
    if (listRef.current) {
      listRef.current.innerHTML = WW.room.roomList('employee', true)
    }
  }, [])

  useEffect(() => {
    if (window.WW?.room) build()
    showSky()
    // Hidden rather than removed — see lib/sky for why removing it is what
    // left the office with no background on the way back.
    return hideSky
  }, [build])

  // On a phone the plan scales down until its labels are ~13px and the tap
  // targets are far under 44px, so the list is simply the better small
  // screen. The server cannot know the viewport, so we determine the view
  // after mount. Using a ref avoids setState-in-effect while still achieving
  // the hydration guard — the initial render uses 'room' and we sync to 'list'
  // once the viewport is known.
  const initialViewRef = useRef<'room' | 'list'>('room')

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 760px)')
    initialViewRef.current = mq.matches ? 'list' : 'room'
  }, [])

  useEffect(() => {
    setView(initialViewRef.current)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const saved = localStorage.getItem(REMEMBER)
      if (!cancelled && saved) setEmail(saved)
    })()
    return () => { cancelled = true }
  }, [])

  /* ------------------------------------------------------------ The sheet */

  const openSheet = useCallback((from?: Element | null) => {
    doorRef.current = from ?? null
    setError(null)
    setOpen(true)
  }, [])

  const closeSheet = useCallback(() => {
    setOpen(false)
    // Send focus back where it came from, or it lands on <body> and the
    // room has to be tabbed through again. Opened straight from the URL
    // there is no origin, so hand it to the door — the way back in.
    const back =
      (doorRef.current as HTMLElement | null) ??
      roomRef.current?.querySelector<SVGElement>('[data-frontdoor]')
    back?.focus?.()
  }, [])

  useEffect(() => {
    if (!open) return
    emailRef.current?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSheet()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, closeSheet])

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

    // A full navigation rather than router.push: the session cookie was just
    // set, and middleware has to see it to choose between the office and the
    // set-password screen. `next` is read from the URL rather than with
    // useSearchParams, which would make the page dynamic for something only
    // needed at submit.
    const next = new URLSearchParams(location.search).get('next')
    const to =
      next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
    window.location.assign(to)
  }, [])

  /* ------------------------------------------------------------- Wiring */

  const onRoomClick = useCallback(
    (e: React.MouseEvent | React.KeyboardEvent) => {
      const target = e.target as HTMLElement
      // Everything in a locked room leads to the same place. The prototype
      // let a click on a dimmed destination do nothing at all, which reads
      // as broken rather than as locked.
      const el = target.closest('[data-frontdoor], .spot')
      if (!el) return
      e.preventDefault()
      openSheet(el)
    },
    [openSheet]
  )

  const onRoomKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return
      if (!(e.target as HTMLElement).closest('[data-frontdoor], .spot')) return
      onRoomClick(e)
    },
    [onRoomClick]
  )

  return (
    <>
      {/* room before sky: sky.js reads WW.room for the current minute. */}
      <Script src="/prototype/room.js" strategy="afterInteractive" />
      <Script
        src="/prototype/sky.js"
        strategy="afterInteractive"
        onReady={build}
      />

      <div className={`room-shell${view === 'room' ? ' is-fit' : ''}`}>
        <header className="room-top">
          <div className="room-top__brand">
            <Wordmark />
          </div>
          <span className="room-top__spacer" />
          <div className="segmented" role="group" aria-label="How to navigate">
            <button
              type="button"
              aria-pressed={view === 'room'}
              onClick={() => setView('room')}
            >
              Room
            </button>
            <button
              type="button"
              aria-pressed={view === 'list'}
              onClick={() => setView('list')}
            >
              List
            </button>
          </div>
          <button
            className="btn btn--primary btn--sm"
            type="button"
            onClick={() => openSheet(null)}
          >
            Sign in
          </button>
        </header>

        <main className="room-stage">
          <div
            className={`room-views${view === 'room' ? ' is-on' : ''}`}
            data-view-panel="room"
            hidden={view !== 'room'}
          >
            <p className="t-lead t-center">Click the front door to sign in.</p>
            <div
              className="room"
              data-room
              data-open="false"
              ref={roomRef}
              onClick={onRoomClick}
              onKeyDown={onRoomKey}
            />
          </div>

          {/* A picture must never be the only way in. */}
          <div
            className={`room-views${view === 'list' ? ' is-on' : ''}`}
            data-view-panel="list"
            hidden={view !== 'list'}
            style={{ width: 'min(560px, 100%)' }}
          >
            <h1 className="mb-2" style={{ fontSize: 'var(--fs-xl)' }}>
              Where would you like to go?
            </h1>
            <p className="t-subtle mb-4">Sign in at the front door first.</p>
            <button
              className="btn btn--primary btn--block mb-4"
              type="button"
              onClick={() => openSheet(null)}
            >
              Sign in
            </button>
            <div ref={listRef} />
          </div>
        </main>
      </div>

      {open && (
        <div
          className="sheet-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeSheet()
          }}
        >
          <div
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Sign in"
            style={{ maxWidth: 420 }}
          >
            <div className="auth__card" style={{ padding: 'var(--s-6)' }}>
              <div className="wordmark mb-5">
                <Wordmark size={34} />
              </div>

              <h2 className="auth__title">Welcome back</h2>
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
                  disabled={busy}
                >
                  {busy ? 'Signing in…' : 'Sign in'}
                </button>
              </form>

              {/* No self-service reset, on purpose: HR decides who gets in,
                  and that carries through to who gets back in. Saying where
                  to go beats a dead "forgot password?" link. */}
              <p className="auth__foot mt-4">
                Forgotten it, or never had one? Ask whoever runs WorkWell
                where you work — they create the accounts.
              </p>

              <p className="auth__foot mt-3">
                🔒 What you record in WorkWell is yours. Your employer never
                sees it.
              </p>

              <button className="auth__alt" type="button" onClick={closeSheet}>
                Not now
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
