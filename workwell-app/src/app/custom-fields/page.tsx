import { Empty, PageHead, PlaneBadge } from '@/components/chrome'
import { Shell } from '@/components/shell'

export default function CustomFields() {
  return (
    <Shell plane="work">
      <PageHead
        title="Custom data fields"
        lead="Add fields to an employment record beyond the built-in ones."
      />
      <PlaneBadge plane="work" />
      <Empty icon="🧩" title="Not built yet">
        An admin screen for defining extra fields — and where they'd show up
        on People — will live here.
      </Empty>
    </Shell>
  )
}
