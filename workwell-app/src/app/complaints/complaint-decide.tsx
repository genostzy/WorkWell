'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const STATUSES = ['open', 'investigating', 'resolved', 'closed'] as const

export function ComplaintDecide({ id }: { id: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function decide(status: string) {
    setBusy(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase
      .from('complaints')
      .update({ status })
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
      <select
        className="select"
        value=""
        disabled={busy}
        onChange={(e) => {
          if (e.target.value) decide(e.target.value)
        }}
      >
        <option value="" disabled>
          Update…
        </option>
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </option>
        ))}
      </select>
    </>
  )
}
