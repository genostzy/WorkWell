'use client'

import { useCallback, useEffect, useRef } from 'react'

/**
 * Mobile-only floating button that opens the sidebar as a slide-over panel.
 * On desktop the sidebar is always visible, so this never renders.
 */
export function SidebarToggle({ isHr }: { isHr: boolean }) {
  const ref = useRef<HTMLButtonElement>(null)

  const close = useCallback(() => {
    const app = document.querySelector('.app')
    if (!app) return
    app.classList.remove('sidebar-open')
    ref.current?.setAttribute('aria-expanded', 'false')
  }, [])

  const toggle = useCallback(() => {
    const app = ref.current?.closest('.app')
    if (!app) return
    const open = app.classList.toggle('sidebar-open')
    ref.current?.setAttribute('aria-expanded', String(open))
  }, [])

  // Close on escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [close])

  return (
    <>
      {/* Backdrop — clicking it closes the sidebar */}
      <button
        type="button"
        className="sidebar-backdrop"
        aria-hidden="true"
        tabIndex={-1}
        onClick={close}
      />
      <button
        ref={ref}
        type="button"
        className="hub"
        aria-label={isHr ? 'Open admin menu' : 'Open your space'}
        aria-expanded={false}
        onClick={toggle}
      >
        <span className="hub__glyph" aria-hidden="true">
          {isHr ? '📋' : '🏠'}
        </span>
        {isHr ? 'Dashboard' : 'Your space'}
      </button>
    </>
  )
}
