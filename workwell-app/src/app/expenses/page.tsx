import { Empty, PageHead, PlaneBadge } from '@/components/chrome'
import { Shell } from '@/components/shell'

export default function Expenses() {
  return (
    <Shell plane="work">
      <PageHead
        title="Expenses"
        lead="Claim something back, and see where it stands."
      />
      <PlaneBadge plane="work" />
      <Empty icon="🧾" title="Not built yet">
        A claim-and-approve flow, the same shape as leave requests, will
        live here.
      </Empty>
    </Shell>
  )
}
