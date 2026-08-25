'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHead, PlaneBadge, PrivacyNote } from '@/components/chrome'

type Case = { id: string; summary: string; status: 'Submitted' | 'In review' | 'Resolved' }

export default function ComplaintsClient() {
  const [personId, setPersonId] = useState<string | null>(null)
  const [cases, setCases] = useState<Case[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [summary, setSummary] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

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

      const { data, error } = await supabase
        .from('complaints')
        .select('id, summary, status')
        .order('created_at', { ascending: false })
      if (cancelled) return
      if (error) setLoadError(error.message)
      setCases((data ?? []) as Case[])
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!personId) return setError('This account is not linked to a person yet.')
    if (!summary.trim()) return setError('Say what happened, even briefly.')

    setSending(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('complaints')
      .insert({ person_id: personId, summary: summary.trim() })
      .select('id, summary, status')
      .single()
    setSending(false)

    if (error) return setError(error.message)

    setCases((c) => [data as Case, ...c])
    setSummary('')
  }

  return (
    <>
      <PageHead
        title="Complaints"
        lead="A formal grievance, tracked as a case rather than a message."
      />
      <PlaneBadge plane="work" />

      <div className="banner banner--info mb-5" role="note">
        <span aria-hidden="true">💬</span>
        <span>
          <Link href="/recognition">Recognition &amp; connection</Link> already has a
          private, withdrawable way to ask HR or an external service for support —
          worth using that first if this doesn&apos;t need to be formal.
        </span>
      </div>

      <div className="grid grid--sidebar-right">
        <div className="stack">
          <div className="card card--flush">
            <div style={{ padding: 'var(--s-5) var(--s-5) var(--s-3)' }}>
              <h2 className="card__title">Your cases</h2>
            </div>
            {loadError && (
              <div className="banner banner--error" style={{ margin: '0 var(--s-5) var(--s-5)' }} role="alert">
                {loadError}
              </div>
            )}
            {loading ? (
              <div style={{ padding: '0 var(--s-5) var(--s-5)' }}>
                <div className="skel skel--text" />
              </div>
            ) : cases.length === 0 ? (
              <p className="t-subtle" style={{ padding: '0 var(--s-5) var(--s-5)' }}>
                Nothing filed.
              </p>
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <caption className="sr-only">Your complaint cases</caption>
                  <tbody>
                    {cases.map((c) => (
                      <tr key={c.id}>
                        <td>{c.summary}</td>
                        <td><span className="chip">{c.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="stack">
          <form className="card" onSubmit={submit}>
            <h2 className="card__title">File a case</h2>
            <p className="card__sub">Goes to HR as a tracked case, not a chat message.</p>

            {error && <div className="banner banner--error" role="alert">{error}</div>}

            <div className="mt-4">
              <label className="field__label" htmlFor="csum">What happened</label>
              <textarea
                id="csum"
                className="textarea"
                value={summary}
                placeholder="As much detail as you're comfortable giving."
                onChange={(e) => setSummary(e.target.value)}
              />
            </div>

            <div className="mt-4">
              <button className="btn btn--primary" type="submit" disabled={sending}>
                {sending ? 'Filing…' : 'File case'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <PrivacyNote
        plane="work"
        detail="A case is visible to HR from the moment you file it — there's no private, HR-only-on-request path here the way Recognition & connection has. Nothing you track privately (check-ins, mood, boundaries) is ever attached to a case."
      >
        <b>Goes straight to HR — not anonymous.</b>{' '}
      </PrivacyNote>
    </>
  )
}
