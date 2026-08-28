'use client'

import { useEffect, useState } from 'react'

export type TrendRow = {
  id: string
  created_at: string
  day: string
  mood: number | null
  energy: number | null
  pressure: number | null
  workload: number | null
}

const METRICS = [
  { key: 'mood', label: 'Mood' },
  { key: 'energy', label: 'Energy' },
  { key: 'pressure', label: 'Pressure' },
  { key: 'workload', label: 'Workload' },
] as const

type Metric = (typeof METRICS)[number]['key']

// One chart's box. Small on purpose: four of these side by side is what
// makes them comparable, and a shape you can take in at a glance is worth
// more here than a big one you have to read.
const W = 240
const H = 92
const PAD_L = 18
const PAD_R = 6
const PAD_T = 10
const PAD_B = 20
const X0 = PAD_L
const X1 = W - PAD_R
const Y0 = PAD_T
const Y1 = H - PAD_B

/** The scale every metric is answered on. Fixed, never fitted to the data:
 *  a chart that rescales to its own range turns a 3.2-to-3.4 wobble into a
 *  dramatic climb, which is exactly the kind of false story this page is
 *  supposed to refuse to tell. */
const LOW = 1
const HIGH = 5

function xAt(i: number, n: number) {
  if (n <= 1) return (X0 + X1) / 2
  return X0 + (i / (n - 1)) * (X1 - X0)
}

function yAt(v: number) {
  return Y1 - ((v - LOW) / (HIGH - LOW)) * (Y1 - Y0)
}

function clamp(v: number) {
  return Math.min(HIGH, Math.max(LOW, v))
}

/** Mean and spread of what was actually recorded. Nulls are skipped rather
 *  than counted as zero — a question you left blank is not a low answer. */
function stats(values: (number | null)[]) {
  const got = values.filter((v): v is number => v !== null)
  if (!got.length) return null
  const mean = got.reduce((a, b) => a + b, 0) / got.length
  const variance =
    got.reduce((a, b) => a + (b - mean) * (b - mean), 0) / got.length
  return { mean, sd: Math.sqrt(variance), n: got.length }
}

/** Runs of consecutive entries that both have a value, so a skipped
 *  question leaves a gap in the line instead of a straight segment drawn
 *  through days nothing was said about. */
function runs(values: (number | null)[]) {
  const out: { i: number; v: number }[][] = []
  let current: { i: number; v: number }[] = []
  values.forEach((v, i) => {
    if (v === null) {
      if (current.length) out.push(current)
      current = []
    } else {
      current.push({ i, v })
    }
  })
  if (current.length) out.push(current)
  return out
}

function when(row: TrendRow) {
  const date = new Date(row.day + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  })
  const time = new Date(row.created_at).toLocaleTimeString('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
  })
  return `${date}, ${time}`
}

/**
 * Your typical day, and every day against it.
 *
 * Four small charts rather than one with four lines on it. They share a
 * scale, so the shapes are directly comparable, and each keeps a line of
 * its own instead of four colours fighting over the same 1-to-5 band.
 *
 * They also share a cursor: pointing at any one of them moves the marker on
 * all four and swaps the four big numbers from your averages to that single
 * check-in. That is the whole interaction — the averages are the resting
 * state, and a moment in your own record is one hover away.
 */
export function TrendCharts({ rows }: { rows: TrendRow[] }) {
  // Oldest first. `rows` arrives newest-first because that is the order the
  // table below wants; time has to run left-to-right here.
  const chron = [...rows].reverse()
  const n = chron.length

  const [at, setAt] = useState<number | null>(null)
  const here = at === null ? null : chron[at]

  // The lines draw themselves in, but only once a frame has been painted.
  // requestAnimationFrame is the check: it fires when the document is
  // actually being rendered, so anywhere it never fires — a tab that is
  // never composited, a print — the chart is simply already drawn instead
  // of being an animation nobody is there to watch, with the data hidden
  // behind it.
  const [drawing, setDrawing] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setDrawing(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  const summary = METRICS.map((m) => ({
    ...m,
    stat: stats(chron.map((r) => r[m.key])),
  }))

  function move(delta: number) {
    setAt((prev) => {
      const next = prev === null ? n - 1 : prev + delta
      return Math.min(n - 1, Math.max(0, next))
    })
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowLeft') move(-1)
    else if (e.key === 'ArrowRight') move(1)
    else if (e.key === 'Home') setAt(0)
    else if (e.key === 'End') setAt(n - 1)
    else if (e.key === 'Escape') setAt(null)
    else return
    e.preventDefault()
  }

  return (
    <div className="card">
      <div className="card__head">
        <div>
          <h2 className="card__title">Your typical day</h2>
          <div className="card__sub">
            {here
              ? when(here)
              : `Averaged across your last ${n} check-in${n === 1 ? '' : 's'}`}
          </div>
        </div>
      </div>

      <div
        className={drawing ? 'trends trends--drawing' : 'trends'}
        tabIndex={0}
        role="group"
        aria-label="Your check-ins over time. Use the arrow keys to step through them."
        onKeyDown={onKeyDown}
        onBlur={() => setAt(null)}
        onPointerLeave={() => setAt(null)}
        onPointerCancel={() => setAt(null)}
      >
        <div className="grid grid--4">
          {summary.map(({ key, label, stat }) => (
            <Cell
              key={key}
              metric={key}
              label={label}
              stat={stat}
              chron={chron}
              at={at}
              setAt={setAt}
            />
          ))}
        </div>
      </div>

      <div className="legend">
        <span className="legend__item">
          <span className="legend__swatch" aria-hidden="true" />
          Each check-in
        </span>
        <span className="legend__item">
          <span className="legend__swatch legend__swatch--context" aria-hidden="true" />
          Your average
        </span>
        <span className="legend__item">
          <span className="legend__swatch legend__swatch--band" aria-hidden="true" />
          Where most of your entries sit
        </span>
      </div>

      <p className="chart__caption">
        Point at a chart, or use the arrow keys, to read one check-in. Nothing
        here is a score, and nothing is compared to anyone else.
      </p>
    </div>
  )
}

function Cell({
  metric,
  label,
  stat,
  chron,
  at,
  setAt,
}: {
  metric: Metric
  label: string
  stat: { mean: number; sd: number; n: number } | null
  chron: TrendRow[]
  at: number | null
  setAt: (i: number | null) => void
}) {
  const n = chron.length
  const values = chron.map((r) => r[metric])
  const shown = at === null ? stat && stat.mean.toFixed(1) : values[at]

  // The band is one standard deviation either side of the average, clamped
  // to the scale. Descriptive, not a target: it says where this person's
  // answers usually land, which is the only thing on the page that gives
  // the line something to be read against.
  const band =
    stat && stat.n > 1
      ? { lo: clamp(stat.mean - stat.sd), hi: clamp(stat.mean + stat.sd) }
      : null

  function onPointerMove(e: React.PointerEvent<SVGRectElement>) {
    const box = e.currentTarget.getBoundingClientRect()
    if (!box.width) return
    const t = (e.clientX - box.left) / box.width
    setAt(Math.min(n - 1, Math.max(0, Math.round(t * (n - 1)))))
  }

  return (
    <div className="trends__cell">
      <div className="trends__label">{label}</div>
      <div className="trends__value t-num">{shown ?? '—'}</div>

      <div className="chart">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={
            stat
              ? `${label} over your last ${n} check-ins, averaging ${stat.mean.toFixed(1)} out of 5.`
              : `${label}: nothing recorded yet.`
          }
        >
          {band && (
            <rect
              className="chart-band"
              x={X0}
              y={yAt(band.hi)}
              width={X1 - X0}
              height={Math.max(1, yAt(band.lo) - yAt(band.hi))}
            />
          )}

          {[5, 3, 1].map((v) => (
            <g key={v}>
              <line
                className="chart-grid-line"
                x1={X0}
                x2={X1}
                y1={yAt(v)}
                y2={yAt(v)}
              />
              <text
                className="chart-tick"
                x={X0 - 6}
                y={yAt(v) + 4}
                textAnchor="end"
              >
                {v}
              </text>
            </g>
          ))}

          {stat && (
            <line
              className="chart-line chart-line--context"
              x1={X0}
              x2={X1}
              y1={yAt(stat.mean)}
              y2={yAt(stat.mean)}
            />
          )}

          {runs(values).map((run, i) => (
            <polyline
              key={i}
              className="chart-line trends__draw"
              pathLength={1}
              points={run.map((p) => `${xAt(p.i, n)},${yAt(p.v)}`).join(' ')}
            />
          ))}

          {values.map((v, i) =>
            v === null ? null : (
              <circle
                key={i}
                className="chart-dot"
                cx={xAt(i, n)}
                cy={yAt(v)}
                r={i === at ? 4.5 : i === n - 1 ? 3 : 2}
              />
            ),
          )}

          {at !== null && (
            <line
              className="chart-crosshair"
              x1={xAt(at, n)}
              x2={xAt(at, n)}
              y1={Y0 - 4}
              y2={Y1 + 4}
            />
          )}

          <rect
            className="chart-hit"
            x={X0}
            y={0}
            width={X1 - X0}
            height={H}
            onPointerMove={onPointerMove}
          />
        </svg>
      </div>
    </div>
  )
}
