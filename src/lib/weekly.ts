import type { SkillTree } from '../../content/schema'
import { localISO, mondayOf } from './trained'
import type { Band, MilestoneResult, SetLog } from './types'

// yyyy-mm-dd is a local date; full ISO timestamps are converted to local time
const toDate = (iso: string) => {
  if (iso.length > 10) return new Date(iso)
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const weekKey = (dateISO: string) => localISO(mondayOf(toDate(dateISO)))

const byWeek = (logs: SetLog[]) => {
  const weeks = new Map<string, SetLog[]>()
  for (const l of logs) weeks.set(weekKey(l.at), [...(weeks.get(weekKey(l.at)) ?? []), l])
  return [...weeks].sort(([a], [b]) => a.localeCompare(b))
}

const max = (ns: (number | undefined)[]) => {
  const xs = ns.filter((n): n is number => n !== undefined)
  return xs.length ? Math.max(...xs) : undefined
}
const min = (ns: (number | undefined)[]) => {
  const xs = ns.filter((n): n is number => n !== undefined)
  return xs.length ? Math.min(...xs) : undefined
}

export type WeekPoint = { week: string; bestSet: number; total: number; maxKg?: number; bandLevel?: number }

export function weeklySeries(logs: SetLog[], exerciseId: string, bands: Band[]): WeekPoint[] {
  const sorted = [...bands].sort((a, b) => a.order - b.order)
  const level = (id: string) => (sorted.some((b) => b.id === id) ? sorted.length - 1 - sorted.findIndex((b) => b.id === id) : undefined)
  return byWeek(logs.filter((l) => l.exerciseId === exerciseId)).map(([week, ls]) => {
    const amount = ls.map((l) => l.reps ?? l.seconds ?? 0)
    const maxKg = max(ls.map((l) => l.weightKg))
    // a double band counts as its heaviest band; the week shows the lightest assistance used
    const bandLevel = max(ls.map((l) => (l.bandIds?.length ? min(l.bandIds.map(level)) : undefined)))
    return { week, bestSet: Math.max(...amount), total: amount.reduce((a, b) => a + b, 0), ...(maxKg !== undefined && { maxKg }), ...(bandLevel !== undefined && { bandLevel }) }
  })
}

// every log week from the tree's first logged week; weeks without tree logs keep the previous step
export function treeStairs(logs: SetLog[], tree: SkillTree): { week: string; stepIndex: number }[] {
  const stepOf = (id: string) => max(tree.steps.map((s, i) => (s.exerciseId === id ? i : undefined)))
  const out: { week: string; stepIndex: number }[] = []
  for (const [week, ls] of byWeek(logs)) {
    const step = max(ls.map((l) => stepOf(l.exerciseId))) ?? out.at(-1)?.stepIndex
    if (step !== undefined) out.push({ week, stepIndex: step })
  }
  return out
}

// unsided logs (middle split) go to value
export function cmSeries(logs: SetLog[], exerciseIds: string[]): { week: string; left?: number; right?: number; value?: number }[] {
  return byWeek(logs.filter((l) => exerciseIds.includes(l.exerciseId) && l.cmFromFloor !== undefined)).map(([week, ls]) => {
    const [left, right, value] = (['left', 'right', undefined] as const).map((s) => min(ls.filter((l) => l.side === s).map((l) => l.cmFromFloor)))
    return { week, ...(left !== undefined && { left }), ...(right !== undefined && { right }), ...(value !== undefined && { value }) }
  })
}

// sorted by date; the first entry is the baseline
export function testMarkers(results: MilestoneResult[], testId: string): { week: string; value: number; side?: 'left' | 'right' }[] {
  return results
    .filter((r) => r.testId === testId)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => ({ week: weekKey(r.date), value: r.value, ...(r.side && { side: r.side }) }))
}

export type PR = { bestReps?: number; bestSeconds?: number; maxKg?: number }

export function personalRecords(logs: SetLog[]): Record<string, PR> {
  const out: Record<string, PR> = {}
  for (const l of logs) {
    const p = (out[l.exerciseId] ??= {})
    if (l.reps !== undefined) p.bestReps = Math.max(p.bestReps ?? 0, l.reps)
    if (l.seconds !== undefined) p.bestSeconds = Math.max(p.bestSeconds ?? 0, l.seconds)
    if (l.weightKg !== undefined) p.maxKg = Math.max(p.maxKg ?? 0, l.weightKg)
  }
  return out
}
