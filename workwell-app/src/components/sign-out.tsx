'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ConfirmButton } from '@/components/controls'

/**
 * scope: 'global' revokes every refresh token for the account, not just
 * this browser's. On a wellbeing product that matters: someone signing out
 * on a shared or work machine means "end my session", and leaving other
 * devices signed in quietly would be the wrong reading of that.
 *
 * Exported so the room's own front door — a second, non-button entry point
 * to the same action — can call the identical sign-out rather than growing
 * its own copy.
 */
export async function signOutEverywhere() {
  const supabase = createClient()
  await supabase.auth.signOut({ scope: 'global' })
}

/**
 * router.refresh() after the push clears the server components' cached
 * render, otherwise the next page can still show the signed-in view from
 * cache for a beat.
 */
export function SignOut({ compact = false }: { compact?: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function run() {
    setBusy(true)
    await signOutEverywhere()
    router.push('/')
    router.refresh()
  }

  return (
    <ConfirmButton
      label={busy ? 'Signing out…' : 'Sign out'}
      // Distinct from the base label on purpose — "Sign out" repeated next
      // to a "Cancel" read as two unrelated actions, not as one action
      // asking to be confirmed.
      confirmLabel="Confirm sign out"
      className={compact ? 'btn btn--ghost btn--sm' : 'btn btn--secondary btn--sm'}
      confirmClassName="btn btn--danger btn--sm"
      disabled={busy}
      onConfirm={run}
    />
  )
}
