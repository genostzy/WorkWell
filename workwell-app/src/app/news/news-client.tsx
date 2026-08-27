'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import { PageHead, PlaneBadge } from '@/components/chrome'
import { fmtDate } from '@/lib/format-date'

type Post = { id: string; title: string; posted_on: string; body: string }

async function fetchPosts() {
  const { data, error } = await createClient()
    .from('news_posts')
    .select('id, title, posted_on, body')
    .order('posted_on', { ascending: false })
  if (error) throw error
  return (data ?? []) as Post[]
}

export default function NewsClient() {
  const { data: posts, error: loadErrorObj, isLoading: loading } = useSWR('news:posts', fetchPosts)
  const loadError = loadErrorObj?.message ?? null

  const [open, setOpen] = useState<string | null>(null)
  const [seeded, setSeeded] = useState(false)

  // First post opens by default, then the person is free to collapse or
  // switch — set during render so it's seeded before anything paints.
  if (!loading && !seeded) {
    setSeeded(true)
    setOpen((posts ?? [])[0]?.id ?? null)
  }

  return (
    <>
      <PageHead title="News" lead="Announcements from your organisation." />
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
      ) : (posts ?? []).length === 0 ? (
        <div className="card card--quiet">
          <p className="t-subtle">Nothing posted yet.</p>
        </div>
      ) : (
        <div className="stack">
          {(posts ?? []).map((p) => {
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
                    <h2 className="card__title">{p.title}</h2>
                    <div className="card__sub">{fmtDate(p.posted_on, { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                  </div>
                  <span aria-hidden="true">{expanded ? '−' : '+'}</span>
                </button>
                {expanded && <p className="t-subtle mt-3">{p.body}</p>}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
