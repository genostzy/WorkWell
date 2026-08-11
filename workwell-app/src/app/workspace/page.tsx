import { PageHead, PlaneBadge, PrivacyNote, Shell } from '@/components/chrome'
import { PreviewNotice, Segmented, ToggleRow } from '@/components/preview'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

/** Adaptive workspace — PRD F6. Theme, contrast, motion, density, focus
 *  mode and alternative input formats.
 *
 *  These are the four toggles the PRD's target users actually need: its
 *  stated audience includes people with ADHD, autism, anxiety and
 *  notification overload, for whom a busy screen is not a preference
 *  problem but an access problem. */
export default function Workspace() {
  return (
    <Shell plane="private">
      <PageHead
        title="Adaptive workspace"
        lead="All local to your device. Changes apply straight away."
      />

      <PlaneBadge plane="private" />
      <PreviewNotice what="changing these settings" />

      <PrivacyNote detail="These preferences are stored on your own device. They are not part of your record, they are not visible to HR, and nobody is told that you use high contrast or reduced motion.">
        <b>Nobody is told which of these you use.</b>{' '}
      </PrivacyNote>

      <div className="card">
        <div className="card__head">
          <div>
            <div className="card__title">Display &amp; accessibility</div>
            <div className="card__sub">
              These apply immediately, across every screen
            </div>
          </div>
        </div>

        <div className="stack mt-4">
          <div className="field">
            <span className="field__label">Colour theme</span>
            <Segmented
              label="Colour theme"
              options={['Match system', 'Light', 'Dark']}
              active="Match system"
            />
          </div>

          <div className="field">
            <span className="field__label">Contrast</span>
            <Segmented
              label="Contrast"
              options={['Normal', 'High contrast']}
              active="Normal"
            />
          </div>

          <div className="field">
            <span className="field__label">Motion</span>
            <Segmented
              label="Motion"
              options={['Match system', 'Full motion', 'Reduced motion']}
              active="Match system"
            />
            <span className="field__hint">
              Reduced motion also stops the loading shimmer.
            </span>
          </div>

          <div className="field">
            <span className="field__label">Notification density</span>
            <Segmented
              label="Notification density"
              options={['Compact', 'Comfortable', 'Spacious']}
              active="Comfortable"
            />
          </div>
        </div>
      </div>

      <div className="grid grid--2">
        <div className="card">
          <div className="card__title mb-2">Focus mode</div>
          <p className="card__sub mb-4">
            Strips the interface back to one thing at a time
          </p>
          <div className="stack stack--tight">
            <ToggleRow
              title="One question per screen"
              desc="The check-in becomes a single step at a time"
            />
            <ToggleRow title="Hide counts and totals" desc="Numbers only when you ask" />
            <ToggleRow title="Plain language only" desc="No charts, words instead" />
          </div>
        </div>

        <div className="card">
          <div className="card__title mb-2">Check-in format</div>
          <p className="card__sub mb-4">
            Alternative input formats for the daily check-in
          </p>
          <Segmented
            label="Check-in format"
            options={['Scale', 'Emoji', 'Words']}
            active="Scale"
          />
          <p className="field__hint mt-3">
            Every question stays skippable whichever you choose.
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card__title mb-2">Calendar protection</div>
        <p className="card__sub mb-4">
          Holds time so the day doesn&rsquo;t fill up by default
        </p>
        <div className="row" style={{ gap: 'var(--s-2)' }}>
          {DAYS.map((d) => (
            <button key={d} className="btn btn--secondary btn--sm" type="button">
              {d}
            </button>
          ))}
        </div>
      </div>
    </Shell>
  )
}
