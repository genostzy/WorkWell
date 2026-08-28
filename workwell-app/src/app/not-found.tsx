import Link from 'next/link'
import { Brandmark } from '@/components/brandmark'

/**
 * An address with nothing behind it.
 *
 * Next serves this for any URL that matches no route, and it renders in
 * the root layout only — there is no sidebar or topbar here, because the
 * shell lives under (app)/ and an unmatched path never reaches it. So this
 * carries its own frame, built from the same tokens, card and state
 * classes as every other screen rather than from anything new.
 *
 * Signed-out visitors rarely see it: proxy.ts sends them to sign-in before
 * a missing page is ever reached. The reader here is almost always someone
 * already signed in who followed a stale link, which is why the wording
 * reassures about the account rather than explaining what a 404 is.
 */
export default function NotFound() {
  return (
    <main className="notice">
      <div className="notice__inner">
        <div className="notice__brand">
          <Brandmark size={30} />
          <span className="notice__wordmark">WorkWell</span>
        </div>

        <div className="card">
          <div className="state">
            <div className="state__icon" aria-hidden="true">
              🚪
            </div>
            <h1 className="state__title">There is no room here</h1>
            <p className="state__text">
              This address does not open onto anything. Nothing has gone wrong
              with your account, and nothing has been lost — the link is
              simply pointing at a page that does not exist.
            </p>
            <div className="state__actions">
              <Link className="btn btn--primary" href="/">
                Back to your room
              </Link>
            </div>
            <p className="notice__code">Error 404</p>
          </div>
        </div>
      </div>
    </main>
  )
}
