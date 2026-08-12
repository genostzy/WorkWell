import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SignInRoom } from '@/components/sign-in-room'

/**
 * Reaching this page is always deliberate — a direct visit, or a redirect
 * from a guarded route — so the sheet is already up rather than asking for
 * a second click on the door. The locked office stands behind it either
 * way, so the page is recognisably the same place you are signing in to.
 *
 * Someone already signed in has no business here. It happens easily: a
 * stale tab, a bookmark, the back button after signing in. Asking them to
 * sign in again would be a dead end, so send them where they were going.
 */
export default async function SignIn({ searchParams }: PageProps<'/sign-in'>) {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()

  const params = await searchParams

  if (claims) {
    const { next } = params
    // Only ever a path within this app. `//evil.example` also starts with a
    // slash and is a protocol-relative URL, so a lone leading slash is not
    // enough of a test — that is the shape an open redirect takes.
    const to =
      typeof next === 'string' &&
      next.startsWith('/') &&
      !next.startsWith('//')
        ? next
        : '/'
    redirect(to)
  }

  // The callback sends failed exchanges back here. Landing on a plain sign
  // -in form after clicking a link that did not work reads as the app
  // ignoring you, so say what happened.
  const notice =
    params.error === 'link'
      ? 'That link has expired or was already used. Send yourself a fresh one.'
      : undefined

  return <SignInRoom openOnLoad notice={notice} />
}
