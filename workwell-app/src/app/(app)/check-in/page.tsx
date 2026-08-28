import { createClient } from '@/lib/supabase/server'
import { readIsHr } from '@/lib/role'
import { LoadError, PageHead, RoleLocked } from '@/components/chrome'
import { PageTabs, activeTab, type Tab } from '@/components/page-tabs'
import CheckInClient from '../../check-in/check-in-client'
import { TrendsView } from '../../trends/trends-view'

/**
 * Recording the day, and what the days add up to.
 *
 * These were two routes reading one table. Trends is nothing but the
 * check-ins drawn back at you, so keeping them apart meant the record and
 * what it says could never be seen together — and meant two pieces of
 * furniture in the room for a single question. The room keeps both (the
 * journal and the desk); they now open the same page on different tabs.
 */
const TABS: Tab[] = [
  { id: 'today', label: 'Check in' },
  { id: 'trends', label: 'Trends' },
]

export default async function CheckIn({ searchParams }: PageProps<'/check-in'>) {
  const supabase = await createClient()
  const { isHr, error } = await readIsHr(supabase)

  if (error) {
    return (
      <>
        <PageHead title="Daily check-in" />
        <LoadError what="Your account" detail={error} />
      </>
    )
  }

  // Checked once for both sections rather than once per section, which is
  // what each of them used to do on its own.
  if (isHr) {
    return (
      <>
        <PageHead title="Not available on this account" />
        <RoleLocked audience="employee" />
      </>
    )
  }

  const active = activeTab(TABS, (await searchParams).tab)

  return (
    <>
      <PageTabs tabs={TABS} active={active} basePath="/check-in" />
      {active === 'trends' ? <TrendsView /> : <CheckInClient />}
    </>
  )
}
