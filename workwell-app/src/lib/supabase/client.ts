import { createBrowserClient } from '@supabase/ssr'

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`${name} is not set — add it to .env.local from Supabase → Project Settings → API.`)
  return v
}

export function createClient() {
  return createBrowserClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
  )
}
