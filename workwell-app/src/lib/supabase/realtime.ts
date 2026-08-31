import type { SupabaseClient } from '@supabase/supabase-js'

type ChangeHandlers<T> = {
  onInsert?: (row: T) => void
  onUpdate?: (row: T) => void
  onDelete?: (row: T) => void
}

/**
 * Subscribe to Postgres Changes for one table and get back a function that
 * tears the subscription down.
 *
 * No authorization happens here. Every table this is pointed at already
 * has row level security, and Realtime evaluates those same policies per
 * subscriber before a change is ever sent — the same select a client is
 * allowed to run is the same set of changes it can be pushed. There is
 * nothing to widen or narrow at this layer.
 *
 * DELETE only ever hands back a complete `old` row if the table's replica
 * identity is FULL — the default (primary key only) is enough for INSERT
 * and UPDATE, whose new row always arrives whole, but a plain DELETE would
 * carry only the id and nothing a filter like `person_id = ...` could be
 * checked against.
 *
 * A subscriber the row is not authorized for does not simply hear nothing:
 * Realtime still delivers an event, with `new`/`old` emptied out and an
 * `errors: ["Error 401: Unauthorized"]` in their place (confirmed against
 * this project directly — an anon-role subscription to work.notifications
 * receives exactly this shape on a real insert, never the row). Passing
 * that through as if it were a real, empty-columned row would hand a
 * handler an object with no `id`, which for anything keyed on `id` reads
 * as a row with `id: undefined`. Both are dropped before a handler is
 * ever called.
 */
export function watchTable<T extends Record<string, unknown>>(
  supabase: SupabaseClient,
  where: { schema: string; table: string; filter?: string },
  handlers: ChangeHandlers<T>
) {
  const name = `${where.schema}:${where.table}:${where.filter ?? 'all'}:${crypto.randomUUID()}`

  function row(payload: {
    new: Record<string, unknown>
    old: Record<string, unknown>
    errors: string[] | null
  }, which: 'new' | 'old'): T | null {
    if (payload.errors && payload.errors.length > 0) return null
    const data = payload[which]
    return Object.keys(data).length > 0 ? (data as T) : null
  }

  let channel: ReturnType<SupabaseClient['channel']> | null = null
  let cancelled = false

  // The socket is told who is watching before the channel joins, rather
  // than relying on supabase-js's own realtime.setAuth() on SIGNED_IN /
  // TOKEN_REFRESHED -- those fire on auth *transitions*, and a page loaded
  // with a session already in cookies races them.
  //
  // This matters more than it looks, because the failure mode is silent.
  // A channel that joins without the user's token is registered by
  // Realtime as role `anon`, and every row is then filtered out by the
  // same RLS that is meant to be delivering it -- current_person_id() is
  // null for anon, so `person_id = ...` can never match. The channel
  // still reports SUBSCRIBED, nothing throws, nothing logs, and the
  // screen simply never updates.
  //
  // That is not hypothetical: this project spent a while in exactly that
  // state for an unrelated reason (it was signing user JWTs with an
  // asymmetric ES256 key that Realtime's postgres_changes path did not
  // verify, so it fell back to anon). Diagnosed by reading
  // realtime.subscription -- claims_role there is the ground truth for
  // who Realtime thinks a subscriber is, and it disagreeing with the
  // same client's REST reads is the tell. Worth knowing about if live
  // updates ever go quiet again.
  ;(async () => {
    const { data } = await supabase.auth.getSession()
    if (cancelled) return
    await supabase.realtime.setAuth(data.session?.access_token ?? null)
    if (cancelled) return

    channel = buildChannel()
  })()

  function buildChannel() {
    return supabase
    .channel(name)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: where.schema, table: where.table, filter: where.filter },
      (payload) => {
        const r = row(payload, 'new')
        if (r) handlers.onInsert?.(r)
      }
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: where.schema, table: where.table, filter: where.filter },
      (payload) => {
        const r = row(payload, 'new')
        if (r) handlers.onUpdate?.(r)
      }
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: where.schema, table: where.table, filter: where.filter },
      (payload) => {
        const r = row(payload, 'old')
        if (r) handlers.onDelete?.(r)
      }
    )
    // Unhandled, a failed join is invisible: nothing throws, nothing
    // rejects, the caller's cleanup function still works, and the screen
    // just quietly never updates. Logged rather than swallowed so a
    // dropped or errored subscription shows up as a message pointing at
    // the table involved, not as "realtime doesn't work" with nothing to
    // go on.
    .subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error(`Realtime subscription to ${where.schema}.${where.table} failed (${status})`, err)
      }
    })
  }

  return () => {
    cancelled = true
    if (channel) supabase.removeChannel(channel)
  }
}
