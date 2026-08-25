'use client'

import { useEffect } from 'react'
import { PageHead, PlaneBadge, PrivacyNote } from '@/components/chrome'
import { SaveState, Segmented, ToggleRow } from '@/components/controls'
import { usePrefs } from '@/lib/use-prefs'

const DEFAULTS = {
  theme: 'system' as 'system' | 'light' | 'dark',
  contrast: 'normal' as 'normal' | 'high',
  motion: 'system' as 'system' | 'full' | 'reduced',
  density: 'comfortable' as 'compact' | 'comfortable' | 'spacious',
  focus_one_question: false,
  hide_counts: false,
  plain_language: false,
  checkin_format: 'scale' as 'scale' | 'emoji' | 'words',
}

/** Adaptive workspace — PRD F6.
 *
 *  These are stored against the account rather than the device, so they
 *  follow the person between machines. The theme and contrast choices are
 *  applied to the document immediately, because a setting that needs a
 *  reload to take effect is not an accessibility feature. */
export default function WorkspaceClient() {
  const { value, update, loading, saving, error } = usePrefs(
    'workspace_prefs',
    DEFAULTS
  )

  // Applies whichever of these was actually saved — on the first render
  // once the fetch resolves, and again on every change after. Without this
  // running on load too, a choice made last session only ever showed up in
  // the segmented control here; the document itself stayed on whatever the
  // OS/browser defaulted to, so "saved" looked like "did nothing" on the
  // next visit.
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

  return (
    <>
      <PageHead
        title="Adaptive workspace"
        lead="Saved to your account, so they follow you between devices."
      />

      <PlaneBadge plane="private" />

      {loading ? (
        <div className="card">
          <div className="skel skel--title" />
          <div className="skel skel--text" />
        </div>
      ) : (
        <>
          <div className="card">
            <div className="card__head">
              <div>
                <h2 className="card__title">Display &amp; accessibility</h2>
                <div className="card__sub">
                  Theme and contrast apply the moment you choose them
                </div>
              </div>
            </div>

            <div className="stack mt-4">
              <div className="field">
                <span className="field__label">Colour theme</span>
                <Segmented
                  label="Colour theme"
                  value={value.theme}
                  onChange={(theme) => update({ theme })}
                  options={[
                    { value: 'system', label: 'Match system' },
                    { value: 'light', label: 'Light' },
                    { value: 'dark', label: 'Dark' },
                  ]}
                />
              </div>

              <div className="field">
                <span className="field__label">Contrast</span>
                <Segmented
                  label="Contrast"
                  value={value.contrast}
                  onChange={(contrast) => update({ contrast })}
                  options={[
                    { value: 'normal', label: 'Normal' },
                    { value: 'high', label: 'High contrast' },
                  ]}
                />
              </div>

              <div className="field">
                <span className="field__label">Motion</span>
                <Segmented
                  label="Motion"
                  value={value.motion}
                  onChange={(motion) => update({ motion })}
                  options={[
                    { value: 'system', label: 'Match system' },
                    { value: 'full', label: 'Full motion' },
                    { value: 'reduced', label: 'Reduced motion' },
                  ]}
                />
                <span className="field__hint">
                  Reduced motion also stops the loading shimmer.
                </span>
              </div>

              <div className="field">
                <span className="field__label">Notification density</span>
                <Segmented
                  label="Notification density"
                  value={value.density}
                  onChange={(density) => update({ density })}
                  options={[
                    { value: 'compact', label: 'Compact' },
                    { value: 'comfortable', label: 'Comfortable' },
                    { value: 'spacious', label: 'Spacious' },
                  ]}
                />
              </div>
            </div>

            <SaveState saving={saving} error={error} />
          </div>

          <div className="grid grid--2">
            <div className="card">
              <h2 className="card__title mb-2">Focus mode</h2>
              <p className="card__sub mb-4">
                Strips the interface back to one thing at a time
              </p>
              <div className="stack stack--tight">
                <ToggleRow
                  title="One question per screen"
                  desc="The check-in becomes a single step at a time, and health nudges pause while it's on"
                  on={value.focus_one_question}
                  onChange={(focus_one_question) =>
                    update({ focus_one_question })
                  }
                />
                <ToggleRow
                  title="Hide counts and totals"
                  desc="Numbers only when you ask"
                  on={value.hide_counts}
                  onChange={(hide_counts) => update({ hide_counts })}
                />
                <ToggleRow
                  title="Plain language only"
                  desc="No charts, words instead"
                  on={value.plain_language}
                  onChange={(plain_language) => update({ plain_language })}
                />
              </div>
            </div>

            <div className="card">
              <h2 className="card__title mb-2">Check-in format</h2>
              <p className="card__sub mb-4">
                Alternative input formats for the daily check-in
              </p>
              <Segmented
                label="Check-in format"
                value={value.checkin_format}
                onChange={(checkin_format) => update({ checkin_format })}
                options={[
                  { value: 'scale', label: 'Scale' },
                  { value: 'emoji', label: 'Emoji' },
                  { value: 'words', label: 'Words' },
                ]}
              />
              <p className="field__hint mt-3">
                Every question stays skippable whichever you choose.
              </p>
            </div>
          </div>
        </>
      )}

      <PrivacyNote detail="These preferences are part of your private plane. They are not in your employment record, HR cannot query them, and nobody is told that you use high contrast or reduced motion.">
        <b>Nobody is told which of these you use.</b>{' '}
      </PrivacyNote>
    </>
  )
}
