import { createClient } from '@/lib/supabase/server'
import { Empty, LoadError, PageHead, PlaneBadge, PrivacyNote } from '@/components/chrome'
import { Shell } from '@/components/shell'
import { OffboardingChecklist } from './offboarding-checklist'
import { NewOffboardingForm } from './new-offboarding-form'

export default async function Offboarding() {
  const supabase = await createClient()

  const { data: me } = await supabase.from('me').select('id').maybeSingle()
  const { data: roles } = await supabase.from('person_roles').select('role')
  const isHr = (roles ?? []).some((r) => r.role === 'hr')

  if (isHr) {
    const { data: checklists, error } = await supabase
      .from('offboarding_checklists')
      .select('*, people!inner(full_name)')
      .order('created_at', { ascending: false })

    if (error) {
      return (
        <Shell current="hr" plane="work">
          <PageHead title="Offboarding" />
          <PlaneBadge plane="work" />
          <LoadError what="Offboarding checklists" detail={error.message} />
        </Shell>
      )
    }

    return (
      <Shell current="hr" plane="work">
        <PageHead
          title="Offboarding"
          lead="The checklist for someone leaving — HR's side of it."
        />
        <PlaneBadge plane="work" />
        <PrivacyNote
          plane="work"
          detail="Offboarding checklists are employment data. They track the logistics of someone's departure."
        >
          <b>Employment data only.</b>{' '}
        </PrivacyNote>

        <NewOffboardingForm />

        {(checklists ?? []).length === 0 ? (
          <Empty icon="🚪" title="No offboarding checklists yet">
            Create a checklist above when someone starts leaving.
          </Empty>
        ) : (
          <div className="stack">
            {(checklists ?? []).map((cl) => (
              <OffboardingChecklist
                key={cl.id}
                checklist={{
                  ...cl,
                  person_name: (cl.people as { full_name: string })?.full_name ?? 'Unknown',
                }}
                isHr={true}
              />
            ))}
          </div>
        )}
      </Shell>
    )
  }

  // Non-HR: only see own checklists
  if (!me) {
    return (
      <Shell current="hr" plane="work">
        <PageHead title="Offboarding" />
        <PlaneBadge plane="work" />
        <LoadError what="Your identity" />
      </Shell>
    )
  }

  const { data: myChecklists, error } = await supabase
    .from('offboarding_checklists')
    .select('*')
    .eq('person_id', me.id)
    .order('created_at', { ascending: false })

  if (error) {
    return (
      <Shell current="hr" plane="work">
        <PageHead title="Offboarding" />
        <PlaneBadge plane="work" />
        <LoadError what="Your offboarding checklist" detail={error.message} />
      </Shell>
    )
  }

  return (
    <Shell current="hr" plane="work">
      <PageHead
        title="Offboarding"
        lead="Your departure checklist."
      />
      <PlaneBadge plane="work" />

      {(myChecklists ?? []).length === 0 ? (
        <Empty icon="🚪" title="No offboarding checklist">
          HR will create a checklist here when your departure is being processed.
        </Empty>
      ) : (
        <div className="stack">
          {(myChecklists ?? []).map((cl) => (
            <OffboardingChecklist
              key={cl.id}
              checklist={cl}
              isHr={false}
            />
          ))}
        </div>
      )}
    </Shell>
  )
}
