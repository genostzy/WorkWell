import { createClient } from '@/lib/supabase/server'
import { PageHead, RoleLocked } from '@/components/chrome'
import OffboardingClient from '../../offboarding/offboarding-client'

export default async function Offboarding() {
  const supabase = await createClient()
  const { data: roles } = await supabase.from('person_roles').select('role')
  const isHr = (roles ?? []).some((r) => r.role === 'hr')

  if (!isHr) {
    return (
      <>
        <PageHead title="Not available on this account" />
        <RoleLocked audience="hr" />
      </>
    )
  }

  return <OffboardingClient />
}
