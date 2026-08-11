import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PageHead, PlaneBadge, PrivacyNote, Shell } from '@/components/chrome'

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
      <PageHead
        title={`Hello, ${firstName}`}
        lead={
          todays
            ? 'You checked in today. You can change it any time before midnight.'
            : 'Three questions, ten seconds. Skip anything you would rather not answer.'
        }
      />

      <PlaneBadge plane="private" />

      <PrivacyNote detail="Your check-ins, notes and trends are stored on a separate plane from anything your employer can query. HR sees group patterns for eight or more people, and your leave dates. Never your mood, and never your name attached to a number.">
        <b>Only you can see your check-ins.</b>{' '}
      </PrivacyNote>

      <div className="grid grid--2">
        <div className="card">
          <div className="card__head">
            <div>
              <div className="card__title">Today</div>
              <div className="card__sub">
                {todays ? 'Recorded' : 'Not checked in yet'}
              </div>
            </div>
          </div>
          <p className="t-subtle">
            {todays
              ? 'Changing it replaces today’s entry rather than adding another.'
              : 'Mood, energy and pressure. Every question is skippable.'}
          </p>
          <div className="mt-4">
            <Link className="btn btn--primary" href="/check-in">
              {todays ? 'Change today’s answer' : 'Check in'}
            </Link>
          </div>
        </div>

        <div className="card">
          <div className="card__head">
            <div>
              <div className="card__title">Your trends</div>
              <div className="card__sub">Against your own baseline</div>
            </div>
          </div>
          <p className="t-subtle">
            Measured against how your own weeks usually go — never against a
            colleague, and never as a score.
          </p>
          <div className="mt-4">
            <Link className="btn btn--secondary" href="/trends">
              See trends
            </Link>
          </div>
        </div>
      </div>

      <div className="card card--quiet mt-5">
        <div className="card__title mb-2">Leave and profile</div>
        <p className="t-subtle">
          The one part your employer does see. Booking a day off says nothing
          about how you are.
        </p>
        <div className="mt-4">
          <Link className="btn btn--ghost" href="/leave">
            Open
          </Link>
        </div>
      </div>
    </Shell>
  )
}
