'use client'

import { PageHead, PlaneBadge, PrivacyNote, Shell } from '@/components/chrome'
import { SaveState, ToggleRow } from '@/components/controls'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { usePrefs } from '@/lib/use-prefs'

const DEFAULTS = {
  move: false,
  hydrate: false,
  breathe: false,
  step_away: false,
  daily_cap: 4,
  muted_until: null as string | null,
}

const KINDS = [
  { key: 'move' as const, title: 'Move', desc: 'After a long unbroken stretch at the desk' },
  { key: 'hydrate' as const, title: 'Hydrate', desc: 'Occasional, never during meetings' },
  { key: 'breathe' as const, title: 'Breathe', desc: 'Two minutes, before a heavy block' },
  { key: 'step_away' as const, title: 'Step away', desc: 'When the day has run long' },
]

/** Adaptive health nudges — PRD F3.
 *
 *  Note what is not here: any count of how many nudges you accepted. The
 *  PRD refuses to optimise for acceptance, because a product that measures
 *  it becomes a product that nags. The cap is stored server-side so it is
 *  enforceable rather than a number the client agrees to respect. */
type Delivered = { id: string; kind: string; action: string | null }

const COPY: Record<string, { title: string; text: string }> = {
  move: { title: 'Fancy a two-minute stretch?', text: 'A while at the desk now. Won’t fix a heavy week.' },
  hydrate: { title: 'Water within reach?', text: 'Small thing, easy to miss.' },
  breathe: { title: 'Two minutes before the next block?', text: 'Nothing to log, nothing to report.' },
  step_away: { title: 'Long day — worth stopping?', text: 'The work will still be there tomorrow.' },
}

export default function Nudges() {
  const { value, update, loading, saving, error } = usePrefs(
    'nudge_prefs',
    DEFAULTS
  )
  const [delivered, setDelivered] = useState<Delivered[]>([])
  const [logError, setLogError] = useState<string | null>(null)
  const [answering, setAnswering] = useState<string | null>(null)

  const loadDelivered = useCallback(async () => {
    const supabase = createClient()
    const today = new Date().toISOString().slice(0, 10)
    const { data, error } = await supabase
      .from('nudge_log')
      .select('id, kind, action')
      .eq('sent_on', today)
    setLogError(error?.message ?? null)
    setDelivered(data ?? [])
  }, [])

  useEffect(() => {
    loadDelivered()
  }, [loadDelivered])

  // Answering used to ignore its own result, so a failed write left the
  // nudge sitting there and the three buttons doing nothing visible. A
  // silent no-op is the one response a person cannot act on.
  async function answer(id: string, action: string) {
    setAnswering(id)
    setLogError(null)
    const supabase = createClient()
    const { error } = await supabase
      .from('nudge_log')
      .update({ action })
      .eq('id', id)
    setAnswering(null)

    if (error) setLogError(error.message)
    else loadDelivered()
  }

  const open = delivered.filter((d) => d.action === null)

  const today = new Date().toISOString().slice(0, 10)
  const muted = value.muted_until != null && value.muted_until >= today
  const anyOn = KINDS.some((k) => value[k.key])

  return (
    <Shell plane="private">
      <PageHead
        title="Health nudges"
        lead="Opt-in, capped, and silenced for the day in one tap."
      />

      <PlaneBadge plane="private" />

      <PrivacyNote detail="Which nudges you use, whether you dismiss them, and how often they arrive are never reported to anyone. There is no acceptance rate anywhere in this product, because measuring that is the first step to nagging.">
        <b>Nobody is told whether you follow these.</b>{' '}
      </PrivacyNote>

      {loading ? (
        <div className="card">
          <div className="skel skel--title" />
          <div className="skel skel--text" />
        </div>
      ) : (
        <>
          {muted && (
            <div className="banner banner--info mb-5" role="status">
              <span aria-hidden="true">🔕</span>
              <span>
                <b>Quiet for the rest of today.</b> Nothing will arrive until
                tomorrow.
              </span>
              <button
                className="btn btn--ghost btn--sm"
                type="button"
                onClick={() => update({ muted_until: null })}
              >
                Unmute now
              </button>
            </div>
          )}

          <div className="card">
            <div className="card__head">
              <div>
                <div className="card__title">Waiting for you</div>
                <div className="card__sub">
                  Delivered hourly during your working window
                </div>
              </div>
              <span className="chip">{anyOn ? 'On' : 'All off'}</span>
            </div>

            {logError && (
              <div className="banner banner--error mt-4" role="alert">
                <span aria-hidden="true">⚠️</span>
                <span>
                  <b>That did not go through.</b> {logError}
                </span>
              </div>
            )}

            {open.length === 0 ? (
              <p className="t-subtle mt-4">
                {anyOn
                  ? 'Nothing waiting. They arrive during your working window, up to the cap.'
                  : 'Turn something on below and they will start arriving.'}
              </p>
            ) : (
              <div className="stack mt-4">
                {open.map((d) => (
                  <div className="nudge" key={d.id}>
                    <div className="nudge__icon" aria-hidden="true">
                      🌿
                    </div>
                    <div className="grow">
                      <div className="nudge__title">
                        {COPY[d.kind]?.title ?? d.kind}
                      </div>
                      <p className="nudge__text">{COPY[d.kind]?.text}</p>
                      <div className="nudge__actions">
                        <button
                          className="btn btn--primary btn--sm"
                          type="button"
                          disabled={answering === d.id}
                          onClick={() => answer(d.id, 'accepted')}
                        >
                          Okay
                        </button>
                        <button
                          className="btn btn--secondary btn--sm"
                          type="button"
                          disabled={answering === d.id}
                          onClick={() => answer(d.id, 'snoozed')}
                        >
                          In 20 min
                        </button>
                        <button
                          className="btn btn--ghost btn--sm"
                          type="button"
                          disabled={answering === d.id}
                          onClick={() => answer(d.id, 'dismissed')}
                        >
                          Not today
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="field__hint mt-3">
              What you answer is never counted or reported. It is recorded
              only so the same one does not arrive twice.
            </p>
          </div>

          <div className="grid grid--2">
            <div className="card">
              <div className="card__title mb-2">Which nudges you&rsquo;d like</div>
              <p className="card__sub mb-4">All off by default</p>
              <div className="stack stack--tight">
                {KINDS.map((k) => (
                  <ToggleRow
                    key={k.key}
                    title={k.title}
                    desc={k.desc}
                    on={Boolean(value[k.key])}
                    onChange={(on) => update({ [k.key]: on })}
                  />
                ))}
              </div>
              <SaveState saving={saving} error={error} />
            </div>

            <div className="card">
              <div className="card__title mb-3">
                Never interrupt{' '}
                <span className="t-subtle" style={{ fontWeight: 500 }}>
                  — enforced
                </span>
              </div>
              <p className="t-subtle mb-4">
                These are not preferences. They hold whatever else you turn on.
              </p>
              <div className="stack stack--tight">
                {[
                  'Time off & leave',
                  'Out of office',
                  'Focus time',
                  'Meetings',
                  'Quiet hours',
                ].map((t) => (
                  <div className="row row--between" key={t}>
                    <span className="toggle__title">{t}</span>
                    <span className="chip chip--accent">Always</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card card--quiet">
            <div className="row row--between">
              <div>
                <div className="card__title">Daily cap</div>
                <p className="card__sub">
                  {delivered.length} of at most {value.daily_cap} today. The cap
                  is the point.
                </p>
              </div>
              {!muted && (
                <button
                  className="btn btn--secondary btn--sm"
                  type="button"
                  onClick={() => update({ muted_until: today })}
                >
                  Mute for today
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </Shell>
  )
}
