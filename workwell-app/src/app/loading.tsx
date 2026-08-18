import { Wordmark } from '@/components/brandmark'

/**
 * Your space, arriving.
 *
 * This is the root loading state, so it covers your space and the sign-in
 * screen — both of which are the room, not the article column, which is why
 * it does not use the ScreenSkeleton the inner screens share.
 *
 * The room takes a moment for an honest reason: the page reads who you are,
 * then the vendored scripts draw the plan. Saying so is better than a blank
 * viewport that looks like a click nothing happened to.
 */
export default function Loading() {
  return (
    <div className="room-shell is-fit">
      <div className="room-brand">
        <Wordmark />
      </div>
      <main className="room-stage">
        <div className="room-views is-on" data-view-panel="room">
          <p className="t-subtle" style={{ textAlign: 'center' }} role="status">
            Opening your space…
          </p>
        </div>
      </main>
    </div>
  )
}
