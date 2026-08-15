import { Empty, PageHead, PlaneBadge } from '@/components/chrome'
import { Shell } from '@/components/shell'

export default function CompanyPolicies() {
  return (
    <Shell plane="work">
      <PageHead
        title="Company policies"
        lead="The documents everyone is expected to have read."
      />
      <PlaneBadge plane="work" />
      <Empty icon="📘" title="Not built yet">
        A simple list of policy documents will live here — one of the more
        straightforward additions on the list, if you want it built for
        real next.
      </Empty>
    </Shell>
  )
}
