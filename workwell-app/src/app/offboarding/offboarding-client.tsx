'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHead, PlaneBadge } from '@/components/chrome'
import { ToggleRow } from '@/components/controls'
import { fmtDate } from '@/lib/format-date'

type Leaver = { personId: string; name: string; lastDay: string }

const CHECKLIST = [
  { key: 'assets', title: 'Assets returned', desc: 'Laptop, badge, and anything else on loan' },
  { key: 'access', title: 'Access revoked', desc: 'Accounts, systems, building access' },
  { key: 'lastday', title: 'Last day confirmed', desc: 'Agreed in writing with the employee' },
  { key: 'finalpay', title: 'Final pay processed', desc: 'Including any unused leave payout' },
  { key: 'exit', title: 'Exit interview done', desc: 'Optional, but logged either way' },
] as const

export default function OffboardingClient() {
  const [leavers, setLeavers] = useState<Leaver[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [checks, setChecks] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const { data: resignations, error: rError } = await supabase
        .from('resignations')
        .select('person_id, last_day')
        .neq('status', 'Withdrawn')
        .order('last_day')
      if (cancelled) return
      if (rError) {
        setLoadError(rError.message)
        setLoading(false)
        return
      }

      const personIds = [...new Set((resignations ?? []).map((r) => r.person_id))]
      if (personIds.length === 0) {
        setLoading(false)
        return
      }

      const { data: people, error: pError } = await supabase
        .from('people')
        .select('id, full_name')
        .in('id', personIds)
      if (cancelled) return
      if (pError) {
        setLoadError(pError.message)
        setLoading(false)
        return
      }

      const names = new Map((people ?? []).map((p) => [p.id, p.full_name]))
      const rows = (resignations ?? []).map((r) => ({
        personId: r.person_id as string,
        name: names.get(r.person_id) ?? 'Someone',
        lastDay: r.last_day as string,
      }))
      setLeavers(rows)
      setSelected(rows[0]?.personId ?? null)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!selected) return
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('offboarding_checklist')
        .select('item_key, done')
        .eq('person_id', selected)
      if (cancelled) return
      if (error) return setLoadError(error.message)
      setChecks(Object.fromEntries((data ?? []).map((c) => [c.item_key, c.done])))
    })()
    return () => {
      cancelled = true
    }
  }, [selected])

  async function toggle(key: string, on: boolean) {
    if (!selected) return
    setChecks((c) => ({ ...c, [key]: on }))
    const supabase = createClient()
    const { error } = await supabase
      .from('offboarding_checklist')
      .upsert(
        { person_id: selected, item_key: key, done: on, updated_at: new Date().toISOString() },
        { onConflict: 'person_id,item_key' }
      )
    if (error) setLoadError(error.message)
  }

  const done = CHECKLIST.filter((c) => checks[c.key]).length
  const current = leavers.find((l) => l.personId === selected)

  return (
    <>
      <PageHead
        title="Offboarding"
        lead="The checklist for someone leaving — HR's side of it."
      />
      <PlaneBadge plane="work" />

      {loadError && (
        <div className="banner banner--error mb-5" role="alert">
          {loadError}
        </div>
      )}

      {loading ? (
        <div className="card">
          <div className="skel skel--text" />
        </div>
      ) : leavers.length === 0 ? (
        <div className="card card--quiet">
          <p className="t-subtle">Nobody has given notice yet.</p>
        </div>
      ) : (
        <>
          <div className="card mb-5">
            <label className="field__label" htmlFor="lvr">Leaving</label>
            <select
              id="lvr"
              className="select"
              value={selected ?? ''}
              onChange={(e) => setSelected(e.target.value)}
            >
              {leavers.map((l) => (
                <option key={l.personId} value={l.personId}>
                  {l.name} — last day {fmtDate(l.lastDay, { day: 'numeric', month: 'short' })}
                </option>
              ))}
            </select>
          </div>

          {current && (
            <div className="card">
              <div className="card__head">
                <h2 className="card__title">{current.name}</h2>
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
          )}
        </>
      )}
    </>
  )
}
