import { PageHead, PlaneBadge, PrivacyNote, Shell } from '@/components/chrome'
import { PreviewNotice, Segmented, ToggleRow } from '@/components/preview'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** Boundary assistant — PRD F4. A user-defined working window, delayed
 *  sending, and focus protection.
 *
 *  The PRD is unusually firm about this one: no after-hours record reaches
 *  the employer, ever. An activity log is precisely the liability that
 *  right-to-disconnect law is aimed at, so the honest design is not to
 *  collect it. */
export default function Boundaries() {
  return (
    <Shell plane="private">
      <PageHead
        title="Boundary assistant"
        lead="You define your working window. Nothing here is reported to anyone."
      />

      <PlaneBadge plane="private" />
      <PreviewNotice what="setting your hours" />

      <PrivacyNote detail="Your working window, the messages held back, and when you were active are not visible to your employer in any form — not as a name, not as a total, not as a group average. An after-hours activity log is the exact record that creates legal exposure, so it is not kept.">
        <b>This is never employer-facing.</b>{' '}
      </PrivacyNote>

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
            <input className="input" id="qs" defaultValue="6:30 pm" readOnly />
          </div>
          <div className="field" style={{ flex: 1, minWidth: 130 }}>
            <label className="field__label" htmlFor="qe">
              Until
            </label>
            <input className="input" id="qe" defaultValue="8:30 am" readOnly />
          </div>
        </div>

        <p className="field__label mt-4">Days this applies</p>
        <div className="row" style={{ gap: 'var(--s-2)' }}>
          {DAYS.map((d) => (
            <button
              key={d}
              className={
                d === 'Sat' || d === 'Sun'
                  ? 'btn btn--ghost btn--sm'
                  : 'btn btn--secondary btn--sm'
              }
              type="button"
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid--2">
        <div className="card">
          <div className="card__title mb-2">Delayed sending</div>
          <p className="card__sub mb-4">
            Write when it suits you, deliver when it suits them
          </p>

          <div className="nudge">
            <div className="nudge__icon" aria-hidden="true">
              🌙
            </div>
            <div className="grow">
              <div className="nudge__title">
                It&rsquo;s 9:40 pm — send this in the morning?
              </div>
              <p className="nudge__text">
                Sending at 9:00 am means nobody feels they must reply tonight.
              </p>
              <div className="nudge__actions">
                <button className="btn btn--primary btn--sm" type="button">
                  Schedule for 9:00 am
                </button>
                <button className="btn btn--secondary btn--sm" type="button">
                  Send now anyway
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="card card--flush">
          <div style={{ padding: 'var(--s-5) var(--s-5) var(--s-3)' }}>
            <div className="card__title">Queued to send</div>
            <div className="card__sub">Two messages waiting for 9:00 am</div>
          </div>
          <div className="stack stack--tight" style={{ padding: '0 var(--s-5)' }}>
            <div className="row row--between">
              <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600 }}>
                To #platform-team
              </span>
              <span className="chip">9:00 am</span>
            </div>
            <div className="row row--between">
              <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600 }}>
                Reply to Priya N.
              </span>
              <span className="chip">9:00 am</span>
            </div>
          </div>
          <div className="card__foot">
            <button className="btn btn--ghost btn--sm" type="button">
              Send all now
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card__title mb-2">Focus protection</div>
        <p className="card__sub mb-4">
          Holds blocks in your calendar so meetings can&rsquo;t fill everything
        </p>
        <div className="stack stack--tight">
          <ToggleRow
            title="Hold two hours each morning"
            desc="Marked busy, no detail shared"
            on
          />
          <ToggleRow title="Protect lunch" desc="Every weekday" on />
          <ToggleRow title="No meetings after quiet hours start" />
        </div>
        <div className="mt-5">
          <p className="field__label">Notification density</p>
          <Segmented
            label="Notification density"
            options={['Compact', 'Comfortable', 'Spacious']}
            active="Comfortable"
          />
        </div>
      </div>
    </Shell>
  )
}
