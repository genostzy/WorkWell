'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export type DirectoryRow = {
  id: string
  full_name: string
  status: string
  job_title: string | null
  department: string | null
  team: string | null
  manager_id: string | null
  manager_name: string | null
  contract_type: string | null
  location: string | null
  started_on: string | null
  entitlement: number | null
}

/** Offered as a list because these are the shapes an employment record
 *  actually takes here. Not a database constraint: an org with a kind of
 *  contract nobody thought of should not need a migration to record it. */
const CONTRACTS = [
  'Full time',
  'Part time',
  'Contract',
  'Probationary',
  'Intern',
] as const

/**
 * The directory, and the one place an employment record can be written.
 *
 * The record has always been shown to the employee as "held by HR" while
 * being unwritable by anyone — team, manager and location could never be
 * anything but blank. This is the other half of that sentence.
 *
 * A row expands in place rather than opening its own screen: the point of
 * editing here is usually to fix one field against the rest of the row,
 * and a page that replaces the table takes away the very context that
 * showed the mistake.
 */
export function Directory({ rows }: { rows: DirectoryRow[] }) {
  const [editing, setEditing] = useState<string | null>(null)

  return (
    <div className="card card--flush mt-5">
      <div style={{ padding: 'var(--s-5) var(--s-5) var(--s-3)' }}>
        <h2 className="card__title">Directory</h2>
        <div className="card__sub">
          {rows.length === 1 ? '1 person' : `${rows.length} people`}
        </div>
      </div>

      <div className="table-scroll">
        <table className="data-table">
          <caption className="sr-only">
            Employee directory. Each row can be expanded to edit that person&rsquo;s
            employment record.
          </caption>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Title</th>
              <th scope="col">Department</th>
              <th scope="col">Manager</th>
              <th scope="col">Status</th>
              <th scope="col">
                <span className="sr-only">Edit</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <RowPair
                key={p.id}
                person={p}
                people={rows}
                open={editing === p.id}
                onToggle={() => setEditing((id) => (id === p.id ? null : p.id))}
                onDone={() => setEditing(null)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function RowPair({
  person,
  people,
  open,
  onToggle,
  onDone,
}: {
  person: DirectoryRow
  people: DirectoryRow[]
  open: boolean
  onToggle: () => void
  onDone: () => void
}) {
  return (
    <>
      <tr>
        <th scope="row" style={{ fontWeight: 600 }}>
          {person.full_name}
        </th>
        <td>{person.job_title ?? '—'}</td>
        <td>{person.department ?? '—'}</td>
        <td>{person.manager_name ?? '—'}</td>
        <td>
          <span className={person.status === 'active' ? 'chip chip--accent' : 'chip'}>
            {person.status}
          </span>
        </td>
        <td>
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            aria-expanded={open}
            onClick={onToggle}
          >
            {open ? 'Close' : 'Edit'}
          </button>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={6} style={{ background: 'var(--surface-2)' }}>
            <EmploymentForm person={person} people={people} onDone={onDone} />
          </td>
        </tr>
      )}
    </>
  )
}

function EmploymentForm({
  person,
  people,
  onDone,
}: {
  person: DirectoryRow
  people: DirectoryRow[]
  onDone: () => void
}) {
  const router = useRouter()
  const [jobTitle, setJobTitle] = useState(person.job_title ?? '')
  const [department, setDepartment] = useState(person.department ?? '')
  const [team, setTeam] = useState(person.team ?? '')
  const [managerId, setManagerId] = useState(person.manager_id ?? '')
  const [contract, setContract] = useState(person.contract_type ?? 'Full time')
  const [location, setLocation] = useState(person.location ?? '')
  const [startedOn, setStartedOn] = useState(person.started_on ?? '')
  const [entitlement, setEntitlement] = useState(String(person.entitlement ?? 20))

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Nobody manages themselves, so nobody is offered as their own manager.
  // Closed accounts are left out too: a manager who has gone is a stale
  // answer, and the record is the wrong place to learn it.
  const candidates = people
    .filter((p) => p.id !== person.id && p.status === 'active')
    .sort((a, b) => a.full_name.localeCompare(b.full_name))

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)

    const supabase = createClient()
    const { error: rpcError } = await supabase.rpc('hr_update_employment', {
      p_person_id: person.id,
      p_job_title: jobTitle,
      p_department: department,
      p_team: team,
      p_manager_id: managerId || null,
      p_contract_type: contract,
      p_location: location,
      p_started_on: startedOn || null,
      p_entitlement: Number(entitlement),
    })

    setBusy(false)
    // The RPC raises a written sentence for every rule it enforces, so
    // showing its message is showing the reason, not a code.
    if (rpcError) return setError(rpcError.message)

    onDone()
    router.refresh()
  }

  return (
    <form onSubmit={save} style={{ padding: 'var(--s-4) 0' }}>
      <h3 className="card__title" style={{ fontSize: 'var(--fs-md)' }}>
        {person.full_name}&rsquo;s employment record
      </h3>
      <p className="card__sub">
        This is what they see on their own Leave &amp; profile screen.
      </p>

      {error && (
        <div className="banner banner--error mt-3" role="alert">
          {error}
        </div>
      )}

      <div
        className="mt-4"
        style={{
          display: 'grid',
          gap: 'var(--s-3)',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        }}
      >
        <div>
          <label className="field__label" htmlFor={`jt-${person.id}`}>Job title</label>
          <input
            id={`jt-${person.id}`}
            className="input"
            value={jobTitle}
            required
            onChange={(e) => setJobTitle(e.target.value)}
          />
        </div>

        <div>
          <label className="field__label" htmlFor={`dp-${person.id}`}>Department</label>
          <input
            id={`dp-${person.id}`}
            className="input"
            value={department}
            required
            onChange={(e) => setDepartment(e.target.value)}
          />
        </div>

        <div>
          <label className="field__label" htmlFor={`tm-${person.id}`}>Team</label>
          <input
            id={`tm-${person.id}`}
            className="input"
            value={team}
            placeholder="Optional"
            onChange={(e) => setTeam(e.target.value)}
          />
        </div>

        <div>
          <label className="field__label" htmlFor={`mg-${person.id}`}>Manager</label>
          <select
            id={`mg-${person.id}`}
            className="select"
            value={managerId}
            onChange={(e) => setManagerId(e.target.value)}
          >
            <option value="">No manager recorded</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field__label" htmlFor={`ct-${person.id}`}>Contract</label>
          <select
            id={`ct-${person.id}`}
            className="select"
            value={contract}
            onChange={(e) => setContract(e.target.value)}
          >
            {/* A value already on the record that is not one of the usual
                five still has to be selectable, or opening this form would
                silently change it on save. */}
            {!CONTRACTS.includes(contract as (typeof CONTRACTS)[number]) && contract && (
              <option value={contract}>{contract}</option>
            )}
            {CONTRACTS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field__label" htmlFor={`lc-${person.id}`}>Location</label>
          <input
            id={`lc-${person.id}`}
            className="input"
            value={location}
            placeholder="Optional"
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>

        <div>
          <label className="field__label" htmlFor={`sd-${person.id}`}>Started</label>
          <input
            id={`sd-${person.id}`}
            className="input"
            type="date"
            value={startedOn}
            required
            onChange={(e) => setStartedOn(e.target.value)}
          />
        </div>

        <div>
          <label className="field__label" htmlFor={`en-${person.id}`}>
            Leave entitlement (days)
          </label>
          <input
            id={`en-${person.id}`}
            className="input"
            type="number"
            min="0"
            max="365"
            value={entitlement}
            required
            onChange={(e) => setEntitlement(e.target.value)}
          />
        </div>
      </div>

      <div className="row mt-4">
        <button className="btn btn--primary btn--sm" type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save record'}
        </button>
        <button
          className="btn btn--secondary btn--sm"
          type="button"
          disabled={busy}
          onClick={onDone}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
