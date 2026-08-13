import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { LoadError, PageHead, PlaneBadge, PrivacyNote } from '@/components/chrome'
import { Shell } from '@/components/shell'
import { CreateAccount } from './create'
import { Accounts, type Account } from './manage'

/**
 * Account management.
 *
 * Deciding who gets in was the only account decision the product had. This
 * is the rest of the life of an account: who has HR access, who has left,
 * and who is still waiting to be let in at all.
 *
 * It is deliberately a separate screen from People. That one is about
 * employment — titles, departments, leave. This one is about access, and
 * mixing the two is how someone ends up granting the directory while they
 * thought they were correcting a job title.
 */
export default async function AccountsPage() {
  const supabase = await createClient()

  const { data: roles } = await supabase.from('person_roles').select('role')
  const isHr = (roles ?? []).some((r) => r.role === 'hr')

  if (!isHr) {
    return (
      <Shell current="hr" plane="private">
        <PageHead title="Not available on this account" />
        <div className="card">
          <div className="state">
            <div className="state__icon" aria-hidden="true">
              🔒
            </div>
            <h2 className="state__title">This area is for HR</h2>
            <p className="state__text">
              Your own data lives on the private plane, which nobody here can
              read.
            </p>
          </div>
        </div>
      </Shell>
    )
  }

  const { data: me } = await supabase.from('me').select('id').maybeSingle()

  const [
    { data: people, error: peopleError },
    { data: employment },
    // Every role row in the org, now that HR can read them. Before 0019 this
    // returned only the caller's own, so "who else is HR" was unanswerable.
    { data: allRoles, error: rolesError },
  ] = await Promise.all([
    supabase.from('people').select('id, full_name, status').order('full_name'),
    supabase.from('employment').select('person_id, job_title, department'),
    supabase.from('person_roles').select('person_id, role'),
  ])

  // Roles matter more than most reads here: if that one fails and is treated
  // as empty, every account renders as "Private" and someone could be given
  // HR access they already have, or have it removed without meaning to.
  const readError = peopleError ?? rolesError
  if (readError) {
    return (
      <Shell current="hr" plane="work">
        <PageHead title="Accounts" />
        <PlaneBadge plane="work" />
        <LoadError what="The account list" detail={readError.message} />
      </Shell>
    )
  }

  const job = new Map((employment ?? []).map((e) => [e.person_id, e]))
  const departments = [
    ...new Set(
      (employment ?? [])
        .map((e) => e.department)
        .filter((d): d is string => Boolean(d && d.trim()))
    ),
  ].sort()
  const hrIds = new Set(
    (allRoles ?? []).filter((r) => r.role === 'hr').map((r) => r.person_id)
  )

  const accounts: Account[] = (people ?? []).map((p) => ({
    id: p.id,
    full_name: p.full_name,
    status: p.status,
    isHr: hrIds.has(p.id),
    jobTitle: job.get(p.id)?.job_title ?? null,
    department: job.get(p.id)?.department ?? null,
    isSelf: p.id === me?.id,
  }))

  const hrCount = accounts.filter((a) => a.isHr).length
  const closed = accounts.filter((a) => a.status === 'left').length

  return (
    <Shell current="hr" plane="work">
      <PageHead
        title="Accounts"
        lead="Who can get in, and what they can open once they are."
      />

      <PlaneBadge plane="work" />

      <PrivacyNote
        plane="work"
        detail="Access is a work-plane fact: it says what an account can open, never how anyone is. Giving someone HR access does not give them, or you, any route to another person's check-ins — there is no policy granting it, so there is nothing to configure here and nothing to get wrong."
      >
        <b>Changing access never opens a private plane.</b>{' '}
      </PrivacyNote>

      <CreateAccount departments={departments} />

      <div className="grid grid--3 mb-5">
        <div className="stat">
          <span className="stat__label">Accounts</span>
          <span className="stat__value t-num">{accounts.length}</span>
        </div>
        <div className="stat">
          <span className="stat__label">With HR access</span>
          <span className="stat__value t-num">{hrCount}</span>
        </div>
        <div className="stat">
          <span className="stat__label">Closed</span>
          <span className="stat__value t-num">{closed}</span>
        </div>
      </div>

      <div className="card card--quiet mb-5">
        <p className="t-subtle">
          Employment records — titles, departments, leave — live on{' '}
          <Link href="/hr">People</Link>.
        </p>
      </div>

      <Accounts accounts={accounts} />
    </Shell>
  )
}
