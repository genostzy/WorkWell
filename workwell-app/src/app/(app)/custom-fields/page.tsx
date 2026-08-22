import { createClient } from '@/lib/supabase/server'
import { PageHead, RoleLocked } from '@/components/chrome'
import CustomFieldsClient from '../../custom-fields/custom-fields-client'

export default async function CustomFields() {
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

  return <CustomFieldsClient />
}
