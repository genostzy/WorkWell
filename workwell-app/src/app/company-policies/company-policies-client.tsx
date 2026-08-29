'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHead, PlaneBadge, PrivacyNote } from '@/components/chrome'
import { fmtDate } from '@/lib/format-date'

type Policy = { id: string; title: string; updated_on: string; body: string | null }

export default function CompanyPoliciesClient() {
  const [policies, setPolicies] = useState<Policy[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  /** Which policy is open. Only one at a time: these are documents, not
   *  rows to skim side by side. */
  const [reading, setReading] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const { data: ps, error: psError } = await supabase
        .from('policies')
        .select('id, title, updated_on, body')
        .order('title')
      if (cancelled) return
      if (psError) setLoadError(psError.message)
      setPolicies((ps ?? []) as Policy[])
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

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
        <div className="stack">
          {policies.map((p) => (
            <div className="card" key={p.id}>
              <div>
                <div className="card__title">{p.title}</div>
                <div className="card__sub">Updated {fmtDate(p.updated_on)}</div>
              </div>

              {/* The policy itself. Open and shut in place rather than on
                  its own screen: policies are documents to be read, not
                  tasks to be acknowledged — the previous toggle has been
                  removed so the page is read-only. Absent entirely when HR
                  has not written the text yet — an empty reader is worse
                  than no button. */}
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
      )}

      <PrivacyNote
        plane="work"
        detail="These are work-plane documents — everyone can read them, no acknowledgment is recorded, and nothing here touches the private plane."
      >
        <b>Read-only — no tracking.</b>{' '}
      </PrivacyNote>
    </>
  )
}
