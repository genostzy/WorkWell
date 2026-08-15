import { Empty, PageHead, PlaneBadge } from '@/components/chrome'
import { Shell } from '@/components/shell'

export default function News() {
  return (
    <Shell plane="work">
      <PageHead title="News" lead="Announcements from your organisation." />
      <PlaneBadge plane="work" />
      <Empty icon="📰" title="Not built yet">
        A company-wide feed will live here — nothing personal, the same
        posts everyone sees.
      </Empty>
    </Shell>
  )
}
