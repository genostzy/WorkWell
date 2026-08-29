import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) {
    // Don't throw in the browser — that crashes the whole page with a white
    // screen (see 2hml4iembow74.js:24). Log once and return a client that will
    // fail on queries with a readable error instead.
    if (typeof window !== 'undefined') {
      console.error('Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY — set them in .env.local (local) or Vercel → Settings → Environment Variables (deployed).')
    }
    return createBrowserClient(
      url || 'https://missing-supabase-url.supabase.co',
      key || 'missing-key'
    )
  }
  return createBrowserClient(url, key)
}
