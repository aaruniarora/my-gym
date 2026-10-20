import { exerciseById } from '../content'
import type { SessionRecord, SetLog } from '../lib/types'

type Props = { record: SessionRecord; logs: SetLog[]; events: string[]; onDone: () => void }

export default function Summary({ record, logs, events, onDone }: Props) {
  const { plan } = record
  const actual = record.endedAt ? Math.round((Date.parse(record.endedAt) - Date.parse(record.startedAt)) / 60000) : 0
  // per-side exercises log both sides; count the pair as one set
  const sets = logs.filter((l) => l.side !== 'left')
  const best: Record<string, SetLog> = {}
  for (const l of logs) {
    const b = best[l.exerciseId]
    if (!b || (l.reps ?? l.seconds ?? 0) > (b.reps ?? b.seconds ?? 0)) best[l.exerciseId] = l
  }

  return (
    <main>
      <h2>Saved</h2>
      <p>{new Date(record.startedAt).toLocaleDateString()} · {plan.dayType.replace('_', ' ')} · {plan.mode} · {plan.location}</p>
      <p>{plan.minutesTarget} min planned, {actual} min actual · {sets.length} sets</p>
      <h3>Best sets</h3>
      <ul>
        {Object.values(best).map((l) => (
          <li key={l.exerciseId}>{exerciseById[l.exerciseId]?.name ?? l.exerciseId}: {l.reps !== undefined ? `${l.reps} reps` : `${l.seconds} s`}</li>
        ))}
      </ul>
      <h3>Progression</h3>
      {events.length === 0 ? <p className="muted">No changes this time.</p> : <ul>{events.map((e) => <li key={e}>{e}</li>)}</ul>}
      <button className="primary wide" onClick={onDone}>Done</button>
    </main>
  )
}
