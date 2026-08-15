import { Empty, PageHead, PlaneBadge } from '@/components/chrome'
import { Shell } from '@/components/shell'

export default function Resignations() {
  return (
    <Shell plane="work">
      <PageHead
        title="Resignations"
        lead="Hand in notice, and see where it stands."
      />
      <PlaneBadge plane="work" />
      <Empty icon="✉️" title="Not built yet">
        A formal notice flow — submitted, acknowledged, last day agreed —
        will live here.
      </Empty>
    </Shell>
  )
}
