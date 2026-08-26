import { createClient } from '@/lib/supabase/server'
import { readIsHr } from '@/lib/role'
import { LoadError, PageHead } from '@/components/chrome'
import CompanyPoliciesClient from '../../company-policies/company-policies-client'
import { PoliciesManageClient } from '../../company-policies/policies-manage-client'

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

  return isHr ? <PoliciesManageClient /> : <CompanyPoliciesClient />
}
