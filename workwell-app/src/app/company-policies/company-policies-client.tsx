'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHead, PlaneBadge, PrivacyNote } from '@/components/chrome'
import { ToggleRow } from '@/components/controls'
import { fmtDate } from '@/lib/format-date'

type Policy = { id: string; title: string; updated_on: string; body: string | null }

export default function CompanyPoliciesClient() {
  const [personId, setPersonId] = useState<string | null>(null)
  const [policies, setPolicies] = useState<Policy[]>([])
  const [ack, setAck] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  /** Which policy is open. Only one at a time: these are documents, not
   *  rows to skim side by side. */
  const [reading, setReading] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const { data: me, error: meError } = await supabase.from('me').select('id').maybeSingle()
      if (cancelled) return
      if (meError) {
        setLoadError(meError.message)
        setLoading(false)
        return
      }
      setPersonId(me?.id ?? null)

      const [{ data: ps, error: psError }, { data: acks, error: acksError }] = await Promise.all([
        supabase.from('policies').select('id, title, updated_on, body').order('title'),
        supabase.from('policy_acks').select('policy_id'),
      ])
      if (cancelled) return
      if (psError ?? acksError) setLoadError((psError ?? acksError)!.message)
      setPolicies((ps ?? []) as Policy[])
      setAck(Object.fromEntries((acks ?? []).map((a) => [a.policy_id, true])))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function acknowledge(policyId: string) {
    if (!personId) return
    setBusy(policyId)
    const supabase = createClient()
    const { error } = await supabase
      .from('policy_acks')
      .insert({ policy_id: policyId, person_id: personId })
    setBusy(null)

    if (error) return setLoadError(error.message)
    setAck((a) => ({ ...a, [policyId]: true }))
  }

  const done = policies.filter((p) => ack[p.id]).length

  return (
    <>
      <PageHead
        title="Company policies"
        lead="The documents everyone is expected to have read."
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
      ) : (
        <>
          <div className="card mb-5">
            <div className="stat">
              <span className="stat__value t-num">{done}</span>
              <span className="stat__label">of {policies.length} acknowledged</span>
            </div>
            <div className="meter mt-3">
              <div className="meter__track">
                <div
                  className="meter__fill"
                  style={{ width: `${policies.length === 0 ? 0 : (done / policies.length) * 100}%` }}
                />
              </div>
            </div>
          </div>

          <div className="stack">
            {policies.map((p) => (
              <div className="card" key={p.id}>
                <ToggleRow
                  title={p.title}
                  desc={`Updated ${fmtDate(p.updated_on)}${ack[p.id] ? ' · Acknowledged' : ''}`}
                  on={!!ack[p.id]}
                  onChange={(next) => {
                    if (next && !ack[p.id] && busy !== p.id) acknowledge(p.id)
                  }}
                />

                {/* The policy itself. Open and shut in place rather than on
                    its own screen: the switch that says you have read it is
                    right here, and sending somebody elsewhere to read the
                    thing means coming back to a list to find their row
                    again. Absent entirely when HR has not written the text
                    yet — an empty reader is worse than no button. */}
                {p.body ? (
                  <>
                    <div className="row mt-3">
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm"
                        aria-expanded={reading === p.id}
                        onClick={() => setReading((id) => (id === p.id ? null : p.id))}
                      >
                        {reading === p.id ? 'Close' : 'View policy'}
                      </button>
                    </div>
                    {reading === p.id && (
                      <div className="policy-body mt-3">
                        {p.body.split(/\n{2,}/).map((para, i) => (
                          <p key={i}>{para}</p>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="t-subtle mt-3">
                    The text of this one has not been added yet.
                  </p>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <PrivacyNote
        plane="work"
        detail="Acknowledging a policy records that you've read it — HR can see who has and hasn't, the same as any other work-plane record. It says nothing about how you feel about the policy, and nothing here touches the private plane."
      >
        <b>Your acknowledgment is visible to HR.</b>{' '}
      </PrivacyNote>
    </>
  )
}
