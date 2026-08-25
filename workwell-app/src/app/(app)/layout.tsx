import { Suspense } from 'react'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { readIsHr } from '@/lib/role'
import { Shell } from '@/components/shell'
import { ContentSkeleton } from '@/components/content-skeleton'
import { ROUTE_META } from '@/lib/route-meta'
import type { Plane } from '@/components/chrome'

async function ShellData({
  children,
  isHr,
  title,
  plane,
}: {
  children: React.ReactNode
  isHr: boolean
  title?: string
  plane?: Plane
}) {
  const supabase = await createClient()
  const { data: me } = await supabase
    .from('me')
    .select('id, full_name, status')
    .maybeSingle()

  // A closed or unlinked account gets no shell chrome at all.
  if (!me || me.status === 'left') {
    return <>{children}</>
  }

  return (
    <Shell isHr={isHr} title={title} plane={plane}>
      {children}
    </Shell>
  )
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { isHr } = await readIsHr(supabase)

  // Set by proxy.ts on every request — see route-meta.ts for why this is
  // the only way a layout (a Server Component, rendered once for every
  // route under this group) can know which specific page it's wrapping.
  const pathname = (await headers()).get('x-pathname') ?? ''
  const meta = ROUTE_META[pathname]

  return (
    <Suspense fallback={
      <div className="app app--room" data-plane={meta?.plane ?? 'private'}>
        <aside className="room-sidebar" aria-hidden="true">
          <div className="sidebar-inner">
            <div className="sidebar-brand">
              <div className="skel" style={{ width: 30, height: 30, borderRadius: 'var(--r-xs)' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div className="skel skel--title" style={{ width: 80 }} />
                <div className="skel skel--text" style={{ width: 60 }} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 'var(--s-2)', gap: 6 }}>
              <div className="skel" style={{ width: 48, height: 48, borderRadius: '50%' }} />
              <div className="skel skel--text" style={{ width: 72 }} />
            </div>
            <div className="skel" style={{ height: 1, margin: 'var(--s-2)' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, padding: '0 var(--s-3)' }}>
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="skel" style={{ height: 52, borderRadius: 'var(--r-sm)' }} />
              ))}
            </div>
          </div>
        </aside>
        <div className="main">
          <header className="topbar">
            <span className="topbar__home topbar__home--static" />
            <span className="topbar__spacer" />
          </header>
          <main className="content"><ContentSkeleton cards={2} /></main>
        </div>
      </div>
    }>
      <ShellData isHr={isHr} title={meta?.title} plane={meta?.plane}>
        {children}
      </ShellData>
    </Suspense>
  )
}
