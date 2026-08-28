'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function DecideComplaint({
  id,
  personId,
  status,
}: {
  id: string
  personId: string
  status: 'Submitted' | 'In review' | 'Resolved'
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function set(next: 'In review' | 'Resolved') {
    setBusy(true)
    setError(null)

    const supabase = createClient()
    const { data: me } = await supabase.from('me').select('id').maybeSingle()
    const { error } = await supabase
      .from('complaints')
      .update({ status: next, decided_by: me?.id ?? null, decided_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      setBusy(false)
      setError(error.message)
      return
    }

    await supabase.from('notifications').insert({
      person_id: personId,
      kind: 'complaint_updated',
      title: 'Your case is ' + next.toLowerCase(),
      body: 'HR has updated the case you filed.',
      link: '/cases',
    })

    setBusy(false)
    setDone(next)
    router.refresh()
  }

  if (done) {
    return (
      <p className="confirmed mt-3" role="status">
        <span aria-hidden="true">✓</span>
        <span>{done}.</span>
      </p>
    )
  }

  return (
    <>
      {error && (
        <div className="banner banner--error mt-3" role="alert">
          {error}
        </div>
      )}
      <div className="row mt-3">
        {status === 'Submitted' && (
          <button className="btn btn--secondary btn--sm" disabled={busy} onClick={() => set('In review')}>
            Mark in review
          </button>
        )}
        <button className="btn btn--primary btn--sm" disabled={busy} onClick={() => set('Resolved')}>
          Resolve
        </button>
      </div>
    </>
  )
}
