import type { BlockKind, PlannedExercise, SessionPlan } from './types'

// key identifies a planned exercise slot; swaps change the exercise but keep the key
export type Item = { key: string; kind: BlockKind; pe: PlannedExercise; setIndex: number }

// paired exercises (pairWith) alternate set by set
export function flatten(plan: SessionPlan): Item[] {
  const items: Item[] = []
  plan.blocks.forEach((block, b) => {
    const done = new Set<number>()
    block.exercises.forEach((pe, e) => {
      if (done.has(e)) return
      const p = block.exercises.findIndex((x, i) => i > e && x.exerciseId === pe.pairWith)
      const group = p >= 0 ? [e, p] : [e]
      group.forEach((i) => done.add(i))
      const most = Math.max(...group.map((i) => block.exercises[i].sets))
      for (let s = 0; s < most; s++)
        for (const i of group) if (s < block.exercises[i].sets) items.push({ key: `${b}-${i}`, kind: block.kind, pe: block.exercises[i], setIndex: s })
    })
  })
  return items
}

// first index at or after `from` whose slot is not skipped; items.length means finished
export function nextPos(items: Item[], from: number, skipped: string[]) {
  let i = from
  while (i < items.length && skipped.includes(items[i].key)) i++
  return i
}

// trail holds every position left by moving forward (done or skipped); going back pops it
export function prevPos(trail: number[], pos: number): [number, number[]] {
  return trail.length === 0 ? [pos, trail] : [trail[trail.length - 1], trail.slice(0, -1)]
}
