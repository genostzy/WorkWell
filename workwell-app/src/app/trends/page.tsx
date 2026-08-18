import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { readIsHr } from '@/lib/role'
import { Empty, LoadError, PageHead, PlaneBadge, PrivacyNote, RoleLocked } from '@/components/chrome'
import { Shell } from '@/components/shell'
import { QuickMood } from './quick-mood'

/** The PRD is explicit that we say "not enough data yet" rather than
 *  guess. Four entries cannot describe a pattern. */
const ENOUGH = 5

const METRICS = [
  { key: 'mood' as const, label: 'Mood' },
  { key: 'energy' as const, label: 'Energy' },
  { key: 'pressure' as const, label: 'Pressure' },
  { key: 'workload' as const, label: 'Workload' },
]

type Metric = 'mood' | 'energy' | 'pressure' | 'workload'

type Row = {
  day: string
  mood: number | null
  energy: number | null
  pressure: number | null
  workload: number | null
  note: string | null
}

function average(rows: Row[], key: Metric) {
  const values = rows.map((r) => r[key]).filter((v): v is number => v !== null)
  if (!values.length) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

/** Rule-based, not modelled — the PRD's "no score" promise applies here
 *  too, so this compares you only against your own last stretch, states
 *  exactly which numbers moved, and never reduces it to a single figure.
 *  Two or more genuine moves before it says anything at all, so a single
 *  rough week never reads as a pattern. */
const RECENT = 5
const PATTERN_THRESHOLD = 0.75
const WORSE_WHEN_LOWER: Metric[] = ['mood', 'energy']
const WORSE_WHEN_HIGHER: Metric[] = ['pressure', 'workload']
const PHRASE: Record<Metric, string> = {
  mood: 'lower on mood',
  energy: 'lower on energy',
  pressure: 'higher on pressure',
  workload: 'higher on workload',
}

function describeSignals(keys: Metric[]) {
  const parts = keys.map((k) => PHRASE[k])
  if (parts.length === 1) return parts[0]
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

function patternSignals(rows: Row[]) {
  const recent = rows.slice(0, RECENT)
  const baseline = rows.slice(RECENT)
  if (baseline.length < RECENT) return []

  const signals: Metric[] = []
  for (const key of WORSE_WHEN_LOWER) {
    const r = average(recent, key)
    const b = average(baseline, key)
    if (r != null && b != null && b - r >= PATTERN_THRESHOLD) signals.push(key)
  }
  for (const key of WORSE_WHEN_HIGHER) {
    const r = average(recent, key)
    const b = average(baseline, key)
    if (r != null && b != null && r - b >= PATTERN_THRESHOLD) signals.push(key)
  }
  return signals
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

  // Independent reads — run together rather than paying two round trips
  // for a page that used to need only one.
  const [{ isHr, error: roleError }, { data, error }] = await Promise.all([
    readIsHr(supabase),
    supabase
      .from('check_ins')
      .select('day, mood, energy, pressure, workload, note')
      .order('day', { ascending: false })
      .limit(30),
  ])

  if (roleError) {
    return (
      <Shell plane="private">
        <PageHead title="Your trends" />
        <LoadError what="Your account" detail={roleError} />
      </Shell>
    )
  }

  if (isHr) {
    return (
      <Shell plane="work" isHr>
        <PageHead title="Not available on this account" />
        <RoleLocked audience="employee" />
      </Shell>
    )
  }

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
        <QuickMood />
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
  const signals = patternSignals(rows)

  const today = new Date().toISOString().slice(0, 10)
  const todayRow = rows.find((r) => r.day === today)
  const showQuickMood = !todayRow || todayRow.mood == null

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

      {showQuickMood && <QuickMood />}

      {signals.length > 0 && (
        <div className="card card--accent">
          <div className="card__title mb-2">Worth noticing</div>
          <p className="t-subtle">
            Your last {RECENT} check-ins run {describeSignals(signals)} than
            the weeks before them. Not a score, not a diagnosis — a pattern
            in your own numbers, against nobody but yourself. Nothing happens
            because of this, and nobody else sees it.
          </p>
        </div>
      )}

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
