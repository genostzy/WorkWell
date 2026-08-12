'use client'

import { useCallback, useEffect, useState } from 'react'
import { PageHead, PlaneBadge, PrivacyNote, Shell } from '@/components/chrome'
import { createClient } from '@/lib/supabase/client'

type Person = { id: string; full_name: string }
type Appreciation = {
  id: string
  from_person: string
  to_person: string
  message: string
  created_at: string
}
type SupportRequest = {
  id: string
  body: string
  route: string
  status: string
  created_at: string
}

/** Recognition and connection — PRD F5.
 *
 *  Nothing is counted, by design. The PRD forbids leaderboards, and a tally
 *  of who gets thanked most is a ranking of people wearing a friendly hat.
 *
 *  The support request is the only place in the product where an employee
 *  deliberately opens a channel to HR. That consent is expressed per row
 *  and is revocable: withdrawing takes it back out of HR's view entirely. */
export default function Recognition() {
  const [me, setMe] = useState<string | null>(null)
  const [people, setPeople] = useState<Person[]>([])
  const [received, setReceived] = useState<Appreciation[]>([])
  const [requests, setRequests] = useState<SupportRequest[]>([])
  const [loading, setLoading] = useState(true)

  const [to, setTo] = useState('')
  const [message, setMessage] = useState('')
  const [visibility, setVisibility] = useState<'private' | 'team' | 'everyone'>(
    'private'
  )
  const [sent, setSent] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  const [body, setBody] = useState('')
  const [route, setRoute] = useState<'hr' | 'eap'>('hr')
  const [supportError, setSupportError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const supabase = createClient()

    const { data: mine } = await supabase.from('me').select('id').maybeSingle()
    setMe(mine?.id ?? null)

    const [{ data: ppl }, { data: apps }, { data: reqs }] = await Promise.all([
      supabase.from('people').select('id, full_name').order('full_name'),
      supabase
        .from('appreciations')
        .select('id, from_person, to_person, message, created_at')
        .order('created_at', { ascending: false }),
      supabase
        .from('support_requests')
        .select('id, body, route, status, created_at')
        .order('created_at', { ascending: false }),
    ])

    setPeople((ppl ?? []).filter((p) => p.id !== mine?.id))
    setReceived((apps ?? []).filter((a) => a.to_person === mine?.id))
    setRequests(reqs ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function sendAppreciation(e: React.FormEvent) {
    e.preventDefault()
    setSendError(null)
    if (!to || !message.trim()) {
      setSendError('Pick someone and write something.')
      return
    }

    const supabase = createClient()
    const { error } = await supabase.from('appreciations').insert({
      from_person: me,
      to_person: to,
      message: message.trim(),
      visibility,
    })

    if (error) setSendError(error.message)
    else {
      setSent(true)
      setMessage('')
      load()
    }
  }

  async function sendSupport(e: React.FormEvent) {
    e.preventDefault()
    setSupportError(null)
    if (!body.trim()) {
      setSupportError('Write what would help.')
      return
    }

    const supabase = createClient()
    const { error } = await supabase
      .from('support_requests')
      .insert({ person_id: me, body: body.trim(), route })

    if (error) setSupportError(error.message)
    else {
      setBody('')
      load()
    }
  }

  async function withdraw(id: string) {
    const supabase = createClient()
    const { error } = await supabase
      .from('support_requests')
      .update({ status: 'withdrawn' })
      .eq('id', id)
    if (!error) load()
  }

  const open = requests.filter((r) => r.status === 'open')

  return (
    <Shell plane="private">
      <PageHead
        title="Recognition & connection"
        lead="Optional, off by default, never counted."
      />

      <PlaneBadge plane="private" />

      <PrivacyNote detail="Appreciation is private between you and the person unless you both choose otherwise. Nothing is tallied, ranked or reported — there is no leaderboard, because a count of who gets thanked most is a ranking of people in a friendly hat.">
        <b>Never counted, never ranked.</b>{' '}
      </PrivacyNote>

      {loading ? (
        <div className="card">
          <div className="skel skel--title" />
          <div className="skel skel--text" />
        </div>
      ) : (
        <div className="grid grid--sidebar-right">
          <div className="stack">
            <form className="card" onSubmit={sendAppreciation}>
              <div className="card__title mb-2">Appreciate someone</div>
              <p className="card__sub mb-4">
                Private unless you both choose otherwise
              </p>

              {sent && (
                <p className="confirmed mb-4" role="status">
                  <span aria-hidden="true">✓</span>
                  <span>Sent. Only they will see it.</span>
                </p>
              )}

              {sendError && (
                <div className="banner banner--error mb-4" role="alert">
                  {sendError}
                </div>
              )}

              <div className="field">
                <label className="field__label" htmlFor="who">
                  Who
                </label>
                <select
                  className="select"
                  id="who"
                  value={to}
                  onChange={(e) => {
                    setTo(e.target.value)
                    setSent(false)
                  }}
                >
                  <option value="">Choose someone…</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field mt-4">
                <label className="field__label" htmlFor="what">
                  What for
                </label>
                <textarea
                  className="textarea"
                  id="what"
                  value={message}
                  placeholder="Something specific beats something warm."
                  onChange={(e) => {
                    setMessage(e.target.value)
                    setSent(false)
                  }}
                />
              </div>

              <div className="field mt-4">
                <span className="field__label">Who else can see it</span>
                <div className="segmented" role="group" aria-label="Visibility">
                  {(['private', 'team', 'everyone'] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={visibility === v}
                      onClick={() => setVisibility(v)}
                    >
                      {v === 'private'
                        ? 'Just them'
                        : v === 'team'
                          ? 'Their team'
                          : 'Everyone'}
                    </button>
                  ))}
                </div>
                <span className="field__hint">
                  Anything wider needs their agreement.
                </span>
              </div>

              <button className="btn btn--primary mt-5" type="submit">
                Send appreciation
              </button>
            </form>

            <div className="card card--flush">
              <div style={{ padding: 'var(--s-5) var(--s-5) var(--s-3)' }}>
                <div className="card__title">For you</div>
                <div className="card__sub">
                  {received.length === 0
                    ? 'Nothing yet'
                    : 'Things colleagues have sent you'}
                </div>
              </div>
              {received.length > 0 && (
                <div className="feed">
                  {received.map((a) => (
                    <article className="feed__item" key={a.id}>
                      <div className="avatar" aria-hidden="true">
                        ♥
                      </div>
                      <div className="grow">
                        <div className="row row--between">
                          <span className="feed__name">A colleague</span>
                          <span className="feed__time">
                            {new Date(a.created_at).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                            })}
                          </span>
                        </div>
                        <p className="feed__text">{a.message}</p>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="stack">
            <form className="card card--accent" onSubmit={sendSupport}>
              <div className="card__title mb-2">Ask for support</div>
              <p className="card__sub mb-4">
                A private route to HR or an external service
              </p>

              {supportError && (
                <div className="banner banner--error mb-4" role="alert">
                  {supportError}
                </div>
              )}

              <div className="field">
                <label className="field__label" htmlFor="msg">
                  What would help?
                </label>
                <textarea
                  className="textarea"
                  id="msg"
                  value={body}
                  placeholder="Only the person you send this to will read it."
                  onChange={(e) => setBody(e.target.value)}
                />
              </div>

              <div className="field mt-4">
                <label className="field__label" htmlFor="to-route">
                  Send to
                </label>
                <select
                  className="select"
                  id="to-route"
                  value={route}
                  onChange={(e) => setRoute(e.target.value as 'hr' | 'eap')}
                >
                  <option value="hr">HR at your organisation</option>
                  <option value="eap">
                    Employee assistance programme (external)
                  </option>
                </select>
                <span className="field__hint">
                  {route === 'hr'
                    ? 'HR will see this until you withdraw it.'
                    : 'HR never sees requests sent externally.'}
                </span>
              </div>

              <button className="btn btn--primary btn--block mt-4" type="submit">
                Send privately
              </button>
              <p className="field__hint mt-3">Your manager is not copied.</p>
            </form>

            {open.length > 0 && (
              <div className="card">
                <div className="card__title mb-3">Your open requests</div>
                <div className="stack stack--tight">
                  {open.map((r) => (
                    <div key={r.id}>
                      <div className="row row--between">
                        <span className="chip">
                          {r.route === 'hr' ? 'To HR' : 'To the EAP'}
                        </span>
                        <button
                          className="btn btn--ghost btn--sm"
                          type="button"
                          onClick={() => withdraw(r.id)}
                        >
                          Withdraw
                        </button>
                      </div>
                      <p className="t-subtle mt-2">{r.body}</p>
                    </div>
                  ))}
                </div>
                <p className="field__hint mt-4">
                  Withdrawing takes it back out of HR&rsquo;s view entirely.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </Shell>
  )
}
