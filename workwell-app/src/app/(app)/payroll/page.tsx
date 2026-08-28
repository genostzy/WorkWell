import { createClient } from '@/lib/supabase/server'
import { readIsHr } from '@/lib/role'
import { LoadError, PageHead } from '@/components/chrome'
import { PageTabs, activeTab, type Tab } from '@/components/page-tabs'
import PayrollClient from '../../payroll/payroll-client'
import { PayrollManageClient } from '../../payroll/payroll-manage-client'
import ExpensesClient from '../../expenses/expenses-client'

/**
 * Money owed to you: what you were paid, and what you are claiming back.
 *
 * Two rooms for one question. HR sees only the payroll half here, because
 * expense claims are decided on the People screen alongside every other
 * decision waiting on them — a second place to approve the same thing is
 * how one gets approved twice. With one section, the strip renders nothing
 * and the page is exactly what it was.
 */
function tabsFor(isHr: boolean): Tab[] {
  return isHr
    ? [{ id: 'payslips', label: 'Payroll' }]
    : [
        { id: 'payslips', label: 'Payslips' },
        { id: 'expenses', label: 'Expenses' },
      ]
}

export default async function Payroll({ searchParams }: PageProps<'/payroll'>) {
  const supabase = await createClient()
  const { isHr, error } = await readIsHr(supabase)

  if (error) {
    return (
      <>
        <PageHead title="Pay" />
        <LoadError what="Your account" detail={error} />
      </>
    )
  }

  const tabs = tabsFor(isHr)
  const active = activeTab(tabs, (await searchParams).tab)

  return (
    <>
      <PageTabs tabs={tabs} active={active} basePath="/payroll" />
      {active === 'expenses' ? (
        <ExpensesClient />
      ) : isHr ? (
        <PayrollManageClient />
      ) : (
        <PayrollClient />
      )}
    </>
  )
}
