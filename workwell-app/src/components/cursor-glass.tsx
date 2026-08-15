'use client'

import { useEffect, useRef } from 'react'

/**
 * A frost layer behind every screen that the cursor wipes clear, like a
 * hand clearing condensation off a window — the plain ground underneath
 * shows through in a soft circle whichever way the pointer moves, and
 * fogs back over everywhere else. Purely decorative: it never intercepts
 * a click (pointer-events stay off throughout) and it never mounts the
 * moving part for anyone who has asked for reduced motion, at the OS level
 * or through the app's own Adaptive Workspace toggle.
 */
export function CursorGlass() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const reduced = () =>
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      document.documentElement.dataset.motion === 'reduced'

    if (reduced()) return

    let raf = 0
    let x = window.innerWidth / 2
    let y = window.innerHeight * 0.4

    const apply = () => {
      el.style.setProperty('--cx', `${x}px`)
      el.style.setProperty('--cy', `${y}px`)
      raf = 0
    }

    const onMove = (e: PointerEvent) => {
      x = e.clientX
      y = e.clientY
      if (!raf) raf = requestAnimationFrame(apply)
    }

    window.addEventListener('pointermove', onMove, { passive: true })

    return () => {
      window.removeEventListener('pointermove', onMove)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return <div ref={ref} className="cursor-glass" aria-hidden="true" />
}
