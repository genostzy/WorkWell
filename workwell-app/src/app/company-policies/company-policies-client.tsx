'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import { PageHead, PlaneBadge, PrivacyNote } from '@/components/chrome'
import { ToggleRow } from '@/components/controls'
import { fmtDate } from '@/lib/format-date'

type Policy = { id: string; title: string; updated_on: string }

async function fetchMe() {
  const { data, error } = await createClient().from('me').select('id').maybeSingle()
  if (error) throw error
  return data?.id ?? null
}

async function fetchPoliciesAndAcks() {
  const supabase = createClient()
  const [{ data: ps, error: psError }, { data: acks, error: acksError }] = await Promise.all([
    supabase.from('policies').select('id, title, updated_on').order('title'),
    supabase.from('policy_acks').select('policy_id'),
  ])
  if (psError ?? acksError) throw psError ?? acksError
  return {
    policies: (ps ?? []) as Policy[],
    ack: Object.fromEntries((acks ?? []).map((a) => [a.policy_id, true])) as Record<string, boolean>,
  }
}

export default function CompanyPoliciesClient() {
  const { data: personId } = useSWR('me:id', fetchMe)
  const { data, error: loadErrorObj, isLoading: loading, mutate } = useSWR('policies:mine', fetchPoliciesAndAcks)
  const [actionError, setActionError] = useState<string | null>(null)
  const loadError = actionError ?? loadErrorObj?.message ?? null
  const policies = data?.policies ?? []
  const ack = data?.ack ?? {}

  const [busy, setBusy] = useState<string | null>(null)

  async function acknowledge(policyId: string) {
    if (!personId) return
    setBusy(policyId)
    const supabase = createClient()
    const { error } = await supabase
      .from('policy_acks')
      .insert({ policy_id: policyId, person_id: personId })
    setBusy(null)

    if (error) return setActionError(error.message)
    await mutate(
      (current) =>
        current && { ...current, ack: { ...current.ack, [policyId]: true } },
      { revalidate: false }
    )
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
