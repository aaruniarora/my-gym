import { useState } from 'react'
import type { SkillTree } from '../../content/schema'
import { exerciseById, skillTrees } from '../content'
import { currentStep } from '../lib/progression'
import type { Settings, SkillProgress } from '../lib/types'
import Info from './Info'
import TechniqueCard from './TechniqueCard'

type Side = 'left' | 'right'
type Props = { settings: Settings; progress: SkillProgress[]; onRequestCheck: (treeId: string, side?: Side) => void }

const sidesOf = (t: SkillTree): (Side | undefined)[] => (t.perSide ? ['left', 'right'] : [undefined])
const sideName = (s?: Side) => (s === 'left' ? 'Left' : s === 'right' ? 'Right' : '')

// the "I can already do this" button, or the scheduled note once a check is pending
export function CheckButton({ tree, side, settings, progress, onRequestCheck }: Props & { tree: SkillTree; side?: Side }) {
  const now = new Date()
  const { stepIndex } = currentStep(progress, tree, now, settings.bests, side)
  if (stepIndex >= tree.steps.length - 1) return null
  if (progress.find((p) => p.treeId === tree.id && p.side === side)?.checkPending) return <p className="muted small">Check set scheduled for your next session</p>
  if (currentStep([{ treeId: tree.id, stepIndex: stepIndex + 1, hits: 0, misses: 0 }], tree, now, settings.bests).locked) return null
  const next = exerciseById[tree.steps[stepIndex + 1].exerciseId]?.name ?? tree.steps[stepIndex + 1].exerciseId
  return <p><button className="small" onClick={() => onRequestCheck(tree.id, side)}>I can already do this{side && ` (${sideName(side)})`}: {next}</button>{' '}
    <Info text="Schedules a short check set next session; passing moves you up, failing costs nothing." /></p>
}

export default function SkillTrees(props: Props) {
  const { settings, progress } = props
  const [open, setOpen] = useState<string>()
  const now = new Date()
  const flex = settings.focus?.flexibility !== false

  return (
    <>
      {skillTrees.filter((t) => flex || t.kind !== 'flexibility').map((tree) => {
        const current = sidesOf(tree).map((side) => ({ side, ...currentStep(progress, tree, now, settings.bests, side) }))
        return (
          <div key={tree.id} className="card">
            <strong>{tree.name}</strong>
            <ol className="steps">
              {tree.steps.map((s, i) => {
                const gate = currentStep([{ treeId: tree.id, stepIndex: i, hits: 0, misses: 0 }], tree, now, settings.bests).gateMissing
                const state = current.map((c) => (i < c.stepIndex ? 'done' : i === c.stepIndex ? 'current' : gate.length ? 'locked' : 'upcoming'))
                const label = current.map((c, j) => `${c.side ? `${sideName(c.side)}: ` : ''}${state[j]}`).join(' · ')
                return (
                  <li key={i} className={`step step-${state.includes('current') ? 'current' : state[0]}`}>
                    <button className="link" onClick={() => setOpen(s.exerciseId)}>{exerciseById[s.exerciseId]?.name ?? s.exerciseId}</button>
                    <span className="muted small"> {label}</span>
                    {gate.length > 0 && i >= Math.min(...current.map((c) => c.stepIndex)) && <p className="muted small">Locked until {gate.join(', ')}</p>}
                  </li>
                )
              })}
            </ol>
            {sidesOf(tree).map((side) => <CheckButton key={side ?? 'both'} {...props} tree={tree} side={side} />)}
          </div>
        )
      })}
      {open && exerciseById[open] && (
        <div className="overlay">
          <button className="wide" onClick={() => setOpen(undefined)}>Close</button>
          <TechniqueCard exercise={exerciseById[open]} />
        </div>
      )}
    </>
  )
}
