import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  // Server Components have no built-in way to read the current pathname —
  // (app)/layout.tsx needs it to pick the right topbar title and plane
  // colour for whichever page is actually being rendered, now that Shell
  // lives once in the layout instead of once per page.tsx. Every
  // NextResponse.next({ request }) below reuses this same, already-mutated
  // request object, so setting it once here is enough for it to reach
  // every non-redirect path.
  request.headers.set('x-pathname', request.nextUrl.pathname)

  let response = NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    return NextResponse.next({ request })
  }
  const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refreshes the auth token. Do not remove: without it, server components
  // see an expired session and every page looks signed out.
  const { data } = await supabase.auth.getClaims()

  // Guard every route here rather than page by page. A client page that
  // fetches before checking sits on a loading state forever when signed
  // out, and each new page would have to remember its own guard.
  const path = request.nextUrl.pathname
  // /offline.html is the service worker's cached fallback. It has to be
  // public or the worker caches whatever this redirects to instead — which
  // is the sign-in page, served forever after as "you are offline". The
  // matcher below excludes static assets by extension but not .html, so
  // this is the exemption that keeps it reachable. It reads no data and
  // names nobody: there is nothing on it to protect.
  const isPublic =
    path === '/' || path.startsWith('/sign-in') || path === '/offline.html'

  if (!data && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/sign-in'
    // Come back to where they were headed once they are signed in.
    url.searchParams.set('next', path)
    return NextResponse.redirect(url)
  }

  // A password HR read out to someone is a handoff token, not a secret. It
  // must not survive first contact, so an account still carrying the flag
  // gets exactly one destination until it clears.
  //
  // The API route is exempt on purpose: it is how HR resets a password, and
  // an HR account that was itself just reset must still be able to do that
  // for whoever is locked out behind them. Its own HR check is the gate
  // there, not this one.
  if (data && !path.startsWith('/set-password') && !path.startsWith('/api/')) {
    const { data: me } = await supabase
      .from('me')
      .select('must_change_password')
      .maybeSingle()

    // A read that failed is not a person who must change their password.
    // Redirecting on a failed read would lock the whole app behind a screen
    // that cannot succeed either, so only a definite `true` diverts.
    if (me?.must_change_password === true) {
      const url = request.nextUrl.clone()
      url.pathname = '/set-password'
      url.search = ''
      return NextResponse.redirect(url)
    }
  }

  return response
}

export const config = {
  // Anything with a file extension is a static asset and must be excluded,
  // not just the _next ones. Without the extension clause every file under
  // public/ — including the vendored room and sky scripts — is answered
  // with a 307 to /sign-in, and the office silently never loads.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:js|css|svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf)$).*)',
  ],
}
