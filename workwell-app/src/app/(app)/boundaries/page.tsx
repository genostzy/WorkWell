import { createClient } from '@/lib/supabase/server'
import { readIsHr } from '@/lib/role'
import { LoadError, PageHead, RoleLocked } from '@/components/chrome'
import BoundariesClient from '../../boundaries/boundaries-client'

export default async function Boundaries() {
  const supabase = await createClient()
  const { isHr, error } = await readIsHr(supabase)

  if (error) {
    return (
      <>
        <PageHead title="Boundaries" />
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

  return <BoundariesClient />
}
