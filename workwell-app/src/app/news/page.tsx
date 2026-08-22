import { createClient } from '@/lib/supabase/server'
import { Empty, LoadError, PageHead, PlaneBadge } from '@/components/chrome'
import { Shell } from '@/components/shell'
import { NewsForm } from './news-form'

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
}

export default async function News() {
  const supabase = await createClient()

  const [
    { data: posts, error: postsError },
    { data: roles },
  ] = await Promise.all([
    supabase
      .from('news')
      .select('*')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase.from('person_roles').select('role'),
  ])

  const isHr = (roles ?? []).some((r) => r.role === 'hr')

  if (postsError) {
    return (
      <Shell plane="work">
        <PageHead title="News" />
        <PlaneBadge plane="work" />
        <LoadError what="The news feed" detail={postsError.message} />
      </Shell>
    )
  }

  const rows = posts ?? []

  return (
    <Shell plane="work">
      <PageHead title="News" lead="Announcements from your organisation." />
      <PlaneBadge plane="work" />

      {isHr && <NewsForm />}

      {rows.length === 0 ? (
        <Empty icon="📰" title="No announcements yet">
          {isHr
            ? 'Post the first announcement using the form above.'
            : 'No announcements have been posted yet. Check back later.'}
        </Empty>
      ) : (
        <div className="stack">
          {rows.map((post) => (
            <div
              key={post.id}
              className={`card${post.pinned ? ' card--accent' : ''}`}
            >
              <div className="card__head">
                <div>
                  <div className="card__title">
                    {post.pinned && (
                      <span className="chip chip--accent" style={{ marginRight: 8 }}>
                        📌 Pinned
                      </span>
                    )}
                    {post.title}
                  </div>
                  <div className="card__sub">{fmtDate(post.created_at)}</div>
                </div>
              </div>
              {post.body && (
                <p style={{ marginTop: 'var(--s-3)', whiteSpace: 'pre-wrap' }}>
                  {post.body.length > 500
                    ? post.body.slice(0, 500) + '…'
                    : post.body}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </Shell>
  )
}
