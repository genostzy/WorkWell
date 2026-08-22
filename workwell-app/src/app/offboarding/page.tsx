import { createClient } from '@/lib/supabase/server'
import { PageHead, RoleLocked } from '@/components/chrome'
import { Shell } from '@/components/shell'
import OffboardingClient from './offboarding-client'

export default async function Offboarding() {
  const supabase = await createClient()
  const { data: roles } = await supabase.from('person_roles').select('role')
  const isHr = (roles ?? []).some((r) => r.role === 'hr')

  if (!isHr) {
    return (
      <Shell plane="private">
        <PageHead title="Not available on this account" />
        <RoleLocked audience="hr" />
      </Shell>
    )
  }

  return (
    <Shell plane="work" isHr>
      <OffboardingClient />
    </Shell>
  )
}
