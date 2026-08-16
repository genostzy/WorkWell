'use client'

import { useEffect, useRef } from 'react'
import { reducedMotion } from '@/components/office'

/**
 * A frost layer behind every screen that the cursor wipes clear, like a
 * hand clearing condensation off a window — the plain ground underneath
 * shows through in a soft circle whichever way the pointer moves, and
 * fogs back over everywhere else. Purely decorative: it never intercepts
 * a click (pointer-events stay off throughout) and it never mounts the
 * moving part for anyone who has asked for reduced motion, at the OS level
 * or through the app's own Adaptive Workspace toggle — and, since either of
 * those can change mid-session without a reload, it keeps listening rather
 * than deciding once at mount.
 */
export function CursorGlass() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    let raf = 0
    let x = window.innerWidth / 2
    let y = window.innerHeight * 0.4
    let cleanupMove: (() => void) | null = null

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

    const sync = () => {
      if (reducedMotion()) {
        cleanupMove?.()
        cleanupMove = null
        return
      }
      if (cleanupMove) return
      window.addEventListener('pointermove', onMove, { passive: true })
      cleanupMove = () => window.removeEventListener('pointermove', onMove)
    }

    sync()

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    mq.addEventListener('change', sync)
    const observer = new MutationObserver(sync)
    observer.observe(document.documentElement, { attributeFilter: ['data-motion'] })

    return () => {
      cleanupMove?.()
      if (raf) cancelAnimationFrame(raf)
      mq.removeEventListener('change', sync)
      observer.disconnect()
    }
  }, [])

  return <div ref={ref} className="cursor-glass" aria-hidden="true" />
}
