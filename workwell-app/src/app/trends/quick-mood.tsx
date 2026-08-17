'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const MOODS = [
  { value: 1, emoji: '😞', label: 'Low' },
  { value: 2, emoji: '😕', label: 'Off' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '😄', label: 'Great' },
]

/**
 * One tap, not four steps — the lighter door into the same check_ins row
 * the full check-in writes. save_check_in replaces the whole row rather
 * than merging, so a tap here reads what's already there for today first
 * and carries it through untouched; otherwise a quick mood tap could
 * silently erase an energy/pressure/workload answer already recorded.
 */
export function QuickMood() {
  const router = useRouter()
  const [saving, setSaving] = useState<number | null>(null)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function log(mood: number) {
    setSaving(mood)
    setError(null)
    const supabase = createClient()
    const today = new Date().toISOString().slice(0, 10)

    const { data: existing, error: readError } = await supabase
      .from('check_ins')
      .select('energy, pressure, workload, note')
      .eq('day', today)
      .maybeSingle()

    if (readError) {
      setSaving(null)
      setError(readError.message)
      return
    }

    const { error: saveError } = await supabase.rpc('save_check_in', {
      p_mood: mood,
      p_energy: existing?.energy ?? null,
      p_pressure: existing?.pressure ?? null,
      p_workload: existing?.workload ?? null,
      p_note: existing?.note ?? null,
    })

    setSaving(null)
    if (saveError) {
      setError(saveError.message)
      return
    }
    setDone(true)
    router.refresh()
  }

  if (done) {
    return (
      <div className="card card--quiet">
        <div className="confirmed" role="status">
          <span aria-hidden="true">✓</span>
          <span>Logged. It joins today&rsquo;s check-in.</span>
        </div>
      </div>
    )
  }

  return (
    <div className="card card--quiet">
      <div className="card__title mb-1">How&rsquo;s right now?</div>
      <p className="card__sub mb-3">
        One tap — the full check-in still asks the rest, whenever you want it.
      </p>

      {error && (
        <div className="banner banner--error mb-3" role="alert">
          {error}
        </div>
      )}

      <div className="row" style={{ gap: 'var(--s-2)' }} role="group" aria-label="Log your mood right now">
        {MOODS.map((m) => (
          <button
            key={m.value}
            type="button"
            className="btn btn--secondary btn--sm"
            disabled={saving !== null}
            onClick={() => log(m.value)}
            aria-label={m.label}
            title={m.label}
          >
            <span aria-hidden="true" style={{ fontSize: 'var(--fs-lg)' }}>
              {saving === m.value ? '…' : m.emoji}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
