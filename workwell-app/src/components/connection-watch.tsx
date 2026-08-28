'use client'

import { useEffect, useSyncExternalStore } from 'react'

/** Connectedness is a browser store, not React state, so it is read as one.
 *
 *  navigator.onLine is only trustworthy in the negative: false really does
 *  mean no interface is up, while true only means one is — it says nothing
 *  about whether anything is reachable beyond it. Used here for exactly
 *  that, and nothing is claimed about being back until `online` fires.
 *
 *  The server snapshot is `true`: markup rendered on a server is by
 *  definition markup that reached the reader, so rendering the bar into it
 *  would flash an offline warning on every first paint. */
function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

const isOnline = () => navigator.onLine
const assumeOnline = () => true

/**
 * Registers the offline worker, and says so when the connection goes.
 *
 * Two halves of one problem. The worker (public/sw.js) handles a
 * navigation made with no network — it serves the offline page instead of
 * the browser's own. This component handles the other case: the tab is
 * already open and the connection drops under it, where no navigation
 * happens and the browser therefore says nothing at all.
 *
 * A bar rather than a takeover, on purpose. Losing the network mid-session
 * usually means somebody is part-way through typing a check-in or a leave
 * note, and replacing the screen would throw that away to tell them
 * something a strip along the top says just as clearly.
 */
export function ConnectionWatch() {
  const online = useSyncExternalStore(subscribe, isOnline, assumeOnline)

  useEffect(() => {
    // Not in development: a worker intercepting navigations sits directly
    // in the way of hot reloading, and the offline page is a production
    // concern anyway.
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return

    // After load rather than during it — registration competes with the
    // page's own requests, and nothing here is needed for first paint.
    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // A worker that will not register costs the offline page and
        // nothing else. Not worth a message the reader can do nothing with.
      })
    }

    if (document.readyState === 'complete') register()
    else {
      window.addEventListener('load', register)
      return () => window.removeEventListener('load', register)
    }
  }, [])

  if (online) return null

  return (
    <div className="offline-bar" role="status">
      <span aria-hidden="true">📴</span>
      <span>
        <b>You are offline.</b> Anything you save now will not reach the
        server until the connection is back.
      </span>
    </div>
  )
}
