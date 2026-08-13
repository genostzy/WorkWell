'use client'

import { PageHead, PlaneBadge, PrivacyNote } from '@/components/chrome'
import { SaveState, ToggleRow } from '@/components/controls'
import { usePrefs } from '@/lib/use-prefs'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const DEFAULTS = {
  quiet_from: '18:30:00',
  quiet_to: '08:30:00',
  quiet_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as string[],
  delayed_sending: true,
  hold_morning: false,
  protect_lunch: false,
  no_late_meetings: false,
}

/** Boundary assistant — PRD F4.
 *
 *  The PRD is firm about this one: no after-hours record reaches the
 *  employer, ever. An activity log is precisely the liability that
 *  right-to-disconnect law targets, so the honest design is not to collect
 *  it — which is why there is no "hours worked" figure anywhere here, not
 *  even for the person themselves. */
export default function BoundariesClient() {
  const { value, update, loading, saving, error } = usePrefs(
    'boundaries',
    DEFAULTS
  )

  const days = value.quiet_days ?? []

  function toggleDay(d: string) {
    const next = days.includes(d) ? days.filter((x) => x !== d) : [...days, d]
    update({ quiet_days: next })
  }

  // <input type="time"> wants HH:MM; Postgres hands back HH:MM:SS.
  const hhmm = (t: string) => (t ?? '').slice(0, 5)

  return (
    <>
      <PageHead
        title="Boundary assistant"
        lead="You define your working window. Nothing here is reported to anyone."
      />

      <PlaneBadge plane="private" />

      <PrivacyNote detail="Your working window and the messages held back are not visible to your employer in any form — not as a name, not as a total, not as a group average. No record of when you were active is kept at all, because that record is the exact thing that creates legal exposure.">
        <b>This is never employer-facing.</b>{' '}
      </PrivacyNote>

      {loading ? (
        <div className="card">
          <div className="skel skel--title" />
          <div className="skel skel--text" />
        </div>
      ) : (
        <>
          <div className="card">
            <div className="card__head">
              <div>
                <div className="card__title">Quiet hours</div>
                <div className="card__sub">
                  When you&rsquo;d rather not be pulled back into work
                </div>
              </div>
            </div>

            <div className="row mt-4" style={{ gap: 'var(--s-4)' }}>
              <div className="field" style={{ flex: 1, minWidth: 130 }}>
                <label className="field__label" htmlFor="qs">
                  From
                </label>
                <input
                  className="input"
                  id="qs"
                  type="time"
                  value={hhmm(value.quiet_from)}
                  onChange={(e) =>
                    update({ quiet_from: `${e.target.value}:00` })
                  }
                />
              </div>
              <div className="field" style={{ flex: 1, minWidth: 130 }}>
                <label className="field__label" htmlFor="qe">
                  Until
                </label>
                <input
                  className="input"
                  id="qe"
                  type="time"
                  value={hhmm(value.quiet_to)}
                  onChange={(e) => update({ quiet_to: `${e.target.value}:00` })}
                />
              </div>
            </div>

            <p className="field__label mt-4">Days this applies</p>
            <div className="row" style={{ gap: 'var(--s-2)' }}>
              {DAYS.map((d) => (
                <button
                  key={d}
                  className={
                    days.includes(d)
                      ? 'btn btn--secondary btn--sm'
                      : 'btn btn--ghost btn--sm'
                  }
                  aria-pressed={days.includes(d)}
                  type="button"
                  onClick={() => toggleDay(d)}
                >
                  {d}
                </button>
              ))}
            </div>

            <SaveState saving={saving} error={error} />
          </div>

          <div className="card">
            <div className="card__title mb-2">Delayed sending</div>
            <p className="card__sub mb-4">
              Write when it suits you, deliver when it suits them
            </p>
            <div className="stack stack--tight">
              <ToggleRow
                title="Hold messages written during quiet hours"
                desc="They go out when your working window opens"
                on={value.delayed_sending}
                onChange={(delayed_sending) => update({ delayed_sending })}
              />
            </div>
          </div>

          <div className="card">
            <div className="card__title mb-2">Focus protection</div>
            <p className="card__sub mb-4">
              Holds blocks in your calendar so meetings can&rsquo;t fill
              everything
            </p>
            <div className="stack stack--tight">
              <ToggleRow
                title="Hold two hours each morning"
                desc="Marked busy, with no detail shared"
                on={value.hold_morning}
                onChange={(hold_morning) => update({ hold_morning })}
              />
              <ToggleRow
                title="Protect lunch"
                desc="Every weekday"
                on={value.protect_lunch}
                onChange={(protect_lunch) => update({ protect_lunch })}
              />
              <ToggleRow
                title="No meetings after quiet hours start"
                on={value.no_late_meetings}
                onChange={(no_late_meetings) => update({ no_late_meetings })}
              />
            </div>
            <p className="field__hint mt-4">
              Calendar holds need a calendar connection, which is not built.
              These settings are stored and will apply when it is.
            </p>
          </div>
        </>
      )}
    </>
  )
}
