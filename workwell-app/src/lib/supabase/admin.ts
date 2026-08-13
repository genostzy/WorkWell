import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * The service-role client. Server only, and only ever inside a route
 * handler that has already established the caller is HR.
 *
 * This key bypasses every RLS policy in the database — the whole two-plane
 * guarantee included. It exists here for exactly one thing the anon key
 * cannot do: create and update rows in auth.users. Nothing else should
 * reach for it, and it must never be imported into a client component,
 * which is why the variable has no NEXT_PUBLIC_ prefix — Next refuses to
 * inline it into the browser bundle.
 *
 * Sessions are off deliberately: this client acts as the service, not as a
 * person, and persisting a session would be a way for one request's
 * identity to leak into the next.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. Creating accounts needs it — ' +
        'add it to .env.local from Supabase → Project Settings → API.'
    )
  }

  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/**
 * A password someone has to read off one screen and type into another.
 *
 * The alphabet leaves out the characters that get misread doing exactly
 * that — O/0, I/l/1 — so a wrong first login means a wrong password rather
 * than a wrong transcription. Grouped with a dash for the same reason.
 *
 * crypto.getRandomValues, not Math.random: this is a credential, however
 * short-lived, and Math.random is predictable from previous outputs.
 *
 * The modulo is unbiased because 32 divides 256 exactly.
 */
export function generatePassword() {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789abc'.slice(0, 32)
  const bytes = new Uint8Array(10)
  crypto.getRandomValues(bytes)
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length])
  return `${chars.slice(0, 5).join('')}-${chars.slice(5).join('')}`
}
