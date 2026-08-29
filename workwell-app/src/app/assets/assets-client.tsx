'use client'

import { useEffect, useState } from 'react'
import { PageHead, PlaneBadge } from '@/components/chrome'
import { createClient } from '@/lib/supabase/client'
import { fmtDate } from '@/lib/format-date'

type Asset = {
  id: string
  tag: string
  type: string
  issued: string
  condition: string
  issueReported: boolean
}

export default function AssetsClient() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string|null>(null)
  const [reporting, setReporting] = useState<string | null>(null)
  const [note, setNote] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.from('assets').select('id, name, serial_number, issued_on, status, notes').order('issued_on', { ascending: false }).then(({ data, error }) => {
      if (error) { setError(error.message); setLoading(false); return }
      const rows = (data ?? []) as { id: string; name: string; serial_number: string | null; issued_on: string; status: string; notes: string | null }[]
      setAssets(rows.map(r => ({ id: r.id, tag: r.serial_number ?? r.id.slice(0,8), type: r.name, issued: r.issued_on, condition: r.status, issueReported: !!r.notes })))
      setLoading(false)
    })
  }, [])

  async function report(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('assets').update({ notes: note.trim() || 'Issue reported' }).eq('id', id)
    if (error) { setError(error.message); return }
    setAssets((a) => a.map((x) => (x.id === id ? { ...x, issueReported: true } : x)))
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
          <div className="card__title">Issued to you</div>
        </div>
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
                  <th scope="row" style={{ fontWeight: 600 }}>{a.type}</th>
                  <td className="t-subtle">{a.tag}</td>
                  <td>{fmtDate(a.issued)}</td>
                  <td>
                    <span className={a.condition === 'Good' ? 'chip chip--accent' : 'chip'}>
                      {a.condition}
                    </span>
                  </td>
                  <td>
                    {a.issueReported ? (
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
                        <button className="btn btn--primary btn--sm" type="button" onClick={() => report(a.id)}>
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
      </div>
    </>
  )
}
