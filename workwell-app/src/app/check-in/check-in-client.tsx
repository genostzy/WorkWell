'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PageHead, PlaneBadge, PrivacyNote } from '@/components/chrome'
import { usePrefs } from '@/lib/use-prefs'

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
 *
 * Format and pacing are Workspace's settings (F6), read here rather than
 * chosen here: checkin_format picks the drawing/emoji/words below, and
 * focus_one_question picks stepped-one-at-a-time vs. all four on one
 * screen. Both used to be saved without either page ever reading them back
 * — this is that wiring.
 */

const PREFS_DEFAULTS = {
  checkin_format: 'scale' as 'scale' | 'emoji' | 'words',
  focus_one_question: false,
}

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

/** One shared low-to-high face scale rather than a different set of icons
 *  per question — the word beneath each button is still what actually
 *  says what the position means; the face is a quicker glance at the same
 *  five answers, not a second, looser scale of its own. */
const EMOJI = ['', '😞', '😕', '😐', '🙂', '😄']

type Answers = Record<Key, number | null>

/** Answered on the "Saved" screen, after the timed four-question flow is
 *  already recorded — never inside it, so F2's ten-second target is never
 *  at stake for this. Fully private, same as the four questions above:
 *  there is no HR read path for it, on this table or any other. */
const DAY_TAGS: { key: string; label: string }[] = [
  { key: 'meetings', label: 'Meetings' },
  { key: 'deep_work', label: 'Deep work' },
  { key: 'interruptions', label: 'Interruptions' },
  { key: 'admin', label: 'Admin' },
]

export default function CheckInClient() {
  const router = useRouter()
  const flowRef = useRef<HTMLDivElement>(null)

  const { value: prefs, loading: prefsLoading } = usePrefs(
    'workspace_prefs',
    PREFS_DEFAULTS
  )

  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Answers>({
    mood: null,
    energy: null,
    pressure: null,
    workload: null,
  })
  const [labels, setLabels] = useState<Partial<Record<Key, string>>>({})
  const [note, setNote] = useState('')
  /** How many are already recorded today. Drives the note above the
   *  questions; zero is the ordinary case. */
  const [earlierToday, setEarlierToday] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** The row just saved, so "What ate your day?" has something to attach
   *  to. Stays null for an offline-queued save — there is no row yet to
   *  tag until it actually syncs, so the tag picker doesn't offer itself. */
  const [checkInId, setCheckInId] = useState<string | null>(null)
  const [dayEatenBy, setDayEatenBy] = useState<string[]>([])
  const [ready, setReady] = useState(false)
  const [scalesFailed, setScalesFailed] = useState(false)

  /* ------------------------------------------------------------- Loading */

  useEffect(() => {
    const supabase = createClient()
    const today = new Date().toISOString().slice(0, 10)

    // A count, not the answers. Since 0056 a day can hold several
    // check-ins and each one is its own moment, so the questions start
    // blank every time rather than pre-filled with the last set — going
    // through again records how it is now, and reopening this morning's
    // numbers would invite editing them into something that was never
    // true. maybeSingle() also had to go: it errors outright the moment a
    // day has more than one row.
    supabase
      .from('check_ins')
      .select('id', { count: 'exact', head: true })
      .eq('day', today)
      .then(({ count, error }) => {
        // None today is the normal case. A failed read is not.
        if (error) setError(error.message)
        else setEarlierToday(count ?? 0)
        setLoading(false)
      })
  }, [])

  /* -------------------------------------------------------- The scales

     They append their own children, so React must never render into those
     nodes. Mounted once, after today's values are known — dragscale reads
     data-value at init and never again — and kept mounted for the life of
     the page, which is why the steps hide rather than unmount.

     Only attempted when the format is actually 'scale': with 'emoji' or
     'words' there are no [data-scale] nodes in the DOM at all by design,
     and the old built-count check below would otherwise read that as the
     scripts failing rather than as nothing to mount. */

  useEffect(() => {
    if (loading || prefsLoading || prefs.checkin_format !== 'scale') return

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
  }, [loading, prefsLoading, prefs.checkin_format])

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
  const QUEUE_KEY = 'ww:pending_checkins'

  function queueOffline(payload: Answers & { note: string; day: string }) {
    try {
      const q = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]')
      q.push(payload)
      localStorage.setItem(QUEUE_KEY, JSON.stringify(q))
    } catch { /* ignore quota */ }
  }

  useEffect(() => {
    // Sync any queued offline check-ins when back online.
    if (!navigator.onLine) return
    const raw = localStorage.getItem(QUEUE_KEY)
    if (!raw) return
    let q: (Answers & { note: string; day: string })[]
    try { q = JSON.parse(raw) } catch { localStorage.removeItem(QUEUE_KEY); return }
    if (q.length === 0) return
    const supabase = createClient()
    ;(async () => {
      for (const item of q) {
        const { error } = await supabase.rpc('save_check_in', {
          p_mood: item.mood, p_energy: item.energy, p_pressure: item.pressure, p_workload: item.workload, p_note: item.note,
        })
        if (error) return // keep queue for next try
      }
      localStorage.removeItem(QUEUE_KEY)
    })()
  }, [loading])

  async function save() {
    setSaving(true)
    setError(null)

    const day = new Date().toISOString().slice(0,10)
    const supabase = createClient()
    const { data, error } = await supabase.rpc('save_check_in', {
      p_mood: answers.mood,
      p_energy: answers.energy,
      p_pressure: answers.pressure,
      p_workload: answers.workload,
      p_note: note,
    })

    setSaving(false)
    if (error) {
      if (!navigator.onLine || /Failed to fetch|NetworkError/i.test(error.message)) {
        queueOffline({ ...answers, note, day })
        setSaved(true)
        setError('Saved locally — will sync when back online.')
      } else setError(error.message)
    } else {
      // flushed offline queue on success
      try { localStorage.removeItem(QUEUE_KEY) } catch {}
      setCheckInId(data as string)
      setDayEatenBy([])
      setSaved(true)
      router.refresh()
    }
  }

  /** Fires immediately on tap, no separate submit — the same instant feel
   *  as the rest of this screen. Reverts on a failed write rather than
   *  leaving the chip showing a state that never actually saved. */
  async function toggleDayEatenBy(key: string) {
    if (!checkInId) return
    const prev = dayEatenBy
    const next = prev.includes(key) ? prev.filter((t) => t !== key) : [...prev, key]
    setDayEatenBy(next)

    const supabase = createClient()
    const { error: updateError } = await supabase
      .from('check_ins')
      .update({ day_eaten_by: next.length > 0 ? next : null })
      .eq('id', checkInId)

    if (updateError) {
      setDayEatenBy(prev)
      setError(updateError.message)
    }
  }

  const skip = (key: Key) => {
    setAnswers((a) => ({ ...a, [key]: null }))
    setLabels((l) => ({ ...l, [key]: undefined }))
    setStep((s) => s + 1)
  }

  const pick = (key: Key, n: number) => {
    setAnswers((a) => ({ ...a, [key]: n }))
    setLabels((l) => ({ ...l, [key]: WORDS[key][n] }))
  }

  /* ------------------------------------------------------------ Rendering */

  if (loading || prefsLoading) {
    return (
      <>
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
      </>
    )
  }

  const done = saved
  const oneAtATime = prefs.focus_one_question
  // 'scale' only actually draws once the scripts have loaded without
  // failing; a chosen 'emoji'/'words' format never touches the scripts at
  // all, so it is never at the mercy of that race.
  const useWords = prefs.checkin_format === 'words' || (prefs.checkin_format === 'scale' && scalesFailed)
  const useEmoji = prefs.checkin_format === 'emoji'

  return (
    <>
      <PageHead
        title="How’s today going?"
        lead={
          oneAtATime
            ? 'Four taps, ten seconds. Skip anything.'
            : 'All four at once. Skip anything.'
        }
      />

      <PlaneBadge plane="private" />

      {error && (
        <div className="banner banner--error mb-5" role="alert">
          <span aria-hidden="true">⚠️</span>
          <span>
            <b>Couldn’t save to your history.</b> {error}
          </span>
        </div>
      )}

      {earlierToday > 0 && !done && (oneAtATime ? step === 0 : true) && (
        <div className="banner banner--info mb-5" role="status">
          <span aria-hidden="true">✓</span>
          <span>
            <b>
              {earlierToday === 1
                ? 'You checked in once already today.'
                : `You have checked in ${earlierToday} times today.`}
            </b>{' '}
            This adds another rather than replacing it — a day is not one
            mood, and both are true.
          </span>
        </div>
      )}

      <div className="card" ref={flowRef} data-flow>
        {!done && oneAtATime && (
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

        {!done && !oneAtATime && (
          <div className="row row--between mb-5">
            <span className="stepper__label">All four questions</span>
            <Link className="btn btn--ghost btn--sm" href="/trends">
              Skip today
            </Link>
          </div>
        )}

        {/* Every step stays in the document: dragscale mounted into these
            nodes and re-mounting on each change would lose the drag state
            and the value with it. */}
        {STEPS.map((s, i) => (
          <div
            key={s.key}
            hidden={done || (oneAtATime && i !== step)}
            className={!oneAtATime && i > 0 ? 'mt-6 pt-6' : undefined}
            style={!oneAtATime && i > 0 ? { borderTop: '1px solid var(--border)' } : undefined}
          >
            <h2 className="mb-2">{s.title}</h2>
            <p className="t-subtle mb-5">{s.lead}</p>

            {useEmoji ? (
              <div className="segmented" role="group" aria-label={s.label} style={{ flexWrap: 'wrap' }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={answers[s.key] === n}
                    aria-label={WORDS[s.key][n]}
                    onClick={() => pick(s.key, n)}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}
                  >
                    <span aria-hidden="true" style={{ fontSize: 'var(--fs-xl)', lineHeight: 1 }}>
                      {EMOJI[n]}
                    </span>
                    <span style={{ fontSize: 'var(--fs-xs)' }}>{WORDS[s.key][n]}</span>
                  </button>
                ))}
              </div>
            ) : useWords ? (
              <div className="segmented" role="group" aria-label={s.label} style={{ flexWrap: 'wrap' }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={answers[s.key] === n}
                    onClick={() => pick(s.key, n)}
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

            {oneAtATime && (
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
            )}
          </div>
        ))}

        {!done && !oneAtATime && (
          <div className="row mt-6">
            <button
              className="btn btn--primary"
              type="button"
              disabled={saving}
              onClick={save}
            >
              {saving ? 'Saving…' : '✓ Save check-in'}
            </button>
          </div>
        )}

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

            {checkInId && (
              <div className="mt-5">
                <p className="t-subtle mb-2">What ate your day? (optional)</p>
                <div
                  className="row"
                  role="group"
                  aria-label="What ate your day?"
                  style={{ justifyContent: 'center', flexWrap: 'wrap', gap: 'var(--s-2)' }}
                >
                  {DAY_TAGS.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      className="chip"
                      aria-pressed={dayEatenBy.includes(t.key)}
                      onClick={() => toggleDayEatenBy(t.key)}
                      style={
                        dayEatenBy.includes(t.key)
                          ? { background: 'var(--accent-quiet)', borderColor: 'var(--accent-border)', color: 'var(--accent-text)' }
                          : undefined
                      }
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

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
                  setCheckInId(null)
                  setDayEatenBy([])
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
            <h2 className="card__title">Prefer a different format?</h2>
            <p className="t-subtle mt-2">Emoji, sliders, or plain words.</p>
          </div>
          <Link className="btn btn--secondary btn--sm nowrap" href="/workspace">
            Change format
          </Link>
        </div>
      </div>

      <PrivacyNote detail="Not the values, not the dates, not whether you checked in at all. That is what makes an honest answer possible.">
        <b>Your employer cannot see these answers.</b>{' '}
      </PrivacyNote>
    </>
  )
}
