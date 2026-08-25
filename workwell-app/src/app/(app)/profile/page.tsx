import { createClient } from '@/lib/supabase/server'
import { Empty, LoadError, PageHead, PrivacyNote } from '@/components/chrome'
import { ProfileSettings } from '../../profile/profile-client'

export default async function Profile() {
  const supabase = await createClient()
  const { data: me, error } = await supabase
    .from('me')
    .select('full_name')
    .maybeSingle()

  if (error) {
    return (
      <>
        <PageHead title="Profile settings" />
        <LoadError what="Your account" detail={error.message} />
      </>
    )
  }

  if (!me) {
    return (
      <>
        <PageHead title="Profile settings" />
        <Empty icon="🔑" title="No account set up yet">
          Accounts here are created by whoever runs WorkWell where you work.
          Ask them to set yours up first.
        </Empty>
      </>
    )
  }

  return (
    <>
      <PageHead
        title="Profile settings"
        lead="How WorkWell presents itself to you — set once here, seen only by you."
      />

      <ProfileSettings legalName={me.full_name} />

      <PrivacyNote
        plane="private"
        detail="Your name here, your colour, your photo — none of it reaches your employment record, and nobody else has a screen where any of it would show."
      >
        <b>Only you can see this.</b>{' '}
      </PrivacyNote>
    </>
  )
}
