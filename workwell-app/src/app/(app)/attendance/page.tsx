import { createClient } from '@/lib/supabase/server'
import { readIsHr } from '@/lib/role'
import { LoadError, PageHead, RoleLocked } from '@/components/chrome'
import AttendanceClient from '../../attendance/attendance-client'

export default async function Attendance() {
  const supabase = await createClient()
  const { isHr, error } = await readIsHr(supabase)

  if (error) {
    return (
      <>
        <PageHead title="Attendance" />
        <LoadError what="Your account" detail={error} />
      </>
    )
  }

  if (isHr) {
    return (
      <>
        <PageHead title="Not available on this account" />
        <RoleLocked audience="employee" />
      </>
    )
  }

  return <AttendanceClient />
}
