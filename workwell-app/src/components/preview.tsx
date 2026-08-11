/** Marks a screen whose controls are drawn but not wired.
 *
 *  This exists so a preview never reads as a bug. Half of the confusion on
 *  this project has come from something looking broken when it was merely
 *  unfinished, so unfinished says so out loud. */
export function PreviewNotice({ what }: { what: string }) {
  return (
    <div className="banner banner--info mb-5" role="status">
      <span aria-hidden="true">✏️</span>
      <span>
        <b>Design preview.</b> The layout and copy are real; {what} does not
        save yet. Nothing on this screen changes anything.
      </span>
    </div>
  )
}

/** The prototype's switch, drawn in a fixed state. Deliberately not a
 *  disabled control — the point is to show how it will look in use. */
export function Switch({ on, label }: { on: boolean; label: string }) {
  return (
    <button
      className="switch"
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      tabIndex={-1}
    />
  )
}

export function ToggleRow({
  title,
  desc,
  on = false,
}: {
  title: string
  desc?: string
  on?: boolean
}) {
  return (
    <label className="toggle" style={{ padding: 'var(--s-2) 0' }}>
      <span className="toggle__text">
        <span className="toggle__title">{title}</span>
        {desc && <span className="toggle__desc">{desc}</span>}
      </span>
      <Switch on={on} label={title} />
    </label>
  )
}

export function Segmented({
  label,
  options,
  active,
}: {
  label: string
  options: string[]
  active: string
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o} type="button" aria-pressed={o === active} tabIndex={-1}>
          {o}
        </button>
      ))}
    </div>
  )
}
