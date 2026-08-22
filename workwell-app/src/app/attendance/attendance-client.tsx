'use client'

import { useCallback, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Empty } from '@/components/chrome'

type Record = {
  id: string
  clock_in: string
  clock_out: string | null
  date: string
  note: string | null
}

type TodayAllRecord = {
  person_id: string
  clock_in: string
  clock_out: string | null
  date: string
}

type TodayAll = TodayAllRecord[]

type Summary = {
  id: string
  name: string
  clockedIn: boolean
  clock_in: string | null
  clock_out: string | null
}[]

function fmtTime(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function duration(clockIn: string, clockOut: string | null) {
  const start = new Date(clockIn).getTime()
  const end = clockOut ? new Date(clockOut).getTime() : Date.now()
  const ms = end - start
  if (ms < 0) return '—'
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function fmtDate(iso: string) {
  const d = new Date(iso + 'T00:00:00')
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      })
}

export default function AttendanceClient({
  todayRecord: initialToday,
  history: initialHistory,
  isHr,
  summary: initialSummary,
}: {
  todayRecord: Record | null
  history: Record[]
  isHr: boolean
  todayAll: TodayAll
  names: Map<string, string>
  summary: Summary
}) {
  const [todayRecord, setTodayRecord] = useState(initialToday)
  const [history, setHistory] = useState(initialHistory)
  const [summary, setSummary] = useState(initialSummary)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const supabase = createClient()
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const since = thirtyDaysAgo.toISOString().slice(0, 10)
    const today = new Date().toISOString().slice(0, 10)

    const { data: me } = await supabase.from('me').select('id').maybeSingle()
    if (!me) return

    const [
      { data: myRecords },
      { data: allRecords },
      { data: people },
    ] = await Promise.all([
      supabase
        .from('attendance')
        .select('id, clock_in, clock_out, date, note')
        .eq('person_id', me.id)
        .gte('date', since)
        .order('date', { ascending: false }),
      isHr
        ? supabase
            .from('attendance')
            .select('id, person_id, clock_in, clock_out, date, note')
            .gte('date', since)
            .order('date', { ascending: false })
        : Promise.resolve({ data: null }),
      isHr
        ? supabase.from('people').select('id, full_name')
        : Promise.resolve({ data: null }),
    ])

    const todayRec = (myRecords ?? []).find((r: Record) => r.date === today) ?? null
    setTodayRecord(todayRec)
    setHistory((myRecords ?? []).filter((r: Record) => r.date !== today))

    if (isHr) {
      const todayAllRecs = (allRecords ?? []).filter((r: Record) => r.date === today)
      setSummary(
        (people ?? []).map((p: { id: string; full_name: string }) => {
          const rec = todayAllRecs.find((r) => r.person_id === p.id)
          return {
            id: p.id,
            name: p.full_name,
            clockedIn: rec ? !rec.clock_out : false,
            clock_in: rec?.clock_in ?? null,
            clock_out: rec?.clock_out ?? null,
          }
        })
      )
    }
  }, [isHr])

  async function clockIn() {
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error: rpcError } = await supabase.rpc('clock_in')
    setLoading(false)
    if (rpcError) {
      setError(rpcError.message)
    } else {
      await refresh()
    }
  }

  async function clockOut() {
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error: rpcError } = await supabase.rpc('clock_out')
    setLoading(false)
    if (rpcError) {
      setError(rpcError.message)
    } else {
      await refresh()
    }
  }

  const clockedIn = todayRecord && !todayRecord.clock_out

  return (
    <>
      {error && (
        <div className="banner banner--error mb-5" role="alert">
          <span aria-hidden="true">⚠️</span>
          <span>
            <b>Something went wrong.</b> {error}
          </span>
        </div>
      )}

      {/* ---- Clock in / out button ---- */}
      <div className="card">
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 'var(--s-4)',
            padding: 'var(--s-5) 0',
          }}
        >
          {todayRecord ? (
            <div style={{ textAlign: 'center' }}>
              <div className="t-subtle" style={{ marginBottom: 'var(--s-2)' }}>
                {clockedIn ? 'Clocked in' : 'Clocked out'}
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                {fmtTime(todayRecord.clock_in)}
                {todayRecord.clock_out && (
                  <> – {fmtTime(todayRecord.clock_out)}</>
                )}
              </div>
              {todayRecord.clock_out && (
                <div className="t-subtle" style={{ marginTop: 'var(--s-1)' }}>
                  {duration(todayRecord.clock_in, todayRecord.clock_out)} today
                </div>
              )}
            </div>
          ) : (
            <div className="t-subtle">Not clocked in yet today</div>
          )}

          <button
            className={`btn ${clockedIn ? 'btn--secondary' : 'btn--primary'}`}
            type="button"
            disabled={loading}
            onClick={clockedIn ? clockOut : clockIn}
            style={{ fontSize: '1.1rem', padding: 'var(--s-3) var(--s-6)' }}
          >
            {loading
              ? 'Working…'
              : clockedIn
                ? 'Clock out'
                : 'Clock in'}
          </button>
        </div>
      </div>

      {/* ---- HR: today's summary ---- */}
      {isHr && summary.length > 0 && (
        <div className="card card--flush mt-5">
          <div style={{ padding: 'var(--s-5) var(--s-5) var(--s-3)' }}>
            <div className="card__title">Today — all employees</div>
            <div className="card__sub">
              {summary.filter((s) => s.clockedIn).length} clocked in
            </div>
          </div>
          <div className="table-scroll">
            <table className="data-table">
              <caption className="sr-only">
                Today&apos;s attendance for all employees
              </caption>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Status</th>
                  <th scope="col">Clock In</th>
                  <th scope="col">Clock Out</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((s) => (
                  <tr key={s.id}>
                    <th scope="row" style={{ fontWeight: 600 }}>
                      {s.name}
                    </th>
                    <td>
                      <span
                        className={s.clockedIn ? 'chip chip--accent' : 'chip'}
                      >
                        {s.clockedIn ? 'In' : s.clock_in ? 'Out' : '—'}
                      </span>
                    </td>
                    <td>{fmtTime(s.clock_in)}</td>
                    <td>{fmtTime(s.clock_out)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---- History ---- */}
      {history.length > 0 ? (
        <div className="card card--flush mt-5">
          <div style={{ padding: 'var(--s-5) var(--s-5) var(--s-3)' }}>
            <div className="card__title">Recent attendance</div>
            <div className="card__sub">Last 30 days</div>
          </div>
          <div className="table-scroll">
            <table className="data-table">
              <caption className="sr-only">
                Your attendance history
              </caption>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Clock In</th>
                  <th scope="col">Clock Out</th>
                  <th scope="col">Duration</th>
                </tr>
              </thead>
              <tbody>
                {history.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>{fmtDate(r.date)}</td>
                    <td>{fmtTime(r.clock_in)}</td>
                    <td>{fmtTime(r.clock_out)}</td>
                    <td>{duration(r.clock_in, r.clock_out)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        !todayRecord && (
          <div className="mt-5">
            <Empty icon="🕘" title="No attendance yet">
              Clock in to start tracking your hours.
            </Empty>
          </div>
        )
      )}
    </>
  )
}
