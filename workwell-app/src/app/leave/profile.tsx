'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SaveState, Segmented } from '@/components/controls'
import { usePrefs } from '@/lib/use-prefs'

const COLOURS = [
  { value: 'accent', label: 'Green' },
  { value: 'clay', label: 'Clay' },
  { value: 'indigo', label: 'Indigo' },
  { value: 'plum', label: 'Plum' },
  { value: 'moss', label: 'Moss' },
] as const

const DEFAULTS = {
  preferred_name: null as string | null,
  avatar_initials: null as string | null,
  avatar_colour: 'accent' as string,
  greeting: 'warm' as string,
}

/** "Wilson Dayrit" → "WD". Mirrors the office's own derivation so the
 *  preview and the room agree before anything is overridden. */
function derive(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : ''))
    .toUpperCase()
}

/**
 * The half of the locker that is yours.
 *
 * Beside it sits the employment record, which HR holds and you cannot
 * change. This is everything about how the product presents itself to you,
 * and it is on the private plane — nobody is shown your preferred name or
 * told you turned greetings off.
 *
 * Text fields save on blur rather than on every keystroke: a write per
 * character would be a write per character.
 */
export function OwnProfile({ legalName }: { legalName: string }) {
  const router = useRouter()
  const { value, update, loading, saving, error } = usePrefs('profile', DEFAULTS)
  const [nameDraft, setNameDraft] = useState<string | null>(null)
  const [initialsDraft, setInitialsDraft] = useState<string | null>(null)

  if (loading) {
    return (
      <div className="card">
        <div className="skel skel--title" />
        <div className="skel skel--text" />
      </div>
    )
  }

  const preferred = nameDraft ?? value.preferred_name ?? ''
  const initials =
    (initialsDraft ?? value.avatar_initials ?? '') ||
    derive(preferred || legalName)

  // The room reads this on its next render, so push the change through.
  const commit = (patch: Partial<typeof DEFAULTS>) => {
    update(patch)
    router.refresh()
  }

  return (
    <div className="card">
      <div className="card__head">
        <div>
          <h2 className="card__title">How your space knows you</h2>
          <div className="card__sub">
            Yours alone — none of this reaches your employment record
          </div>
        </div>
        <span
          className="avatar"
          data-avatar-colour={value.avatar_colour}
          aria-hidden="true"
        >
          {initials}
        </span>
      </div>

      <div className="field mt-4">
        <label className="field__label" htmlFor="preferred">
          What should we call you?
        </label>
        <input
          id="preferred"
          className="input"
          value={preferred}
          maxLength={40}
          placeholder={legalName}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={() => {
            const next = (nameDraft ?? '').trim()
            setNameDraft(null)
            if (next !== (value.preferred_name ?? '')) {
              commit({ preferred_name: next || null })
            }
          }}
        />
        <span className="field__hint">
          Your employment record still says {legalName}. HR holds that one and
          it has to match your contract.
        </span>
      </div>

      <div className="field mt-4">
        <label className="field__label" htmlFor="initials">
          Initials on your avatar
        </label>
        <input
          id="initials"
          className="input"
          style={{ maxWidth: 120 }}
          value={initialsDraft ?? value.avatar_initials ?? ''}
          maxLength={3}
          placeholder={derive(preferred || legalName)}
          onChange={(e) => setInitialsDraft(e.target.value)}
          onBlur={() => {
            const next = (initialsDraft ?? '').trim().toUpperCase()
            setInitialsDraft(null)
            if (next !== (value.avatar_initials ?? '')) {
              commit({ avatar_initials: next || null })
            }
          }}
        />
        <span className="field__hint">
          Left empty we take them from your name, which is not always right —
          not every name is two words, or in this order.
        </span>
      </div>

      <div className="field mt-4">
        <span className="field__label">Your colour in the room</span>
        <div className="swatches" role="radiogroup" aria-label="Avatar colour">
          {COLOURS.map((c) => (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={value.avatar_colour === c.value}
              aria-label={c.label}
              title={c.label}
              className="swatch"
              data-avatar-colour={c.value}
              onClick={() => commit({ avatar_colour: c.value })}
            />
          ))}
        </div>
      </div>

      <div className="field mt-4">
        <span className="field__label">How your space greets you</span>
        <Segmented
          label="Greeting"
          value={value.greeting as 'warm' | 'plain'}
          onChange={(g) => commit({ greeting: g })}
          options={[
            { value: 'warm', label: 'By name' },
            { value: 'plain', label: 'Just the time' },
          ]}
        />
        <span className="field__hint">
          A product about workload can be grating when it is chatty. This
          turns it down without turning anything off.
        </span>
      </div>

      <SaveState saving={saving} error={error} />
    </div>
  )
}
