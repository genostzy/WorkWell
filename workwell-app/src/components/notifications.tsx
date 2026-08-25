'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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
      .select('*')
      .eq('read', false)
      .order('created_at', { ascending: false })
      .then(({ data }) => setNotifications(data ?? []))
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
          <div className="card__title" style={{ padding: 'var(--s-3) var(--s-4)' }}>
            Notifications
          </div>
          {notifications.length === 0 ? (
            <p className="t-subtle" style={{ padding: 'var(--s-3) var(--s-4)' }}>
              All caught up.
            </p>
          ) : (
            <div className="stack stack--tight">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className="btn btn--secondary btn--sm"
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    borderRadius: 0,
                    borderTop: 'none',
                    borderLeft: 'none',
                    borderRight: 'none',
                    borderBottom: '1px solid var(--border)',
                    padding: 'var(--s-3) var(--s-4)',
                  }}
                  onClick={() => follow(n)}
                >
                  <div style={{ fontWeight: 600 }}>{n.title}</div>
                  <div className="t-subtle" style={{ fontSize: 'var(--fs-sm)' }}>
                    {n.body}
                  </div>
                  <div className="t-subtle" style={{ fontSize: 'var(--fs-xs)', marginTop: 4 }}>
                    {timeAgo(n.created_at)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
