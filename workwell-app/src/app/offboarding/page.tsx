import { Empty, PageHead, PlaneBadge } from '@/components/chrome'
import { Shell } from '@/components/shell'

export default function Offboarding() {
  return (
    <Shell plane="work">
      <PageHead
        title="Offboarding"
        lead="The checklist for someone leaving — HR's side of it."
      />
      <PlaneBadge plane="work" />
      <Empty icon="🚪" title="Not built yet">
        Closing an account already exists on Accounts &amp; access. A fuller
        offboarding checklist — assets returned, access revoked, last day
        confirmed — is next.
      </Empty>
    </Shell>
  )
}
