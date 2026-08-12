'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PageHead, PlaneBadge, PrivacyNote, Shell } from '@/components/chrome'

type Answers = {
  mood: number | null
  energy: number | null
  pressure: number | null
  note: string
}

/** Three questions, all skippable per the PRD. A null answer is a real
 *  answer — "I would rather not say" must not be indistinguishable from
 *  the middle of the scale, which is why clearing is offered explicitly. */
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
    hint: 'Workload and deadlines — not how well you coped.',
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

  // Load today's entry so returning here amends rather than silently
  // starting blank over the top of existing answers.
  useEffect(() => {
    const supabase = createClient()
    const today = new Date().toISOString().slice(0, 10)

    supabase
      .from('check_ins')
      .select('mood, energy, pressure, note')
      .eq('day', today)
      .maybeSingle()
      .then(({ data, error }) => {
        // No row for today is the normal case — a blank form is right. A
        // failed read is not, and starting blank over answers that do exist
        // would quietly overwrite them on save.
        if (error) setError(error.message)
        else if (data) {
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
        <PageHead title="How was today?" />
        <div className="card">
          <div className="skel skel--title" />
          <div className="skel skel--text" />
          <div className="skel skel--text" />
        </div>
      </Shell>
    )
  }

  if (saved) {
    return (
      <Shell current="check-in">
        <PageHead title="Saved" />
        <div className="card">
          <div className="state state--info">
            <div className="state__icon" aria-hidden="true">
              ✓
            </div>
            <h2 className="state__title">That’s it.</h2>
            <p className="state__text">
              It joins your own history and nothing else.
            </p>
            <div className="state__actions">
              <Link className="btn btn--primary" href="/trends">
                See your trends
              </Link>
              <button
                className="btn btn--secondary"
                type="button"
                onClick={() => setSaved(false)}
              >
                Change an answer
              </button>
            </div>
          </div>
        </div>
      </Shell>
    )
  }

  return (
    <Shell current="check-in">
      <PageHead
        title="How was today?"
        lead="Skip anything you would rather not answer."
      />

      <PlaneBadge plane="private" />

      <PrivacyNote detail="This is stored on the private plane. HR can query group patterns for eight or more people, and your leave dates. They cannot query this table at all — not your row, not anyone's.">
        <b>Nobody else will ever read this.</b>{' '}
      </PrivacyNote>

      {error && (
        <div className="banner banner--error" role="alert">
          {error}
        </div>
      )}

      <form className="card" onSubmit={save}>
        {SCALES.map((scale) => (
          <fieldset className="scale" key={scale.key}>
            <legend className="scale__legend">{scale.label}</legend>
            <span className="scale__hint">{scale.hint}</span>
            <div className="scale__row">
              {[1, 2, 3, 4, 5].map((n) => (
                <div className="scale__opt" key={n}>
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
                className="linkish"
                onClick={() => setAnswers((a) => ({ ...a, [scale.key]: null }))}
              >
                Clear this answer
              </button>
            )}
          </fieldset>
        ))}

        <div className="field mt-6">
          <label className="field__label" htmlFor="note">
            Anything you want to note? (optional)
          </label>
          <textarea
            id="note"
            className="textarea"
            value={answers.note}
            placeholder="Only you will ever read this."
            onChange={(e) => setAnswers((a) => ({ ...a, note: e.target.value }))}
          />
        </div>

        <button
          className="btn btn--primary btn--block mt-5"
          type="submit"
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save today’s check-in'}
        </button>
      </form>
    </Shell>
  )
}
