'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function DecideExpense({
  id,
  personId,
  status,
}: {
  id: string
  personId: string
  status: 'Submitted' | 'Approved' | 'Reimbursed' | 'Declined'
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function set(next: 'Approved' | 'Declined' | 'Reimbursed') {
    setBusy(true)
    setError(null)

    const supabase = createClient()
    const { data: me } = await supabase.from('me').select('id').maybeSingle()
    const { error } = await supabase
      .from('expenses')
      .update({
        status: next,
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
      kind: 'expense_decided',
      title: 'Expense claim ' + next.toLowerCase(),
      body: 'Your expense claim has been ' + next.toLowerCase() + '.',
      link: '/expenses',
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
          <>
            <button className="btn btn--primary btn--sm" disabled={busy} onClick={() => set('Approved')}>
              Approve
            </button>
            <button className="btn btn--secondary btn--sm" disabled={busy} onClick={() => set('Declined')}>
              Decline
            </button>
          </>
        )}
        {status === 'Approved' && (
          <button className="btn btn--primary btn--sm" disabled={busy} onClick={() => set('Reimbursed')}>
            Mark reimbursed
          </button>
        )}
      </div>
    </>
  )
}
