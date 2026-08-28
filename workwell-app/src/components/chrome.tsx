import { InfoTip } from '@/components/info-tip'

export type Page = 'home' | 'check-in' | 'trends' | 'leave' | 'hr' | 'org'

/** Which plane a screen belongs to. Drives the accent — teal-green for the
 *  employee's own data, terracotta for anything the employer sees. The
 *  prototype validated that pair for colour-vision separation, which is
 *  also why plane identity is never carried by colour alone: there is
 *  always a chip, an icon and a sentence too. */
export type Plane = 'private' | 'work' | 'org'

/** Kept here, not inside Shell, deliberately: this file has no server-only
 *  imports, which is what lets the fully client-rendered screens (check-in,
 *  nudges, recognition, boundaries, workspace) import PageHead and friends
 *  directly. Shell itself — which does read the database, for the room
 *  sidebar — lives in shell.tsx instead, and only ever gets imported by a
 *  page.tsx, never by a 'use client' file. */
export const BADGE: Record<Plane, { icon: string; label: string; sub: string }> = {
  private: {
    icon: '🔒',
    label: 'Private plane',
    sub: 'Only you can see anything here. Your employer never can.',
  },
  work: {
    icon: '🏢',
    label: 'Work plane',
    sub: 'Employment data. Only HR sees this.',
  },
  org: {
    icon: '👥',
    label: 'Organisation plane',
    sub: 'Anonymous group patterns. Never a person.',
  },
}

/** The plane identity, kept to the two things that matter at a glance — the
 *  icon and the name. What used to run on as a full sentence under it every
 *  single time is now a tap or hover away instead: the "?" carries exactly
 *  the words InfoTip is passed, nothing trimmed from them, just not forced
 *  onto the page whether anyone reads it or not. */
export function PlaneBadge({ plane }: { plane: Plane }) {
  const b = BADGE[plane]
  return (
    <div className="plane-badge">
      <span aria-hidden="true">{b.icon}</span>
      <div className="plane-badge__label">
        {b.label}
        <InfoTip text={b.sub} />
      </div>
    </div>
  )
}

/** The privacy claim, stated once and briefly. The prototype learned that
 *  repeating it at paragraph length on every screen makes people stop
 *  reading it, so the detail sits behind a disclosure. */
export function PrivacyNote({
  children,
  detail,
  plane = 'private',
}: {
  children: React.ReactNode
  detail?: string
  plane?: Plane
}) {
  return (
    <div className="privacy-note mb-5">
      <span aria-hidden="true">{BADGE[plane].icon}</span>
      <span>
        {children}
        {detail && (
          // <details>/<summary> rather than InfoTip: this text runs to a
          // paragraph, and a hover bubble that size would either clip it or
          // swallow half the screen. A tap that expands in place is the
          // right control for a paragraph; InfoTip is for a sentence.
          <details style={{ display: 'inline' }}>
            <summary className="info-dot privacy-more" aria-label="What this means">
              ?
            </summary>
            <span className="privacy-detail">{detail}</span>
          </details>
        )}
      </span>
    </div>
  )
}

/**
 * A read that failed, said as a read that failed.
 *
 * A query that errored and a query that found nothing are different things,
 * and rendering the first as the second is how "your record could not be
 * loaded" became "you have no record" on the home page. Every screen that
 * reads something now distinguishes them, because the difference decides
 * what the person should do: wait and retry, or go and create something.
 */
export function LoadError({
  what,
  detail,
}: {
  what: string
  detail?: string | null
}) {
  return (
    <div className="card">
      <div className="state state--error">
        <div className="state__icon" aria-hidden="true">
          ⚠️
        </div>
        <h2 className="state__title">{what} could not be loaded</h2>
        <p className="state__text">
          Nothing has been lost. This is a read failing, not data missing.
        </p>
        {detail && (
          <p className="t-subtle mt-3">
            <code>{detail}</code>
          </p>
        )}
      </div>
    </div>
  )
}

/** Nothing here yet, said without sounding like a fault. */
export function Empty({
  icon = '🌱',
  title,
  children,
  action,
}: {
  icon?: string
  title: string
  children?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="card">
      <div className="state state--info">
        <div className="state__icon" aria-hidden="true">
          {icon}
        </div>
        <h2 className="state__title">{title}</h2>
        {children && <p className="state__text">{children}</p>}
        {action && <div className="state__actions">{action}</div>}
      </div>
    </div>
  )
}

/** The plane boundary, said as a locked door rather than a blank page.
 *  One account is ever HR; everyone else is strictly private-plane, so
 *  each side of that line gets exactly one message, used everywhere the
 *  line is crossed rather than copy-pasted per screen. */
export function RoleLocked({
  audience,
  detail,
}: {
  audience: 'hr' | 'employee'
  /** Overrides the default explanation, for a screen where the generic
   *  line is not specific enough to be reassuring on its own. */
  detail?: string
}) {
  const copy =
    audience === 'hr'
      ? {
          title: 'This area is for HR',
          text: detail ?? 'Your own data lives on the private plane, which nobody here can read.',
        }
      : {
          title: 'This area is for employees',
          text: detail ?? "HR/admin accounts hold no private plane of their own. There is nothing on this screen for this account.",
        }

  return (
    <div className="card">
      <div className="state">
        <div className="state__icon" aria-hidden="true">
          🔒
        </div>
        <h2 className="state__title">{copy.title}</h2>
        <p className="state__text">{copy.text}</p>
      </div>
    </div>
  )
}

export function PageHead({ title, lead }: { title: string; lead?: string }) {
  return (
    <div className="page-head">
      <h1>{title}</h1>
      {lead && <p className="t-lead">{lead}</p>}
    </div>
  )
}
