'use client'

import { useEffect } from 'react'
import { usePrefs } from '@/lib/use-prefs'

const DEFAULTS = {
  theme: 'system' as 'system' | 'light' | 'dark',
  contrast: 'normal' as 'normal' | 'high',
  motion: 'system' as 'system' | 'full' | 'reduced',
  density: 'comfortable' as 'compact' | 'comfortable' | 'spacious',
}

/** Mounted once in Shell, so display/accessibility choices made on
 *  /workspace apply everywhere, not only on that page — and on the first
 *  paint of every visit, not only after the user opens Workspace again to
 *  re-trigger them. */
export function ApplyWorkspacePrefs() {
  const { value, loading } = usePrefs('workspace_prefs', DEFAULTS)

  useEffect(() => {
    if (loading) return
    const root = document.documentElement

    if (value.theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', value.theme)

    root.setAttribute('data-contrast', value.contrast)

    if (value.motion === 'system') root.removeAttribute('data-motion')
    else root.setAttribute('data-motion', value.motion)

    root.setAttribute('data-density', value.density)
  }, [loading, value.theme, value.contrast, value.motion, value.density])

  return null
}
