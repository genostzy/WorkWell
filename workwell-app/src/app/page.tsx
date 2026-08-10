import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function Home() {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()

  if (!claims) return <Link href="/sign-in">Sign in</Link>

  // Reads go through the public views, which carry security_invoker so the
  // identity policies still apply. An account with no people row sees
  // nothing, which is the intended failure mode.
  const { data: people } = await supabase
    .from('people')
    .select('id, full_name, status')

  const { data: roles } = await supabase
    .from('person_roles')
    .select('role')

  return (
    <main>
      <h1>Signed in</h1>
      <p>Your roles: {roles?.map((r) => r.role).join(', ') || 'none'}</p>
      <h2>People visible to you</h2>
      <ul>
        {people?.map((p) => (
          <li key={p.id}>
            {p.full_name} — {p.status}
          </li>
        ))}
      </ul>
    </main>
  )
}
