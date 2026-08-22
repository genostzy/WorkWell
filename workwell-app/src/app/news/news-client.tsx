'use client'

import { useState } from 'react'
import { PageHead, PlaneBadge } from '@/components/chrome'
import { fmtDate } from '@/lib/format-date'

type Post = { id: string; title: string; date: string; body: string }

const POSTS: Post[] = [
  {
    id: 'n1',
    title: 'Office closed for the long weekend',
    date: '2026-08-14',
    body: "With National Heroes Day landing on a Monday, the office stays closed through the weekend. Nothing to action — this is a heads-up, not a request.",
  },
  {
    id: 'n2',
    title: 'New benefits partner starting next quarter',
    date: '2026-08-05',
    body: 'HR is finalising a switch in HMO provider. Coverage details and the transition timeline will follow once the contract is signed — nothing changes before then.',
  },
  {
    id: 'n3',
    title: 'Building Wi-Fi upgrade this Saturday',
    date: '2026-07-29',
    body: 'IT is replacing the access points floor by floor this Saturday. Expect brief drops if anyone is in over the weekend; everything should be back by Monday morning.',
  },
]

export default function NewsClient() {
  const [open, setOpen] = useState<string | null>(POSTS[0]?.id ?? null)

  return (
    <>
      <PageHead title="News" lead="Announcements from your organisation." />
      <PlaneBadge plane="work" />

      <div className="stack">
        {POSTS.map((p) => {
          const expanded = open === p.id
          return (
            <div className="card" key={p.id}>
              <button
                type="button"
                className="row row--between"
                style={{ width: '100%', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left', padding: 0 }}
                aria-expanded={expanded}
                onClick={() => setOpen(expanded ? null : p.id)}
              >
                <div>
                  <div className="card__title">{p.title}</div>
                  <div className="card__sub">{fmtDate(p.date, { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                </div>
                <span aria-hidden="true">{expanded ? '−' : '+'}</span>
              </button>
              {expanded && <p className="t-subtle mt-3">{p.body}</p>}
            </div>
          )
        })}
      </div>
    </>
  )
}
