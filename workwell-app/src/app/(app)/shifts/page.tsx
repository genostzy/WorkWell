import { createClient } from '@/lib/supabase/server'
import { readIsHr } from '@/lib/role'
import { LoadError, PageHead, RoleLocked } from '@/components/chrome'
import ShiftsManageClient from '../../shifts/shifts-manage-client'

export default async function Shifts() {
  const supabase = await createClient()
  const { isHr, error } = await readIsHr(supabase)

  if (error) {
    return (
      <>
        <PageHead title="Working hours" />
        <LoadError what="Your account" detail={error} />
      </>
    )
  }

  // Deciding the roster is HR's; seeing your own hours is not a separate
  // screen — it is the ring around your room and the meal pause on
  // Attendance, both of which read the assignment directly.
  if (!isHr) {
    return (
      <>
        <PageHead title="Not available on this account" />
        <RoleLocked audience="hr" />
      </>
    )
  }

  return <ShiftsManageClient />
}
