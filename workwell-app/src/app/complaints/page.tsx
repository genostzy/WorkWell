import Link from 'next/link'
import { Empty, PageHead, PlaneBadge } from '@/components/chrome'
import { Shell } from '@/components/shell'

export default function Complaints() {
  return (
    <Shell plane="work">
      <PageHead
        title="Complaints"
        lead="A formal grievance, tracked as a case rather than a message."
      />
      <PlaneBadge plane="work" />
      <Empty icon="📋" title="Not built yet">
        <>
          <Link href="/recognition">Recognition &amp; connection</Link>{' '}
          already has a private, withdrawable way to ask HR or an external
          service for support — worth checking before this becomes a second,
          more formal case-tracking system alongside it.
        </>
      </Empty>
    </Shell>
  )
}
