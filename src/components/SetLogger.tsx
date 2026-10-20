import { useState } from 'react'
import type { Exercise } from '../../content/schema'
import type { SetLog, Settings } from '../lib/types'

const setupLabels = { trx_angle: 'TRX angle (step position)', box_height: 'Box height (cm)', incline_height: 'Incline height (cm)', foot_elevation: 'Foot elevation (cm)' }

// edits an already logged set (both sides for per-side exercises); saves on Close
type Props = { exercise: Exercise; logs: SetLog[]; settings: Settings; onSave: (logs: SetLog[]) => void }

export default function SetLogger({ exercise, logs, settings, onSave }: Props) {
  const first = logs[0]
  const timed = first.seconds !== undefined
  const { loggable } = exercise
  const [amount, setAmount] = useState(first.seconds ?? first.reps ?? 0)
  const [weight, setWeight] = useState(first.weightKg !== undefined ? String(first.weightKg) : '')
  const [bandIds, setBandIds] = useState(first.bandIds ?? [])
  const [setup, setSetup] = useState(first.setup ?? '')
  const [note, setNote] = useState(first.note ?? '')

  function save() {
    onSave(logs.map(({ weightKg: _w, bandIds: _b, setup: _s, note: _n, ...l }) => ({
      ...l,
      ...(timed ? { seconds: amount } : { reps: amount }),
      ...(loggable.weight && weight !== '' && { weightKg: Number(weight) }),
      ...(loggable.band && bandIds.length > 0 && { bandIds }),
      ...(loggable.setup && setup !== '' && { setup }),
      ...(note !== '' && { note }),
    })))
  }

  const bands = [...settings.bands].sort((a, b) => a.order - b.order)
  const perSide = exercise.mode.endsWith('_per_side') ? ' per side' : ''

  return (
    <div className="logger">
      <label>{timed ? 'Seconds' : 'Reps'}{perSide} <input type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></label>
      {loggable.weight && <label>Weight (kg) <input type="number" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} /></label>}
      {loggable.band && (bands.length === 0
        ? <p className="muted">Add bands in Settings</p>
        : <div className="row">{bands.map((b) => (
            <button key={b.id} className={bandIds.includes(b.id) ? 'primary' : ''}
              onClick={() => setBandIds(bandIds.includes(b.id) ? bandIds.filter((x) => x !== b.id) : [...bandIds, b.id])}>
              {b.label}
            </button>
          ))}</div>)}
      {loggable.setup && <label>{setupLabels[loggable.setup]} <input value={setup} onChange={(e) => setSetup(e.target.value)} /></label>}
      <input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      <button className="primary wide" onClick={save}>Close</button>
    </div>
  )
}
