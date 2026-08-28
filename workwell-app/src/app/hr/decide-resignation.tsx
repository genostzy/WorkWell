'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function DecideResignation({ id, personId }: { id: string; personId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function acknowledge() {
    setBusy(true)
    setError(null)

    const supabase = createClient()
    const { data: me } = await supabase.from('me').select('id').maybeSingle()
    const { error } = await supabase
      .from('resignations')
      .update({ status: 'Acknowledged', decided_by: me?.id ?? null, decided_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      setBusy(false)
      setError(error.message)
      return
    }

    await supabase.from('notifications').insert({
      person_id: personId,
      kind: 'resignation_updated',
      title: 'Your notice has been acknowledged',
      body: 'HR has acknowledged the resignation notice you submitted.',
      link: '/resignations',
    })

    setBusy(false)
    setDone(true)
    router.refresh()
  }

  if (done) {
    return (
      <p className="confirmed mt-3" role="status">
        <span aria-hidden="true">✓</span>
        <span>Acknowledged.</span>
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
        <button className="btn btn--primary btn--sm" disabled={busy} onClick={acknowledge}>
          Acknowledge
        </button>
      </div>
    </>
  )
}
