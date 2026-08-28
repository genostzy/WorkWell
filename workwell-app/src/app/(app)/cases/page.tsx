import { createClient } from '@/lib/supabase/server'
import { readIsHr } from '@/lib/role'
import { LoadError, PageHead } from '@/components/chrome'
import { PageTabs, activeTab, type Tab } from '@/components/page-tabs'
import ComplaintsClient from '../../complaints/complaints-client'
import ResignationsClient from '../../resignations/resignations-client'
import WarningsClient from '../../warnings/warnings-client'
import WarningsManageClient from '../../warnings/warnings-manage-client'

/**
 * The formal record between you and your employer.
 *
 * A complaint, a notice and a warning are the three things either side
 * puts in writing, and they had a screen each despite being the same
 * shape: raised by someone, decided by HR, kept. Given a name of their
 * own, they stop being three unrelated pieces of furniture and start being
 * one place to look before a conversation.
 *
 * HR sees only warnings here, and that is deliberate: complaints and
 * resignations are decided on the People screen, next to every other
 * decision waiting on them. A second place to act on the same case is how
 * one gets acted on twice.
 */
function tabsFor(isHr: boolean): Tab[] {
  return isHr
    ? [{ id: 'warnings', label: 'Warnings' }]
    : [
        { id: 'complaints', label: 'Complaints' },
        { id: 'resignation', label: 'Resignation' },
        { id: 'warnings', label: 'Warnings' },
      ]
}

export default async function Cases({ searchParams }: PageProps<'/cases'>) {
  const supabase = await createClient()
  const { isHr, error } = await readIsHr(supabase)

  if (error) {
    return (
      <>
        <PageHead title="Cases" />
        <LoadError what="Your account" detail={error} />
      </>
    )
  }

  const tabs = tabsFor(isHr)
  const active = activeTab(tabs, (await searchParams).tab)

  return (
    <>
      <PageTabs tabs={tabs} active={active} basePath="/cases" />
      {active === 'warnings' ? (
        isHr ? (
          <WarningsManageClient />
        ) : (
          <WarningsClient />
        )
      ) : active === 'resignation' ? (
        <ResignationsClient />
      ) : (
        <ComplaintsClient />
      )}
    </>
  )
}
