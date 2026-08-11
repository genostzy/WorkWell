import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Office } from '@/components/office'
import { Shell, PageHead } from '@/components/chrome'

export default async function Home() {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()

  if (!claims) {
    return (
      <div className="app" data-plane="private">
        <div className="main">
          <main className="content">
            <div className="page-head">
              <h1>WorkWell</h1>
              <p className="t-lead">
                Notice your own strain early. Your employer sees where workload
                sits heavy — never who.
              </p>
            </div>
            <Link className="btn btn--primary btn--lg" href="/sign-in">
              Sign in
            </Link>
          </main>
        </div>
      </div>
    )
  }

  const { data: me, error: meError } = await supabase
    .from('me')
    .select('full_name')
    .maybeSingle()

  // A query that FAILED and a query that found nothing are different
  // things, and conflating them sent us hunting for a missing invitation
  // when the real cause was a permission error on the view.
  if (meError) {
    return (
      <Shell current="home">
        <PageHead title="Something went wrong reading your account" />
        <div className="card">
          <div className="state state--error">
            <div className="state__icon" aria-hidden="true">
              ⚠️
            </div>
            <h2 className="state__title">Your record could not be loaded</h2>
            <p className="state__text">
              Your history is safe — this is a read failing, not data missing.
            </p>
            <p className="t-subtle mt-3">
              <code>{meError.message}</code>
            </p>
          </div>
        </div>
      </Shell>
    )
  }

  if (!me) {
    return (
      <Shell current="home">
        <PageHead title="Signed in, but not set up yet" />
        <div className="card">
          <div className="state state--info">
            <div className="state__icon" aria-hidden="true">
              ✉️
            </div>
            <h2 className="state__title">This account is not linked to anyone</h2>
            <p className="state__text">
              Ask whoever runs WorkWell where you work to invite this email
              address. Until then there is nothing here to show you.
            </p>
          </div>
        </div>
      </Shell>
    )
  }

  const { data: roles } = await supabase.from('person_roles').select('role')
  const isHr = (roles ?? []).some((r) => r.role === 'hr')

  // The office is the interface, not a menu. The room is the navigation
  // surface; the plain list beside it is never optional.
  return <Office isHr={isHr} name={me.full_name} />
}
