'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Initial = {
  timeIn: string | null
  lunchStart: string | null
  lunchEnd: string | null
  timeOut: string | null
}

// <input type="time"> wants local HH:MM; the DB holds timestamptz. Both
// conversions go through the requester's own local wall-clock reading of
// the value, same as fmtTime() elsewhere in attendance does for display.
function toInput(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function fromInput(day: string, hhmm: string) {
  if (!hhmm) return null
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date(day + 'T00:00:00')
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}

export function DecideAttendanceReset({
  requestId,
  day,
  initial,
}: {
  requestId: string
  day: string
  initial: Initial
}) {
  const router = useRouter()
  const [timeIn, setTimeIn] = useState(toInput(initial.timeIn))
  const [lunchStart, setLunchStart] = useState(toInput(initial.lunchStart))
  const [lunchEnd, setLunchEnd] = useState(toInput(initial.lunchEnd))
  const [timeOut, setTimeOut] = useState(toInput(initial.timeOut))
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<'approved' | 'declined' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function decide(approve: boolean) {
    setBusy(true)
    setError(null)
    const supabase = createClient()
    // Declining sends nulls along — decide_attendance_reset() ignores them
    // entirely when p_approve is false, so what's in the fields at that
    // moment never matters for a decline.
    const { error } = await supabase.rpc('decide_attendance_reset', {
      p_id: requestId,
      p_approve: approve,
      p_time_in: approve ? fromInput(day, timeIn) : null,
      p_lunch_start: approve ? fromInput(day, lunchStart) : null,
      p_lunch_end: approve ? fromInput(day, lunchEnd) : null,
      p_time_out: approve ? fromInput(day, timeOut) : null,
    })
    setBusy(false)
    if (error) setError(error.message)
    else {
      setDone(approve ? 'approved' : 'declined')
      router.refresh()
    }
  }

  if (done) {
    return (
      <p className="confirmed mt-3" role="status">
        <span aria-hidden="true">✓</span>
        <span>{done === 'approved' ? 'Approved — the record is updated.' : 'Declined.'}</span>
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
      <div className="row mt-3" style={{ flexWrap: 'wrap', gap: 'var(--s-3)' }}>
        <div className="field" style={{ flex: '1 1 120px' }}>
          <label className="field__label" htmlFor={`ti-${requestId}`}>
            Time in
          </label>
          <input
            id={`ti-${requestId}`}
            className="input"
            type="time"
            value={timeIn}
            onChange={(e) => setTimeIn(e.target.value)}
          />
        </div>
        <div className="field" style={{ flex: '1 1 120px' }}>
          <label className="field__label" htmlFor={`ls-${requestId}`}>
            Lunch start
          </label>
          <input
            id={`ls-${requestId}`}
            className="input"
            type="time"
            value={lunchStart}
            onChange={(e) => setLunchStart(e.target.value)}
          />
        </div>
        <div className="field" style={{ flex: '1 1 120px' }}>
          <label className="field__label" htmlFor={`le-${requestId}`}>
            Lunch end
          </label>
          <input
            id={`le-${requestId}`}
            className="input"
            type="time"
            value={lunchEnd}
            onChange={(e) => setLunchEnd(e.target.value)}
          />
        </div>
        <div className="field" style={{ flex: '1 1 120px' }}>
          <label className="field__label" htmlFor={`to-${requestId}`}>
            Time out
          </label>
          <input
            id={`to-${requestId}`}
            className="input"
            type="time"
            value={timeOut}
            onChange={(e) => setTimeOut(e.target.value)}
          />
        </div>
      </div>
      <div className="row mt-3">
        <button
          className="btn btn--primary btn--sm"
          type="button"
          disabled={busy}
          onClick={() => decide(true)}
        >
          Approve &amp; save
        </button>
        <button
          className="btn btn--secondary btn--sm"
          type="button"
          disabled={busy}
          onClick={() => decide(false)}
        >
          Decline
        </button>
      </div>
    </>
  )
}
