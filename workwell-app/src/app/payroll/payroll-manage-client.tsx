'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import { PageHead, PlaneBadge, PrivacyNote } from '@/components/chrome'

type Payslip = {
  id: string
  person_id: string
  period_month: string
  gross: number
  net: number
  status: 'Processing' | 'Paid'
}
type Person = { id: string; full_name: string }

function monthLabel(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  })
}

function peso(n: number) {
  return `₱${n.toLocaleString('en-PH')}`
}

function thisMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const EMPTY_DRAFT = {
  personId: '',
  month: thisMonth(),
  gross: '',
  net: '',
  status: 'Processing' as 'Processing' | 'Paid',
}

async function fetchPeople() {
  const { data, error } = await createClient().from('people').select('id, full_name').order('full_name')
  if (error) throw error
  return (data ?? []) as Person[]
}

async function fetchPayslips() {
  const { data, error } = await createClient()
    .from('payslips')
    .select('id, person_id, period_month, gross, net, status')
    .order('period_month', { ascending: false })
  if (error) throw error
  return (data ?? []) as Payslip[]
}

/**
 * HR's side of payroll: issuing the payslip, not just reading it. The
 * table has always allowed this (see 0034_payroll.sql) — there was simply
 * nowhere in the product to do it, so every payslip anyone ever saw was
 * fixed seed data.
 *
 * Re-issuing for a person and month that already has one overwrites it
 * (upsert) rather than erroring — the friendlier assumption when someone
 * fixes a mistake by resubmitting. Once issued, only the amounts and
 * status can change; who it's for and which month stay fixed, since
 * changing either is really issuing a different payslip.
 */
export function PayrollManageClient() {
  const { data: people, error: peopleErrorObj } = useSWR('people', fetchPeople)
  const { data: payslips, error: payslipsErrorObj, isLoading: loading, mutate } = useSWR('payslips:all', fetchPayslips)
  const loadError = peopleErrorObj?.message ?? payslipsErrorObj?.message ?? null

  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const names = new Map((people ?? []).map((p) => [p.id, p.full_name]))

  function startCreate() {
    setEditingId('new')
    setDraft(EMPTY_DRAFT)
    setFormError(null)
  }

  function startEdit(p: Payslip) {
    setEditingId(p.id)
    setDraft({
      personId: p.person_id,
      month: p.period_month.slice(0, 7),
      gross: String(p.gross),
      net: String(p.net),
      status: p.status,
    })
    setFormError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setFormError(null)
  }

  async function save() {
    const gross = Number(draft.gross)
    const net = Number(draft.net)
    if (editingId === 'new' && !draft.personId) {
      setFormError('Choose who this payslip is for.')
      return
    }
    if (!Number.isFinite(gross) || gross < 0 || !Number.isFinite(net) || net < 0) {
      setFormError('Gross and net both need to be numbers, 0 or more.')
      return
    }
    if (net > gross) {
      setFormError('Net pay cannot be more than gross pay.')
      return
    }

    setSaving(true)
    setFormError(null)
    const supabase = createClient()

    if (editingId === 'new') {
      const { data, error } = await supabase
        .from('payslips')
        .upsert(
          {
            person_id: draft.personId,
            period_month: `${draft.month}-01`,
            gross,
            net,
            status: draft.status,
          },
          { onConflict: 'person_id,period_month' }
        )
        .select('id, person_id, period_month, gross, net, status')
        .single()
      setSaving(false)
      if (error) return setFormError(error.message)
      const row = data as Payslip
      await mutate(
        (prev) =>
          [row, ...(prev ?? []).filter((p) => p.id !== row.id)].sort((a, b) =>
            a.period_month < b.period_month ? 1 : -1
          ),
        { revalidate: false }
      )
      setEditingId(null)
      return
    }

    const { data, error } = await supabase
      .from('payslips')
      .update({ gross, net, status: draft.status })
      .eq('id', editingId)
      .select('id, person_id, period_month, gross, net, status')
      .single()
    setSaving(false)
    if (error) return setFormError(error.message)
    await mutate((prev) => prev?.map((p) => (p.id === editingId ? (data as Payslip) : p)), { revalidate: false })
    setEditingId(null)
  }

  return (
    <>
      <PageHead
        title="Payroll"
        lead="Issue payslips, correct one already issued, and mark them paid."
      />
      <PlaneBadge plane="work" />

      {loadError && (
        <div className="banner banner--error mb-5" role="alert">
          {loadError}
        </div>
      )}

      <div className="grid grid--sidebar-right">
        <div className="stack">
          <div className="card card--flush">
            <div style={{ padding: 'var(--s-5) var(--s-5) var(--s-3)' }}>
              <h2 className="card__title">Issued payslips</h2>
            </div>
            {loading ? (
              <div style={{ padding: '0 var(--s-5) var(--s-5)' }}>
                <div className="skel skel--text" />
              </div>
            ) : (payslips ?? []).length === 0 ? (
              <p className="t-subtle" style={{ padding: '0 var(--s-5) var(--s-5)' }}>
                Nothing issued yet.
              </p>
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <caption className="sr-only">Issued payslips</caption>
                  <thead>
                    <tr>
                      <th scope="col">Employee</th>
                      <th scope="col">Month</th>
                      <th scope="col">Gross</th>
                      <th scope="col">Net</th>
                      <th scope="col">Status</th>
                      <th scope="col">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(payslips ?? []).map((p) => (
                      <tr key={p.id}>
                        <th scope="row" style={{ fontWeight: 600 }}>
                          {names.get(p.person_id) ?? 'Someone'}
                        </th>
                        <td>{monthLabel(p.period_month)}</td>
                        <td className="t-num">{peso(p.gross)}</td>
                        <td className="t-num">{peso(p.net)}</td>
                        <td>
                          <span className={p.status === 'Paid' ? 'chip chip--accent' : 'chip'}>
                            {p.status}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn--secondary btn--sm"
                            onClick={() => startEdit(p)}
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <h2 className="card__title mb-3">
              {editingId && editingId !== 'new' ? 'Edit payslip' : 'Issue a payslip'}
            </h2>
            {editingId ? (
              <div className="stack stack--tight">
                {formError && (
                  <div className="banner banner--error" role="alert">
                    {formError}
                  </div>
                )}
                <div className="field">
                  <label className="field__label" htmlFor="pay-person">
                    Employee
                  </label>
                  {editingId === 'new' ? (
                    <select
                      id="pay-person"
                      className="select"
                      value={draft.personId}
                      onChange={(e) => setDraft({ ...draft, personId: e.target.value })}
                    >
                      <option value="">Choose one</option>
                      {(people ?? []).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.full_name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="input"
                      value={names.get(draft.personId) ?? 'Someone'}
                      disabled
                    />
                  )}
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="pay-month">
                    Pay period
                  </label>
                  <input
                    id="pay-month"
                    className="input"
                    type="month"
                    value={draft.month}
                    disabled={editingId !== 'new'}
                    onChange={(e) => setDraft({ ...draft, month: e.target.value })}
                  />
                  {editingId !== 'new' && (
                    <span className="field__hint">
                      The employee and month are fixed once issued — issue a new one instead
                      if either was wrong.
                    </span>
                  )}
                </div>
                <div className="row" style={{ gap: 'var(--s-3)' }}>
                  <div className="field" style={{ flex: 1 }}>
                    <label className="field__label" htmlFor="pay-gross">
                      Gross
                    </label>
                    <input
                      id="pay-gross"
                      className="input"
                      type="number"
                      min={0}
                      step="0.01"
                      value={draft.gross}
                      onChange={(e) => setDraft({ ...draft, gross: e.target.value })}
                    />
                  </div>
                  <div className="field" style={{ flex: 1 }}>
                    <label className="field__label" htmlFor="pay-net">
                      Net
                    </label>
                    <input
                      id="pay-net"
                      className="input"
                      type="number"
                      min={0}
                      step="0.01"
                      value={draft.net}
                      onChange={(e) => setDraft({ ...draft, net: e.target.value })}
                    />
                  </div>
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="pay-status">
                    Status
                  </label>
                  <select
                    id="pay-status"
                    className="select"
                    value={draft.status}
                    onChange={(e) =>
                      setDraft({ ...draft, status: e.target.value as 'Processing' | 'Paid' })
                    }
                  >
                    <option value="Processing">Processing</option>
                    <option value="Paid">Paid</option>
                  </select>
                </div>
                <div className="row" style={{ gap: 'var(--s-2)' }}>
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    disabled={saving}
                    onClick={save}
                  >
                    {saving ? 'Saving…' : editingId === 'new' ? 'Issue' : 'Save changes'}
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={cancelEdit}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="btn btn--primary" onClick={startCreate}>
                New payslip
              </button>
            )}
          </div>
        </div>
      </div>

      <PrivacyNote
        plane="work"
        detail="This uses the same general HR access as the rest of this plane, not a narrower payroll-only role — that split doesn't exist in this product yet. A payslip can be corrected after issuing, but never deleted, the same as every other financial record here."
      >
        <b>Same HR access as the rest of this plane — not narrowed yet.</b>{' '}
      </PrivacyNote>
    </>
  )
}
