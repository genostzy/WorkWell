/**
 * Signed links to expense receipts.
 *
 * The bucket is private (see 0053), so a receipt is only ever reachable
 * through a short-lived signed URL. Both screens that show receipts — the
 * claimant's own list and HR's review queue — need the same thing for a
 * whole list at once, which is why this signs in one batch rather than
 * exposing a per-row component that would fire a request per row.
 */

export const RECEIPTS_BUCKET = 'receipts'

/** Mirrors the bucket's own allowed_mime_types and file_size_limit. Checked
 *  here as well so a wrong file is refused with a sentence instead of a
 *  storage error code. */
export const RECEIPT_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
] as const

export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024

/** An hour, matching the avatars precedent. Long enough to read a page,
 *  short enough that a copied URL is not a lasting hole in the bucket. */
const SIGNED_FOR_SECONDS = 3600

/** Structural, so the same function serves the browser client and the
 *  server one without this module importing either. Mirrors what
 *  supabase-js actually returns, including the per-row error it reports
 *  when one path in a batch could not be signed. */
type StorageLike = {
  storage: {
    from: (bucket: string) => {
      createSignedUrls: (
        paths: string[],
        expiresIn: number
      ) => Promise<{
        data:
          | { path: string | null; signedUrl: string | null }[]
          | null
      }>
    }
  }
}

/**
 * path → signed URL, for every path that could be signed.
 *
 * A path that fails to sign is simply absent from the map rather than
 * throwing: one unreadable receipt should cost that row its link, not cost
 * the whole page its render.
 */
export async function signReceipts(
  supabase: StorageLike,
  paths: (string | null | undefined)[]
): Promise<Map<string, string>> {
  const wanted = [...new Set(paths.filter((p): p is string => Boolean(p)))]
  if (wanted.length === 0) return new Map()

  const { data } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .createSignedUrls(wanted, SIGNED_FOR_SECONDS)

  const signed = new Map<string, string>()
  for (const row of data ?? []) {
    if (row.path && row.signedUrl) signed.set(row.path, row.signedUrl)
  }
  return signed
}
