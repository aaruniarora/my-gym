import type { SkillTree } from '../../content/schema'
import { exerciseById, skillTrees, tests } from '../content'
import type { SessionPlan, SetLog, SkillProgress } from './types'

const WEEK_MS = 7 * 24 * 3600 * 1000

// a gate is met when settings.bests for each requirement's test exercise reaches the min (pass_fail: 1)
export function currentStep(progress: SkillProgress[], tree: SkillTree, _now: Date, bests: Record<string, number> = {}) {
  const entry = progress.find((p) => p.treeId === tree.id)
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

const stepOk = (tree: SkillTree, stepIndex: number, progress: SkillProgress[], bests: Record<string, number>, now: Date) =>
  stepIndex <= currentStep(progress, tree, now, bests).stepIndex && !currentStep([{ treeId: tree.id, stepIndex, hits: 0, misses: 0 }], tree, now, bests).locked

// exercises outside every tree are always within ability
export function withinAbility(exerciseId: string, progress: SkillProgress[], bests: Record<string, number>, now: Date): boolean {
  return (treeSteps.get(exerciseId) ?? []).every(({ tree, stepIndex }) => stepOk(tree, stepIndex, progress, bests, now))
}

// for an out-of-ability exercise: the highest doable step at or below the current one in its first tree
export function abilityStep(exerciseId: string, progress: SkillProgress[], bests: Record<string, number>, now: Date): string | undefined {
  const first = treeSteps.get(exerciseId)?.[0]
  if (!first || withinAbility(exerciseId, progress, bests, now)) return undefined
  for (let i = currentStep(progress, first.tree, now, bests).stepIndex; i >= 0; i--) if (stepOk(first.tree, i, progress, bests, now)) return first.tree.steps[i].exerciseId
}

export function applySession(progress: SkillProgress[], plan: SessionPlan, logs: SetLog[], now: Date, bests: Record<string, number> = {}) {
  const next = progress.map((p) => ({ ...p }))
  const events: string[] = []
  const counted = logs.filter((l) => l.mode === 'normal' || l.mode === 'push')
  const seen = new Set<string>()
  for (const pe of plan.blocks.flatMap((b) => b.exercises)) {
    const tree = skillTrees.find((t) => t.id === pe.treeId)
    if (!tree || pe.stepIndex === undefined || seen.has(tree.id)) continue
    seen.add(tree.id)
    let entry = next.find((p) => p.treeId === tree.id)
    if (!entry) next.push((entry = { treeId: tree.id, stepIndex: 0, hits: 0, misses: 0 }))
    // dropped-back or locked sessions run an earlier step; they don't move the tree
    if (entry.stepIndex !== pe.stepIndex) continue
    const target = tree.steps[pe.stepIndex].target
    const exLogs = counted.filter((l) => l.exerciseId === pe.exerciseId)
    // cm-from-floor targets aren't logged yet; skipped exercises don't count as misses
    if ((target.reps === undefined && target.seconds === undefined) || exLogs.length === 0) continue
    const ex = exerciseById[pe.exerciseId]
    const need = target.sets * (ex.mode.endsWith('per_side') ? 2 : 1)
    const hit = exLogs.length >= need && exLogs.slice(0, need).every((l) => (target.reps !== undefined ? (l.reps ?? 0) >= target.reps : (l.seconds ?? 0) >= target.seconds!))
    if (!hit) {
      entry.hits = 0
      entry.misses++
      if (entry.misses >= 3) {
        entry.droppedUntil = new Date(now.getTime() + WEEK_MS).toISOString()
        entry.misses = 0
        events.push(`${tree.id}: dropped back for a week`)
      }
      continue
    }
    if (ex.loggable.band) events.push(`${ex.id}: try the next lighter band`)
    entry.hits++
    entry.misses = 0
    const nextStep = tree.steps[entry.stepIndex + 1]
    if (entry.hits < 2 || !nextStep) continue
    if (currentStep([{ ...entry, stepIndex: entry.stepIndex + 1 }], tree, now, bests).locked) {
      events.push(`${tree.id}: next step locked: ${nextStep.gate!.requirements.map((r) => `${r.testId} >= ${r.min}`).join(', ')}`)
      continue
    }
    entry.stepIndex++
    entry.hits = 0
    events.push(`${tree.id}: moved up to ${nextStep.exerciseId}`)
  }
  return { progress: next, events }
}

export function applyPain(progress: SkillProgress[], treeId: string, now: Date): SkillProgress[] {
  const droppedUntil = new Date(now.getTime() + WEEK_MS).toISOString()
  if (!progress.some((p) => p.treeId === treeId)) return [...progress, { treeId, stepIndex: 0, hits: 0, misses: 0, droppedUntil }]
  return progress.map((p) => (p.treeId === treeId ? { ...p, droppedUntil, misses: 0 } : p))
}

// three "too hard" taps drop the tree back for a week, like three missed sessions
export function applyTooHard(progress: SkillProgress[], treeId: string, now: Date): SkillProgress[] {
  const next = progress.some((p) => p.treeId === treeId) ? progress : [...progress, { treeId, stepIndex: 0, hits: 0, misses: 0 }]
  return next.map((p) => {
    if (p.treeId !== treeId) return p
    const misses = p.misses + 1
    return misses >= 3 ? { ...p, hits: 0, misses: 0, droppedUntil: new Date(now.getTime() + WEEK_MS).toISOString() } : { ...p, hits: 0, misses }
  })
}
