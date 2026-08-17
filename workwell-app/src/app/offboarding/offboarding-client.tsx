'use client'

import { useState } from 'react'
import { PageHead, PlaneBadge } from '@/components/chrome'
import { ToggleRow } from '@/components/controls'
import { fmtDate } from '@/lib/format-date'

type Leaver = { name: string; lastDay: string }

const LEAVERS: Leaver[] = [
  { name: 'Ana Cruz', lastDay: '2026-08-29' },
  { name: 'Ben Torres', lastDay: '2026-09-12' },
]

const CHECKLIST = [
  { key: 'assets', title: 'Assets returned', desc: 'Laptop, badge, and anything else on loan' },
  { key: 'access', title: 'Access revoked', desc: 'Accounts, systems, building access' },
  { key: 'lastday', title: 'Last day confirmed', desc: 'Agreed in writing with the employee' },
  { key: 'finalpay', title: 'Final pay processed', desc: 'Including any unused leave payout' },
  { key: 'exit', title: 'Exit interview done', desc: 'Optional, but logged either way' },
] as const

export default function OffboardingClient() {
  const [selected, setSelected] = useState(LEAVERS[0].name)
  const [state, setState] = useState<Record<string, Record<string, boolean>>>({})

  const checks = state[selected] ?? {}
  const done = CHECKLIST.filter((c) => checks[c.key]).length

  function toggle(key: string, on: boolean) {
    setState((s) => ({ ...s, [selected]: { ...s[selected], [key]: on } }))
  }

  return (
    <>
      <PageHead
        title="Offboarding"
        lead="The checklist for someone leaving — HR's side of it."
      />
      <PlaneBadge plane="work" />

      <div className="card mb-5">
        <label className="field__label" htmlFor="lvr">Leaving</label>
        <select id="lvr" className="select" value={selected} onChange={(e) => setSelected(e.target.value)}>
          {LEAVERS.map((l) => (
            <option key={l.name} value={l.name}>
              {l.name} — last day {fmtDate(l.lastDay, { day: 'numeric', month: 'short' })}
            </option>
          ))}
        </select>
      </div>

      <div className="card">
        <div className="card__head">
          <div className="card__title">{selected}</div>
          <span className="chip chip--accent">{done} of {CHECKLIST.length}</span>
        </div>
        <div className="meter mt-3 mb-4">
          <div className="meter__track">
            <div className="meter__fill" style={{ width: `${(done / CHECKLIST.length) * 100}%` }} />
          </div>
        </div>

        <div className="stack stack--tight">
          {CHECKLIST.map((c) => (
            <ToggleRow
              key={c.key}
              title={c.title}
              desc={c.desc}
              on={!!checks[c.key]}
              onChange={(on) => toggle(c.key, on)}
            />
          ))}
        </div>
      </div>
    </>
  )
}
