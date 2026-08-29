'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function Decide({
  id,
  personId,
}: {
  id: string
  personId: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function decide(status: 'approved' | 'declined') {
    setBusy(true)
    setError(null)

    const supabase = createClient()
    const { data: me } = await supabase.from('me').select('id').maybeSingle()
    const { error } = await supabase
      .from('leave_requests')
      .update({ status, decided_by: me?.id ?? null, decided_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      setBusy(false)
      setError(error.message)
      return
    }

    const { error: notifError } = await supabase.from('notifications').insert({
      person_id: personId,
      kind: 'leave_decided',
      title: 'Leave request ' + status,
      body: 'Your leave request has been ' + status + '.',
      link: '/leave',
    })
    if (notifError) {
      setError('Decision saved but notification failed: ' + notifError.message)
    }

    setBusy(false)
    setDone(status)
    router.refresh()
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
