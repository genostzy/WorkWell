'use client'

import { useState } from 'react'
import { PageHead, PlaneBadge, PrivacyNote } from '@/components/chrome'

type Warning = {
  id: string
  employee: string
  category: string
  note: string
  status: 'Active' | 'Resolved'
}

const CATEGORIES = ['Attendance', 'Conduct', 'Performance', 'Policy breach'] as const

const SEED: Warning[] = [
  { id: 'w1', employee: 'Ben Torres', category: 'Attendance', note: 'Three unapproved absences in one month.', status: 'Active' },
]

export default function WarningsClient() {
  const [warnings, setWarnings] = useState<Warning[]>(SEED)
  const [employee, setEmployee] = useState('')
  const [category, setCategory] = useState<string>(CATEGORIES[0])
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!employee.trim()) return setError('Name the employee this concerns.')
    if (!note.trim()) return setError('State what the warning is for.')
    setError(null)
    setWarnings((w) => [
      { id: crypto.randomUUID(), employee: employee.trim(), category, note: note.trim(), status: 'Active' },
      ...w,
    ])
    setEmployee('')
    setNote('')
  }

  function resolve(id: string) {
    setWarnings((w) => w.map((x) => (x.id === id ? { ...x, status: 'Resolved' } : x)))
  }

  return (
    <>
      <PageHead title="Warnings" lead="Formal disciplinary records." />
      <PlaneBadge plane="work" />

      <div className="grid grid--records">
        <div className="stack">
          <div className="card card--flush">
            <div style={{ padding: 'var(--s-5) var(--s-5) var(--s-3)' }}>
              <h2 className="card__title">Records</h2>
            </div>
            {warnings.length === 0 ? (
              <p className="t-subtle" style={{ padding: '0 var(--s-5) var(--s-5)' }}>
                None on file.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {warnings.map((w) => (
                  <div
                    key={w.id}
                    style={{
                      padding: 'var(--s-4) var(--s-5)',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--s-3)', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-3)', flexWrap: 'wrap' }}>
                        <b style={{ fontWeight: 600 }}>{w.employee}</b>
                        <span className="chip">{w.category}</span>
                        <span className={w.status === 'Active' ? 'chip chip--accent' : 'chip'}>
                          {w.status}
                        </span>
                      </div>
                      {w.status === 'Active' && (
                        <button className="btn btn--ghost btn--sm" type="button" onClick={() => resolve(w.id)}>
                          Mark resolved
                        </button>
                      )}
                    </div>
                    <p style={{ marginTop: 'var(--s-2)', color: 'var(--text-muted)', fontSize: 'var(--fs-sm)' }}>
                      {w.note}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="stack">
          <form className="card" onSubmit={submit}>
            <h2 className="card__title">Raise a warning</h2>

            {error && <div className="banner banner--error" role="alert">{error}</div>}

            <div className="mt-4">
              <label className="field__label" htmlFor="wemp">Employee</label>
              <input id="wemp" className="input" value={employee} onChange={(e) => setEmployee(e.target.value)} />
            </div>

            <div className="mt-4">
              <label className="field__label" htmlFor="wcat">Category</label>
              <select id="wcat" className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>

            <div className="mt-4">
              <label className="field__label" htmlFor="wnote">What it&apos;s for</label>
              <textarea id="wnote" className="textarea" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>

            <div className="mt-4">
              <button className="btn btn--primary" type="submit">Raise warning</button>
            </div>
          </form>
        </div>
      </div>

      <PrivacyNote
        plane="work"
        detail="Every other work-plane record here is neutral fact HR needs to run the place — a job title, a leave balance. A warning is a judgement about a person, and putting it next to the same private-plane data this product goes out of its way to wall off is worth deciding on purpose, with whoever owns HR policy. What is mocked below is one option, not a decided design."
      >
        <b>Illustrative only — a different kind of record than the rest of this list.</b>{' '}
      </PrivacyNote>
    </>
  )
}
