'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHead, PlaneBadge } from '@/components/chrome'
import { fmtDate } from '@/lib/format-date'

type Post = { id: string; title: string; posted_on: string; body: string }

export default function NewsClient() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('news_posts')
        .select('id, title, posted_on, body')
        .order('posted_on', { ascending: false })
      if (cancelled) return
      if (error) setLoadError(error.message)
      const rows = (data ?? []) as Post[]
      setPosts(rows)
      setOpen(rows[0]?.id ?? null)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

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
      ) : posts.length === 0 ? (
        <div className="card card--quiet">
          <p className="t-subtle">Nothing posted yet.</p>
        </div>
      ) : (
        <div className="stack">
          {posts.map((p) => {
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
