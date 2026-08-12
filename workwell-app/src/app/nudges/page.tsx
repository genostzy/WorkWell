'use client'

import { PageHead, PlaneBadge, PrivacyNote, Shell } from '@/components/chrome'
import { SaveState, ToggleRow } from '@/components/controls'
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
export default function Nudges() {
  const { value, update, loading, saving, error } = usePrefs(
    'nudge_prefs',
    DEFAULTS
  )

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
                <div className="card__title">Live example</div>
                <div className="card__sub">
                  What a nudge looks like when it arrives
                </div>
              </div>
              <span className="chip">{anyOn ? 'On' : 'All off'}</span>
            </div>

            <div className="nudge mt-4">
              <div className="nudge__icon" aria-hidden="true">
                🧘
              </div>
              <div className="grow">
                <div className="nudge__title">Fancy a two-minute stretch?</div>
                <p className="nudge__text">
                  At the desk since 1:15 pm. Won&rsquo;t fix a heavy week.
                </p>
                <div className="nudge__actions">
                  <button className="btn btn--primary btn--sm" type="button">
                    Okay
                  </button>
                  <button className="btn btn--secondary btn--sm" type="button">
                    In 20 min
                  </button>
                  <button className="btn btn--ghost btn--sm" type="button">
                    Not today
                  </button>
                </div>
              </div>
            </div>
            <p className="field__hint mt-3">
              An example, so you can see the shape of one. Delivery itself
              needs a scheduler, which is not built.
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
                  At most {value.daily_cap} a day. The cap is the point.
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
