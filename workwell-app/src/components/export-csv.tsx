'use client'

import { useRef } from 'react'

export function ExportCsv({
  data,
  filename,
  children,
}: {
  data: Record<string, unknown>[]
  filename: string
  children: React.ReactNode
}) {
  const linkRef = useRef<HTMLAnchorElement>(null)

  function handleClick() {
    if (!data.length) return
    const keys = Object.keys(data[0])
    const header = keys.map(escape).join(',')
    const rows = data.map((row) => keys.map((k) => escape(String(row[k] ?? ''))).join(','))
    const csv = [header, ...rows].join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = linkRef.current!
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  function escape(v: string) {
    if (v.includes(',') || v.includes('"') || v.includes('\n')) {
      return '"' + v.replace(/"/g, '""') + '"'
    }
    return v
  }

  return (
    <>
      <button
        type="button"
        className="btn btn--secondary btn--sm"
        onClick={handleClick}
        disabled={!data.length}
      >
        {children}
      </button>
      <a ref={linkRef} className="sr-only" aria-hidden="true" />
    </>
  )
}
