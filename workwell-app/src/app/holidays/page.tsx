import { Empty, PageHead, PlaneBadge } from '@/components/chrome'
import { Shell } from '@/components/shell'

export default function Holidays() {
  return (
    <Shell plane="work">
      <PageHead
        title="Holidays"
        lead="The company calendar — the days nobody is expected in."
      />
      <PlaneBadge plane="work" />
      <Empty icon="📅" title="Not built yet">
        Public holidays and any company-wide closures will live here once
        it's built, separate from the leave you book yourself.
      </Empty>
    </Shell>
  )
}
