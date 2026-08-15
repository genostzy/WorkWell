'use client'

import { useCallback, useEffect, useState } from 'react'
import { LoadError, PageHead, PlaneBadge, PrivacyNote } from '@/components/chrome'
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
export default function RecognitionClient() {
  const [me, setMe] = useState<string | null>(null)
  const [people, setPeople] = useState<Person[]>([])
  const [received, setReceived] = useState<Appreciation[]>([])
  const [requests, setRequests] = useState<SupportRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [to, setTo] = useState('')
  const [message, setMessage] = useState('')
  const [visibility, setVisibility] = useState<'private' | 'team' | 'everyone'>(
    'private'
  )
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  const [body, setBody] = useState('')
  const [route, setRoute] = useState<'hr' | 'eap'>('hr')
  const [supporting, setSupporting] = useState(false)
  const [supportSent, setSupportSent] = useState(false)
  const [supportError, setSupportError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const supabase = createClient()

    const { data: mine, error: meError } = await supabase
      .from('me')
      .select('id')
      .maybeSingle()
    setMe(mine?.id ?? null)

    const [{ data: ppl }, { data: apps, error: appError }, { data: reqs, error: reqError }] =
      await Promise.all([
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

    // A read that failed is not an empty inbox, and showing it as one is how
    // a permission problem gets mistaken for "nobody has thanked you".
    setLoadError((meError ?? appError ?? reqError)?.message ?? null)
    setPeople((ppl ?? []).filter((p) => p.id !== mine?.id))
    setReceived((apps ?? []).filter((a) => a.to_person === mine?.id))
    setRequests(reqs ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    ;(async () => {
      const supabase = createClient()

      const { data: mine, error: meError } = await supabase
        .from('me')
        .select('id')
        .maybeSingle()
      setMe(mine?.id ?? null)

      const [{ data: ppl }, { data: apps, error: appError }, { data: reqs, error: reqError }] =
        await Promise.all([
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

      setLoadError((meError ?? appError ?? reqError)?.message ?? null)
      setPeople((ppl ?? []).filter((p) => p.id !== mine?.id))
      setReceived((apps ?? []).filter((a) => a.to_person === mine?.id))
      setRequests(reqs ?? [])
      setLoading(false)
    })()
  }, [])

  // Without a person row every insert below fails on a not-null constraint,
  // and a constraint violation is a poor way to learn you have no access yet.
  const NO_PERSON = 'This account is not linked to a person yet, so there is nobody to send this as.'

  async function sendAppreciation(e: React.FormEvent) {
    e.preventDefault()
    setSendError(null)
    if (!me) return setSendError(NO_PERSON)
    if (!to || !message.trim()) {
      setSendError('Pick someone and write something.')
      return
    }

    setSending(true)
    const supabase = createClient()
    const { error } = await supabase.from('appreciations').insert({
      from_person: me,
      to_person: to,
      message: message.trim(),
      visibility,
    })
    setSending(false)

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
    if (!me) return setSupportError(NO_PERSON)
    if (!body.trim()) {
      setSupportError('Write what would help.')
      return
    }

    setSupporting(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('support_requests')
      .insert({ person_id: me, body: body.trim(), route })
    setSupporting(false)

    if (error) setSupportError(error.message)
    else {
      setBody('')
      setSupportSent(true)
      load()
    }
  }

  async function withdraw(id: string) {
    setBusyId(id)
    setSupportError(null)
    const supabase = createClient()
    const { error } = await supabase
      .from('support_requests')
      .update({ status: 'withdrawn' })
      .eq('id', id)
    setBusyId(null)

    // This used to be `if (!error) load()`, so a failed withdrawal did
    // nothing at all — the button looked broken, and the request stayed
    // visible to HR with no hint that taking it back had not worked. On
    // this screen of all screens that silence is the wrong answer.
    if (error) setSupportError(`Could not withdraw that: ${error.message}`)
    else load()
  }

  const open = requests.filter((r) => r.status === 'open')

  return (
    <>
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
      ) : loadError ? (
        <LoadError what="This page" detail={loadError} />
      ) : (
        <div className="grid grid--sidebar-right">
          <div className="stack">
            {/* Nobody to thank yet is a normal state for a new organisation,
                and a select whose only entry is "Choose someone…" invites a
                click that can only fail. Say why instead. */}
            {people.length === 0 ? (
              <div className="card">
                <div className="card__title mb-2">Appreciate someone</div>
                <p className="t-subtle">
                  There is nobody else here yet. As colleagues are given
                  accounts they appear in this list.
                </p>
              </div>
            ) : (
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

              <button
                className="btn btn--primary mt-5"
                type="submit"
                disabled={sending}
              >
                {sending ? 'Sending…' : 'Send appreciation'}
              </button>
            </form>
            )}

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

              {supportSent && (
                <p className="confirmed mb-4" role="status">
                  <span aria-hidden="true">✓</span>
                  <span>Sent. You can withdraw it at any time.</span>
                </p>
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
                  onChange={(e) => {
                    setBody(e.target.value)
                    setSupportSent(false)
                  }}
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

              <button
                className="btn btn--primary btn--block mt-4"
                type="submit"
                disabled={supporting}
              >
                {supporting ? 'Sending…' : 'Send privately'}
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
                          disabled={busyId === r.id}
                          onClick={() => withdraw(r.id)}
                        >
                          {busyId === r.id ? 'Withdrawing…' : 'Withdraw'}
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
    </>
  )
}
