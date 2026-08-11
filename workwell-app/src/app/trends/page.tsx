import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PrivacyNote, Shell } from '@/components/chrome'

/** The PRD is explicit that we say "not enough data yet" rather than
 *  guess. Four entries cannot describe a pattern, so below that we show
 *  the entries themselves and draw no conclusion. */
const ENOUGH = 5

const METRICS = [
  { key: 'mood' as const, label: 'Mood' },
  { key: 'energy' as const, label: 'Energy' },
  { key: 'pressure' as const, label: 'Pressure' },
]

type Row = {
  day: string
  mood: number | null
  energy: number | null
  pressure: number | null
  note: string | null
}

function average(rows: Row[], key: 'mood' | 'energy' | 'pressure') {
  const values = rows.map((r) => r[key]).filter((v): v is number => v !== null)
  if (!values.length) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

export default async function Trends() {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()

  if (!claims) {
    return (
      <div className="shell">
        <p className="state">
          <Link href="/sign-in">Sign in</Link> to see your trends.
        </p>
      </div>
    )
  }

  const { data } = await supabase
    .from('check_ins')
    .select('day, mood, energy, pressure, note')
    .order('day', { ascending: false })
    .limit(30)

  const rows: Row[] = data ?? []

  if (rows.length === 0) {
    return (
      <Shell current="trends">
        <h1>Your trends</h1>
        <PrivacyNote />
        <div className="card">
          <div className="state">
            <p><b>Nothing here yet.</b></p>
            <p className="muted mt">
              Your first check-in starts the record. Nothing is shared with
              anyone, ever.
            </p>
            <div className="mt">
              <Link className="btn" href="/check-in">
                Check in
              </Link>
            </div>
          </div>
        </div>
      </Shell>
    )
  }

  const enough = rows.length >= ENOUGH

  return (
    <Shell current="trends">
      <h1>Your trends</h1>
      <p className="lead">
        {enough
          ? `Your last ${rows.length} check-ins, against your own baseline.`
          : `${rows.length} check-in${rows.length === 1 ? '' : 's'} so far.`}
      </p>

      <PrivacyNote />

      {enough ? (
        <div className="card">
          <div className="card__title">Your typical day</div>
          <p className="card__sub">
            The average of everything you have recorded. There is no score and
            no comparison to anyone else.
          </p>
          <div className="bars mt">
            {METRICS.map((m) => {
              const avg = average(rows, m.key)
              return (
                <div className="bar" key={m.key}>
                  <span>{m.label}</span>
                  <span className="bar__track">
                    <span
                      className="bar__fill"
                      style={{ width: avg ? `${(avg / 5) * 100}%` : '0%' }}
                    />
                  </span>
                  <span>{avg ? avg.toFixed(1) : '—'}</span>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card__title">Not enough data yet</div>
          <p className="card__sub">
            {ENOUGH - rows.length} more check-in
            {ENOUGH - rows.length === 1 ? '' : 's'} and we can describe a
            pattern. Until then, here is what you recorded — we would rather
            show you nothing than guess.
          </p>
        </div>
      )}

      <div className="card">
        <div className="card__title">Every entry</div>
        <div className="rows mt">
          {rows.map((r) => (
            <div className="row" key={r.day}>
              <span className="row__day">
                {new Date(r.day + 'T00:00:00').toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                })}
              </span>
              <div className="bars">
                {METRICS.map((m) => (
                  <div className="bar" key={m.key}>
                    <span>{m.label}</span>
                    <span className="bar__track">
                      <span
                        className="bar__fill"
                        style={{
                          width: r[m.key] ? `${(r[m.key]! / 5) * 100}%` : '0%',
                        }}
                      />
                    </span>
                    <span>{r[m.key] ?? '—'}</span>
                  </div>
                ))}
                {r.note && <p className="muted">{r.note}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  )
}
