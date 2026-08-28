import { redirect } from 'next/navigation'

/**
 * Trends is now a tab of the check-in page, not a route of its own.
 *
 * Kept as a redirect rather than deleted: this path is in the room's own
 * navigation history, in bookmarks, and in anything anybody has linked.
 * A merge that turns working links into 404s is a merge that cost the
 * reader something.
 */
export default async function TrendsMoved() {
  redirect('/check-in?tab=trends')
}
