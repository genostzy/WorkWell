'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Checklist {
  id: string
  person_id: string
  person_name?: string
  asset_returned: boolean
  access_revoked: boolean
  last_day_confirmed: boolean
  equipment_returned: boolean
  handover_done: boolean
  created_at: string
}

const CHECKBOXES = [
  { key: 'asset_returned' as const, label: 'Assets returned' },
  { key: 'access_revoked' as const, label: 'Access revoked' },
  { key: 'last_day_confirmed' as const, label: 'Last day confirmed' },
  { key: 'equipment_returned' as const, label: 'Equipment returned' },
  { key: 'handover_done' as const, label: 'Handover done' },
]

export function OffboardingChecklist({
  checklist,
  isHr,
}: {
  checklist: Checklist
  isHr: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [local, setLocal] = useState(checklist)

  function fmt(iso: string) {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  const completedCount = CHECKBOXES.filter((c) => local[c.key]).length
  const allDone = completedCount === CHECKBOXES.length

  async function toggle(key: keyof Checklist) {
    setBusy(true)
    const supabase = createClient()
    const newValue = !local[key]

    const { error } = await supabase
      .from('offboarding_checklists')
      .update({ [key]: newValue })
      .eq('id', local.id)

    if (!error) {
      setLocal({ ...local, [key]: newValue })
    }
    setBusy(false)
  }

  return (
    <div className="card card--quiet" style={{ margin: 0 }}>
      <div className="row row--between">
        <div>
          <b>{isHr ? local.person_name : 'Your checklist'}</b>
          <span className="t-subtle" style={{ marginLeft: 'var(--s-3)' }}>
            Created {fmt(local.created_at)}
          </span>
        </div>
        <span className={allDone ? 'chip chip--accent' : 'chip'}>
          {completedCount}/{CHECKBOXES.length}
        </span>
      </div>

      <div className="stack mt-3" style={{ gap: 'var(--s-2)' }}>
        {CHECKBOXES.map((cb) => (
          <label
            key={cb.key}
            className="row"
            style={{
              gap: 'var(--s-2)',
              cursor: isHr ? 'pointer' : 'default',
              opacity: busy ? 0.6 : 1,
            }}
          >
            <input
              type="checkbox"
              checked={local[cb.key]}
              disabled={!isHr || busy}
              onChange={() => toggle(cb.key)}
            />
            <span>{cb.label}</span>
          </label>
        ))}
      </div>
    </div>
  )
}
