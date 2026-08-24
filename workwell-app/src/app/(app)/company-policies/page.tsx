import { createClient } from '@/lib/supabase/server'
import { readIsHr } from '@/lib/role'
import { LoadError, PageHead, RoleLocked } from '@/components/chrome'
import CompanyPoliciesClient from '../../company-policies/company-policies-client'

export default async function CompanyPolicies() {
  const supabase = await createClient()
  const { isHr, error } = await readIsHr(supabase)

  if (error) {
    return (
      <>
        <PageHead title="Company policies" />
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

  return <CompanyPoliciesClient />
}
