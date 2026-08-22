'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function ResignationDecide({
  id,
  status,
}: {
  id: string
  status: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const next: Record<string, string> = {
    submitted: 'acknowledged',
    acknowledged: 'accepted',
  }

  const action = next[status]

  if (!action && !done) return null

  async function decide(newStatus: string) {
    setBusy(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase
      .from('resignations')
      .update({ status: newStatus })
      .eq('id', id)

    setBusy(false)
    if (error) setError(error.message)
    else {
      setDone(newStatus)
      router.refresh()
    }
  }

  if (done) {
    return (
      <span className="chip chip--accent" role="status">
        {done}
      </span>
    )
  }

  return (
    <>
      {error && (
        <div className="banner banner--error" role="alert">
          {error}
        </div>
      )}
      <button
        className="btn btn--primary btn--sm"
        disabled={busy}
        onClick={() => decide(action)}
      >
        {action === 'acknowledged' ? 'Acknowledge' : 'Accept'}
      </button>
    </>
  )
}
