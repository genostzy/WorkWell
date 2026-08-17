import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Which side of the plane boundary this account is on, read once and
 * shared by every page that has to ask — a failed read is not the same
 * as "not HR," so callers get told apart rather than silently treated as
 * a private-plane account. Works with either the server or browser
 * client, since sign-in-room.tsx has to ask this too, right after signing
 * in, before a page has even loaded.
 */
export async function readIsHr(
  supabase: SupabaseClient
): Promise<{ isHr: boolean; error: string | null }> {
  const { data: roles, error } = await supabase
    .from('person_roles')
    .select('role')
  if (error) return { isHr: false, error: error.message }
  return { isHr: (roles ?? []).some((r) => r.role === 'hr'), error: null }
}
