'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHead, PlaneBadge } from '@/components/chrome'

type Employee = { id: string; name: string; title: string }
type Template = { id: string; name: string; body: (name: string, title: string) => string }

const TEMPLATES: Template[] = [
  {
    id: 't1',
    name: 'Employment certificate',
    body: (name, title) =>
      `This is to certify that ${name} is a current employee of WorkWell, holding the position of ${title}, in good standing as of today.`,
  },
  {
    id: 't2',
    name: 'Offer letter',
    body: (name, title) =>
      `Dear ${name},\n\nWe are pleased to offer you the position of ${title} at WorkWell. Full terms will follow under separate cover.`,
  },
  {
    id: 't3',
    name: 'Certificate of employment (final)',
    body: (name, title) =>
      `This certifies that ${name} was employed by WorkWell as ${title}. We wish them well in their next role.`,
  },
]

export default function LetterHeadsClient() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [templateId, setTemplateId] = useState(TEMPLATES[0].id)
  const [employeeId, setEmployeeId] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ template: string; body: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const [{ data: people, error: pError }, { data: employment }] = await Promise.all([
        supabase.from('people').select('id, full_name').order('full_name'),
        supabase.from('employment').select('person_id, job_title'),
      ])
      if (cancelled) return
      if (pError) {
        setLoadError(pError.message)
        setLoading(false)
        return
      }
      const titles = new Map((employment ?? []).map((e) => [e.person_id, e.job_title]))
      const rows = (people ?? []).map((p) => ({
        id: p.id as string,
        name: p.full_name as string,
        title: titles.get(p.id) ?? '—',
      }))
      setEmployees(rows)
      setEmployeeId(rows[0]?.id ?? null)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  function generate(e: React.FormEvent) {
    e.preventDefault()
    const template = TEMPLATES.find((t) => t.id === templateId)!
    const employee = employees.find((e) => e.id === employeeId)
    if (!employee) return
    setPreview({ template: template.name, body: template.body(employee.name, employee.title) })
  }

  return (
    <>
      <PageHead
        title="Letter heads"
        lead="Templates HR generates from — offer letters, employment certificates, that kind of thing."
      />
      <PlaneBadge plane="work" />

      {loadError && (
        <div className="banner banner--error mb-5" role="alert">
          {loadError}
        </div>
      )}

      <div className="grid grid--sidebar-right">
        <div className="stack">
          <form className="card" onSubmit={generate}>
            <h2 className="card__title">Generate a letter</h2>
            <p className="card__sub">Fills a template from an employment record.</p>

            <div className="mt-4">
              <label className="field__label" htmlFor="ltpl">Template</label>
              <select id="ltpl" className="select" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                {TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>

            <div className="mt-4">
              <label className="field__label" htmlFor="lemp">Employee</label>
              <select
                id="lemp"
                className="select"
                value={employeeId ?? ''}
                disabled={loading || employees.length === 0}
                onChange={(e) => setEmployeeId(e.target.value)}
              >
                {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>

            <div className="mt-4">
              <button className="btn btn--primary" type="submit" disabled={!employeeId}>
                Generate
              </button>
            </div>
          </form>

          <div className="card card--flush">
            <div style={{ padding: 'var(--s-5) var(--s-5) var(--s-3)' }}>
              <h2 className="card__title">Available templates</h2>
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <caption className="sr-only">Letter templates</caption>
                <tbody>
                  {TEMPLATES.map((t) => (
                    <tr key={t.id}>
                      <th scope="row" style={{ fontWeight: 600 }}>{t.name}</th>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="stack">
          {preview ? (
            <div className="card">
              <h2 className="card__title mb-1">{preview.template}</h2>
              <div className="card__sub mb-3">Preview — not sent or saved</div>
              <p style={{ whiteSpace: 'pre-wrap' }}>{preview.body}</p>
            </div>
          ) : (
            <div className="card card--quiet">
              <p className="t-subtle">Generate a letter to see a preview here.</p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
