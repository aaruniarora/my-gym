import { useState } from 'react'
import { exerciseById } from '../content'
import type { BlockKind, SessionPlan, Settings } from '../lib/types'
import Info from './Info'
import { modeLabel } from './labels'
import TechniqueCard from './TechniqueCard'

const LABELS: Partial<Record<BlockKind, string>> = { warmup: 'Warm-up', skill: 'Skill practice', cooldown: 'Flexibility cool-down', balance: 'Balance', spring: 'Spring' }
const INFO: Partial<Record<BlockKind, string>> = {
  skill: 'Short, fresh practice of a skill such as handstand; quality over fatigue.',
  cooldown: "Stretching sized to your session; rotates by what you've done least this week.",
}

type Props = { plan: SessionPlan; settings: Settings; onSettings: (s: Settings) => void }

export default function Preview({ plan, settings, onSettings }: Props) {
  const [open, setOpen] = useState<string>()

  return (
    <div>
      <p className="muted">{plan.dayType === 'movement' ? 'Movement day' : plan.dayType.replace('_', ' ')} · {modeLabel(plan.mode)} · {plan.location} · about {Math.round(plan.estSeconds / 60)} min (target {plan.minutesTarget})</p>
      {plan.blocks.map((b, i) => (
        <section key={i}>
          <h3>{LABELS[b.kind] ?? b.kind.replace('_', ' ')}{INFO[b.kind] && <> <Info text={INFO[b.kind]!} /></>}</h3>
          <ul className="plan">
            {b.exercises.map((pe, j) => {
              const ex = exerciseById[pe.exerciseId]
              const dose = pe.seconds !== undefined ? `${pe.seconds} s` : pe.reps?.[0] === pe.reps?.[1] ? `${pe.reps?.[0]}` : `${pe.reps?.[0]}-${pe.reps?.[1]}`
              return (
                <li key={j}>
                  <button className="link" onClick={() => setOpen(pe.exerciseId)}>{ex?.name ?? pe.exerciseId}</button>
                  {' '}{pe.sets} x {dose}{ex?.mode.endsWith('_per_side') && ' per side'} · rest {pe.restSeconds} s
                </li>
              )
            })}
          </ul>
        </section>
      ))}
      {open && exerciseById[open] && (
        <div className="overlay">
          <button className="wide" onClick={() => setOpen(undefined)}>Close</button>
          <TechniqueCard exercise={exerciseById[open]} settings={settings} onSettings={onSettings} />
        </div>
      )}
    </div>
  )
}
