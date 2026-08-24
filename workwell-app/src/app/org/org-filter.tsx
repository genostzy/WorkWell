'use client'

import { useState } from 'react'

type Cohort = {
  cohort: string
  headcount: number
  suppressed: boolean
}

type Metric = {
  cohort: string
  metric: string
  value: number
  n: number
}

const METRICS = [
  { key: 'mood', label: 'Mood' },
  { key: 'energy', label: 'Energy' },
  { key: 'pressure', label: 'Pressure' },
]

function valueFor(
  metrics: Metric[],
  cohort: string,
  metric: string,
): Metric | undefined {
  return metrics.find((m) => m.cohort === cohort && m.metric === metric)
}

export function OrgFilter({
  cohorts,
  metrics,
}: {
  cohorts: Cohort[]
  metrics: Metric[]
}) {
  const departments = [...new Set(cohorts.map((c) => c.cohort))].sort()
  const [selected, setSelected] = useState('all')

  const shown =
    selected === 'all'
      ? cohorts.filter((c) => !c.suppressed)
      : cohorts.filter((c) => !c.suppressed && c.cohort === selected)

  const hidden =
    selected === 'all'
      ? cohorts.filter((c) => c.suppressed)
      : cohorts.filter((c) => c.suppressed && c.cohort === selected)

  return (
    <>
      <div className="mb-5">
        <label htmlFor="dept-filter" style={{ fontSize: 'var(--fs-sm)', fontWeight: 600 }}>
          Filter by department
        </label>
        <select
          id="dept-filter"
          className="input"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          style={{ maxWidth: 300, display: 'block', marginTop: 'var(--s-2)' }}
        >
          <option value="all">All departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      {shown.length === 0 && (
        <div className="card">
          <div className="state state--info">
            <div className="state__icon" aria-hidden="true">👥</div>
            <h2 className="state__title">No matching groups</h2>
            <p className="state__text">
              No groups of eight or more match this filter.
            </p>
          </div>
        </div>
      )}

      {shown.map((c) => (
        <div className="card" key={c.cohort}>
          <div className="card__head">
            <div>
              <div className="card__title">{c.cohort}</div>
              <div className="card__sub">{c.headcount} people contributing</div>
            </div>
            <span className="chip chip--accent">Reporting</span>
          </div>
          {METRICS.map((m) => {
            const v = valueFor(metrics, c.cohort, m.key)
            return (
              <div className="metric" key={m.key}>
                <span>{m.label}</span>
                <span className="meter__track">
                  <span
                    className="meter__fill"
                    style={{
                      width: v ? `${(Number(v.value) / 5) * 100}%` : '0%',
                    }}
                  />
                </span>
                <b className="t-num">
                  {v ? Number(v.value).toFixed(1) : '—'}
                </b>
              </div>
            )
          })}
        </div>
      ))}

      {hidden.length > 0 && (
        <div className="card card--quiet">
          <div className="card__title mb-2">Hidden: too few people</div>
          <p className="t-subtle mb-4">
            Named so that a gap is never mistaken for a signal. No figures exist
            for these groups.
          </p>
          <div className="stack stack--tight">
            {hidden.map((c) => (
              <div className="row row--between" key={c.cohort}>
                <b>{c.cohort}</b>
                <span className="chip">
                  {c.headcount} {c.headcount === 1 ? 'person' : 'people'} — under 8
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
