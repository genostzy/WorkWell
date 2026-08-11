import { PageHead, PlaneBadge, PrivacyNote, Shell } from '@/components/chrome'
import { PreviewNotice, ToggleRow } from '@/components/preview'

const FEED = [
  {
    initials: 'PN',
    from: 'Priya Nair',
    time: 'Tuesday',
    text: 'Thank you for picking up the migration review at short notice — it unblocked the whole team.',
  },
  {
    initials: 'MR',
    from: 'Marco Reyes',
    time: 'Last week',
    text: 'Your notes on the incident were the clearest thing I read all month.',
  },
]

/** Recognition and connection — PRD F5. Peer appreciation, virtual coffee,
 *  and a private route to HR or an EAP.
 *
 *  No counting anywhere, by design. The PRD forbids leaderboards, and a
 *  tally of who was thanked most is a ranking of people wearing a friendly
 *  hat. */
export default function Recognition() {
  return (
    <Shell plane="private">
      <PageHead
        title="Recognition & connection"
        lead="Optional, off by default, never counted."
      />

      <PlaneBadge plane="private" />
      <PreviewNotice what="sending appreciation or a support request" />

      <PrivacyNote detail="Appreciation is private between you and the person unless you both choose otherwise. Nothing is tallied, ranked or reported — there is no leaderboard, because a count of who gets thanked most is a ranking of people in a friendly hat.">
        <b>Never counted, never ranked.</b>{' '}
      </PrivacyNote>

      <div className="grid grid--sidebar-right">
        <div className="stack">
          <div className="card">
            <div className="card__title mb-2">Appreciate someone</div>
            <p className="card__sub mb-4">
              Private unless you both choose otherwise
            </p>

            <div className="field">
              <label className="field__label" htmlFor="who">
                Who
              </label>
              <select className="select" id="who" defaultValue="Priya Nair">
                <option>Priya Nair</option>
                <option>Marco Reyes</option>
                <option>Sam Okonkwo</option>
              </select>
            </div>

            <div className="field mt-4">
              <label className="field__label" htmlFor="what">
                What for
              </label>
              <textarea
                className="textarea"
                id="what"
                placeholder="Something specific beats something warm."
              />
            </div>

            <div className="field mt-4">
              <span className="field__label">Who else can see it</span>
              <div className="segmented" role="group" aria-label="Visibility">
                <button type="button" aria-pressed="true">
                  Just them
                </button>
                <button type="button" aria-pressed="false">
                  Their team
                </button>
                <button type="button" aria-pressed="false">
                  Everyone
                </button>
              </div>
              <span className="field__hint">
                Anything wider needs their agreement.
              </span>
            </div>

            <div className="row mt-5">
              <button className="btn btn--primary" type="button">
                Send appreciation
              </button>
              <button className="btn btn--secondary" type="button">
                Send a virtual coffee instead
              </button>
            </div>
          </div>

          <div className="card card--flush">
            <div style={{ padding: 'var(--s-5) var(--s-5) var(--s-3)' }}>
              <div className="card__title">For you</div>
              <div className="card__sub">Things colleagues have sent you</div>
            </div>
            <div className="feed">
              {FEED.map((f) => (
                <article className="feed__item" key={f.from}>
                  <div className="avatar">{f.initials}</div>
                  <div className="grow">
                    <div className="row row--between">
                      <span className="feed__name">{f.from}</span>
                      <span className="feed__time">{f.time}</span>
                    </div>
                    <p className="feed__text">{f.text}</p>
                    <div className="row mt-3">
                      <button className="btn btn--ghost btn--sm" type="button">
                        Say thanks
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card__title mb-2">Virtual coffee</div>
            <p className="card__sub mb-4">Occasional pairing suggestions</p>
            <ToggleRow
              title="Suggest a pairing now and then"
              desc="Decline any of them without a word to anyone"
            />
          </div>

          <div className="card card--accent">
            <div className="card__title mb-2">Ask for support</div>
            <p className="card__sub mb-4">
              A private route to HR or an external EAP
            </p>
            <div className="field">
              <label className="field__label" htmlFor="msg">
                What would help?
              </label>
              <textarea
                className="textarea"
                id="msg"
                placeholder="Only the person you send this to will read it."
              />
            </div>
            <div className="field mt-4">
              <label className="field__label" htmlFor="to">
                Send to
              </label>
              <select className="select" id="to" defaultValue="HR">
                <option>HR — Wilson Dayrit</option>
                <option>Employee assistance programme (external)</option>
              </select>
            </div>
            <button className="btn btn--primary btn--block mt-4" type="button">
              Send privately
            </button>
            <p className="field__hint mt-3">Your manager is not copied.</p>
          </div>
        </div>
      </div>
    </Shell>
  )
}
