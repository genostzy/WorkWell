import { createClient } from '@/lib/supabase/server'
import { readIsHr } from '@/lib/role'
import { LoadError, PageHead, RoleLocked } from '@/components/chrome'
import { Shell } from '@/components/shell'
import ExpensesClient from './expenses-client'

export default async function Expenses() {
  const supabase = await createClient()
  const { isHr, error } = await readIsHr(supabase)

  if (error) {
    return (
      <Shell plane="work">
        <PageHead title="Expenses" />
        <LoadError what="Your account" detail={error} />
      </Shell>
    )
  }

  if (isHr) {
    return (
      <Shell plane="work" isHr>
        <PageHead title="Not available on this account" />
        <RoleLocked audience="employee" />
      </Shell>
    )
  }

  return (
    <Shell plane="work">
      <ExpensesClient />
    </Shell>
  )
}
