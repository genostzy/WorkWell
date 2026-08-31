import type { SupabaseClient } from '@supabase/supabase-js'

type ChangeHandlers<T> = {
  onInsert?: (row: T) => void
  onUpdate?: (row: T) => void
  onDelete?: (row: T) => void
}

type BroadcastEnvelope<T> = {
  payload: {
    operation: 'INSERT' | 'UPDATE' | 'DELETE'
    table: string
    schema: string
    record: T | null
    old_record: T | null
  }
}

/**
 * Subscribe to a Broadcast-from-Database topic and get back a function that
 * tears the subscription down.
 *
 * `topic` names a private channel authorized by an RLS policy on
 * realtime.messages, set up by whichever migration wired the trigger that
 * broadcasts to it -- see 0067_broadcast_from_database.sql for the five
 * topics currently live (private-tasks:<person_id>,
 * work-assigned-tasks:<person_id>, work-assigned-tasks-org:<org_id>,
 * task-comments:<task_id>, notifications:<person_id>). There is nothing to
 * authorize here beyond joining the right topic string -- the RLS policy on
 * realtime.messages is where "who is this for" is actually decided, same as
 * it always was for the table itself.
 *
 * Unauthorized here does not look like an errored payload the way it did
 * under Postgres Changes: a client without a matching realtime.messages
 * policy simply never receives anything on that topic at all. There is no
 * `errors` field to check and no empty-row shape to guard against.
 */
export function watchTopic<T extends Record<string, unknown>>(
  supabase: SupabaseClient,
  topic: string,
  handlers: ChangeHandlers<T>
) {
  let channel: ReturnType<SupabaseClient['channel']> | null = null
  let cancelled = false

  // Same reasoning as the Postgres Changes version this replaces: the
  // socket is told who is watching before the channel joins, rather than
  // relying on supabase-js's own realtime.setAuth() on SIGNED_IN /
  // TOKEN_REFRESHED, which fires on auth *transitions* and loses the race
  // against a page loaded with a session already in cookies. Broadcast's
  // authorization is checked at join time (and re-checked whenever a fresh
  // JWT arrives), so a socket that joins unauthenticated stays unauthorized
  // for the life of the connection.
  ;(async () => {
    const { data } = await supabase.auth.getSession()
    if (cancelled) return
    await supabase.realtime.setAuth(data.session?.access_token ?? null)
    if (cancelled) return

    channel = buildChannel()
  })()

  function buildChannel() {
    return supabase
      .channel(topic, { config: { private: true } })
      .on('broadcast', { event: 'INSERT' }, (msg) => {
        const record = (msg as unknown as BroadcastEnvelope<T>).payload.record
        if (record) handlers.onInsert?.(record)
      })
      .on('broadcast', { event: 'UPDATE' }, (msg) => {
        const record = (msg as unknown as BroadcastEnvelope<T>).payload.record
        if (record) handlers.onUpdate?.(record)
      })
      .on('broadcast', { event: 'DELETE' }, (msg) => {
        const oldRecord = (msg as unknown as BroadcastEnvelope<T>).payload.old_record
        if (oldRecord) handlers.onDelete?.(oldRecord)
      })
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error(`Realtime subscription to topic "${topic}" failed (${status})`, err)
        }
      })
  }

  return () => {
    cancelled = true
    if (channel) supabase.removeChannel(channel)
  }
}
