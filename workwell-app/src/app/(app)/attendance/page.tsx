import { createClient } from '@/lib/supabase/server'
import { readIsHr } from '@/lib/role'
import { LoadError, PageHead } from '@/components/chrome'
import { PageTabs, activeTab, type Tab } from '@/components/page-tabs'
import AttendanceClient from '../../attendance/attendance-client'
import ShiftsManageClient from '../../shifts/shifts-manage-client'
import HolidaysClient from '../../holidays/holidays-client'
import HolidaysManageClient from '../../holidays/holidays-manage-client'

/**
 * When you are meant to be working, and when you were.
 *
 * Attendance, the roster and the holiday calendar answer one question
 * between them and used to be three rooms. They are also the clearest case
 * for tabs rather than one long page: an employee and HR want genuinely
 * different halves of it.
 *
 * The sections each role sees differ, which is why the tab set is built
 * per role rather than declared once. An employee stamps their own day and
 * reads the calendar; HR sets the roster that the stamping is measured
 * against and edits that same calendar. Attendance was already closed to
 * HR and the roster was already closed to everyone else — folding them
 * together changes which page they live on, not who may open them.
 */
function tabsFor(isHr: boolean): Tab[] {
  return isHr
    ? [
        { id: 'shifts', label: 'Shifts' },
        { id: 'holidays', label: 'Holidays' },
      ]
    : [
        { id: 'mine', label: 'My attendance' },
        { id: 'holidays', label: 'Holidays' },
      ]
}

export default async function Attendance({
  searchParams,
}: PageProps<'/attendance'>) {
  const supabase = await createClient()
  const { isHr, error } = await readIsHr(supabase)

  if (error) {
    return (
      <>
        <PageHead title="Time" />
        <LoadError what="Your account" detail={error} />
      </>
    )
  }

  const tabs = tabsFor(isHr)
  const active = activeTab(tabs, (await searchParams).tab)

  return (
    <>
      <PageTabs tabs={tabs} active={active} basePath="/attendance" />
      {active === 'holidays' ? (
        isHr ? (
          <HolidaysManageClient />
        ) : (
          <HolidaysClient />
        )
      ) : isHr ? (
        <ShiftsManageClient />
      ) : (
        <AttendanceClient />
      )}
    </>
  )
}
