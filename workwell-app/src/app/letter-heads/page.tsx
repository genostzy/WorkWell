import { Empty, PageHead, PlaneBadge } from '@/components/chrome'
import { Shell } from '@/components/shell'

export default function LetterHeads() {
  return (
    <Shell plane="work">
      <PageHead
        title="Letter heads"
        lead="Templates HR generates from — offer letters, employment certificates, that kind of thing."
      />
      <PlaneBadge plane="work" />
      <Empty icon="📄" title="Not built yet">
        Template management and generating a filled-in letter from an
        employment record will live here.
      </Empty>
    </Shell>
  )
}
