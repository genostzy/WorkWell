'use client'

import { useState } from 'react'

type Row = {
  id: string
  name: string
  title: string
  department: string
  status: string
}

export function DirectoryFilter({ data }: { data: Row[] }) {
  const [query, setQuery] = useState('')

  const q = query.toLowerCase()
  const filtered = q
    ? data.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.department.toLowerCase().includes(q),
      )
    : data

  return (
    <>
      <div style={{ padding: '0 var(--s-5) var(--s-3)' }}>
        <input
          type="text"
          className="input"
          placeholder="Search by name or department…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search directory"
        />
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <caption className="sr-only">Employee directory</caption>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Title</th>
              <th scope="col">Department</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <th scope="row" style={{ fontWeight: 600 }}>
                  {r.name}
                </th>
                <td>{r.title}</td>
                <td>{r.department}</td>
                <td>
                  <span
                    className={
                      r.status === 'active' ? 'chip chip--accent' : 'chip'
                    }
                  >
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="t-subtle">
                  No matches.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
