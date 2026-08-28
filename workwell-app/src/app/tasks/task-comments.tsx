'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Comment = {
  id: string
  author_id: string
  body: string
  created_at: string
}

/**
 * The thread on one assigned task.
 *
 * Assigned tasks only. A task somebody gave you is the one kind here that
 * can be blocked by something you cannot fix — a missing key, a locked
 * account, an answer you are waiting on — and until now the only reply
 * available was ticking it or not ticking it. Your own list has nobody on
 * the other end of it, so it has no thread.
 *
 * Loaded when opened rather than with the page. A task list is mostly
 * closed threads, and fetching every one of them up front would be a query
 * per task for words nobody has asked to read.
 */
export function TaskComments({
  taskId,
  meId,
  names,
}: {
  taskId: string
  meId: string | null
  /** person_id → display name. HR has the directory already; an employee
   *  can read their own org's names, which is enough for both sides of a
   *  thread they are part of. */
  names: Map<string, string>
}) {
  const [open, setOpen] = useState(false)
  const [comments, setComments] = useState<Comment[] | null>(null)
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || comments) return
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const { data, error: readError } = await supabase
        .from('task_comments')
        .select('id, author_id, body, created_at')
        .eq('task_id', taskId)
        .order('created_at')
      if (cancelled) return
      if (readError) setError(readError.message)
      else setComments((data ?? []) as Comment[])
    })()
    return () => {
      cancelled = true
    }
  }, [open, comments, taskId])

  async function post(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!meId) return setError('This account is not linked to a person yet.')
    if (!body.trim()) return

    setBusy(true)
    const supabase = createClient()
    const { data, error: writeError } = await supabase
      .from('task_comments')
      // author_id is sent, and the policy checks it against the caller —
      // so this is a convenience, not the thing being trusted.
      .insert({ task_id: taskId, author_id: meId, body: body.trim() })
      .select('id, author_id, body, created_at')
      .single()
    setBusy(false)

    if (writeError) return setError(writeError.message)
    setComments((c) => [...(c ?? []), data as Comment])
    setBody('')
  }

  async function remove(comment: Comment) {
    const kept = comments ?? []
    setComments(kept.filter((c) => c.id !== comment.id))
    const supabase = createClient()
    const { error: deleteError } = await supabase
      .from('task_comments')
      .delete()
      .eq('id', comment.id)
    if (deleteError) {
      setComments(kept)
      setError(deleteError.message)
    }
  }

  const count = comments?.length
  const label = open
    ? 'Hide comments'
    : count === undefined
      ? 'Comments'
      : count === 0
        ? 'Add a comment'
        : `Comments (${count})`

  return (
    <div className="task-thread">
      <button
        type="button"
        className="btn btn--ghost btn--sm"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
      </button>

      {open && (
        <div className="task-thread__panel mt-3">
          {error && (
            <div className="banner banner--error mb-3" role="alert">
              {error}
            </div>
          )}

          {comments === null ? (
            <div className="skel skel--text" />
          ) : comments.length === 0 ? (
            <p className="t-subtle">
              Nothing here yet. Say what is holding it up and whoever set it
              will see it.
            </p>
          ) : (
            <ul className="task-thread__list">
              {comments.map((c) => (
                <li className="task-thread__item" key={c.id}>
                  <div className="row row--between">
                    <b className="task-thread__who">
                      {names.get(c.author_id) ?? 'Someone'}
                      {c.author_id === meId ? ' · you' : ''}
                    </b>
                    <span className="t-subtle task-thread__when">
                      {new Date(c.created_at).toLocaleString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="task-thread__body">{c.body}</p>
                  {/* Yours to take back, nobody's to edit — an edited
                      record of a blocker is worth less than an honest one,
                      and a removed one at least reads as removed. */}
                  {c.author_id === meId && (
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => remove(c)}
                    >
                      Delete
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          <form className="mt-3" onSubmit={post}>
            <label className="sr-only" htmlFor={`c-${taskId}`}>
              Add a comment
            </label>
            <textarea
              id={`c-${taskId}`}
              className="textarea"
              rows={2}
              value={body}
              placeholder="A problem, a blocker, or where it has got to."
              onChange={(e) => setBody(e.target.value)}
            />
            <div className="row mt-2">
              <button
                className="btn btn--primary btn--sm"
                type="submit"
                disabled={busy || !body.trim()}
              >
                {busy ? 'Posting…' : 'Post'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
