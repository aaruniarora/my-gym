import type { Exercise, MilestoneTest } from '../../content/schema'
import { exerciseById, skillTrees, tests as battery } from '../content'
import { currentStep } from './progression'
import type { DayType, Location, MilestoneResult, SetLog, Settings, SkillProgress } from './types'

const DAY_MS = 24 * 3600 * 1000
const TEST_WEEKS = [1, 4, 8, 12] as const
const Q1_TREES = ['pull-up', 'push-up', 'dip', 'handstand', 'l-sit', 'pistol', 'front-split', 'bridge', 'pike-pancake']

// settings saved before equipment existed keep the old rule: everything at the gym, homeOk at home
export function available(ex: Exercise, settings: Settings, location: Location): boolean {
  const have = settings.equipment?.[location]
  return have ? ex.equipment.every((e) => e === 'none' || have.includes(e)) : location === 'gym' || ex.homeOk
}

// calendar days, so time of day and DST don't shift the week
export function quarterWeek(startDate: string, today: Date): number {
  const [y, m, d] = startDate.split('-').map(Number)
  const days = Math.floor((Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - Date.UTC(y, m - 1, d)) / DAY_MS)
  return Math.max(1, Math.floor(days / 7) + 1)
}

export function blockOf(week: number): 'Foundations' | 'Build' | 'Intensify' | 'Deload' | 'Over' {
  return week <= 4 ? 'Foundations' : week <= 8 ? 'Build' : week <= 11 ? 'Intensify' : week === 12 ? 'Deload' : 'Over'
}

export function nextTestWeek(week: number): 1 | 4 | 8 | 12 | null {
  return TEST_WEEKS.find((w) => w >= week) ?? null
}

export const isTestWeek = (week: number) => (TEST_WEEKS as readonly number[]).includes(week)

export const deloadFactor = (week: number) => (week === 12 ? 0.6 : 1)

export function applyTestResults(bests: Record<string, number>, results: MilestoneResult[], tests: MilestoneTest[]): Record<string, number> {
  const out = { ...bests }
  for (const r of results) {
    const test = tests.find((t) => t.id === r.testId)
    if (!test) continue
    // per-side tests share an exercise, so they keep their own id (as Placement does)
    const key = /-(left|right)$/.test(test.id) ? test.id : test.exerciseId ?? test.id
    out[key] = out[key] === undefined ? r.value : test.higherIsBetter ? Math.max(out[key], r.value) : Math.min(out[key], r.value)
  }
  return out
}

// newly unlocked trees (gated entry step, gate now met, not started) first, then the Q1 trees least progressed first
export function proposeFocus(results: MilestoneResult[], bests: Record<string, number>, progress: SkillProgress[]): string[] {
  const b = applyTestResults(bests, results, battery)
  const started = (id: string) => progress.some((p) => p.treeId === id && p.stepIndex > 0)
  // currentStep ignores its date argument
  const unlocked = skillTrees.filter((t) => t.steps[0].gate && !started(t.id) && !currentStep([], t, new Date(0), b).locked).map((t) => t.id)
  // no entry yet counts as step 0; per-side trees use the weaker side
  const step = (id: string) => {
    const steps = progress.filter((p) => p.treeId === id).map((p) => p.stepIndex)
    return steps.length ? Math.min(...steps) : 0
  }
  const q1 = [...Q1_TREES].sort((x, y) => step(x) - step(y))
  return [...new Set([...unlocked, ...q1])].slice(0, 4)
}

// test id -> [prerequisite test id, min best on its exercise]
export const TEST_REQUIRES: Record<string, [string, number]> = { 'archer-pull-up-max': ['pull-up-max', 8] }

// cm tests (splits, leg raises) need flexibility, balance and jump rope need mobility, the rest strength
export const testFocus = (t: MilestoneTest): 'strength' | 'mobility' | 'flexibility' =>
  t.metric === 'cm_from_floor' || t.metric === 'cm_height' ? 'flexibility' : t.id.startsWith('single-leg-balance') || t.id === 'jump-rope-continuous' ? 'mobility' : 'strength'

// focus ticked, location ok, prerequisite best met, every gate up to each tree step of the exercise met
export function testAllowed(test: MilestoneTest, settings: Settings, _progress: SkillProgress[], location: Location): boolean {
  const ex = test.exerciseId ? exerciseById[test.exerciseId] : undefined
  const bests = settings.bests ?? {}
  if (!ex || !{ strength: true, mobility: true, flexibility: true, ...settings.focus }[testFocus(test)] || !available(ex, settings, location)) return false
  const req = TEST_REQUIRES[test.id]
  const reqEx = req && battery.find((t) => t.id === req[0])?.exerciseId
  if (req && (!reqEx || (bests[reqEx] ?? 0) < req[1])) return false
  // per-side trees read the side from the test id and check the same side's gate tests
  const side = test.id.match(/-(left|right)$/)?.[0]
  const met = (r: { testId: string; metric: string; min: number }, perSide?: boolean) => {
    const id = perSide && side ? r.testId.replace(/-(left|right)$/, side) : r.testId
    const t = battery.find((b) => b.id === id)
    const key = t && (/-(left|right)$/.test(t.id) ? t.id : t.exerciseId)
    return !!key && (bests[key] ?? 0) >= (r.metric === 'pass_fail' ? 1 : r.min)
  }
  return skillTrees.every((tree) =>
    tree.steps.every((s, i) => s.exerciseId !== ex.id || tree.steps.slice(0, i + 1).every((g) => (g.gate?.requirements ?? []).every((r) => met(r, tree.perSide)))),
  )
}

// balance tests count as skill/core work even though their pattern is legs
export function testDayType(test: MilestoneTest): DayType {
  const ex = exerciseById[test.exerciseId ?? '']
  if (!ex || ex.flags?.includes('balance')) return 'skill_core'
  return ex.pattern === 'pull' ? 'pull' : ex.pattern === 'push' || ex.pattern === 'handstand' ? 'push' : ex.pattern === 'legs' || ex.pattern === 'flexibility' ? 'legs' : 'skill_core'
}

export const untestedThisWeek = (settings: Settings, progress: SkillProgress[], results: MilestoneResult[], week: number, location: Location) =>
  battery.filter((t) => testAllowed(t, settings, progress, location) && !results.some((r) => r.week === week && r.testId === t.id))

export const isTestDay = (settings: Settings, today: Date) => settings.testMode?.mode === 'day' && today.getDay() === settings.testMode.weekday

// 3-6 tests matching the day type; fewer than 3 are topped up with other untested ones. Day mode leaves the core tests to the test day
export function testsForSession(settings: Settings, progress: SkillProgress[], results: MilestoneResult[], week: number, dayType: DayType, location: Location): MilestoneTest[] {
  const left = untestedThisWeek(settings, progress, results, week, location).filter((t) => settings.testMode?.mode !== 'day' || !t.core)
  const want = dayType === 'movement' ? 'skill_core' : dayType
  const match = left.filter((t) => ['full_body', 'light', 'test'].includes(want) || testDayType(t) === want).slice(0, 6)
  return match.length >= 3 ? match : [...match, ...left.filter((t) => !match.includes(t))].slice(0, 3)
}

// least fatiguing first: skills and balance, max strength alternating pull and push, core holds, flexibility last
export function coreTestsOrdered(settings: Settings, progress: SkillProgress[], location: Location): MilestoneTest[] {
  const core = battery.filter((t) => t.core && testAllowed(t, settings, progress, location))
  const ex = (t: MilestoneTest) => exerciseById[t.exerciseId!]
  const group = (t: MilestoneTest) => {
    const e = ex(t)
    return e.type === 'skill_hold' || e.flags?.includes('balance') ? 0 : e.type === 'main_strength' || e.type === 'accessory' ? 1 : e.type === 'core' ? 2 : 3
  }
  const strength = core.filter((t) => group(t) === 1)
  const [pulls, pushes] = (['pull', 'push'] as const).map((p) => strength.filter((t) => ex(t).pattern === p))
  const alternated = Array.from({ length: Math.max(pulls.length, pushes.length) }, (_, i) => [pulls[i], pushes[i]]).flat().filter((t) => !!t)
  return [...core.filter((t) => group(t) === 0), ...alternated, ...strength.filter((t) => !alternated.includes(t)), ...core.filter((t) => group(t) === 2), ...core.filter((t) => group(t) === 3)]
}

// any unassisted normal/push set that beats a best raises it; cm and pass/fail bests stay with the tests
const testOnlyExercises = new Set(battery.filter((t) => t.metric.startsWith('cm') || t.metric === 'pass_fail').map((t) => t.exerciseId))
export function bestsFromLogs(bests: Record<string, number>, logs: SetLog[]): Record<string, number> {
  const out = { ...bests }
  for (const l of logs) {
    const v = (l.mode === 'normal' || l.mode === 'push') && !l.bandIds?.length && !testOnlyExercises.has(l.exerciseId) ? l.reps ?? l.seconds : undefined
    if (v !== undefined) out[l.exerciseId] = Math.max(out[l.exerciseId] ?? 0, v)
  }
  return out
}

// day mode: a test day on a usually symptomatic weekday moves to the nearest free one; ties prefer a day still ahead this week, else the later one
export function suggestTestDayMove(settings: Settings, symptomaticWeekdays: number[], today?: Date): { from: number; to: number } | null {
  const from = settings.testMode?.weekday
  if (settings.testMode?.mode !== 'day' || from === undefined || !symptomaticWeekdays.includes(from)) return null
  // Monday-first position, so "ahead this week" compares correctly
  const pos = (d: number) => (d + 6) % 7
  for (let k = 1; k <= 3; k++) {
    const free = [(from + k) % 7, (from + 7 - k) % 7].filter((d) => !symptomaticWeekdays.includes(d))
    const ahead = today && free.find((d) => pos(d) >= pos(today.getDay()))
    if (free.length) return { from, to: ahead ?? free[0] }
  }
  return null
}
