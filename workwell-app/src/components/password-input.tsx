'use client'

import { useState, type InputHTMLAttributes } from 'react'

/** A password field a person can check before submitting it, rather than
 *  finding out what they actually typed only after "invalid credentials"
 *  comes back. Wraps a plain `<input>` — every other prop passes straight
 *  through, so a caller only ever swaps `type="password"` for this. */
export function PasswordInput({
  className = 'input',
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="input-wrap">
      <input {...rest} type={visible ? 'text' : 'password'} className={className} />
      <button
        type="button"
        className="input-wrap__toggle"
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        onClick={() => setVisible((v) => !v)}
      >
        {visible ? '🙈' : '👁️'}
      </button>
    </div>
  )
}
