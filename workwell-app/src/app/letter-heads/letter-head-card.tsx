'use client'

import { useState } from 'react'

interface LetterHead {
  id: string
  name: string
  body: string
  created_at: string
}

export function LetterHeadCard({ letterHead }: { letterHead: LetterHead }) {
  const [copied, setCopied] = useState(false)

  function fmt(iso: string) {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(letterHead.body)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: select text for manual copy
      const textarea = document.createElement('textarea')
      textarea.value = letterHead.body
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const preview = letterHead.body.length > 200
    ? letterHead.body.slice(0, 200) + '…'
    : letterHead.body

  return (
    <div className="card card--quiet" style={{ margin: 0 }}>
      <div className="row row--between">
        <b>{letterHead.name}</b>
        <span className="chip">{fmt(letterHead.created_at)}</span>
      </div>
      <p className="t-subtle mt-2" style={{ whiteSpace: 'pre-wrap' }}>
        {preview}
      </p>
      <div className="row mt-3">
        <button
          className="btn btn--secondary btn--sm"
          onClick={copyToClipboard}
        >
          {copied ? '✓ Copied' : 'Copy body to clipboard'}
        </button>
      </div>
    </div>
  )
}
