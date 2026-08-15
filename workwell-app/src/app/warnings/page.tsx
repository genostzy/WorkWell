import { Empty, PageHead, PlaneBadge, PrivacyNote } from '@/components/chrome'
import { Shell } from '@/components/shell'

export default function Warnings() {
  return (
    <Shell plane="work">
      <PageHead title="Warnings" lead="Formal disciplinary records." />
      <PlaneBadge plane="work" />

      <PrivacyNote
        plane="work"
        detail="Every other work-plane record here is neutral fact HR needs to run the place — a job title, a leave balance. A warning is a judgement about a person, and putting it next to the same private-plane data this product goes out of its way to wall off is worth deciding on purpose, with whoever owns HR policy, rather than shipping because the word appeared on a list."
      >
        <b>A different kind of record than the rest of this list.</b>{' '}
      </PrivacyNote>

      <Empty icon="⚠️" title="Not built yet">
        The spot is here; the record type, who can see it, and how it is
        raised are a policy decision first.
      </Empty>
    </Shell>
  )
}
