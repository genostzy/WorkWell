'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Sign out everywhere.
 *
 * scope: 'global' revokes every refresh token for the account, not just
 * this browser's. On a wellbeing product that matters: someone signing out
 * on a shared or work machine means "end my session", and leaving other
 * devices signed in quietly would be the wrong reading of that.
 *
 * router.refresh() after the push clears the server components' cached
 * render, otherwise the next page can still show the signed-in view from
 * cache for a beat.
 */
export function SignOut({ compact = false }: { compact?: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function signOut() {
    setBusy(true)
    const supabase = createClient()
    await supabase.auth.signOut({ scope: 'global' })
    router.push('/')
    router.refresh()
  }

  return (
    <button
      className={compact ? 'btn btn--ghost btn--sm' : 'btn btn--secondary btn--sm'}
      type="button"
      onClick={signOut}
      disabled={busy}
    >
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  )
}
