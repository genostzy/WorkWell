import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  // Only ever a same-origin path. Taking an absolute URL from a query
  // string and redirecting to it is an open-redirect; requiring a leading
  // slash and rejecting "//" keeps this pointed at our own app.
  const requested = searchParams.get('next')
  const next =
    requested && requested.startsWith('/') && !requested.startsWith('//')
      ? requested
      : '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(new URL(next, origin))
  }

  return NextResponse.redirect(`${origin}/sign-in?error=link`)
}
