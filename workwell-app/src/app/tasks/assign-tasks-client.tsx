'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHead, PlaneBadge, PrivacyNote } from '@/components/chrome'
import { fmtDate } from '@/lib/format-date'
import { TaskComments } from './task-comments'

type Assigned = {
  id: string
  person_id: string
  title: string
  note: string | null
  due_on: string | null
  done_at: string | null
}

type Person = { id: string; full_name: string; status: string }

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`
}

/**
 * Setting tasks for people, and seeing where they got to.
 *
 * The HR half of the same feature. What is deliberately absent here: any
 * sight of anybody's own list. Those live in private.tasks, which no
 * policy grants this account — so there is nothing to filter out on this
 * screen, because there was never anything to fetch.
 */
export default function AssignTasksClient() {
  const [rows, setRows] = useState<Assigned[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [meId, setMeId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showDone, setShowDone] = useState(false)
  /** Which task's thread is open. One at a time: a table of open threads
   *  stops being a table. */
  const [openThread, setOpenThread] = useState<string | null>(null)

  const [personId, setPersonId] = useState('')
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const [me, peopleRes, tasksRes] = await Promise.all([
        supabase.from('me').select('id').maybeSingle(),
        supabase.from('people').select('id, full_name, status').order('full_name'),
        supabase
          .from('assigned_tasks')
          .select('id, person_id, title, note, due_on, done_at')
          .order('created_at', { ascending: false }),
      ])
      if (cancelled) return

      if (peopleRes.error || tasksRes.error) {
        setLoadError((peopleRes.error ?? tasksRes.error)!.message)
      } else {
        setMeId(me.data?.id ?? null)
        setPeople((peopleRes.data ?? []) as Person[])
        setRows((tasksRes.data ?? []) as Assigned[])
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function assign(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!personId) return setError('Choose who the task is for.')
    if (!title.trim()) return setError('Give the task a name.')

    setBusy(true)
    const supabase = createClient()
    const { data, error: insertError } = await supabase
      .from('assigned_tasks')
      .insert({
        person_id: personId,
        title: title.trim(),
        due_on: due || null,
        note: note.trim() || null,
        assigned_by: meId,
      })
      .select('id, person_id, title, note, due_on, done_at')
      .single()

    if (insertError) {
      setBusy(false)
      return setError(insertError.message)
    }

    // Told, not just recorded — a task nobody knows about is not a task.
    await supabase.from('notifications').insert({
      person_id: personId,
      kind: 'task_assigned',
      title: 'A task was assigned to you',
      body: title.trim(),
      link: '/tasks',
    })

    setBusy(false)
    setRows((r) => [data as Assigned, ...r])
    setTitle('')
    setDue('')
    setNote('')
  }

  async function remove(task: Assigned) {
    setRows((r) => r.filter((x) => x.id !== task.id))
    const supabase = createClient()
    const { error: deleteError } = await supabase
      .from('assigned_tasks')
      .delete()
      .eq('id', task.id)
    if (deleteError) {
      setRows((r) => [task, ...r])
      setError(deleteError.message)
    }
  }

  const names = new Map(people.map((p) => [p.id, p.full_name]))
  const open = rows.filter((r) => !r.done_at)
  const visible = showDone ? rows : open
  const today = todayISO()

  return (
    <>
      <PageHead
        title="Tasks"
        lead="Set a task for someone, and see where it got to."
      />
      <PlaneBadge plane="work" />

      {(error || loadError) && (
        <div className="banner banner--error mb-4" role="alert">
          {error ?? loadError}
        </div>
      )}

      <div className="grid grid--sidebar-right">
        <div className="stack">
          <div className="card card--flush">
            <div style={{ padding: 'var(--s-5) var(--s-5) var(--s-3)' }}>
              <div className="row row--between">
                <div>
                  <h2 className="card__title">Assigned tasks</h2>
                  <div className="card__sub">
                    {open.length === 0 ? 'Nothing outstanding' : `${open.length} still open`}
                  </div>
                </div>
                {rows.length - open.length > 0 && (
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    aria-pressed={showDone}
                    onClick={() => setShowDone((v) => !v)}
                  >
                    {showDone ? 'Hide done' : `Show done (${rows.length - open.length})`}
                  </button>
                )}
              </div>
            </div>

            {loading ? (
              <div style={{ padding: '0 var(--s-5) var(--s-5)' }}>
                <div className="skel skel--text" />
              </div>
            ) : visible.length === 0 ? (
              <p className="t-subtle" style={{ padding: '0 var(--s-5) var(--s-5)' }}>
                {rows.length === 0
                  ? 'No tasks assigned yet.'
                  : 'Everything assigned has been done.'}
              </p>
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <caption className="sr-only">Tasks assigned to people</caption>
                  <thead>
                    <tr>
                      <th scope="col">Person</th>
                      <th scope="col">Task</th>
                      <th scope="col">Due</th>
                      <th scope="col">State</th>
                      <th scope="col">
                        <span className="sr-only">Remove</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((t) => {
                      const overdue = Boolean(!t.done_at && t.due_on && t.due_on < today)
                      // Two rows per task when the thread is open: the row
                      // itself, then a full-width row under it. A <tr> can
                      // only live inside <tbody>, so this returns a list
                      // rather than wrapping them in anything.
                      return [
                        <tr key={t.id}>
                          <th scope="row" style={{ fontWeight: 600 }}>
                            {names.get(t.person_id) ?? 'Someone'}
                          </th>
                          <td>
                            {t.title}
                            {t.note && <div className="t-subtle">{t.note}</div>}
                          </td>
                          <td>{t.due_on ? fmtDate(t.due_on) : '—'}</td>
                          <td>
                            <span
                              className={
                                t.done_at
                                  ? 'chip chip--accent'
                                  : overdue
                                    ? 'chip task__due is-overdue'
                                    : 'chip'
                              }
                            >
                              {t.done_at ? 'Done' : overdue ? 'Overdue' : 'Open'}
                            </span>
                          </td>
                          <td>
                            <div className="row" style={{ gap: 'var(--s-1)' }}>
                              <button
                                type="button"
                                className="btn btn--ghost btn--sm"
                                aria-expanded={openThread === t.id}
                                onClick={() =>
                                  setOpenThread((id) => (id === t.id ? null : t.id))
                                }
                              >
                                {openThread === t.id ? 'Close' : 'Comments'}
                              </button>
                              <button
                                type="button"
                                className="btn btn--ghost btn--sm"
                                onClick={() => remove(t)}
                              >
                                Remove
                              </button>
                            </div>
                          </td>
                        </tr>,
                        openThread === t.id ? (
                          <tr key={`${t.id}-thread`}>
                            <td colSpan={5} style={{ background: 'var(--surface-2)' }}>
                              <TaskComments taskId={t.id} meId={meId} names={names} />
                            </td>
                          </tr>
                        ) : null,
                      ]
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="stack">
          <form className="card" onSubmit={assign}>
            <h2 className="card__title">Assign a task</h2>
            <p className="card__sub">They are notified, and can tick it off.</p>

            <div className="mt-4">
              <label className="field__label" htmlFor="assignee">
                For
              </label>
              <select
                id="assignee"
                className="select"
                value={personId}
                onChange={(e) => setPersonId(e.target.value)}
              >
                <option value="">Choose someone</option>
                {people
                  .filter((p) => p.status === 'active')
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="mt-4">
              <label className="field__label" htmlFor="atitle">
                Task
              </label>
              <input
                id="atitle"
                className="input"
                value={title}
                placeholder="What needs doing"
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="mt-4">
              <label className="field__label" htmlFor="adue">
                Due (optional)
              </label>
              <input
                id="adue"
                className="input"
                type="date"
                value={due}
                onChange={(e) => setDue(e.target.value)}
              />
            </div>

            <div className="mt-4">
              <label className="field__label" htmlFor="anote">
                Note (optional)
              </label>
              <textarea
                id="anote"
                className="textarea"
                value={note}
                placeholder="Anything they need to know."
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            <div className="mt-4">
              <button className="btn btn--primary" type="submit" disabled={busy}>
                {busy ? 'Assigning…' : 'Assign task'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <PrivacyNote
        plane="work"
        detail="A task set here is employment data and visible to the person it is for, exactly as it should be. What this screen cannot show, and has no query for, is anybody's own task list: those live on the private plane, and no policy grants this account any route to them."
      >
        <b>You see tasks you set — never anyone&rsquo;s own list.</b>{' '}
      </PrivacyNote>
    </>
  )
}
