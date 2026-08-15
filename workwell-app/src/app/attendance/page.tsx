import { Empty, PageHead, PlaneBadge, PrivacyNote } from '@/components/chrome'
import { Shell } from '@/components/shell'

export default function Attendance() {
  return (
    <Shell plane="work">
      <PageHead
        title="Attendance"
        lead="Attendance details and summary."
      />
      <PlaneBadge plane="work" />

      <PrivacyNote
        plane="work"
        detail="Boundaries — the private-plane screen for your working hours — exists specifically because no record of when you were active is kept anywhere in this product. A clock-in/out log is the opposite of that promise, so building this for real is a product decision worth making deliberately, not a default to reach for because the word is on a features list."
      >
        <b>Worth a conversation before this is built for real.</b>{' '}
      </PrivacyNote>

      <Empty icon="🕘" title="Not built yet">
        The spot is here so the room reflects the request. What it should
        actually hold — a log of hours, or something looser like core-hours
        confirmation with no per-minute record — is a decision, not an
        engineering task.
      </Empty>
    </Shell>
  )
}
