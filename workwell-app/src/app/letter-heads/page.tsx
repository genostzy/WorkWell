import { createClient } from '@/lib/supabase/server'
import { Empty, LoadError, PageHead, PlaneBadge, PrivacyNote } from '@/components/chrome'
import { Shell } from '@/components/shell'
import { LetterHeadForm } from './letter-head-form'
import { LetterHeadCard } from './letter-head-card'

export default async function LetterHeads() {
  const supabase = await createClient()

  const { data: roles } = await supabase.from('person_roles').select('role')
  const isHr = (roles ?? []).some((r) => r.role === 'hr')

  if (!isHr) {
    return (
      <Shell current="hr" plane="private">
        <PageHead title="Not available on this account" />
        <div className="card">
          <div className="state">
            <div className="state__icon" aria-hidden="true">🔒</div>
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

  const { data: letterHeads, error } = await supabase
    .from('letter_heads')
    .select('*')
    .order('name')

  if (error) {
    return (
      <Shell current="hr" plane="work">
        <PageHead title="Letter heads" />
        <PlaneBadge plane="work" />
        <LoadError what="Letter heads" detail={error.message} />
      </Shell>
    )
  }

  return (
    <Shell current="hr" plane="work">
      <PageHead
        title="Letter heads"
        lead="Templates HR generates from — offer letters, employment certificates, that kind of thing."
      />
      <PlaneBadge plane="work" />
      <PrivacyNote
        plane="work"
        detail="Letter templates are employment data. They contain no personal information until filled in for a specific person."
      >
        <b>Employment data only.</b>{' '}
      </PrivacyNote>

      <LetterHeadForm />

      {(letterHeads ?? []).length === 0 ? (
        <Empty icon="📄" title="No letter head templates yet">
          Create your first template above to start generating letters.
        </Empty>
      ) : (
        <div className="stack">
          {(letterHeads ?? []).map((lh) => (
            <LetterHeadCard key={lh.id} letterHead={lh} />
          ))}
        </div>
      )}
    </Shell>
  )
}
