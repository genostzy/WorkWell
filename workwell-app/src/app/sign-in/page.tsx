'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function SignIn() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function send(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    })
    if (error) setError(error.message)
    else setSent(true)
  }

  if (sent) return <p role="status">Check your email for a sign-in link.</p>

  return (
    <form onSubmit={send}>
      <label htmlFor="email">Work email</label>
      <input
        id="email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button type="submit">Send me a link</button>
      {error && <p role="alert">{error}</p>}
    </form>
  )
}
