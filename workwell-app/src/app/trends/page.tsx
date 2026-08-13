import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Empty, LoadError, PageHead, PlaneBadge, PrivacyNote } from '@/components/chrome'
import { Shell } from '@/components/shell'

/** The PRD is explicit that we say "not enough data yet" rather than
 *  guess. Four entries cannot describe a pattern. */
const ENOUGH = 5

const METRICS = [
  { key: 'mood' as const, label: 'Mood' },
  { key: 'energy' as const, label: 'Energy' },
  { key: 'pressure' as const, label: 'Pressure' },
  { key: 'workload' as const, label: 'Workload' },
]

type Row = {
  day: string
  mood: number | null
  energy: number | null
  pressure: number | null
  workload: number | null
  note: string | null
}

function average(rows: Row[], key: 'mood' | 'energy' | 'pressure' | 'workload') {
  const values = rows.map((r) => r[key]).filter((v): v is number => v !== null)
  if (!values.length) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

function Bar({ value }: { value: number | null }) {
  return (
    <span className="meter__track">
      <span
        className="meter__fill"
        style={{ width: value ? `${(value / 5) * 100}%` : '0%' }}
      />
    </span>
  )
}

export default async function Trends() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('check_ins')
    .select('day, mood, energy, pressure, workload, note')
    .order('day', { ascending: false })
    .limit(30)

  if (error) {
    return (
      <Shell current="trends">
        <PageHead title="Your trends" />
        <PlaneBadge plane="private" />
        <LoadError what="Your check-ins" detail={error.message} />
      </Shell>
    )
  }

  const rows: Row[] = data ?? []

  if (rows.length === 0) {
    return (
      <Shell current="trends">
        <PageHead title="Your trends" />
        <PlaneBadge plane="private" />
        <Empty
          title="Nothing here yet"
          action={
            <Link className="btn btn--primary" href="/check-in">
              Check in
            </Link>
          }
        >
          Your first check-in starts the record. It stays yours.
        </Empty>
      </Shell>
    )
  }

  const enough = rows.length >= ENOUGH

  return (
    <Shell current="trends">
      <PageHead
        title="Your trends"
        lead={
          enough
            ? `Your last ${rows.length} check-ins, against your own baseline.`
            : `${rows.length} check-in${rows.length === 1 ? '' : 's'} so far.`
        }
      />

      <PlaneBadge plane="private" />

      <PrivacyNote>
        <b>None of this is visible to your employer.</b>{' '}
      </PrivacyNote>

      {enough ? (
        <div className="card">
          <div className="card__head">
            <div>
              <div className="card__title">Your typical day</div>
              <div className="card__sub">
                Averaged across everything you have recorded
              </div>
            </div>
          </div>
          <p className="t-subtle mb-4">
            There is no score here, and no comparison to anyone else.
          </p>
          {METRICS.map((m) => {
            const avg = average(rows, m.key)
            return (
              <div className="metric" key={m.key}>
                <span>{m.label}</span>
                <Bar value={avg} />
                <b className="t-num">{avg ? avg.toFixed(1) : '—'}</b>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="card card--quiet">
          <div className="card__title mb-2">Not enough data yet</div>
          <p className="t-subtle">
            {ENOUGH - rows.length} more check-in
            {ENOUGH - rows.length === 1 ? '' : 's'} and a pattern can be
            described honestly. Until then, here is exactly what you recorded —
            better to show you nothing than to guess.
          </p>
        </div>
      )}

      <div className="card card--flush mt-5">
        <div style={{ padding: 'var(--s-5) var(--s-5) var(--s-3)' }}>
          <div className="card__title">Every entry</div>
          <div className="card__sub">Most recent first</div>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <caption className="sr-only">Your check-in history</caption>
            <thead>
              <tr>
                <th scope="col">Day</th>
                <th scope="col">Mood</th>
                <th scope="col">Energy</th>
                <th scope="col">Pressure</th>
                <th scope="col">Workload</th>
                <th scope="col">Note</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.day}>
                  <th scope="row" style={{ fontWeight: 600 }}>
                    {new Date(r.day + 'T00:00:00').toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </th>
                  <td className="t-num">{r.mood ?? '—'}</td>
                  <td className="t-num">{r.energy ?? '—'}</td>
                  <td className="t-num">{r.pressure ?? '—'}</td>
                  <td className="t-num">{r.workload ?? '—'}</td>
                  <td className="t-subtle">{r.note ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Shell>
  )
}
