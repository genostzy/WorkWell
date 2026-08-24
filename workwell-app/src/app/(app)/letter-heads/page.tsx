import { createClient } from '@/lib/supabase/server'
import { PageHead, RoleLocked } from '@/components/chrome'
import LetterHeadsClient from '../../letter-heads/letter-heads-client'

export default async function LetterHeads() {
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

  return <LetterHeadsClient />
}
