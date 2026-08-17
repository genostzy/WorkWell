/**
 * A date-only ISO string ("2026-08-17"), formatted the way every screen in
 * this app wants it. The `+ 'T00:00:00'` is load-bearing, not decoration:
 * parsing a bare date string as UTC and then formatting it in a local
 * timezone west of UTC shifts the displayed date back a day. Forcing local
 * midnight avoids that. Kept in one place so a fix to it only needs to
 * happen once.
 */
export function fmtDate(
  iso: string,
  opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }
) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', opts)
}
