import { createClient } from '@/lib/supabase/server'
import { readIsHr } from '@/lib/role'
import { LoadError, PageHead, RoleLocked } from '@/components/chrome'
import { Shell } from '@/components/shell'
import HolidaysClient from './holidays-client'

export default async function Holidays() {
  const supabase = await createClient()
  const { isHr, error } = await readIsHr(supabase)

  if (error) {
    return (
      <Shell plane="work">
        <PageHead title="Holidays" />
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
      <HolidaysClient />
    </Shell>
  )
}
