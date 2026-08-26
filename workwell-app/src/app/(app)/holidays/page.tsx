import { createClient } from '@/lib/supabase/server'
import { readIsHr } from '@/lib/role'
import { LoadError, PageHead } from '@/components/chrome'
import HolidaysClient from '../../holidays/holidays-client'
import HolidaysManageClient from '../../holidays/holidays-manage-client'

export default async function Holidays() {
  const supabase = await createClient()
  const { isHr, error } = await readIsHr(supabase)

  if (error) {
    return (
      <>
        <PageHead title="Holidays" />
        <LoadError what="Your account" detail={error} />
      </>
    )
  }

  return isHr ? <HolidaysManageClient /> : <HolidaysClient />
}
