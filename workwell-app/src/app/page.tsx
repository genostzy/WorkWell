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

  const { data: me } = await supabase.from('me').select('full_name').maybeSingle()

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
