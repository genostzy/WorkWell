import { createClient } from '@/lib/supabase/server'
import { Office } from '@/components/office'
import { SignInRoom } from '@/components/sign-in-room'
import { PageHead } from '@/components/chrome'
import { Shell } from '@/components/shell'

export default async function Home() {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()

  // Signed out, the office is seen from outside: dimmed, inert, with one
  // live thing in it. A landing page with a Sign in button would have been
  // a second, plainer product bolted in front of this one.
  if (!claims) return <SignInRoom />

  const { data: me, error: meError } = await supabase
    .from('me')
    .select('full_name, status')
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

  // A sign-in with no person behind it. Under the old self-service flow this
  // was the normal first visit, with a form to ask for access. Accounts are
  // made by HR now, so there is nothing here for someone to do — the only
  // honest thing is to say who can fix it. It still happens: an auth user
  // left over from the magic-link era, or a creation that failed halfway.
  if (!me) {
    return (
      <Shell current="home">
        <PageHead title="You're signed in, but this account has no access" />
        <div className="card">
          <div className="state">
            <div className="state__icon" aria-hidden="true">
              🔑
            </div>
            <h2 className="state__title">Nothing is set up for you yet</h2>
            <p className="state__text">
              Accounts here are created by whoever runs WorkWell where you
              work. Ask them to set yours up — there is nothing you can do
              from this screen.
            </p>
          </div>
        </div>
      </Shell>
    )
  }

  // A closed account is stopped here rather than in the resolver. Cutting it
  // off in current_person_id() would revoke someone's access to their own
  // private plane on the day they leave, which is a different decision from
  // "this person no longer works here" and not one HR gets to make by
  // clicking Close.
  if (me.status === 'left') {
    return (
      <Shell current="home">
        <PageHead title="This account is closed" />
        <div className="card">
          <div className="state">
            <div className="state__icon" aria-hidden="true">
              🔒
            </div>
            <h2 className="state__title">You are signed in, but not in</h2>
            <p className="state__text">
              Whoever runs WorkWell where you work has closed this account.
              Nothing you recorded has been deleted, and nobody has gained
              access to it.
            </p>
          </div>
        </div>
      </Shell>
    )
  }

  const [{ data: roles }, { data: profile }] = await Promise.all([
    supabase.from('person_roles').select('role'),
    supabase
      .from('profile')
      .select('preferred_name, avatar_initials, avatar_colour, greeting')
      .maybeSingle(),
  ])
  const isHr = (roles ?? []).some((r) => r.role === 'hr')

  // The office is the interface, not a menu. The room is the navigation
  // surface; the plain list beside it is never optional.
  return (
    <Office
      isHr={isHr}
      name={profile?.preferred_name || me.full_name}
      initials={profile?.avatar_initials ?? null}
      colour={profile?.avatar_colour ?? 'accent'}
      greeting={profile?.greeting ?? 'warm'}
    />
  )
}
