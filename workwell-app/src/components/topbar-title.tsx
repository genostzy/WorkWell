'use client'

import { usePathname } from 'next/navigation'
import { ROUTE_META } from '@/lib/route-meta'

export function TopbarTitle({ fallbackTitle, fallbackCurrent }: { fallbackTitle?: string; fallbackCurrent?: string }) {
  const pathname = usePathname()
  // Strip trailing slash, keep as is for lookup
  const meta = pathname ? ROUTE_META[pathname] : undefined
  const title = meta?.title ?? fallbackTitle ?? (fallbackCurrent ? fallbackCurrent : 'WorkWell')
  return <span className="topbar__title">{title}</span>
}
