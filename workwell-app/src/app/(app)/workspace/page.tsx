import { createClient } from '@/lib/supabase/server'
import { readIsHr } from '@/lib/role'
import { LoadError, PageHead } from '@/components/chrome'
import WorkspaceClient from '../../workspace/workspace-client'

/**
 * Open to every account, HR included.
 *
 * It used to be employee-only, on the rule that an HR account holds no
 * private plane of its own. That rule is about somebody's wellbeing data —
 * check-ins, moods, boundaries — and these are not that: theme, contrast,
 * motion and density are how a person needs the screen to behave, and an
 * HR account is a person reading a screen. Shell already applies whatever
 * is saved here to every route, so the settings were being honoured for
 * HR all along; only the page that sets them was shut.
 *
 * The row is still private-plane and still keyed on the account itself, so
 * nobody reads anybody else's — that has not changed.
 */
export default async function Workspace() {
  const supabase = await createClient()
  const { error } = await readIsHr(supabase)

  if (error) {
    return (
      <>
        <PageHead title="Workspace" />
        <LoadError what="Your account" detail={error} />
      </>
    )
  }

  return <WorkspaceClient />
}
