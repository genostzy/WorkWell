import { Empty, PageHead, PlaneBadge } from '@/components/chrome'
import { Shell } from '@/components/shell'

export default function Assets() {
  return (
    <Shell plane="work">
      <PageHead
        title="Assets"
        lead="Equipment issued to you — laptops, badges, anything else on loan."
      />
      <PlaneBadge plane="work" />
      <Empty icon="💻" title="Not built yet">
        This has a spot in the room now. The record of what is issued to
        whom, and the return flow when someone leaves, is next.
      </Empty>
    </Shell>
  )
}
