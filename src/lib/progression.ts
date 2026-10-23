import type { Exercise, SkillTree } from '../../content/schema'
import { exerciseById, skillTrees, tests } from '../content'
import type { SessionPlan, SetLog, SkillProgress } from './types'

const WEEK_MS = 7 * 24 * 3600 * 1000
type Side = 'left' | 'right'
const SIDES: Side[] = ['left', 'right']
const sidesOf = (treeId: string) => (skillTrees.find((t) => t.id === treeId)?.perSide ? SIDES : [undefined])

// a gate is met when settings.bests for each requirement's test exercise reaches the min (pass_fail: 1)
// side picks the entry of a per-side tree; normal trees have no side
export function currentStep(progress: SkillProgress[], tree: SkillTree, _now: Date, bests: Record<string, number> = {}, side?: Side) {
  const entry = progress.find((p) => p.treeId === tree.id && p.side === side)
  const stepIndex = Math.min(entry?.stepIndex ?? 0, tree.steps.length - 1)
  const step = tree.steps[stepIndex]
  const gateMissing = (step.gate?.requirements ?? [])
    .filter((r) => {
      const exId = tests.find((t) => t.id === r.testId)?.exerciseId
      return !exId || (bests[exId] ?? 0) < (r.metric === 'pass_fail' ? 1 : r.min)
    })
    .map((r) => `${r.testId} >= ${r.min}`)
  return { stepIndex, step, locked: gateMissing.length > 0, gateMissing }
}

const treeSteps = new Map<string, { tree: SkillTree; stepIndex: number }[]>()
for (const tree of skillTrees) tree.steps.forEach((s, stepIndex) => treeSteps.set(s.exerciseId, [...(treeSteps.get(s.exerciseId) ?? []), { tree, stepIndex }]))

// per-side trees are limited by the weaker side
const abilityIndex = (tree: SkillTree, progress: SkillProgress[], bests: Record<string, number>, now: Date) =>
  Math.min(...sidesOf(tree.id).map((side) => currentStep(progress, tree, now, bests, side).stepIndex))

const stepOk = (tree: SkillTree, stepIndex: number, progress: SkillProgress[], bests: Record<string, number>, now: Date) =>
  stepIndex <= abilityIndex(tree, progress, bests, now) && !currentStep([{ treeId: tree.id, stepIndex, hits: 0, misses: 0 }], tree, now, bests).locked

// exercises outside every tree are always within ability
export function withinAbility(exerciseId: string, progress: SkillProgress[], bests: Record<string, number>, now: Date): boolean {
  return (treeSteps.get(exerciseId) ?? []).every(({ tree, stepIndex }) => stepOk(tree, stepIndex, progress, bests, now))
}

// for an out-of-ability exercise: the highest doable step at or below the current one in its first tree
export function abilityStep(exerciseId: string, progress: SkillProgress[], bests: Record<string, number>, now: Date): string | undefined {
  const first = treeSteps.get(exerciseId)?.[0]
  if (!first || withinAbility(exerciseId, progress, bests, now)) return undefined
  for (let i = abilityIndex(first.tree, progress, bests, now); i >= 0; i--) if (stepOk(first.tree, i, progress, bests, now)) return first.tree.steps[i].exerciseId
}

// "I can already do this": the next step's check set, or 3x5 / 3x10 s when the step has none
export const checkTarget = (step: SkillTree['steps'][number], ex: Exercise) => step.checkSet ?? (ex.mode.startsWith('time') ? { sets: 3, seconds: 10 } : { sets: 3, reps: 5 })

export function applySession(progress: SkillProgress[], plan: SessionPlan, logs: SetLog[], now: Date, bests: Record<string, number> = {}) {
  const next = progress.map((p) => ({ ...p }))
  const events: string[] = []
  const counted = logs.filter((l) => l.mode === 'normal' || l.mode === 'push')
  const seen = new Set<string>()
  for (const pe of plan.blocks.flatMap((b) => b.exercises)) {
    const tree = skillTrees.find((t) => t.id === pe.treeId)
    if (!tree || pe.stepIndex === undefined || seen.has(tree.id)) continue
    seen.add(tree.id)
    // per-side trees score each side against its own entry
    for (const side of sidesOf(tree.id)) {
      let entry = next.find((p) => p.treeId === tree.id && p.side === side)
      if (!entry) next.push((entry = { treeId: tree.id, ...(side && { side }), stepIndex: 0, hits: 0, misses: 0 }))
      const label = side ? `${tree.id} (${side})` : tree.id
      // check set: pass moves up one step, a miss just clears the request
      if (pe.checkSet) {
        if (!entry.checkPending || entry.stepIndex + 1 !== pe.stepIndex) continue
        const ex = exerciseById[pe.exerciseId]
        const t = checkTarget(tree.steps[pe.stepIndex], ex)
        const need = t.sets * (ex.mode.endsWith('per_side') && !side ? 2 : 1)
        const exLogs = counted.filter((l) => l.exerciseId === pe.exerciseId && (!side || (l.side ?? side) === side))
        if (!exLogs.length) continue
        delete entry.checkPending
        if (exLogs.length < need || !exLogs.slice(0, need).every((l) => (t.reps !== undefined ? (l.reps ?? 0) >= t.reps : (l.seconds ?? 0) >= (t.seconds ?? 0)))) continue
        Object.assign(entry, { stepIndex: pe.stepIndex, hits: 0, misses: 0 })
        events.push(`${label}: moved up to ${pe.exerciseId} (check set)`)
        continue
      }
      // dropped-back or locked sessions run an earlier step; they don't move the tree
      if (entry.stepIndex !== pe.stepIndex) continue
      const target = tree.steps[pe.stepIndex].target
      const cm = target.reps === undefined && target.seconds === undefined ? target.cmFromFloor : undefined
      // sets without a cm entry don't count towards a cm target
      const exLogs = counted.filter((l) => l.exerciseId === pe.exerciseId && (!side || (l.side ?? side) === side) && (cm === undefined || l.cmFromFloor !== undefined))
      // skipped exercises don't count as misses
      if ((target.reps === undefined && target.seconds === undefined && cm === undefined) || exLogs.length === 0) continue
      const ex = exerciseById[pe.exerciseId]
      const need = target.sets * (ex.mode.endsWith('per_side') && !side ? 2 : 1)
      const hit = exLogs.length >= need && (cm !== undefined
        ? exLogs.every((l) => l.cmFromFloor! <= cm)
        : exLogs.slice(0, need).every((l) => (target.reps !== undefined ? (l.reps ?? 0) >= target.reps : (l.seconds ?? 0) >= target.seconds!)))
      if (!hit) {
        entry.hits = 0
        entry.misses++
        if (entry.misses >= 3) {
          entry.droppedUntil = new Date(now.getTime() + WEEK_MS).toISOString()
          entry.misses = 0
          events.push(`${label}: dropped back for a week`)
        }
        continue
      }
      if (ex.loggable.band) events.push(`${ex.id}: try the next lighter band`)
      entry.hits++
      entry.misses = 0
      const nextStep = tree.steps[entry.stepIndex + 1]
      if (entry.hits < 2 || !nextStep) continue
      if (currentStep([{ ...entry, stepIndex: entry.stepIndex + 1 }], tree, now, bests, side).locked) {
        events.push(`${label}: next step locked: ${nextStep.gate!.requirements.map((r) => `${r.testId} >= ${r.min}`).join(', ')}`)
        continue
      }
      entry.stepIndex++
      entry.hits = 0
      events.push(`${label}: moved up to ${nextStep.exerciseId}`)
    }
  }
  return { progress: next, events }
}

// adds missing entries (one per side for per-side trees) so pain and too-hard always have one to mark
const withEntries = (progress: SkillProgress[], treeId: string): SkillProgress[] => [
  ...progress,
  ...sidesOf(treeId).filter((side) => !progress.some((p) => p.treeId === treeId && p.side === side)).map((side) => ({ treeId, ...(side && { side }), stepIndex: 0, hits: 0, misses: 0 })),
]

export function applyPain(progress: SkillProgress[], treeId: string, now: Date): SkillProgress[] {
  const droppedUntil = new Date(now.getTime() + WEEK_MS).toISOString()
  return withEntries(progress, treeId).map((p) => (p.treeId === treeId ? { ...p, droppedUntil, misses: 0 } : p))
}

// three "too hard" taps drop the tree back for a week, like three missed sessions
export function applyTooHard(progress: SkillProgress[], treeId: string, now: Date): SkillProgress[] {
  return withEntries(progress, treeId).map((p) => {
    if (p.treeId !== treeId) return p
    const misses = p.misses + 1
    return misses >= 3 ? { ...p, hits: 0, misses: 0, droppedUntil: new Date(now.getTime() + WEEK_MS).toISOString() } : { ...p, hits: 0, misses }
  })
}

// "I can already do this": the next session plans a check set for the tree's next step
export function requestCheck(progress: SkillProgress[], treeId: string, side?: Side): SkillProgress[] {
  const has = progress.some((p) => p.treeId === treeId && p.side === side)
  const all = has ? progress : [...progress, { treeId, ...(side && { side }), stepIndex: 0, hits: 0, misses: 0 }]
  return all.map((p) => (p.treeId === treeId && p.side === side ? { ...p, checkPending: true } : p))
}
