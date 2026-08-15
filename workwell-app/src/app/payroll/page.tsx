import { Empty, PageHead, PlaneBadge, PrivacyNote } from '@/components/chrome'
import { Shell } from '@/components/shell'

export default function Payroll() {
  return (
    <Shell plane="work">
      <PageHead
        title="Payroll"
        lead="Payslips, advances, and increments or promotions — together, since they're all the same salary record."
      />
      <PlaneBadge plane="work" />

      <PrivacyNote
        plane="work"
        detail="Salary is the most sensitive record HR holds. Whatever is built here needs to be readable by the person it belongs to and by whoever actually runs payroll — nobody else, including other HR functions that don't need it."
      >
        <b>Needs its own, narrower access — not the general HR role.</b>{' '}
      </PrivacyNote>

      <Empty icon="💰" title="Not built yet">
        Payslip history, pre-payment requests, and increment or promotion
        records will live here once built.
      </Empty>
    </Shell>
  )
}
