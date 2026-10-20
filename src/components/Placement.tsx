import { useState } from 'react'
import { exerciseById, skillTrees } from '../content'
import { currentStep } from '../lib/progression'
import type { Settings, SkillProgress } from '../lib/types'

type Props = { settings: Settings; progress: SkillProgress[]; onSave: (progress: SkillProgress[], settings: Settings) => void; onCancel?: () => void }

const BESTS: [string, string][] = [
  ['plank', 's'], ['hollow-hold', 's'], ['pull-up', 'reps'], ['full-push-up', 'reps'], ['dip', 'reps'],
  ['chest-to-wall-handstand-hold', 's'], ['l-sit', 's'], ['hanging-leg-raise', 'reps'], ['dead-hang', 's'],
]

export default function Placement({ settings, progress, onSave, onCancel }: Props) {
  const [steps, setSteps] = useState<Record<string, number>>(() =>
    Object.fromEntries(skillTrees.map((t) => [t.id, progress.find((p) => p.treeId === t.id)?.stepIndex ?? 0])))
  const [bests, setBests] = useState(settings.bests)
  const placed: SkillProgress[] = skillTrees.map((t) => ({ treeId: t.id, stepIndex: steps[t.id], hits: 0, misses: 0 }))
  // untouched trees keep their hits, misses and drop-back
  const changed = placed.filter((p) => progress.find((x) => x.treeId === p.treeId)?.stepIndex !== p.stepIndex)
  const now = new Date()

  function setBest(id: string, value: string) {
    const { [id]: _, ...rest } = bests
    setBests(value === '' ? rest : { ...rest, [id]: Number(value) })
  }

  return (
    <main className="settings">
      <h2>Where are you now?</h2>
      <p className="muted">Pick the hardest step you can do with good form.</p>
      {skillTrees.map((t) => {
        const missing = currentStep(placed, t, now, bests).gateMissing
        return (
          <div key={t.id}>
            <label>{t.name}
              <select value={steps[t.id]} onChange={(e) => setSteps({ ...steps, [t.id]: Number(e.target.value) })}>
                {t.steps.map((s, i) => <option key={i} value={i}>{exerciseById[s.exerciseId]?.name ?? s.exerciseId}</option>)}
              </select>
            </label>
            {missing.length > 0 && <p className="muted">Locked until: {missing.join(', ')}</p>}
          </div>
        )
      })}

      <h3>My best</h3>
      {BESTS.map(([id, unit]) => (
        <label key={id}>{exerciseById[id]?.name ?? id} ({unit})
          <input type="number" inputMode="numeric" min={0} value={bests[id] ?? ''} onChange={(e) => setBest(id, e.target.value)} />
        </label>
      ))}

      <button className="primary wide" onClick={() => onSave(changed, { ...settings, bests, placed: true })}>Save</button>
      {onCancel && <button className="wide" onClick={onCancel}>Cancel</button>}
    </main>
  )
}
