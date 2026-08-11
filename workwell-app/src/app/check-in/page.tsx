'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PrivacyNote, Shell } from '@/components/chrome'

type Answers = {
  mood: number | null
  energy: number | null
  pressure: number | null
  note: string
}

/** Three questions, all skippable per the PRD. A null answer is a real
 *  answer — "I would rather not say" must not be indistinguishable from
 *  the middle of the scale. */
const SCALES = [
  {
    key: 'mood' as const,
    label: 'How did today feel?',
    hint: 'Your overall sense of the day.',
    low: 'Rough',
    high: 'Good',
  },
  {
    key: 'energy' as const,
    label: 'How much did you have in the tank?',
    hint: 'Energy, not productivity.',
    low: 'Empty',
    high: 'Full',
  },
  {
    key: 'pressure' as const,
    label: 'How much pressure were you under?',
    hint: 'Workload and deadlines, not how well you coped.',
    low: 'None',
    high: 'A lot',
  },
]

export default function CheckIn() {
  const router = useRouter()
  const [answers, setAnswers] = useState<Answers>({
    mood: null,
    energy: null,
    pressure: null,
    note: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load today's entry if there is one, so returning to this page amends
  // rather than silently starting blank over the top of existing answers.
  useEffect(() => {
    const supabase = createClient()
    const today = new Date().toISOString().slice(0, 10)

    supabase
      .from('check_ins')
      .select('mood, energy, pressure, note')
      .eq('day', today)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setAnswers({
            mood: data.mood,
            energy: data.energy,
            pressure: data.pressure,
            note: data.note ?? '',
          })
        }
        setLoading(false)
      })
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.rpc('save_check_in', {
      p_mood: answers.mood,
      p_energy: answers.energy,
      p_pressure: answers.pressure,
      p_note: answers.note,
    })

    setSaving(false)
    if (error) setError(error.message)
    else {
      setSaved(true)
      router.refresh()
    }
  }

  if (loading) {
    return (
      <Shell current="check-in">
        <p className="state">Loading today’s entry…</p>
      </Shell>
    )
  }

  if (saved) {
    return (
      <Shell current="check-in">
        <h1>Saved</h1>
        <p className="lead">That is all it takes. It joins your own history and nothing else.</p>
        <div className="confirmed" role="status">
          <span aria-hidden="true">✓</span>
          <span>Today’s check-in is recorded.</span>
        </div>
        <div className="mt">
          <button className="btn btn--quiet" onClick={() => setSaved(false)}>
            Change an answer
          </button>
        </div>
      </Shell>
    )
  }

  return (
    <Shell current="check-in">
      <h1>How was today?</h1>
      <p className="lead">Skip anything you would rather not answer.</p>

      <PrivacyNote />

      {error && <p className="error" role="alert">{error}</p>}

      <form onSubmit={save}>
        {SCALES.map((scale) => (
          <fieldset className="scale" key={scale.key}>
            <legend className="scale__label">{scale.label}</legend>
            <span className="scale__hint">{scale.hint}</span>
            <div className="scale__row">
              {[1, 2, 3, 4, 5].map((n) => (
                <div key={n} style={{ flex: 1, display: 'flex' }}>
                  <input
                    type="radio"
                    id={`${scale.key}-${n}`}
                    name={scale.key}
                    checked={answers[scale.key] === n}
                    onChange={() =>
                      setAnswers((a) => ({ ...a, [scale.key]: n }))
                    }
                  />
                  <label htmlFor={`${scale.key}-${n}`}>{n}</label>
                </div>
              ))}
            </div>
            <div className="scale__ends">
              <span>{scale.low}</span>
              <span>{scale.high}</span>
            </div>
            {answers[scale.key] !== null && (
              <button
                type="button"
                className="muted"
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '6px 0 0',
                  cursor: 'pointer',
                  font: 'inherit',
                  color: 'var(--text-muted)',
                  textDecoration: 'underline',
                }}
                onClick={() => setAnswers((a) => ({ ...a, [scale.key]: null }))}
              >
                Clear this answer
              </button>
            )}
          </fieldset>
        ))}

        <label className="field" htmlFor="note">
          Anything you want to note? (optional)
        </label>
        <textarea
          id="note"
          className="input"
          value={answers.note}
          placeholder="Only you will ever read this."
          onChange={(e) => setAnswers((a) => ({ ...a, note: e.target.value }))}
        />

        <div className="mt">
          <button className="btn btn--block" type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save today’s check-in'}
          </button>
        </div>
      </form>
    </Shell>
  )
}
