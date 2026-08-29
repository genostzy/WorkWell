'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { watchTable } from '@/lib/supabase/realtime'

type Notification = {
  id: string
  kind: string
  title: string
  body: string
  link: string | null
  read: boolean
  created_at: string
}

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export function Notifications() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('notifications')
      .select('id, kind, title, body, link, read, created_at')
      .eq('read', false)
      .order('created_at', { ascending: false })
      .then(({ data }) => setNotifications(data ?? []))

    // No `filter` here — RLS already restricts work.notifications to the
    // caller's own rows, and Realtime evaluates that same policy per
    // subscriber, so there is nothing else to scope this to.
    return watchTable<Notification>(
      supabase,
      { schema: 'work', table: 'notifications' },
      {
        onInsert: (n) => {
          if (n.read) return
          setNotifications((prev) =>
            prev.some((x) => x.id === n.id)
              ? prev
              : [n, ...prev].sort(
                  (a, b) => +new Date(b.created_at) - +new Date(a.created_at)
                )
          )
        },
        // The only update a notification ever gets is being marked read
        // (see 0046's guard trigger), so an update either drops it from
        // this unread-only list or is a no-op echo of a change this tab
        // already made itself.
        onUpdate: (n) => {
          setNotifications((prev) =>
            n.read ? prev.filter((x) => x.id !== n.id) : prev
          )
        },
      }
    )
  }, [])

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  async function markRead(id: string) {
    const supabase = createClient()
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  // Reading it and going where it points are the same click — a
  // notification you can only dismiss, never follow, is half a feature.
  function follow(n: Notification) {
    setOpen(false)
    markRead(n.id)
    if (n.link) router.push(n.link)
  }

  const count = notifications.length

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        className="btn btn--secondary btn--sm"
        onClick={() => setOpen(!open)}
        aria-label={`Notifications${count > 0 ? ` (${count} unread)` : ''}`}
        style={{ position: 'relative' }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {count > 0 && (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              background: 'var(--accent)',
              color: 'var(--text-on-accent)',
              borderRadius: '50%',
              width: 18,
              height: 18,
              fontSize: 11,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
            }}
          >
            {count}
          </span>
        )}
      </button>

      {open && (
        <div
          className="card"
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 8,
            width: 320,
            maxHeight: 400,
            overflowY: 'auto',
            zIndex: 100,
          }}
        >
          <h2 className="card__title" style={{ padding: 'var(--s-3) var(--s-4)' }}>
            Notifications
          </h2>
          {notifications.length === 0 ? (
            <p className="t-subtle" style={{ padding: 'var(--s-3) var(--s-4)' }}>
              All caught up.
            </p>
          ) : (
            <div className="stack stack--tight">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  style={{
                    borderBottom: '1px solid var(--border)',
                    padding: 'var(--s-3) var(--s-4)',
                  }}
                >
                  {/* The title/body is its own control (not a parent button
                      around everything) because "Mark as read" below has to
                      sit beside it, not nested inside it — a button inside a
                      button isn't valid HTML. */}
                  <button
                    type="button"
                    onClick={() => follow(n)}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      font: 'inherit',
                      color: 'inherit',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{n.title}</div>
                    <div className="t-subtle" style={{ fontSize: 'var(--fs-sm)' }}>
                      {n.body}
                    </div>
                  </button>
                  <div className="row row--between" style={{ marginTop: 4 }}>
                    <span className="t-subtle" style={{ fontSize: 'var(--fs-xs)' }}>
                      {timeAgo(n.created_at)}
                    </span>
                    <button
                      type="button"
                      className="linkish"
                      style={{ padding: 0 }}
                      onClick={() => markRead(n.id)}
                    >
                      Mark as read
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
