'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function DecidePayrollRequest({ id, personId }: { id: string; personId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<'Resolved' | 'Declined' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function set(status: 'Resolved' | 'Declined') {
    setBusy(true)
    setError(null)

    const supabase = createClient()
    const { data: me } = await supabase.from('me').select('id').maybeSingle()
    const { error } = await supabase
      .from('payroll_requests')
      .update({
        status,
        decided_by: me?.id ?? null,
        decided_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) {
      setBusy(false)
      setError(error.message)
      return
    }

    await supabase.from('notifications').insert({
      person_id: personId,
      kind: 'salary_decided',
      title: 'Payroll request ' + status.toLowerCase(),
      body: 'HR has ' + status.toLowerCase() + ' your payroll request.',
      link: '/payroll',
    })

    setBusy(false)
    setDone(status)
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
        <button className="btn btn--primary btn--sm" disabled={busy} onClick={() => set('Resolved')}>
          Resolve
        </button>
        <button className="btn btn--secondary btn--sm" disabled={busy} onClick={() => set('Declined')}>
          Decline
        </button>
      </div>
    </>
  )
}
