'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import { PageHead, PlaneBadge, PrivacyNote } from '@/components/chrome'
import { ConfirmButton } from '@/components/controls'
import { fmtDate } from '@/lib/format-date'

type Post = { id: string; title: string; posted_on: string; body: string }

function today() {
  return new Date().toISOString().slice(0, 10)
}

const EMPTY_DRAFT = { title: '', body: '', posted_on: today() }

async function fetchOrgId() {
  const { data, error } = await createClient().from('me').select('org_id').maybeSingle()
  if (error) throw error
  return data?.org_id ?? null
}

async function fetchPosts() {
  const { data, error } = await createClient()
    .from('news_posts')
    .select('id, title, posted_on, body')
    .order('posted_on', { ascending: false })
  if (error) throw error
  return (data ?? []) as Post[]
}

/**
 * HR's side of News: the same feed employees see, with the authoring taken
 * out of the seed data and put in HR's hands. Posts are visible org-wide
 * the moment they're saved — there is no draft state to half-finish one in.
 */
export function NewsManageClient() {
  const { data: orgId } = useSWR('me:org_id', fetchOrgId)
  const { data: posts, error: loadErrorObj, isLoading: loading, mutate } = useSWR('news:posts', fetchPosts)
  const [actionError, setActionError] = useState<string | null>(null)
  const loadError = actionError ?? loadErrorObj?.message ?? null

  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  function startCreate() {
    setEditingId('new')
    setDraft(EMPTY_DRAFT)
    setFormError(null)
  }

  function startEdit(p: Post) {
    setEditingId(p.id)
    setDraft({ title: p.title, body: p.body, posted_on: p.posted_on })
    setFormError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setFormError(null)
  }

  async function save() {
    const title = draft.title.trim()
    const body = draft.body.trim()
    if (!title || !body) {
      setFormError('Title and body are both required.')
      return
    }

    setSaving(true)
    setFormError(null)
    const supabase = createClient()

    if (editingId === 'new') {
      if (!orgId) {
        setSaving(false)
        setFormError('This account is not linked to an organisation yet.')
        return
      }
      const { data, error } = await supabase
        .from('news_posts')
        .insert({ org_id: orgId, title, body, posted_on: draft.posted_on })
        .select('id, title, posted_on, body')
        .single()
      setSaving(false)
      if (error) return setFormError(error.message)
      await mutate(
        (prev) => [...(prev ?? []), data as Post].sort((a, b) => (a.posted_on < b.posted_on ? 1 : -1)),
        { revalidate: false }
      )
      setEditingId(null)
      return
    }

    const { data, error } = await supabase
      .from('news_posts')
      .update({ title, body, posted_on: draft.posted_on })
      .eq('id', editingId)
      .select('id, title, posted_on, body')
      .single()
    setSaving(false)
    if (error) return setFormError(error.message)
    await mutate((prev) => prev?.map((p) => (p.id === editingId ? (data as Post) : p)), { revalidate: false })
    setEditingId(null)
  }

  async function remove(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('news_posts').delete().eq('id', id)
    if (error) {
      setActionError(error.message)
      return
    }
    await mutate((prev) => prev?.filter((p) => p.id !== id), { revalidate: false })
    if (editingId === id) setEditingId(null)
  }

  return (
    <>
      <PageHead
        title="News"
        lead="Post, edit, or take down announcements for your organisation."
      />
      <PlaneBadge plane="work" />

      {loadError && (
        <div className="banner banner--error mb-5" role="alert">
          {loadError}
        </div>
      )}

      <div className="grid grid--sidebar-right">
        <div className="stack">
          {loading ? (
            <div className="card">
              <div className="skel skel--text" />
            </div>
          ) : (posts ?? []).length === 0 ? (
            <div className="card card--quiet">
              <p className="t-subtle">Nothing posted yet.</p>
            </div>
          ) : (
            (posts ?? []).map((p) => (
              <div className="card" key={p.id}>
                {editingId === p.id ? (
                  <PostForm
                    draft={draft}
                    setDraft={setDraft}
                    onSave={save}
                    onCancel={cancelEdit}
                    saving={saving}
                    error={formError}
                    submitLabel="Save changes"
                  />
                ) : (
                  <>
                    <div className="card__head">
                      <div>
                        <h2 className="card__title">{p.title}</h2>
                        <div className="card__sub">
                          {fmtDate(p.posted_on, {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </div>
                      </div>
                    </div>
                    <p className="t-subtle mt-3">{p.body}</p>
                    <div className="row mt-4" style={{ gap: 'var(--s-2)' }}>
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm"
                        onClick={() => startEdit(p)}
                      >
                        Edit
                      </button>
                      <ConfirmButton
                        label="Delete"
                        className="btn btn--ghost btn--sm"
                        onConfirm={() => remove(p.id)}
                      />
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        <div className="stack">
          <div className="card">
            <h2 className="card__title mb-3">Post an announcement</h2>
            {editingId === 'new' ? (
              <PostForm
                draft={draft}
                setDraft={setDraft}
                onSave={save}
                onCancel={cancelEdit}
                saving={saving}
                error={formError}
                submitLabel="Post"
              />
            ) : (
              <button type="button" className="btn btn--primary" onClick={startCreate}>
                New post
              </button>
            )}
          </div>
        </div>
      </div>

      <PrivacyNote
        plane="work"
        detail="A post goes out to everyone at your organisation the moment you save it — there is no draft or scheduled state. Editing or deleting one only ever affects the post itself, never anyone's account."
      >
        <b>Visible to your whole organisation.</b>{' '}
      </PrivacyNote>
    </>
  )
}

function PostForm({
  draft,
  setDraft,
  onSave,
  onCancel,
  saving,
  error,
  submitLabel,
}: {
  draft: { title: string; body: string; posted_on: string }
  setDraft: (d: { title: string; body: string; posted_on: string }) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
  error: string | null
  submitLabel: string
}) {
  return (
    <div className="stack stack--tight">
      {error && (
        <div className="banner banner--error" role="alert">
          {error}
        </div>
      )}
      <div className="field">
        <label className="field__label" htmlFor="news-title">
          Title
        </label>
        <input
          id="news-title"
          className="input"
          value={draft.title}
          maxLength={120}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        />
      </div>
      <div className="field">
        <label className="field__label" htmlFor="news-body">
          Body
        </label>
        <textarea
          id="news-body"
          className="textarea"
          rows={5}
          value={draft.body}
          onChange={(e) => setDraft({ ...draft, body: e.target.value })}
        />
      </div>
      <div className="field" style={{ maxWidth: 200 }}>
        <label className="field__label" htmlFor="news-date">
          Posted on
        </label>
        <input
          id="news-date"
          className="input"
          type="date"
          value={draft.posted_on}
          onChange={(e) => setDraft({ ...draft, posted_on: e.target.value })}
        />
      </div>
      <div className="row" style={{ gap: 'var(--s-2)' }}>
        <button
          type="button"
          className="btn btn--primary btn--sm"
          disabled={saving}
          onClick={onSave}
        >
          {saving ? 'Saving…' : submitLabel}
        </button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}
