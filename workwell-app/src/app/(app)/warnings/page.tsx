import { createClient } from '@/lib/supabase/server'
import { readIsHr } from '@/lib/role'
import { LoadError, PageHead } from '@/components/chrome'
import WarningsClient from '../../warnings/warnings-client'
import WarningsManageClient from '../../warnings/warnings-manage-client'

export default async function Warnings() {
  const supabase = await createClient()
  const { isHr, error } = await readIsHr(supabase)

  if (error) {
    return (
      <>
        <PageHead title="Warnings" />
        <LoadError what="Your account" detail={error} />
      </>
    )
  }

  return isHr ? <WarningsManageClient /> : <WarningsClient />
}
