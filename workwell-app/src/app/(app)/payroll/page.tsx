import { createClient } from '@/lib/supabase/server'
import { readIsHr } from '@/lib/role'
import { LoadError, PageHead } from '@/components/chrome'
import PayrollClient from '../../payroll/payroll-client'
import { PayrollManageClient } from '../../payroll/payroll-manage-client'

export default async function Payroll() {
  const supabase = await createClient()
  const { isHr, error } = await readIsHr(supabase)

  if (error) {
    return (
      <>
        <PageHead title="Payroll" />
        <LoadError what="Your account" detail={error} />
      </>
    )
  }

  return isHr ? <PayrollManageClient /> : <PayrollClient />
}
