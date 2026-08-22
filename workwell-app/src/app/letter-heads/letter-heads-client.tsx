'use client'

import { useState } from 'react'
import { PageHead, PlaneBadge } from '@/components/chrome'

type Template = { id: string; name: string; body: (name: string, title: string) => string }

const EMPLOYEES = [
  { name: 'Wilson Dayrit', title: 'Software Engineer' },
  { name: 'Maria Santos', title: 'Product Designer' },
  { name: 'Jun Reyes', title: 'HR Generalist' },
]

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
  const [templateId, setTemplateId] = useState(TEMPLATES[0].id)
  const [employeeName, setEmployeeName] = useState(EMPLOYEES[0].name)
  const [preview, setPreview] = useState<{ template: string; body: string } | null>(null)

  function generate(e: React.FormEvent) {
    e.preventDefault()
    const template = TEMPLATES.find((t) => t.id === templateId)!
    const employee = EMPLOYEES.find((e) => e.name === employeeName)!
    setPreview({ template: template.name, body: template.body(employee.name, employee.title) })
  }

  return (
    <>
      <PageHead
        title="Letter heads"
        lead="Templates HR generates from — offer letters, employment certificates, that kind of thing."
      />
      <PlaneBadge plane="work" />

      <div className="grid grid--sidebar-right">
        <div className="stack">
          <form className="card" onSubmit={generate}>
            <div className="card__title">Generate a letter</div>
            <p className="card__sub">Fills a template from an employment record.</p>

            <div className="mt-4">
              <label className="field__label" htmlFor="ltpl">Template</label>
              <select id="ltpl" className="select" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                {TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>

            <div className="mt-4">
              <label className="field__label" htmlFor="lemp">Employee</label>
              <select id="lemp" className="select" value={employeeName} onChange={(e) => setEmployeeName(e.target.value)}>
                {EMPLOYEES.map((e) => <option key={e.name}>{e.name}</option>)}
              </select>
            </div>

            <div className="mt-4">
              <button className="btn btn--primary" type="submit">Generate</button>
            </div>
          </form>

          <div className="card card--flush">
            <div style={{ padding: 'var(--s-5) var(--s-5) var(--s-3)' }}>
              <div className="card__title">Available templates</div>
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
              <div className="card__title mb-1">{preview.template}</div>
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
