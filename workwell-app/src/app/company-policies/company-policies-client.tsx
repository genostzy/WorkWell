'use client'

import { useState } from 'react'
import { PageHead, PlaneBadge } from '@/components/chrome'
import { ToggleRow } from '@/components/controls'
import { fmtDate } from '@/lib/format-date'

type Policy = { id: string; title: string; updated: string }

const POLICIES: Policy[] = [
  { id: 'p1', title: 'Code of conduct', updated: '2026-01-12' },
  { id: 'p2', title: 'Leave and time off', updated: '2026-02-03' },
  { id: 'p3', title: 'Data & device security', updated: '2026-04-20' },
  { id: 'p4', title: 'Anti-harassment policy', updated: '2026-05-15' },
  { id: 'p5', title: 'Expense reimbursement', updated: '2026-06-01' },
]

export default function CompanyPoliciesClient() {
  const [ack, setAck] = useState<Record<string, boolean>>({})
  const done = POLICIES.filter((p) => ack[p.id]).length

  return (
    <>
      <PageHead
        title="Company policies"
        lead="The documents everyone is expected to have read."
      />
      <PlaneBadge plane="work" />

      <div className="card mb-5">
        <div className="stat">
          <span className="stat__value t-num">{done}</span>
          <span className="stat__label">of {POLICIES.length} acknowledged</span>
        </div>
        <div className="meter mt-3">
          <div className="meter__track">
            <div className="meter__fill" style={{ width: `${(done / POLICIES.length) * 100}%` }} />
          </div>
        </div>
      </div>

      <div className="stack">
        {POLICIES.map((p) => (
          <div className="card" key={p.id}>
            <ToggleRow
              title={p.title}
              desc={`Updated ${fmtDate(p.updated)}${ack[p.id] ? ' · Acknowledged' : ''}`}
              on={!!ack[p.id]}
              onChange={(on) => setAck((a) => ({ ...a, [p.id]: on }))}
            />
          </div>
        ))}
      </div>
    </>
  )
}
