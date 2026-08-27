'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import { PageHead, PlaneBadge, PrivacyNote } from '@/components/chrome'
import { fmtDate } from '@/lib/format-date'

type Asset = {
  id: string
  person_id: string
  tag: string
  asset_type: string
  issued_on: string
  condition: 'Good' | 'Fair' | 'Poor'
  issue_reported: boolean
  issue_note: string | null
}
type Person = { id: string; full_name: string }

const CONDITIONS = ['Good', 'Fair', 'Poor'] as const

const EMPTY_DRAFT = {
  personId: '',
  tag: '',
  assetType: '',
  issuedOn: new Date().toISOString().slice(0, 10),
  condition: 'Good' as (typeof CONDITIONS)[number],
}

async function fetchPeople() {
  const { data, error } = await createClient().from('people').select('id, full_name').order('full_name')
  if (error) throw error
  return (data ?? []) as Person[]
}

async function fetchAssets() {
  const { data, error } = await createClient()
    .from('assets')
    .select('id, person_id, tag, asset_type, issued_on, condition, issue_reported, issue_note')
    .order('issued_on', { ascending: false })
  if (error) throw error
  return (data ?? []) as Asset[]
}

/**
 * HR's side of Assets. 0037's own comment says the design outright: "HR
 * issues rows and the employee's only write is reporting a fault on their
 * own" -- but this account was locked out of the page entirely, so nothing
 * could ever be issued past the one seeded demo row. Resolving a reported
 * issue is just HR editing condition/issue_reported like any other field
 * they own; the guard trigger added alongside this only stops the
 * employee's own path from touching those columns, not HR's.
 */
export default function AssetsManageClient() {
  const { data: people, error: peopleErrorObj } = useSWR('people', fetchPeople)
  const { data: assets, error: assetsErrorObj, isLoading: loading, mutate } = useSWR('assets:all', fetchAssets)
  const [actionError, setActionError] = useState<string | null>(null)
  const loadError = actionError ?? peopleErrorObj?.message ?? assetsErrorObj?.message ?? null

  const [issuing, setIssuing] = useState(false)
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [resolvingId, setResolvingId] = useState<string | null>(null)

  const names = new Map((people ?? []).map((p) => [p.id, p.full_name]))
  const reported = (assets ?? []).filter((a) => a.issue_reported)

  function startIssue() {
    setIssuing(true)
    setDraft(EMPTY_DRAFT)
    setFormError(null)
  }

  async function issue() {
    if (!draft.personId) return setFormError('Choose who this is for.')
    if (!draft.tag.trim()) return setFormError('Give it an asset tag.')
    if (!draft.assetType.trim()) return setFormError('Say what it is.')

    setSaving(true)
    setFormError(null)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('assets')
      .insert({
        person_id: draft.personId,
        tag: draft.tag.trim(),
        asset_type: draft.assetType.trim(),
        issued_on: draft.issuedOn,
        condition: draft.condition,
      })
      .select('id, person_id, tag, asset_type, issued_on, condition, issue_reported, issue_note')
      .single()
    setSaving(false)
    if (error) return setFormError(error.message)

    await mutate((prev) => [data as Asset, ...(prev ?? [])], { revalidate: false })
    setIssuing(false)
  }

  async function resolveIssue(id: string, newCondition: Asset['condition']) {
    setResolvingId(id)
    const supabase = createClient()
    const { error } = await supabase
      .from('assets')
      .update({ issue_reported: false, issue_note: null, condition: newCondition })
      .eq('id', id)
    setResolvingId(null)
    if (error) {
      setActionError(error.message)
      return
    }
    await mutate(
      (prev) =>
        prev?.map((a) =>
          a.id === id ? { ...a, issue_reported: false, issue_note: null, condition: newCondition } : a
        ),
      { revalidate: false }
    )
  }

  return (
    <>
      <PageHead title="Assets" lead="Equipment on loan — issue it, and clear a reported fault." />
      <PlaneBadge plane="work" />

      {loadError && (
        <div className="banner banner--error mb-5" role="alert">
          {loadError}
        </div>
      )}

      {reported.length > 0 && (
        <div className="card card--accent mb-5">
          <h2 className="card__title mb-3">Issues reported</h2>
          <div className="stack stack--tight">
            {reported.map((a) => (
              <div className="card card--quiet" key={a.id} style={{ margin: 0 }}>
                <div className="row row--between">
                  <b>{names.get(a.person_id) ?? 'Someone'}</b>
                  <span className="chip">{a.asset_type} · {a.tag}</span>
                </div>
                <p className="t-subtle mt-2">{a.issue_note}</p>
                <div className="row mt-3" style={{ gap: 'var(--s-2)' }}>
                  {CONDITIONS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className="btn btn--secondary btn--sm"
                      disabled={resolvingId === a.id}
                      onClick={() => resolveIssue(a.id, c)}
                    >
                      Fixed — mark {c}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card card--flush">
        <div style={{ padding: 'var(--s-5) var(--s-5) var(--s-3)' }}>
          <h2 className="card__title">Issued</h2>
        </div>
        {loading ? (
          <div style={{ padding: '0 var(--s-5) var(--s-5)' }}>
            <div className="skel skel--text" />
          </div>
        ) : (assets ?? []).length === 0 ? (
          <p className="t-subtle" style={{ padding: '0 var(--s-5) var(--s-5)' }}>
            Nothing issued yet.
          </p>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <caption className="sr-only">Issued assets</caption>
              <thead>
                <tr>
                  <th scope="col">Employee</th>
                  <th scope="col">Item</th>
                  <th scope="col">Tag</th>
                  <th scope="col">Issued</th>
                  <th scope="col">Condition</th>
                </tr>
              </thead>
              <tbody>
                {(assets ?? []).map((a) => (
                  <tr key={a.id}>
                    <th scope="row" style={{ fontWeight: 600 }}>{names.get(a.person_id) ?? 'Someone'}</th>
                    <td>{a.asset_type}</td>
                    <td className="t-subtle">{a.tag}</td>
                    <td>{fmtDate(a.issued_on)}</td>
                    <td>
                      <span className={a.condition === 'Good' ? 'chip chip--accent' : 'chip'}>
                        {a.condition}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card mt-5">
        {issuing ? (
          <div className="stack stack--tight">
            <h2 className="card__title mb-2">Issue an asset</h2>
            {formError && (
              <div className="banner banner--error" role="alert">
                {formError}
              </div>
            )}
            <div className="field">
              <label className="field__label" htmlFor="a-person">Employee</label>
              <select
                id="a-person"
                className="select"
                value={draft.personId}
                onChange={(e) => setDraft({ ...draft, personId: e.target.value })}
              >
                <option value="">Choose one</option>
                {(people ?? []).map((p) => (
                  <option key={p.id} value={p.id}>{p.full_name}</option>
                ))}
              </select>
            </div>
            <div className="row" style={{ gap: 'var(--s-3)' }}>
              <div className="field" style={{ flex: 1 }}>
                <label className="field__label" htmlFor="a-type">What it is</label>
                <input
                  id="a-type"
                  className="input"
                  value={draft.assetType}
                  placeholder="Laptop — 14&quot;"
                  onChange={(e) => setDraft({ ...draft, assetType: e.target.value })}
                />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label className="field__label" htmlFor="a-tag">Tag</label>
                <input
                  id="a-tag"
                  className="input"
                  value={draft.tag}
                  placeholder="WW-LT-0143"
                  onChange={(e) => setDraft({ ...draft, tag: e.target.value })}
                />
              </div>
            </div>
            <div className="row" style={{ gap: 'var(--s-3)' }}>
              <div className="field" style={{ flex: 1 }}>
                <label className="field__label" htmlFor="a-date">Issued on</label>
                <input
                  id="a-date"
                  className="input"
                  type="date"
                  value={draft.issuedOn}
                  onChange={(e) => setDraft({ ...draft, issuedOn: e.target.value })}
                />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label className="field__label" htmlFor="a-cond">Condition</label>
                <select
                  id="a-cond"
                  className="select"
                  value={draft.condition}
                  onChange={(e) => setDraft({ ...draft, condition: e.target.value as Asset['condition'] })}
                >
                  {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="row" style={{ gap: 'var(--s-2)' }}>
              <button type="button" className="btn btn--primary btn--sm" disabled={saving} onClick={issue}>
                {saving ? 'Issuing…' : 'Issue'}
              </button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setIssuing(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn btn--primary" onClick={startIssue}>
            Issue an asset
          </button>
        )}
      </div>

      <PrivacyNote
        plane="work"
        detail="Equipment records are tied to employment, not the private plane — the same access as leave or expense records. Nothing here touches check-ins, mood, or anything else anyone tracks privately."
      >
        <b>Employment data only.</b>{' '}
      </PrivacyNote>
    </>
  )
}
