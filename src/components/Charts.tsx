export type Point = { week: string; value: number }
export type Series = { label: string; points: Point[] }
export type Marker = Point & { label: string }

// byDay: week holds a day number (cycle day) instead of an ISO week start
type Props = { series: Series[]; unit: string; yLabel: string; markers?: Marker[]; step?: boolean; byDay?: boolean }

const [W, H, L, R, T, B] = [320, 160, 34, 30, 18, 24]

// one point per week, at most 2 series; x is spaced by date so gaps show
export function WeeklyChart({ series, unit, yLabel, markers = [], step = false, byDay = false }: Props) {
  const time = (week: string) => (byDay ? Number(week) : Date.parse(week + 'T00:00:00'))
  const short = (week: string) => (byDay ? `day ${week}` : new Date(time(week)).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }))
  const shown = series.slice(0, 2).filter((s) => s.points.length > 0)
  const weeks = [...new Set([...shown.flatMap((s) => s.points), ...markers].map((p) => p.week))].sort((a, b) => time(a) - time(b))
  if (new Set(shown.flatMap((s) => s.points.map((p) => p.week))).size < 2) return <p className="muted small">Train 2 weeks to see a trend</p>
  const values = [...shown.flatMap((s) => s.points), ...markers].map((p) => p.value)
  let [lo, hi] = [Math.min(...values), Math.max(...values)]
  if (lo === hi) [lo, hi] = [lo - 1, hi + 1]
  const [t0, t1] = [time(weeks[0]), time(weeks.at(-1)!)]
  const x = (week: string) => L + ((time(week) - t0) / (t1 - t0)) * (W - L - R)
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B)
  const path = (ps: Point[]) => ps.map((p, i) => (i === 0 ? `M${x(p.week)},${y(p.value)}` : step ? `H${x(p.week)}V${y(p.value)}` : `L${x(p.week)},${y(p.value)}`)).join('')

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${yLabel} per ${byDay ? 'cycle day' : 'week'}`}>
      <text x={0} y={11} className="chart-label">{yLabel} ({unit})</text>
      <line x1={L} x2={W - R} y1={H - B} y2={H - B} className="chart-axis" />
      <line x1={L} x2={L} y1={T} y2={H - B} className="chart-axis" />
      {[lo, hi].map((v) => <text key={v} x={L - 4} y={y(v) + 4} textAnchor="end" className="chart-label">{Math.round(v * 10) / 10}</text>)}
      {[weeks[0], weeks.at(-1)!].map((w, i) => <text key={w} x={x(w)} y={H - 6} textAnchor={i ? 'end' : 'start'} className="chart-label">{short(w)}</text>)}
      {shown.map((s, i) => {
        const end = s.points.at(-1)!
        return (
          <g key={s.label}>
            <path d={path(s.points)} fill="none" stroke="currentColor" strokeWidth={2} strokeDasharray={i ? '5 3' : undefined} />
            {s.points.map((p) => <circle key={p.week} cx={x(p.week)} cy={y(p.value)} r={2.5} fill="currentColor" />)}
            <text x={x(end.week) + 4} y={y(end.value) + 4} className="chart-label">{s.label}</text>
          </g>
        )
      })}
      {markers.map((m, i) => (
        <g key={i}>
          <circle cx={x(m.week)} cy={y(m.value)} r={4.5} className="chart-marker" />
          <text x={x(m.week)} y={y(m.value) - 7} textAnchor="middle" className="chart-label">{m.label}</text>
        </g>
      ))}
    </svg>
  )
}
