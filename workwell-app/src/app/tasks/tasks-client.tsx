'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { watchTopic } from '@/lib/supabase/realtime'
import Link from 'next/link'
import { PageHead, PlaneBadge, PrivacyNote } from '@/components/chrome'
import { fmtDate } from '@/lib/format-date'
import { TaskComments } from './task-comments'

type Task = {
  id: string
  title: string
  note: string | null
  due_on: string | null
  done_at: string | null
}

/** The realtime payload for either table carries every column -- person_id,
 *  and assigned_by on work.assigned_tasks -- not just the five this screen
 *  keeps in state. Narrowed on the way in rather than widening Task, so a
 *  live row and a fetched one are shaped identically everywhere else. */
function toTask(row: Task): Task {
  return {
    id: row.id,
    title: row.title,
    note: row.note,
    due_on: row.due_on,
    done_at: row.done_at,
  }
}

function upsert(list: Task[], row: Task): Task[] {
  const next = list.some((x) => x.id === row.id)
    ? list.map((x) => (x.id === row.id ? row : x))
    : [...list, row]
  return next.sort(order)
}

/** Today as 'YYYY-MM-DD' in the reader's own zone. Comparing due dates as
 *  strings only works because both sides are date-only and zero-padded —
 *  and building this from local parts rather than toISOString() is the
 *  same trap fmtDate documents: toISOString() is UTC, and west of it that
 *  is yesterday. */
function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`
}

function dueLabel(due: string, done: boolean) {
  const today = todayISO()
  if (done) return { text: fmtDate(due), tone: '' }
  if (due < today) return { text: `Overdue · ${fmtDate(due)}`, tone: 'is-overdue' }
  if (due === today) return { text: 'Due today', tone: 'is-today' }
  return { text: `Due ${fmtDate(due)}`, tone: '' }
}

/** Open first, then by due date, then newest. Nothing without a due date
 *  jumps ahead of something that has one. */
function order(a: Task, b: Task) {
  if (!a.done_at !== !b.done_at) return a.done_at ? 1 : -1
  if (a.due_on && b.due_on) return a.due_on < b.due_on ? -1 : 1
  if (a.due_on) return -1
  if (b.due_on) return 1
  return 0
}

/**
 * Two lists on one screen, on two different planes.
 *
 * The separation is the point, so it is made twice: each list carries its
 * own plane badge, and they are two tables with two policy sets behind
 * them (see 0055). A task you set yourself is nobody's business; a task
 * you were given is your employer's by definition. Showing them together
 * is convenient, and blurring them would be a lie about who can read what.
 */
export default function TasksClient() {
  const [personId, setPersonId] = useState<string | null>(null)
  const [mine, setMine] = useState<Task[]>([])
  const [assigned, setAssigned] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showDone, setShowDone] = useState(false)
  const [names, setNames] = useState<Map<string, string>>(new Map())
  /** The two things the day asks for, worked out rather than stored — see
   *  DailyRow below. null while still being read. */
  const [checkedInToday, setCheckedInToday] = useState<boolean | null>(null)
  const [timedInToday, setTimedInToday] = useState<boolean | null>(null)

  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const [note, setNote] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const { data: me, error: meError } = await supabase
        .from('me')
        .select('id')
        .maybeSingle()
      if (cancelled) return
      if (meError) {
        setLoadError(meError.message)
        setLoading(false)
        return
      }
      setPersonId(me?.id ?? null)

      const today = todayISO()
      const [own, given, people, checkIns, attendance] = await Promise.all([
        supabase.from('tasks').select('id, title, note, due_on, done_at'),
        supabase.from('assigned_tasks').select('id, title, note, due_on, done_at'),
        supabase.from('people').select('id, full_name'),
        supabase.from('check_ins').select('id', { count: 'exact', head: true }).eq('day', today),
        supabase.from('attendance').select('time_in').eq('day', today).maybeSingle(),
      ])
      if (cancelled) return
      if (own.error || given.error) {
        setLoadError((own.error ?? given.error)!.message)
      } else {
        setMine(((own.data ?? []) as Task[]).sort(order))
        setAssigned(((given.data ?? []) as Task[]).sort(order))
      }
      if (people.data) {
        setNames(new Map(people.data.map((p) => [p.id, p.full_name as string])))
      }
      // A failed read leaves these null, which renders as "not sure yet"
      // rather than as "not done" — telling somebody they have not checked
      // in when the query simply failed is the worse of the two.
      if (!checkIns.error) setCheckedInToday((checkIns.count ?? 0) > 0)
      if (!attendance.error) setTimedInToday(Boolean(attendance.data?.time_in))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Both lists filtered to this person: private.tasks is nobody else's to
  // begin with, and work.assigned_tasks is filtered the same way this
  // screen's own select already is, rather than relying on RLS alone to
  // narrow a busier table this account has no other reason to hear about.
  // Waits for personId, since that is what each topic is built from.
  useEffect(() => {
    if (!personId) return
    const supabase = createClient()

    const stopMine = watchTopic<Task>(supabase, `private-tasks:${personId}`, {
      onInsert: (row) => setMine((t) => upsert(t, toTask(row))),
      onUpdate: (row) => setMine((t) => upsert(t, toTask(row))),
      onDelete: (row) => setMine((t) => t.filter((x) => x.id !== row.id)),
    })

    const stopAssigned = watchTopic<Task>(supabase, `work-assigned-tasks:${personId}`, {
      onInsert: (row) => setAssigned((t) => upsert(t, toTask(row))),
      onUpdate: (row) => setAssigned((t) => upsert(t, toTask(row))),
      onDelete: (row) => setAssigned((t) => t.filter((x) => x.id !== row.id)),
    })

    return () => {
      stopMine()
      stopAssigned()
    }
  }, [personId])

  async function add(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!personId) return setError('This account is not linked to a person yet.')
    if (!title.trim()) return setError('Give the task a name.')

    setAdding(true)
    const supabase = createClient()
    const { data, error: insertError } = await supabase
      .from('tasks')
      .insert({
        person_id: personId,
        title: title.trim(),
        due_on: due || null,
        note: note.trim() || null,
      })
      .select('id, title, note, due_on, done_at')
      .single()
    setAdding(false)

    if (insertError) return setError(insertError.message)

    // upsert() rather than a bare append: the broadcast's own onInsert can
    // land over the already-open socket before this request's response
    // does, and without the id check this row would be added twice.
    setMine((t) => upsert(t, data as Task))
    setTitle('')
    setDue('')
    setNote('')
  }

  /** Ticked straight away, then written. A checkbox that waits for a round
   *  trip before it moves feels broken; if the write fails the row goes
   *  back and says so. */
  async function toggleMine(task: Task) {
    const done_at = task.done_at ? null : new Date().toISOString()
    setMine((t) => t.map((x) => (x.id === task.id ? { ...x, done_at } : x)).sort(order))

    const supabase = createClient()
    const { error: updateError } = await supabase
      .from('tasks')
      .update({ done_at })
      .eq('id', task.id)

    if (updateError) {
      setMine((t) => t.map((x) => (x.id === task.id ? task : x)).sort(order))
      setError(updateError.message)
    }
  }

  async function toggleAssigned(task: Task) {
    const done_at = task.done_at ? null : new Date().toISOString()
    setAssigned((t) => t.map((x) => (x.id === task.id ? { ...x, done_at } : x)).sort(order))

    const supabase = createClient()
    // Not a direct update: the row is HR's to edit, and this is the one
    // column the person doing the task owns. See 0055.
    const { error: rpcError } = await supabase.rpc('set_assigned_task_done', {
      p_id: task.id,
      p_done: !task.done_at,
    })

    if (rpcError) {
      setAssigned((t) => t.map((x) => (x.id === task.id ? task : x)).sort(order))
      setError(rpcError.message)
    }
  }

  async function remove(task: Task) {
    setMine((t) => t.filter((x) => x.id !== task.id))
    const supabase = createClient()
    const { error: deleteError } = await supabase.from('tasks').delete().eq('id', task.id)
    if (deleteError) {
      setMine((t) => [...t, task].sort(order))
      setError(deleteError.message)
    }
  }

  async function saveEdit(task: Task, patch: Partial<Task>) {
    const next = { ...task, ...patch }
    setMine((t) => t.map((x) => (x.id === task.id ? next : x)).sort(order))
    setEditing(null)

    const supabase = createClient()
    const { error: updateError } = await supabase
      .from('tasks')
      .update({ title: next.title, due_on: next.due_on, note: next.note })
      .eq('id', task.id)

    if (updateError) {
      setMine((t) => t.map((x) => (x.id === task.id ? task : x)).sort(order))
      setError(updateError.message)
    }
  }

  const openMine = mine.filter((t) => !t.done_at)
  const doneMine = mine.filter((t) => t.done_at)
  const visibleMine = showDone ? mine : openMine
  const openAssigned = assigned.filter((t) => !t.done_at)

  return (
    <>
      <PageHead
        title="Tasks"
        lead="What you have been asked to do, and what you have set yourself."
      />

      {error && (
        <div className="banner banner--error mb-4" role="alert">
          {error}
        </div>
      )}
      {loadError && (
        <div className="banner banner--error mb-4" role="alert">
          {loadError}
        </div>
      )}

      {/* Today first: these two are due again tomorrow whatever happens,
          and they are the only things here with a deadline of "today". */}
      <div className="card card--flush">
        <div style={{ padding: 'var(--s-5) var(--s-5) var(--s-3)' }}>
          <h2 className="card__title">Today</h2>
          <div className="card__sub">Once a day, every working day</div>
        </div>
        <ul className="task-list">
          <DailyRow
            title="Check in"
            note="How the day is going. Yours alone."
            href="/check-in"
            done={checkedInToday}
          />
          <DailyRow
            title="Time in"
            note="Start the day on the record."
            href="/attendance"
            done={timedInToday}
          />
        </ul>
      </div>

      {/* Then the half somebody else is waiting on. */}
      <div className="card card--flush mt-5">
        <div style={{ padding: 'var(--s-5) var(--s-5) var(--s-3)' }}>
          <div className="row row--between">
            <div>
              <h2 className="card__title">Given to you</h2>
              <div className="card__sub">
                {openAssigned.length === 0
                  ? 'Nothing outstanding'
                  : `${openAssigned.length} still open`}
              </div>
            </div>
            <span className="chip">Set by HR</span>
          </div>
          <div className="mt-3">
            <PlaneBadge plane="work" />
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '0 var(--s-5) var(--s-5)' }}>
            <div className="skel skel--text" />
          </div>
        ) : assigned.length === 0 ? (
          <p className="t-subtle" style={{ padding: '0 var(--s-5) var(--s-5)' }}>
            Nobody has given you a task.
          </p>
        ) : (
          <ul className="task-list">
            {assigned.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                onToggle={() => toggleAssigned(t)}
                thread={<TaskComments taskId={t.id} meId={personId} names={names} />}
              />
            ))}
          </ul>
        )}
      </div>

      <div className="card card--flush mt-5">
        <div style={{ padding: 'var(--s-5) var(--s-5) var(--s-3)' }}>
          <div className="row row--between">
            <div>
              <h2 className="card__title">Your own list</h2>
              <div className="card__sub">
                {openMine.length === 0 ? 'Nothing open' : `${openMine.length} still open`}
              </div>
            </div>
            {doneMine.length > 0 && (
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                aria-pressed={showDone}
                onClick={() => setShowDone((v) => !v)}
              >
                {showDone ? 'Hide done' : `Show done (${doneMine.length})`}
              </button>
            )}
          </div>
          <div className="mt-3">
            <PlaneBadge plane="private" />
          </div>
        </div>

        <form onSubmit={add} style={{ padding: '0 var(--s-5) var(--s-4)' }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: '2 1 240px' }}>
              <label className="field__label" htmlFor="task-title">
                Task
              </label>
              <input
                id="task-title"
                className="input"
                value={title}
                placeholder="What needs doing"
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div style={{ flex: '1 1 200px' }}>
              <label className="field__label" htmlFor="task-due">
                Due (optional)
              </label>
              <input
                id="task-due"
                className="input"
                type="date"
                value={due}
                onChange={(e) => setDue(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-3">
            <label className="field__label" htmlFor="task-note">
              Note (optional)
            </label>
            <input
              id="task-note"
              className="input"
              value={note}
              placeholder="Anything worth remembering about it"
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <div className="mt-3">
            <button className="btn btn--primary btn--sm" type="submit" disabled={adding}>
              {adding ? 'Adding…' : 'Add task'}
            </button>
          </div>
        </form>

        {loading ? (
          <div style={{ padding: '0 var(--s-5) var(--s-5)' }}>
            <div className="skel skel--text" />
          </div>
        ) : visibleMine.length === 0 ? (
          <p className="t-subtle" style={{ padding: '0 var(--s-5) var(--s-5)' }}>
            {mine.length === 0
              ? 'Nothing on your list. Add the first thing above.'
              : 'Everything on your list is done.'}
          </p>
        ) : (
          <ul className="task-list">
            {visibleMine.map((t) =>
              editing === t.id ? (
                <EditRow
                  key={t.id}
                  task={t}
                  onCancel={() => setEditing(null)}
                  onSave={(patch) => saveEdit(t, patch)}
                />
              ) : (
                <TaskRow
                  key={t.id}
                  task={t}
                  onToggle={() => toggleMine(t)}
                  onEdit={() => setEditing(t.id)}
                  onDelete={() => remove(t)}
                />
              )
            )}
          </ul>
        )}
      </div>

      <PrivacyNote detail="Your own list lives on the private plane, in a table no policy anywhere grants HR access to — the same footing as your check-ins. Tasks given to you are work-plane and always were: whoever set one can see whether it is done. The two are separate tables precisely so that neither can ever be read as the other.">
        <b>Your own list is yours alone.</b>{' '}
      </PrivacyNote>
    </>
  )
}

function TaskRow({
  task,
  onToggle,
  onEdit,
  onDelete,
  thread,
}: {
  task: Task
  onToggle: () => void
  onEdit?: () => void
  onDelete?: () => void
  /** The comment thread, for the tasks that have one. Passed in rather
   *  than built here so this row stays the same row on both lists. */
  thread?: React.ReactNode
}) {
  const done = Boolean(task.done_at)
  const due = task.due_on ? dueLabel(task.due_on, done) : null

  return (
    <li className={done ? 'task is-done' : 'task'}>
      <button
        type="button"
        className="task__check"
        role="checkbox"
        aria-checked={done}
        onClick={onToggle}
      >
        <span aria-hidden="true">{done ? '✓' : ''}</span>
        <span className="sr-only">
          {done ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
        </span>
      </button>

      <div className="task__body">
        <span className="task__title">{task.title}</span>
        {task.note && <span className="task__note">{task.note}</span>}
      </div>

      {due && <span className={`chip task__due ${due.tone}`}>{due.text}</span>}

      {(onEdit || onDelete) && (
        <span className="task__actions">
          {onEdit && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={onEdit}>
              Edit
            </button>
          )}
          {onDelete && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={onDelete}>
              Delete
            </button>
          )}
        </span>
      )}

      {thread && <div className="task__thread">{thread}</div>}
    </li>
  )
}

/**
 * One of the day's standing jobs, shown as a task without being one.
 *
 * Nothing is stored for these and nothing needs to be: "have you checked
 * in today" is already answerable from the check-ins themselves, and
 * writing two rows into everybody's task list every morning would need a
 * scheduled job, a rule for weekends and holidays, and a pile of rows
 * nobody asked for. They are ticked by doing the thing, not by pressing
 * the box, so the box is a state and the row is a link.
 */
function DailyRow({
  title,
  note,
  href,
  done,
}: {
  title: string
  note: string
  href: string
  /** null while it is still being read — reported as unknown rather than
   *  as not done, because those are different things. */
  done: boolean | null
}) {
  return (
    <li className={done ? 'task is-done' : 'task'}>
      <span
        className="task__check"
        role="img"
        aria-label={done === null ? 'Not known yet' : done ? 'Done' : 'Not done yet'}
        data-daily="true"
        data-state={done === null ? 'unknown' : done ? 'done' : 'open'}
      >
        <span aria-hidden="true">{done ? '✓' : ''}</span>
      </span>

      <div className="task__body">
        <span className="task__title">{title}</span>
        <span className="task__note">{note}</span>
      </div>

      <span className={done ? 'chip chip--accent task__due' : 'chip task__due'}>
        {done === null ? 'Checking…' : done ? 'Done today' : 'Due today'}
      </span>

      <span className="task__actions">
        <Link className="btn btn--ghost btn--sm" href={href}>
          {done ? 'Open' : 'Do it'}
        </Link>
      </span>
    </li>
  )
}

function EditRow({
  task,
  onCancel,
  onSave,
}: {
  task: Task
  onCancel: () => void
  onSave: (patch: Partial<Task>) => void
}) {
  const [title, setTitle] = useState(task.title)
  const [due, setDue] = useState(task.due_on ?? '')
  const [note, setNote] = useState(task.note ?? '')

  return (
    <li className="task task--editing">
      <form
        style={{ width: '100%' }}
        onSubmit={(e) => {
          e.preventDefault()
          if (!title.trim()) return
          onSave({ title: title.trim(), due_on: due || null, note: note.trim() || null })
        }}
      >
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: '2 1 240px' }}>
            <label className="field__label" htmlFor={`et-${task.id}`}>
              Task
            </label>
            <input
              id={`et-${task.id}`}
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div style={{ flex: '1 1 200px' }}>
            <label className="field__label" htmlFor={`ed-${task.id}`}>
              Due
            </label>
            <input
              id={`ed-${task.id}`}
              className="input"
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-3">
          <label className="field__label" htmlFor={`en-${task.id}`}>
            Note
          </label>
          <input
            id={`en-${task.id}`}
            className="input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <div className="row mt-3">
          <button className="btn btn--primary btn--sm" type="submit">
            Save
          </button>
          <button className="btn btn--secondary btn--sm" type="button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </li>
  )
}
