import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { LoadError, PageHead, PlaneBadge, PrivacyNote, RoleLocked } from '@/components/chrome'
import { CreateAccount } from '../../../hr/accounts/create'
import { Accounts, type Account } from '../../../hr/accounts/manage'

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
      <>
        <PageHead title="Not available on this account" />
        <RoleLocked audience="hr" />
      </>
    )
  }

  const { data: me } = await supabase.from('me').select('id').maybeSingle()

  const [
    { data: people, error: peopleError },
    { data: employment },
    { data: allRoles, error: rolesError },
  ] = await Promise.all([
    supabase.from('people').select('id, full_name, status').order('full_name'),
    supabase.from('employment').select('person_id, job_title, department'),
    supabase.from('person_roles').select('person_id, role'),
  ])

  const readError = peopleError ?? rolesError
  if (readError) {
    return (
      <>
        <PageHead title="Accounts" />
        <PlaneBadge plane="work" />
        <LoadError what="The account list" detail={readError.message} />
      </>
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
    <>
      <PageHead
        title="Accounts"
        lead="Who can get in, and what they can open once they are."
      />

      <PlaneBadge plane="work" />

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

      <PrivacyNote
        plane="work"
        detail="Access is a work-plane fact: it says what an account can open, never how anyone is. Giving someone HR access does not give them, or you, any route to another person's check-ins — there is no policy granting it, so there is nothing to configure here and nothing to get wrong."
      >
        <b>Changing access never opens a private plane.</b>{' '}
      </PrivacyNote>
    </>
  )
}
