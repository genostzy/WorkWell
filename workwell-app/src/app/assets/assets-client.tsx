'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHead, PlaneBadge, PrivacyNote } from '@/components/chrome'
import { fmtDate } from '@/lib/format-date'

type Asset = {
  id: string
  tag: string
  asset_type: string
  issued_on: string
  condition: 'Good' | 'Fair' | 'Poor'
  issue_reported: boolean
  issue_note: string | null
}

export default function AssetsClient() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [reporting, setReporting] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('assets')
        .select('id, tag, asset_type, issued_on, condition, issue_reported, issue_note')
        .order('issued_on')
      if (cancelled) return
      if (error) setLoadError(error.message)
      setAssets((data ?? []) as Asset[])
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function report(id: string) {
    setSending(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('assets')
      .update({ issue_reported: true, issue_note: note.trim() || null })
      .eq('id', id)
    setSending(false)

    if (error) return setLoadError(error.message)

    setAssets((a) =>
      a.map((x) => (x.id === id ? { ...x, issue_reported: true, issue_note: note.trim() || null } : x))
    )
    setReporting(null)
    setNote('')
  }

  return (
    <>
      <PageHead
        title="Assets"
        lead="Equipment issued to you — laptops, badges, anything else on loan."
      />
      <PlaneBadge plane="work" />

      <div className="card card--flush">
        <div style={{ padding: 'var(--s-5) var(--s-5) var(--s-3)' }}>
          <h2 className="card__title">Issued to you</h2>
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
        ) : assets.length === 0 ? (
          <p className="t-subtle" style={{ padding: '0 var(--s-5) var(--s-5)' }}>
            Nothing issued to you yet.
          </p>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <caption className="sr-only">Assets issued to you</caption>
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col">Tag</th>
                  <th scope="col">Issued</th>
                  <th scope="col">Condition</th>
                  <th scope="col"></th>
                </tr>
              </thead>
              <tbody>
                {assets.map((a) => (
                  <tr key={a.id}>
                    <th scope="row" style={{ fontWeight: 600 }}>{a.asset_type}</th>
                    <td className="t-subtle">{a.tag}</td>
                    <td>{fmtDate(a.issued_on)}</td>
                    <td>
                      <span className={a.condition === 'Good' ? 'chip chip--accent' : 'chip'}>
                        {a.condition}
                      </span>
                    </td>
                    <td>
                      {a.issue_reported ? (
                        <span className="t-subtle">Issue reported</span>
                      ) : reporting === a.id ? (
                        <div className="row" style={{ gap: 'var(--s-2)' }}>
                          <input
                            className="input"
                            style={{ maxWidth: 200 }}
                            placeholder="What's wrong?"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                          />
                          <button
                            className="btn btn--primary btn--sm"
                            type="button"
                            disabled={sending}
                            onClick={() => report(a.id)}
                          >
                            Send
                          </button>
                        </div>
                      ) : (
                        <button className="btn btn--ghost btn--sm" type="button" onClick={() => setReporting(a.id)}>
                          Report an issue
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PrivacyNote
        plane="work"
        detail="Equipment records are tied to your employment, not your private plane — HR who manage inventory can see what's issued to you and any issue you report, the same as leave or expense records. Nothing here touches check-ins, mood, or anything else you track privately."
      >
        <b>Seen by HR who manage inventory.</b>{' '}
      </PrivacyNote>
    </>
  )
}
