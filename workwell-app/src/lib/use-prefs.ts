'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Load-and-save for the private plane's one-row-per-person tables.
 *
 * Every screen in slice F has the same shape: a row keyed by person_id that
 * may not exist yet, edited a field at a time. Upsert handles both cases,
 * and RLS means a person can only ever write their own row — the person_id
 * we send is checked against the JWT rather than trusted.
 *
 * Saves optimistically, then puts the value back if the write fails. A
 * screen that claims to have stored something it did not is worse than a
 * moment of latency.
 */
export function usePrefs<T extends Record<string, unknown>>(
  table: string,
  defaults: T
) {
  const [value, setValue] = useState<T>(defaults)
  const [personId, setPersonId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    ;(async () => {
      const { data: me } = await supabase.from('me').select('id').maybeSingle()
      if (cancelled) return

      if (!me) {
        setError('This account is not linked to a person yet.')
        setLoading(false)
        return
      }
      setPersonId(me.id)

      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('person_id', me.id)
        .maybeSingle()

      if (cancelled) return
      // No row yet is normal — untouched defaults, not a failure.
      if (error) setError(error.message)
      else if (data) setValue({ ...defaults, ...data } as T)
      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table])

  const update = useCallback(
    async (patch: Partial<T>) => {
      if (!personId) return
      const previous = value
      setValue({ ...value, ...patch })
      setSaving(true)
      setError(null)

      const supabase = createClient()
      const { error } = await supabase
        .from(table)
        .upsert({ person_id: personId, ...patch }, { onConflict: 'person_id' })

      setSaving(false)
      if (error) {
        setError(error.message)
        setValue(previous)
      }
    },
    [personId, table, value]
  )

  return { value, update, loading, saving, error, personId }
}
