import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PrivacyNote, Shell } from '@/components/chrome'

export default async function Home() {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()

  if (!claims) {
    return (
      <div className="shell">
        <h1>WorkWell</h1>
        <p className="lead">
          Notice your own patterns early. Your employer sees group trends, never
          you.
        </p>
        <Link className="btn" href="/sign-in">
          Sign in
        </Link>
      </div>
    )
  }

  // `me` is the signed-in person's own row, or nothing at all if this
  // account was never invited. That empty case is a designed outcome, not
  // an error — say so plainly rather than showing a broken page.
  const { data: me } = await supabase.from('me').select('full_name').maybeSingle()

  if (!me) {
    return (
      <Shell current="home">
        <h1>You are signed in, but not set up yet</h1>
        <p className="lead">
          This account is not linked to anyone at an organisation, so there is
          nothing to show. Ask whoever runs WorkWell where you work to invite
          this email address.
        </p>
      </Shell>
    )
  }

  const today = new Date().toISOString().slice(0, 10)
  const { data: todays } = await supabase
    .from('check_ins')
    .select('mood, energy, pressure')
    .eq('day', today)
    .maybeSingle()

  const { data: roles } = await supabase.from('person_roles').select('role')
  const isHr = (roles ?? []).some((r) => r.role === 'hr')

  const firstName = me.full_name.split(' ')[0]

  return (
    <Shell current="home" isHr={isHr}>
      <h1>Hello, {firstName}</h1>
      <p className="lead">
        {todays
          ? 'You checked in today. You can change it any time before midnight.'
          : 'Thirty seconds, three questions. Skip anything you would rather not answer.'}
      </p>

      <PrivacyNote />

      <div className="card">
        <div className="card__title">Today</div>
        <p className="card__sub">
          {todays
            ? 'Recorded. Changing it replaces today’s entry rather than adding another.'
            : 'Not checked in yet.'}
        </p>
        <div className="mt">
          <Link className="btn" href="/check-in">
            {todays ? 'Change today’s answer' : 'Check in'}
          </Link>
        </div>
      </div>

      <div className="card">
        <div className="card__title">Your trends</div>
        <p className="card__sub">
          How the last couple of weeks have gone, measured against your own
          baseline — never against anybody else’s.
        </p>
        <div className="mt">
          <Link className="btn btn--quiet" href="/trends">
            See trends
          </Link>
        </div>
      </div>
    </Shell>
  )
}
