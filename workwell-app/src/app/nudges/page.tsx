import { PageHead, PlaneBadge, PrivacyNote, Shell } from '@/components/chrome'
import { PreviewNotice, ToggleRow } from '@/components/preview'

/** Adaptive health nudges — PRD F3. Opt-in, rate-limited, silenced during
 *  leave, focus time and meetings, with one tap to mute for the day.
 *
 *  Note what is deliberately absent: any count of how many nudges you
 *  accepted. The PRD says outright that acceptance must not be optimised
 *  for, because that pushes the product toward nagging. */
export default function Nudges() {
  return (
    <Shell plane="private">
      <PageHead
        title="Health nudges"
        lead="Opt-in, capped, and silenced for the day in one tap."
      />

      <PlaneBadge plane="private" />
      <PreviewNotice what="turning nudges on or off" />

      <PrivacyNote detail="Which nudges you use, whether you dismiss them, and how often they arrive are never reported to anyone. There is no acceptance rate, because a product that optimises for that becomes a product that nags.">
        <b>Nobody is told whether you follow these.</b>{' '}
      </PrivacyNote>

      <div className="card">
        <div className="card__head">
          <div>
            <div className="card__title">Live example</div>
            <div className="card__sub">What a nudge looks like when it arrives</div>
          </div>
          <span className="chip">Preview</span>
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
      </div>

      <div className="grid grid--2">
        <div className="card">
          <div className="card__title mb-2">Which nudges you&rsquo;d like</div>
          <p className="card__sub mb-4">All off by default</p>
          <div className="stack stack--tight">
            <ToggleRow title="Move" desc="After a long unbroken stretch at the desk" />
            <ToggleRow title="Hydrate" desc="Occasional, never during meetings" />
            <ToggleRow title="Breathe" desc="Two minutes, before a heavy block" />
            <ToggleRow title="Step away" desc="When the day has run long" />
          </div>
        </div>

        <div className="card">
          <div className="card__title mb-3">
            Never interrupt{' '}
            <span className="t-subtle" style={{ fontWeight: 500 }}>
              — enforced
            </span>
          </div>
          <div className="stack stack--tight">
            <ToggleRow title="Time off & leave" on />
            <ToggleRow title="Out of office" on />
            <ToggleRow title="Focus time" on />
            <ToggleRow title="Meetings" on />
            <ToggleRow title="Quiet hours" on />
          </div>
        </div>
      </div>

      <div className="card card--quiet">
        <div className="row row--between">
          <div>
            <div className="card__title">Today&rsquo;s nudges</div>
            <p className="card__sub">
              You&rsquo;ve had 2 of a maximum 4. The cap is the point.
            </p>
          </div>
          <button className="btn btn--secondary btn--sm" type="button">
            Mute for today
          </button>
        </div>
      </div>
    </Shell>
  )
}
