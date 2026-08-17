import { createClient } from '@/lib/supabase/server'
import { PageHead } from '@/components/chrome'
import { Shell } from '@/components/shell'
import CustomFieldsClient from './custom-fields-client'

export default async function CustomFields() {
  const supabase = await createClient()
  const { data: roles } = await supabase.from('person_roles').select('role')
  const isHr = (roles ?? []).some((r) => r.role === 'hr')

  if (!isHr) {
    return (
      <Shell plane="private">
        <PageHead title="Not available on this account" />
        <div className="card">
          <div className="state">
            <div className="state__icon" aria-hidden="true">🔒</div>
            <h2 className="state__title">This area is for HR</h2>
            <p className="state__text">
              Your own data lives on the private plane, which nobody here can read.
            </p>
          </div>
        </div>
      </Shell>
    )
  }

  return (
    <Shell plane="work">
      <CustomFieldsClient />
    </Shell>
  )
}
