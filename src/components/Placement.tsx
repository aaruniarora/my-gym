import { useState } from 'react'
import type { SkillTree } from '../../content/schema'
import { exerciseById, skillTrees, tests } from '../content'
import { currentStep } from '../lib/progression'
import type { Settings, SkillProgress } from '../lib/types'
import { CheckButton } from './SkillTrees'

type Props = {
  settings: Settings; progress: SkillProgress[]; onSave: (progress: SkillProgress[], settings: Settings) => void; onCancel?: () => void
  onRequestCheck: (treeId: string, side?: 'left' | 'right') => void
}

const BESTS: [string, string][] = [
  ['plank', 's'], ['hollow-hold', 's'], ['pull-up', 'reps'], ['full-push-up', 'reps'], ['dip', 'reps'],
  ['chest-to-wall-handstand-hold', 's'], ['l-sit', 's'], ['hanging-leg-raise', 'reps'], ['dead-hang', 's'],
  // movement tests are keyed by test id since the per-side ones share an exercise
  ['active-front-leg-raise-left', 'cm'], ['active-front-leg-raise-right', 'cm'], ['active-side-leg-raise-left', 'cm'], ['active-side-leg-raise-right', 'cm'],
  ['single-leg-balance-eyes-closed-left', 's'], ['single-leg-balance-eyes-closed-right', 's'], ['jump-rope-continuous', 's'],
]

// test metrics that measure flexibility, hidden with flexibility unticked
const FLEX_METRICS = ['cm_from_floor', 'cm_height']
const flexBest = (id: string) => FLEX_METRICS.includes(tests.find((t) => t.id === id)?.metric ?? '')
const SIDES = ['left', 'right'] as const
// per-side trees place each side separately
const slots = (t: SkillTree) => (t.perSide ? SIDES.map((side) => ({ side, key: `${t.id}:${side}` })) : [{ side: undefined, key: t.id }])

export default function Placement({ settings, progress, onSave, onCancel, onRequestCheck }: Props) {
  const [steps, setSteps] = useState<Record<string, number>>(() =>
    Object.fromEntries(skillTrees.flatMap((t) => slots(t).map(({ side, key }) => [key, progress.find((p) => p.treeId === t.id && p.side === side)?.stepIndex ?? 0]))))
  const [bests, setBests] = useState(settings.bests)
  const placed: SkillProgress[] = skillTrees.flatMap((t) => slots(t).map(({ side, key }) => ({ treeId: t.id, ...(side && { side }), stepIndex: steps[key], hits: 0, misses: 0 })))
  // untouched trees keep their hits, misses and drop-back
  const changed = placed.filter((p) => progress.find((x) => x.treeId === p.treeId && x.side === p.side)?.stepIndex !== p.stepIndex)
  const now = new Date()
  const flex = settings.focus?.flexibility !== false

  function setBest(id: string, value: string) {
    const { [id]: _, ...rest } = bests
    setBests(value === '' ? rest : { ...rest, [id]: Number(value) })
  }

  return (
    <main className="settings">
      <h2>Where are you now?</h2>
      <p className="muted">Pick the hardest step you can do with good form.</p>
      {skillTrees.filter((t) => flex || t.kind !== 'flexibility').flatMap((t) => slots(t).map(({ side, key }) => {
        const missing = currentStep(placed, t, now, bests, side).gateMissing
        return (
          <div key={key}>
            <label>{t.name}{side && ` - ${side === 'left' ? 'Left' : 'Right'}`}
              <select value={steps[key]} onChange={(e) => setSteps({ ...steps, [key]: Number(e.target.value) })}>
                {t.steps.map((s, i) => <option key={i} value={i}>{exerciseById[s.exerciseId]?.name ?? s.exerciseId}</option>)}
              </select>
            </label>
            {missing.length > 0 && <p className="muted">Locked until: {missing.join(', ')}</p>}
            {/* checks the step after the saved one, not the unsaved selection */}
            <CheckButton tree={t} side={side} settings={settings} progress={progress} onRequestCheck={onRequestCheck} />
          </div>
        )
      }))}

      <h3>My best</h3>
      {BESTS.filter(([id]) => flex || !flexBest(id)).map(([id, unit]) => (
        <label key={id}>{exerciseById[id]?.name ?? tests.find((t) => t.id === id)?.name ?? id} ({unit})
          <input type="number" inputMode="numeric" min={0} value={bests[id] ?? ''} onChange={(e) => setBest(id, e.target.value)} />
        </label>
      ))}

      <button className="primary wide" onClick={() => onSave(changed, { ...settings, bests, placed: true })}>Save</button>
      {onCancel && <button className="wide" onClick={onCancel}>Cancel</button>}
    </main>
  )
}
