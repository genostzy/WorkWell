'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHead, PlaneBadge, PrivacyNote } from '@/components/chrome'

type Warning = {
  id: string
  person_id: string
  category: string
  note: string
  status: 'Active' | 'Resolved'
  created_at: string
}
type Person = { id: string; full_name: string }

const CATEGORIES = ['Attendance', 'Conduct', 'Performance', 'Policy breach'] as const

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** HR's side of Warnings, made real. Issuing one tells the person the same
 *  moment every other decide-flow in this product does; resolving one is
 *  one-way (the database enforces Active -> Resolved only) and, unlike
 *  issuing, doesn't notify -- the actionable moment for the person was
 *  being told a warning exists, not that it was later closed out. */
export default function WarningsManageClient() {
  const [me, setMe] = useState<string | null>(null)
  const [people, setPeople] = useState<Person[]>([])
  const [warnings, setWarnings] = useState<Warning[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [personId, setPersonId] = useState('')
  const [category, setCategory] = useState<string>(CATEGORIES[0])
  const [note, setNote] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [resolvingId, setResolvingId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const [{ data: mine }, { data: ppl, error: pplError }, { data, error }] = await Promise.all([
        supabase.from('me').select('id').maybeSingle(),
        supabase.from('people').select('id, full_name').order('full_name'),
        supabase
          .from('warnings')
          .select('id, person_id, category, note, status, created_at')
          .order('created_at', { ascending: false }),
      ])
      if (cancelled) return
      setMe(mine?.id ?? null)
      if (pplError ?? error) setLoadError((pplError ?? error)!.message)
      setPeople((ppl ?? []) as Person[])
      setWarnings((data ?? []) as Warning[])
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const names = new Map(people.map((p) => [p.id, p.full_name]))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!personId) return setFormError('Choose who this concerns.')
    if (!note.trim()) return setFormError('State what the warning is for.')

    setSending(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('warnings')
      .insert({ person_id: personId, category, note: note.trim(), issued_by: me })
      .select('id, person_id, category, note, status, created_at')
      .single()

    if (error) {
      setSending(false)
      return setFormError(error.message)
    }

    await supabase.from('notifications').insert({
      person_id: personId,
      kind: 'warning_issued',
      title: 'A warning has been placed on your file',
      body: `Category: ${category}`,
      link: '/cases?tab=warnings',
    })

    setSending(false)
    setWarnings((w) => [data as Warning, ...w])
    setPersonId('')
    setCategory(CATEGORIES[0])
    setNote('')
  }

  async function resolve(id: string) {
    setResolvingId(id)
    const supabase = createClient()
    const { error } = await supabase
      .from('warnings')
      .update({ status: 'Resolved', resolved_by: me, resolved_at: new Date().toISOString() })
      .eq('id', id)
    setResolvingId(null)

    if (error) {
      setLoadError(error.message)
      return
    }
    setWarnings((w) => w.map((x) => (x.id === id ? { ...x, status: 'Resolved' } : x)))
  }

  return (
    <>
      <PageHead title="Warnings" lead="Formal disciplinary records." />
      <PlaneBadge plane="work" />

      {loadError && (
        <div className="banner banner--error mb-5" role="alert">
          {loadError}
        </div>
      )}

      <div className="grid grid--records">
        <div className="stack">
          <div className="card card--flush">
            <div style={{ padding: 'var(--s-5) var(--s-5) var(--s-3)' }}>
              <h2 className="card__title">Records</h2>
            </div>
            {loading ? (
              <div style={{ padding: '0 var(--s-5) var(--s-5)' }}>
                <div className="skel skel--text" />
              </div>
            ) : warnings.length === 0 ? (
              <p className="t-subtle" style={{ padding: '0 var(--s-5) var(--s-5)' }}>
                None on file.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {warnings.map((w) => (
                  <div
                    key={w.id}
                    style={{ padding: 'var(--s-4) var(--s-5)', borderBottom: '1px solid var(--border)' }}
                  >
                    <div className="row row--between" style={{ flexWrap: 'wrap' }}>
                      <div className="row" style={{ gap: 'var(--s-3)', flexWrap: 'wrap' }}>
                        <b style={{ fontWeight: 600 }}>{names.get(w.person_id) ?? 'Someone'}</b>
                        <span className="chip">{w.category}</span>
                        <span className={w.status === 'Active' ? 'chip chip--accent' : 'chip'}>
                          {w.status}
                        </span>
                      </div>
                      {w.status === 'Active' && (
                        <button
                          className="btn btn--ghost btn--sm"
                          type="button"
                          disabled={resolvingId === w.id}
                          onClick={() => resolve(w.id)}
                        >
                          {resolvingId === w.id ? 'Saving…' : 'Mark resolved'}
                        </button>
                      )}
                    </div>
                    <p className="t-subtle mt-2">{w.note}</p>
                    <p className="t-subtle" style={{ fontSize: 'var(--fs-sm)' }}>
                      {fmtDateTime(w.created_at)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="stack">
          <form className="card" onSubmit={submit}>
            <h2 className="card__title">Raise a warning</h2>

            {formError && <div className="banner banner--error" role="alert">{formError}</div>}

            <div className="mt-4">
              <label className="field__label" htmlFor="wemp">Employee</label>
              <select id="wemp" className="select" value={personId} onChange={(e) => setPersonId(e.target.value)}>
                <option value="">Choose one</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>{p.full_name}</option>
                ))}
              </select>
            </div>

            <div className="mt-4">
              <label className="field__label" htmlFor="wcat">Category</label>
              <select id="wcat" className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>

            <div className="mt-4">
              <label className="field__label" htmlFor="wnote">What it&apos;s for</label>
              <textarea id="wnote" className="textarea" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>

            <div className="mt-4">
              <button className="btn btn--primary" type="submit" disabled={sending}>
                {sending ? 'Raising…' : 'Raise warning'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <PrivacyNote
        plane="work"
        detail="A warning is visible to you and to the person it's about from the moment you raise it, and to nobody else. It is never deleted, only resolved -- correct a mistake by raising a fresh record rather than editing this one after the fact."
      >
        <b>Visible to you and the person it&rsquo;s about, nowhere else.</b>{' '}
      </PrivacyNote>
    </>
  )
}
