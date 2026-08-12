'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PageHead, PlaneBadge, PrivacyNote, Shell } from '@/components/chrome'

/**
 * The daily check-in, as the prototype draws it.
 *
 * Four questions, one per step, each answered by dragging a shape rather
 * than picking a number: shape the face, fill the battery, squeeze the
 * block, balance the scales. dragscale.js and scales.js are vendored
 * unmodified from workwell-prototype and mount themselves into the empty
 * divs below — React owns the flow, they own the drawing.
 *
 * Two places this departs from the prototype, both deliberate:
 *
 * "Skip this" records nothing rather than keeping the scale's starting
 * value. The prototype seeds its summary from whatever the scale happened
 * to render with, which makes a skipped question indistinguishable from a
 * deliberate middle answer — and the PRD requires every question be
 * skippable and "would rather not say" be its own answer. The column is
 * nullable for exactly this reason.
 *
 * The note says it is stored on your private plane, not "on your device",
 * because here it genuinely is stored — and the plane is the promise.
 */

type Key = 'mood' | 'energy' | 'pressure' | 'workload'

/**
 * These four have to execute in this order and nothing else enforces it.
 *
 * scales.js calls WW.defineScale at the top level, which dragscale.js
 * defines; dragscale.js calls WW.onReady, which ready.js defines, and
 * WW.icon, which icons.js defines. next/script's afterInteractive loads in
 * parallel and guarantees no order between separate tags, so scales.js
 * could — and did — run first, throw on an undefined defineScale, and
 * register nothing. initDragScale then returns null against an empty
 * registry and the step renders an empty box with no error in sight.
 *
 * Loading them by hand, in sequence, is what removes the race.
 */
const SCRIPTS = [
  '/prototype/ready.js',
  '/prototype/icons.js',
  '/prototype/dragscale.js',
  '/prototype/scales.js',
]

function loadInOrder(srcs: string[]) {
  return srcs.reduce(
    (chain, src) =>
      chain.then(
        () =>
          new Promise<void>((resolve, reject) => {
            const found = document.querySelector<HTMLScriptElement>(
              `script[data-ww="${src}"]`
            )
            // Already there from an earlier visit to this screen.
            if (found) {
              if (found.dataset.done) return resolve()
              found.addEventListener('load', () => resolve(), { once: true })
              found.addEventListener('error', () => reject(new Error(src)), {
                once: true,
              })
              return
            }
            const s = document.createElement('script')
            s.src = src
            s.dataset.ww = src
            s.addEventListener('load', () => {
              s.dataset.done = 'true'
              resolve()
            })
            s.addEventListener('error', () => reject(new Error(src)))
            document.head.append(s)
          })
      ),
    Promise.resolve()
  )
}

const STEPS: {
  key: Key
  title: string
  lead: string
  label: string
  fallback: number
}[] = [
  {
    key: 'mood',
    title: 'How’s your mood?',
    lead: 'Shape the face to match. No right answer, and nothing is averaged into a score.',
    label: 'Mood',
    fallback: 3,
  },
  {
    key: 'energy',
    title: 'How’s your energy?',
    lead: 'Physical or mental, whichever you notice more.',
    label: 'Energy',
    fallback: 2,
  },
  {
    key: 'pressure',
    title: 'How much pressure are you under?',
    lead: 'Squeeze the shape to match — drag either plate.',
    label: 'Pressure',
    fallback: 4,
  },
  {
    key: 'workload',
    title: 'How does the workload feel?',
    lead: 'Left is what you can take, right is what’s on you. This is about the amount of work — not how well you’re coping.',
    label: 'Workload',
    fallback: 4,
  },
]

/** The same words scales.js labels each position with, so the fallback
 *  below asks the question in the same language the drawings do. */
const WORDS: Record<Key, string[]> = {
  mood: ['', 'Low', 'Not great', 'OK', 'Good', 'Great'],
  energy: ['', 'Empty', 'Low', 'Steady', 'Good', 'High'],
  pressure: ['', 'Calm', 'Settled', 'Noticeable', 'High', 'Very high'],
  workload: ['', 'Light', 'Manageable', 'About right', 'Heavy', 'Too much'],
}

type Answers = Record<Key, number | null>

export default function CheckIn() {
  const router = useRouter()
  const flowRef = useRef<HTMLDivElement>(null)

  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Answers>({
    mood: null,
    energy: null,
    pressure: null,
    workload: null,
  })
  const [labels, setLabels] = useState<Partial<Record<Key, string>>>({})
  const [note, setNote] = useState('')
  const [existing, setExisting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [scalesFailed, setScalesFailed] = useState(false)

  /* ------------------------------------------------------------- Loading */

  useEffect(() => {
    const supabase = createClient()
    const today = new Date().toISOString().slice(0, 10)

    supabase
      .from('check_ins')
      .select('mood, energy, pressure, workload, note')
      .eq('day', today)
      .maybeSingle()
      .then(({ data, error }) => {
        // No row for today is the normal case. A failed read is not, and
        // starting blank over answers that exist would overwrite them.
        if (error) setError(error.message)
        else if (data) {
          setExisting(true)
          setAnswers({
            mood: data.mood,
            energy: data.energy,
            pressure: data.pressure,
            workload: data.workload,
          })
          setNote(data.note ?? '')
        }
        setLoading(false)
      })
  }, [])

  /* -------------------------------------------------------- The scales

     They append their own children, so React must never render into those
     nodes. Mounted once, after today's values are known — dragscale reads
     data-value at init and never again — and kept mounted for the life of
     the page, which is why the steps hide rather than unmount. */

  useEffect(() => {
    // Nothing to mount into until today's values are known: dragscale reads
    // data-value once, at init, and never looks again.
    if (loading) return

    let cancelled = false

    loadInOrder(SCRIPTS)
      .then(() => {
        if (cancelled || !flowRef.current) return

        const init = window.WW?.initDragScale
        if (!init) throw new Error('dragscale did not define initDragScale')

        let built = 0
        flowRef.current
          .querySelectorAll<HTMLElement>('[data-scale]')
          .forEach((el) => {
            if (el.dataset.mounted) {
              built += 1
              return
            }
            // initDragScale returns null for a name it has no drawing for,
            // which is the quiet failure that produced the empty step.
            if (init(el)) {
              el.dataset.mounted = 'true'
              built += 1
            }
          })

        if (built < STEPS.length) throw new Error('a scale has no drawing registered')
        setReady(true)
      })
      .catch(() => {
        // The drawings are how this screen is meant to be answered, but they
        // are not the only way it can be. Fall back to the words rather than
        // leave someone looking at an empty card.
        if (!cancelled) setScalesFailed(true)
      })

    return () => {
      cancelled = true
    }
  }, [loading])

  // One listener for all four: the event bubbles and carries its own name.
  useEffect(() => {
    const el = flowRef.current
    if (!el) return
    const onScale = (e: Event) => {
      const { name, value, label } = (e as CustomEvent).detail
      setAnswers((a) => ({ ...a, [name as Key]: value as number }))
      setLabels((l) => ({ ...l, [name as Key]: label as string }))
    }
    el.addEventListener('ww:scale', onScale)
    return () => el.removeEventListener('ww:scale', onScale)
  }, [ready])

  /* -------------------------------------------------------------- Saving */

  async function save() {
    setSaving(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.rpc('save_check_in', {
      p_mood: answers.mood,
      p_energy: answers.energy,
      p_pressure: answers.pressure,
      p_workload: answers.workload,
      p_note: note,
    })

    setSaving(false)
    if (error) setError(error.message)
    else {
      setSaved(true)
      router.refresh()
    }
  }

  const skip = (key: Key) => {
    setAnswers((a) => ({ ...a, [key]: null }))
    setLabels((l) => ({ ...l, [key]: undefined }))
    setStep((s) => s + 1)
  }

  /* ------------------------------------------------------------ Rendering */

  if (loading) {
    return (
      <Shell current="check-in">
        <PageHead title="How’s today going?" />
        <div className="card" aria-hidden="true">
          <div className="skel skel--text w-50 mb-5" />
          <div className="skel" style={{ height: 6 }} />
          <div className="skel skel--title mt-6 mb-4" />
          <div className="grid grid--4 mt-4">
            {[0, 1, 2, 3].map((i) => (
              <div className="skel" style={{ height: 92 }} key={i} />
            ))}
          </div>
        </div>
        <p className="sr-only" role="status">
          Loading your check-in.
        </p>
      </Shell>
    )
  }

  const done = saved
  const current = STEPS[step]

  return (
    <Shell current="check-in">
      <PageHead
        title="How’s today going?"
        lead="Four taps, ten seconds. Skip anything."
      />

      <PlaneBadge plane="private" />

      <PrivacyNote detail="Not the values, not the dates, not whether you checked in at all. That is what makes an honest answer possible.">
        <b>Your employer cannot see these answers.</b>{' '}
      </PrivacyNote>

      {error && (
        <div className="banner banner--error mb-5" role="alert">
          <span aria-hidden="true">⚠️</span>
          <span>
            <b>Couldn’t save to your history.</b> {error}
          </span>
        </div>
      )}

      {existing && !done && step === 0 && (
        <div className="banner banner--info mb-5" role="status">
          <span aria-hidden="true">✓</span>
          <span>
            <b>You already checked in today.</b> Going through again amends
            it — one a day is plenty.
          </span>
        </div>
      )}

      <div className="card" ref={flowRef} data-flow>
        {!done && (
          <>
            <div className="row row--between mb-5">
              <span className="stepper__label">
                Step {step + 1} of {STEPS.length}
              </span>
              <Link className="btn btn--ghost btn--sm" href="/trends">
                Skip today
              </Link>
            </div>
            <div className="stepper mb-6" aria-hidden="true">
              {STEPS.map((s, i) => (
                <span
                  className="stepper__dot"
                  key={s.key}
                  data-done={i <= step ? 'true' : 'false'}
                />
              ))}
            </div>
          </>
        )}

        {/* Every step stays in the document: dragscale mounted into these
            nodes and re-mounting on each change would lose the drag state
            and the value with it. */}
        {STEPS.map((s, i) => (
          <div key={s.key} hidden={done || i !== step}>
            <h2 className="mb-2">{s.title}</h2>
            <p className="t-subtle mb-5">{s.lead}</p>

            {scalesFailed ? (
              // Same question, same words, no drawing.
              <div
                className="segmented"
                role="group"
                aria-label={s.label}
                style={{ flexWrap: 'wrap' }}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={answers[s.key] === n}
                    onClick={() => {
                      setAnswers((a) => ({ ...a, [s.key]: n }))
                      setLabels((l) => ({ ...l, [s.key]: WORDS[s.key][n] }))
                    }}
                  >
                    {WORDS[s.key][n]}
                  </button>
                ))}
              </div>
            ) : (
              <div
                data-scale={s.key}
                data-value={answers[s.key] ?? s.fallback}
                data-label={s.label}
              />
            )}

            {s.key === 'workload' && (
              <div className="field mt-5">
                <label className="field__label" htmlFor="note">
                  Anything you want to note? (optional)
                </label>
                <textarea
                  id="note"
                  className="textarea"
                  value={note}
                  placeholder="Only you will ever read this."
                  onChange={(e) => setNote(e.target.value)}
                />
                <span className="field__hint">
                  Stored on your private plane, with the rest of it.
                </span>
              </div>
            )}

            <div className="row mt-6">
              {i > 0 && (
                <button
                  className="btn btn--secondary"
                  type="button"
                  onClick={() => setStep(i - 1)}
                >
                  ‹ Back
                </button>
              )}

              {i < STEPS.length - 1 ? (
                <>
                  <button
                    className="btn btn--primary"
                    type="button"
                    onClick={() => setStep(i + 1)}
                  >
                    Next ›
                  </button>
                  <button
                    className="btn btn--ghost"
                    type="button"
                    onClick={() => skip(s.key)}
                  >
                    Skip this
                  </button>
                </>
              ) : (
                <button
                  className="btn btn--primary"
                  type="button"
                  disabled={saving}
                  onClick={save}
                >
                  {saving ? 'Saving…' : '✓ Save check-in'}
                </button>
              )}
            </div>
          </div>
        ))}

        {done && (
          <div className="state state--info">
            <div className="state__icon" aria-hidden="true">
              ✓
            </div>
            <h2 className="state__title">Saved. That’s it.</h2>
            <p className="state__text">
              It joins your own history and nothing else.
            </p>

            <div
              className="row mt-2"
              style={{ justifyContent: 'center', gap: 'var(--s-2)' }}
            >
              {STEPS.filter((s) => answers[s.key] !== null).map((s) => (
                <span className="chip" key={s.key}>
                  {s.label}: <b>{labels[s.key] ?? answers[s.key]}</b>
                </span>
              ))}
            </div>

            <div
              className="state__actions row"
              style={{ justifyContent: 'center' }}
            >
              <Link className="btn btn--primary" href="/trends">
                See your trends
              </Link>
              <button
                className="btn btn--secondary"
                type="button"
                onClick={() => {
                  setSaved(false)
                  setStep(0)
                }}
              >
                Change an answer
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="card card--quiet mt-5">
        <div className="row row--between">
          <div>
            <div className="card__title">Prefer a different format?</div>
            <p className="t-subtle mt-2">Emoji, sliders, or plain words.</p>
          </div>
          <Link className="btn btn--secondary btn--sm nowrap" href="/workspace">
            Change format
          </Link>
        </div>
      </div>
    </Shell>
  )
}
