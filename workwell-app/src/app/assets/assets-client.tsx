'use client'

import { useState } from 'react'
import { PageHead, PlaneBadge } from '@/components/chrome'
import { fmtDate } from '@/lib/format-date'

type Asset = {
  id: string
  tag: string
  type: string
  issued: string
  condition: 'Good' | 'Fair'
  issueReported: boolean
}

const SEED: Asset[] = [
  { id: 'a1', tag: 'WW-LT-0142', type: 'Laptop — 14" ', issued: '2025-03-10', condition: 'Good', issueReported: false },
  { id: 'a2', tag: 'WW-BD-0891', type: 'Access badge', issued: '2025-03-10', condition: 'Good', issueReported: false },
  { id: 'a3', tag: 'WW-MN-0207', type: 'External monitor', issued: '2025-09-02', condition: 'Fair', issueReported: false },
]

export default function AssetsClient() {
  const [assets, setAssets] = useState<Asset[]>(SEED)
  const [reporting, setReporting] = useState<string | null>(null)
  const [note, setNote] = useState('')

  function report(id: string) {
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
