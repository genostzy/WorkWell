'use client'

/** The prototype's switch and segmented control, wired.
 *  These replace the inert versions from the design previews. */

export function Switch({
  on,
  label,
  onChange,
}: {
  on: boolean
  label: string
  onChange: (next: boolean) => void
}) {
  return (
    <button
      className="switch"
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
    />
  )
}

export function ToggleRow({
  title,
  desc,
  on,
  onChange,
}: {
  title: string
  desc?: string
  on: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <label className="toggle" style={{ padding: 'var(--s-2) 0' }}>
      <span className="toggle__text">
        <span className="toggle__title">{title}</span>
        {desc && <span className="toggle__desc">{desc}</span>}
      </span>
      <Switch on={on} label={title} onChange={onChange} />
    </label>
  )
}

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: T; label: string }[]
  value: T
  onChange: (next: T) => void
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Saved-state line. Deliberately understated: these screens save on every
 *  interaction, so a loud confirmation per toggle would be noise. */
export function SaveState({
  saving,
  error,
}: {
  saving: boolean
  error: string | null
}) {
  if (error) {
    return (
      <div className="banner banner--error mt-4" role="alert">
        <span aria-hidden="true">⚠️</span>
        <span>
          <b>Not saved.</b> {error}
        </span>
      </div>
    )
  }
  return (
    <p className="t-subtle mt-4" role="status">
      {saving ? 'Saving…' : 'Saved automatically. Only you can see any of this.'}
    </p>
  )
}
