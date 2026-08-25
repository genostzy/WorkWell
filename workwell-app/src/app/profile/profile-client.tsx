'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ConfirmButton, SaveState, Segmented } from '@/components/controls'
import { usePrefs } from '@/lib/use-prefs'
import { createClient } from '@/lib/supabase/client'

const COLOURS = [
  { value: 'accent', label: 'Green' },
  { value: 'clay', label: 'Clay' },
  { value: 'indigo', label: 'Indigo' },
  { value: 'plum', label: 'Plum' },
  { value: 'moss', label: 'Moss' },
] as const

const PHOTO_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const PHOTO_MAX_BYTES = 2 * 1024 * 1024

const DEFAULTS = {
  preferred_name: null as string | null,
  avatar_initials: null as string | null,
  avatar_colour: 'accent' as string,
  avatar_path: null as string | null,
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
 * How WorkWell presents itself to you.
 *
 * The locker's employment record is the other half of a profile — HR's,
 * and not changeable here. This is the half that is yours, and it lives on
 * the private plane for the same reason everything else there does: it is
 * nobody's business but yours. That is why the photo lives in a private
 * storage bucket rather than a public one — a public URL would have been a
 * second, unenforced copy of the same privacy promise the table's RLS
 * already keeps.
 *
 * Text fields save on blur rather than on every keystroke: a write per
 * character would be a write per character.
 */
export function ProfileSettings({ legalName }: { legalName: string }) {
  const router = useRouter()
  const { value, update, loading, saving, error } = usePrefs('profile', DEFAULTS)
  const [nameDraft, setNameDraft] = useState<string | null>(null)
  const [initialsDraft, setInitialsDraft] = useState<string | null>(null)

  const [uid, setUid] = useState<string | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null))
  }, [])

  // Signed rather than public — see the bucket's own RLS. The URL expires,
  // so it is re-requested whenever the stored path changes rather than
  // cached across visits.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (loading || !value.avatar_path) {
        if (!cancelled) setPhotoUrl(null)
        return
      }
      const supabase = createClient()
      const { data } = await supabase.storage
        .from('avatars')
        .createSignedUrl(value.avatar_path, 3600)
      if (!cancelled) setPhotoUrl(data?.signedUrl ?? null)
    })()
    return () => {
      cancelled = true
    }
  }, [loading, value.avatar_path])

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

  async function handleFile(file: File) {
    setPhotoError(null)
    if (!PHOTO_TYPES.includes(file.type)) {
      setPhotoError('Use a PNG, JPEG, or WebP image.')
      return
    }
    if (file.size > PHOTO_MAX_BYTES) {
      setPhotoError('Keep it under 2MB.')
      return
    }
    if (!uid) {
      setPhotoError('Still finding your account — try again in a moment.')
      return
    }

    setUploading(true)
    const supabase = createClient()
    const path = `${uid}/avatar`
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (uploadError) {
      setUploading(false)
      setPhotoError(uploadError.message)
      return
    }

    const { data: signed } = await supabase.storage
      .from('avatars')
      .createSignedUrl(path, 3600)
    setPhotoUrl(signed?.signedUrl ?? null)
    setUploading(false)
    commit({ avatar_path: path })
  }

  async function removePhoto() {
    if (!uid) return
    setPhotoError(null)
    const supabase = createClient()
    await supabase.storage.from('avatars').remove([`${uid}/avatar`])
    setPhotoUrl(null)
    commit({ avatar_path: null })
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
          {photoUrl ? (
            <img src={photoUrl} alt="" className="avatar__photo" />
          ) : (
            initials
          )}
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
          not every name is two words, or in this order. Covered by a photo
          when you set one, below.
        </span>
      </div>

      <div className="field mt-4">
        <span className="field__label">Your photo</span>
        <div className="row" style={{ gap: 'var(--s-3)', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading
              ? 'Uploading…'
              : value.avatar_path
                ? 'Change photo'
                : 'Upload photo'}
          </button>
          {value.avatar_path && (
            <ConfirmButton
              label="Remove photo"
              className="btn btn--ghost btn--sm"
              onConfirm={removePhoto}
            />
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) handleFile(file)
            }}
          />
        </div>
        {photoError && (
          <div className="banner banner--error mt-2" role="alert">
            {photoError}
          </div>
        )}
        <span className="field__hint">
          PNG, JPEG or WebP, up to 2MB. It replaces the room figure&rsquo;s
          colour dot and your avatar&rsquo;s initials everywhere they show —
          nowhere your employer can see.
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
        <span className="field__hint">
          Still visible as a ring around your photo, if you have set one.
        </span>
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
