'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHead, PlaneBadge, PrivacyNote } from '@/components/chrome'

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

type Warning = {
  id: string
  category: string
  note: string
  status: 'Active' | 'Resolved'
  created_at: string
}

/** Read-only: an employee sees their own warnings the moment HR raises one,
 *  the same visibility Expenses and Complaints already give their own
 *  subject. There's nothing here to act on — no withdraw, no reply. */
export default function WarningsClient() {
  const [warnings, setWarnings] = useState<Warning[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('warnings')
        .select('id, category, note, status, created_at')
        .order('created_at', { ascending: false })
      if (cancelled) return
      if (error) setLoadError(error.message)
      else setWarnings((data ?? []) as Warning[])
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <>
      <PageHead title="Warnings" lead="Formal disciplinary records on your file." />
      <PlaneBadge plane="work" />

      {loadError && (
        <div className="banner banner--error mb-5" role="alert">
          {loadError}
        </div>
      )}

      <div className="card card--flush">
        <div style={{ padding: 'var(--s-5) var(--s-5) var(--s-3)' }}>
          <h2 className="card__title">Your records</h2>
        </div>
        {loading ? (
          <div style={{ padding: '0 var(--s-5) var(--s-5)' }}>
            <div className="skel skel--text" />
          </div>
        ) : warnings.length === 0 ? (
          <p className="t-subtle" style={{ padding: '0 var(--s-5) var(--s-5)' }}>
            None on file.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {warnings.map((w) => (
              <div
                key={w.id}
                style={{ padding: 'var(--s-4) var(--s-5)', borderBottom: '1px solid var(--border)' }}
              >
                <div className="row row--between" style={{ flexWrap: 'wrap' }}>
                  <div className="row" style={{ gap: 'var(--s-3)', flexWrap: 'wrap' }}>
                    <span className="chip">{w.category}</span>
                    <span className={w.status === 'Active' ? 'chip chip--accent' : 'chip'}>
                      {w.status}
                    </span>
                  </div>
                  <span className="t-subtle">{fmtDateTime(w.created_at)}</span>
                </div>
                <p className="t-subtle mt-2">{w.note}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <PrivacyNote
        plane="work"
        detail="A warning is visible to you and to HR of your organisation from the moment it's raised — the same access Expenses and Complaints already give their own subject. Nothing about it reaches the private plane, and nothing you record elsewhere (check-ins, mood, boundaries) is ever attached to one."
      >
        <b>Visible to you and HR, nowhere else.</b>{' '}
      </PrivacyNote>
    </>
  )
}
