import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`${name} is not set — add it to .env.local from Supabase → Project Settings → API.`)
  return v
}

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // Middleware refreshes the session, so this is safe to ignore.
          }
        },
      },
    }
  )
}
