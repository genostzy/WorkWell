'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function Decide({ id }: { id: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function decide(status: 'approved' | 'declined') {
    setBusy(true)
    setError(null)

    const supabase = createClient()
    // decided_by is left to the database's own view of who is asking —
    // the leave_decide policy already restricts this to HR of the same
    // org, so a client-supplied decider would be decoration.
    const { error } = await supabase
      .from('leave_requests')
      .update({ status, decided_at: new Date().toISOString() })
      .eq('id', id)

    setBusy(false)
    if (error) setError(error.message)
    else {
      setDone(status)
      router.refresh()
    }
  }

  if (done) {
    return (
      <p className="confirmed mt-3" role="status">
        <span aria-hidden="true">✓</span>
        <span>{done === 'approved' ? 'Approved.' : 'Declined.'}</span>
      </p>
    )
  }

  return (
    <>
      {error && (
        <div className="banner banner--error" role="alert">
          {error}
        </div>
      )}
      <div className="row mt-3">
        <button className="btn btn--primary btn--sm" disabled={busy} onClick={() => decide('approved')}>
          Approve
        </button>
        <button
          className="btn btn--secondary btn--sm"
          disabled={busy}
          onClick={() => decide('declined')}
        >
          Decline
        </button>
      </div>
    </>
  )
}
