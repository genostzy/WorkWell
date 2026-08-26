'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ConfirmButton } from '@/components/controls'

/** No notification back to the person — this feature never promises a read
 *  receipt, only that HR sees it until it's withdrawn or handled. Closing
 *  one just takes it off HR's shelf. */
export function DecideSupportRequest({ id }: { id: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function close() {
    setBusy(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase
      .from('support_requests')
      .update({ status: 'closed' })
      .eq('id', id)

    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    setDone(true)
    router.refresh()
  }

  if (done) {
    return (
      <p className="confirmed mt-3" role="status">
        <span aria-hidden="true">✓</span>
        <span>Marked handled.</span>
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
        <ConfirmButton
          label="Mark handled"
          className="btn btn--primary btn--sm"
          disabled={busy}
          onConfirm={close}
        />
      </div>
    </>
  )
}
