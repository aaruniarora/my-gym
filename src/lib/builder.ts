import type { Exercise } from '../../content/schema'
import { effectiveDose, exerciseById, niggleMobility, skillTrees, tests } from '../content'
import { dayTemplates, FULL_BODY_SKILLS, SPLITS_BLOCK, WARMUP_POOL } from './dayTemplates'
import { abilityStep, currentStep, withinAbility } from './progression'
import type { Block, BlockKind, DayMode, DayType, Location, PlannedExercise, SessionPlan, SessionRecord, SetLog, Settings, SkillProgress } from './types'

const HOUR = 3600 * 1000
const ROTATION: DayType[] = ['pull', 'push', 'legs', 'skill_core']
const ORDER: BlockKind[] = ['warmup', 'niggle_mobility', 'skill', 'strength', 'secondary', 'core', 'conditioning', 'flexibility', 'cooldown']
// [kind, lowest sets per exercise before the next step]
const REMOVE_ORDER: [BlockKind, number][] = [['conditioning', 1], ['core', 1], ['flexibility', 1], ['secondary', 1], ['strength', 2], ['skill', 1], ['strength', 1]]
const STRETCH_AREA_CAP = 240
// planned rest by type; the player clamps adaptive rest to `range`. core/conditioning rest comes from the interval format
export const REST: Record<Exercise['type'], { base: number; range: [number, number] }> = {
  main_strength: { base: 120, range: [90, 180] },
  accessory: { base: 60, range: [45, 90] },
  skill_hold: { base: 90, range: [60, 120] },
  core: { base: 0, range: [10, 30] },
  conditioning: { base: 0, range: [10, 30] },
  mobility: { base: 8, range: [5, 10] },
  stretch: { base: 8, range: [5, 10] },
}
// test -> the tree that trains it, used when a tree's entry step is gated on that test
const GATE_TREE: Record<string, string> = {
  'pull-up-max': 'pull-up',
  'chest-to-bar-pull-up-max': 'pull-up',
  'dip-max': 'dip',
  'push-up-max': 'push-up',
  'elevated-pike-push-up-max': 'hspu',
  'chest-to-wall-handstand-hold': 'handstand',
  'tuck-front-lever-hold': 'front-lever',
  'german-hang-hold': 'back-lever',
  'skin-the-cat': 'back-lever',
  'planche-lean-hold': 'planche',
  'dragon-flag-negative': 'dragon-flag',
}
// [max planned seconds, work, rest]
const INTERVALS = [[20, 20, 10], [30, 30, 15], [40, 40, 20], [Infinity, 60, 20]]

const ended = (s: SessionRecord) => new Date(s.endedAt ?? s.startedAt).getTime()
const covers = (d: DayType): DayType[] => (d === 'full_body' ? ['pull', 'push', 'legs'] : [d])
const lastWeek = (recent: SessionRecord[], now: Date) =>
  recent.filter((s) => s.completed && now.getTime() - new Date(s.startedAt).getTime() < 7 * 24 * HOUR)
const returningFromBreak = (recent: SessionRecord[], now: Date) => lastWeek(recent, now).length === 0 && recent.some((s) => s.completed)

export function pickDayType(recent: SessionRecord[], settings: Settings, now: Date): DayType {
  if (settings.weeklyTarget <= 3 || returningFromBreak(recent, now)) return 'full_body'
  const week = lastWeek(recent, now).sort((a, b) => ended(b) - ended(a))
  const start = ROTATION.indexOf(week[0]?.plan.dayType) + 1
  const count = (d: DayType) => week.filter((s) => covers(s.plan.dayType).includes(d)).length
  const fresh = ROTATION.map((_, i) => ROTATION[(start + i) % ROTATION.length])
    .filter((d) => !week.some((s) => covers(s.plan.dayType).includes(d) && now.getTime() - ended(s) < 48 * HOUR))
  return fresh.sort((a, b) => count(a) - count(b))[0] ?? 'light'
}

export function estimateSeconds(pe: PlannedExercise, ex: Exercise): number {
  const rest = pe.pairWith && !pe.interval ? pe.restSeconds / 2 : pe.restSeconds
  const work = pe.seconds ?? (pe.reps?.[1] ?? 0) * 3
  return pe.sets * (work + rest) * (ex.mode.endsWith('per_side') ? 2 : 1)
}

export function buildSession(input: {
  minutes: number
  location: Location
  mode: DayMode
  now: Date
  recent: SessionRecord[]
  recentLogs: SetLog[]
  progress: SkillProgress[]
  settings: Settings
}): SessionPlan {
  const { location, mode, now, recent, progress, settings } = input
  const minutes = mode === 'bare' ? 10 : input.minutes
  const short = minutes <= 10
  const dayType = pickDayType(recent, settings, now)
  const t = dayTemplates[dayType]
  const easy = mode === 'tired' || returningFromBreak(recent, now)
  const tired = mode === 'tired'
  // settings saved before bests existed have none
  const bests = settings.bests ?? {}
  const niggles = settings.niggles.filter((n) => !n.clearedAt).map((n) => n.area)
  const used = new Set<string>()
  const caps = new Map<PlannedExercise, number>()

  const ok = (id: string, kind: BlockKind) => {
    const ex = exerciseById[id]
    // niggle mobility entries may load their own area (allowLoaded)
    const niggleOk = kind === 'niggle_mobility' || !ex?.loads.some((a) => niggles.includes(a))
    return !!ex && !used.has(id) && !settings.neverShow.includes(id) && (location === 'gym' || ex.homeOk) && niggleOk
  }
  const fav = (id: string) => +settings.favourites.includes(id)

  function plan(ref: string, kind: BlockKind, subbed = false): PlannedExercise | undefined {
    let id = ref
    let tree: { treeId?: string; stepIndex?: number } = {}
    if (ref.startsWith('tree:')) {
      const st = skillTrees.find((s) => s.id === ref.slice(5))!
      const cs = currentStep(progress, st, now, bests)
      const dropped = progress.find((p) => p.treeId === st.id)?.droppedUntil
      const stepIndex = cs.stepIndex - (cs.locked || (dropped && new Date(dropped) > now) ? 1 : 0)
      if (stepIndex >= 0) {
        id = st.steps[stepIndex].exerciseId
        tree = { treeId: st.id, stepIndex }
      } else {
        // locked entry step: train the tree behind the first unmet requirement, else that test's regression
        if (!cs.locked) return undefined
        const testId = cs.gateMissing[0].split(' >= ')[0]
        const sub = GATE_TREE[testId]
        // one hop only, so gates that point at each other can't loop
        if (sub && sub !== st.id && !subbed) return plan(`tree:${sub}`, kind, true)
        const reg = exerciseById[tests.find((t) => t.id === testId)?.exerciseId ?? '']?.regression
        if (!reg) return undefined
        id = reg
      }
    }
    if (used.has(id)) return undefined
    if (!ok(id, kind)) {
      const ex = exerciseById[id]
      const loaded = ex.loads.filter((a) => niggles.includes(a))
      // niggled skills are dropped; the next skill in the template takes the slot
      if (kind === 'skill' && loaded.length) return undefined
      const alts = loaded.length
        ? loaded.flatMap((a) => ex.alternates.niggle[a] ?? [])
        : location === 'home' && !ex.homeOk
          ? ex.alternates.home
          : [...(ex.alternates.general ?? []), ...ex.alternates.home, ...(tree.treeId && ex.regression ? [ex.regression] : [])]
      const alt = alts.filter((a) => ok(a, kind)).sort((a, b) => fav(b) - fav(a))[0]
      if (!alt) return undefined
      id = alt
      tree = {}
    }
    const top = (x: Exercise) => {
      const d = effectiveDose(x)
      return x.mode.startsWith('time') ? (tired ? d.seconds![0] : d.seconds![1]) : tired ? d.reps![0] : d.reps![1]
    }
    // too easy: a recorded best of 2x the planned top moves up one variation
    const cur = exerciseById[id]
    if ((bests[id] ?? 0) >= 2 * top(cur)) {
      const lockedStep = (x: string) =>
        skillTrees.some((st) => {
          const i = st.steps.findIndex((s) => s.exerciseId === x)
          return i >= 0 && currentStep([{ treeId: st.id, stepIndex: i, hits: 0, misses: 0 }], st, now, bests).locked
        })
      const sameUnit = (x: Exercise) => x.mode.startsWith('time') === cur.mode.startsWith('time')
      const harder =
        cur.progression && ok(cur.progression, kind) && !lockedStep(cur.progression)
          ? cur.progression
          : (cur.alternates.general ?? []).find((a) => ok(a, kind) && sameUnit(exerciseById[a]) && top(exerciseById[a]) > top(cur))
      if (harder) {
        const st = skillTrees.find((x) => x.id === tree.treeId)
        tree = st && st.steps[tree.stepIndex! + 1]?.exerciseId === harder ? { treeId: st.id, stepIndex: tree.stepIndex! + 1 } : {}
        id = harder
      }
    }
    // safety net for linked ids (tree ref, alternate, too-easy): never above the user's current tree step; template-fixed ids are exempt
    const linked = ref.startsWith('tree:') || id !== ref
    if (linked && !withinAbility(id, progress, bests, now)) {
      const step = abilityStep(id, progress, bests, now)
      if (!step || !ok(step, kind)) return undefined
      const st = skillTrees.find((s) => s.steps.some((x) => x.exerciseId === step))!
      tree = { treeId: st.id, stepIndex: st.steps.findIndex((x) => x.exerciseId === step) }
      id = step
    }
    const ex = exerciseById[id]
    const d = effectiveDose(ex)
    const r = REST[ex.type]
    const own = ex.dose?.restSeconds
    let sets = kind === 'strength' || kind === 'secondary' || kind === 'core' ? d.sets[1] : kind === 'skill' || kind === 'conditioning' ? d.sets[0] : 1
    if (easy && sets > 1 && kind !== 'conditioning') sets--
    const longRest = ex.type === 'main_strength' ? (minutes >= 90 ? 60 : minutes >= 60 ? 30 : 0) : 0
    const rest = (own !== undefined && own >= r.range[0] && own <= r.range[1] ? own : r.base) + longRest + (tired && r.base >= 60 ? 30 : 0)
    const pe: PlannedExercise = { exerciseId: id, sets, restSeconds: Math.min(rest, r.range[1]), ...tree }
    if (ex.mode.startsWith('time')) pe.seconds = top(ex)
    else pe.reps = tired ? [d.reps![0], d.reps![0]] : d.reps
    if (ex.type === 'core' || ex.type === 'conditioning') {
      const [, work, rest] = INTERVALS.find(([max]) => (pe.seconds ?? 0) <= max)!
      if (pe.seconds) Object.assign(pe, { interval: true, seconds: work, restSeconds: rest })
      // rep-mode core/conditioning has no interval format
      else pe.restSeconds = r.range[1]
    }
    const flexKind = kind === 'flexibility' || kind === 'cooldown' || (tired && kind === 'warmup')
    caps.set(pe, kind === 'skill' ? (easy ? 4 : 5) : flexKind ? Math.min(3, d.sets[1]) : sets)
    used.add(id)
    return pe
  }

  const secs = (pe: PlannedExercise) => estimateSeconds(pe, exerciseById[pe.exerciseId])
  const blockSecs = (b: Block) => b.exercises.reduce((n, pe) => n + secs(pe), 0)
  const list = (kind: BlockKind, refs: string[]): Block => ({ kind, exercises: refs.map((r) => plan(r, kind)).filter((pe) => !!pe) })
  // adds exercises one at a time until the block reaches its budget
  const fill = (kind: BlockKind, refs: string[], budget: number): Block => {
    const b: Block = { kind, exercises: [] }
    for (const r of refs) {
      if (blockSecs(b) >= budget) break
      const pe = plan(r, kind)
      if (pe) b.exercises.push(pe)
    }
    return b
  }

  const lastSeen = (treeId: string) => Math.max(-Infinity, ...recent.filter((s) => s.plan.blocks.some((b) => b.exercises.some((pe) => pe.treeId === treeId))).map(ended))
  const skillTreeIds = dayType === 'full_body' ? [...FULL_BODY_SKILLS].sort((a, b) => lastSeen(a) - lastSeen(b)) : t.skills
  // skills are planned first so a strength alternate can't take a tree step's exercise
  const skill: Block = { kind: 'skill', exercises: [] }
  if (!short && minutes >= 20) {
    for (const s of skillTreeIds) {
      if (skill.exercises.length >= (minutes >= 75 ? 2 : 1)) break
      const pe = plan(`tree:${s}`, 'skill')
      if (pe) skill.exercises.push(pe)
    }
  }

  const strength: Block = { kind: 'strength', exercises: [] }
  for (const [a, b] of t.strengthPairs.slice(0, mode === 'bare' ? 1 : undefined)) {
    const pa = plan(a, 'strength')
    const pb = plan(b, 'strength')
    if (pa && pb) {
      [pa.pairWith, pb.pairWith] = [pb.exerciseId, pa.exerciseId]
      // pair alternation replaces the interval format
      for (const pe of [pa, pb]) {
        if (!pe.interval) continue
        delete pe.interval
        pe.restSeconds = REST[exerciseById[pe.exerciseId].type].range[1]
      }
    }
    for (const pe of [pa, pb]) if (pe) strength.exercises.push(short && !pe.interval ? Object.assign(pe, { restSeconds: 30 }) : pe)
  }

  const blocks: Block[] = [strength]
  if (!short) {
    if (minutes >= 20) blocks.push(skill)
    blocks.push(list('secondary', t.secondary), list('core', t.core))
    if (t.splits || minutes >= 75) blocks.push(list('flexibility', SPLITS_BLOCK))
    blocks.push(list('niggle_mobility', [...new Set(niggles.flatMap((a) => niggleMobility[a]))]))
  }

  const needsWrist = blocks.some((b) => b.exercises.some((pe) => exerciseById[pe.exerciseId].flags?.some((f) => f === 'hand_balancing' || f === 'needs_wrist_prep')))
  const budget = (share: number) => Math.min(600, Math.max(120, Math.round(minutes * 60 * share)))
  blocks.push(fill('warmup', [...(needsWrist ? ['wrist-prep'] : []), ...WARMUP_POOL], budget(0.08)))
  const cooldown = fill('cooldown', t.flexibility, budget(0.12))
  blocks.push(cooldown)
  const flex = blocks.find((b) => b.kind === 'flexibility')
  // PNF stretches only go at the end of the cool-down
  if (flex) {
    const pnf = (pe: PlannedExercise) => !!exerciseById[pe.exerciseId].flags?.includes('pnf')
    cooldown.exercises.push(...flex.exercises.filter(pnf))
    flex.exercises = flex.exercises.filter((pe) => !pnf(pe))
  }

  const target = minutes * 60
  const total = () => blocks.reduce((n, b) => n + blockSecs(b), 0)

  while (total() > target + 120) {
    let changed = false
    for (const [kind, floor] of REMOVE_ORDER) {
      const b = blocks.find((x) => x.kind === kind && x.exercises.length)
      if (!b) continue
      const pe = [...b.exercises].filter((x) => x.sets > floor).sort((x, y) => y.sets - x.sets)[0]
      if (pe) pe.sets--
      else if (kind !== 'strength') b.exercises = []
      else continue
      changed = true
      break
    }
    if (!changed) break
  }

  const stretchSecs = (area: string) =>
    [...cooldown.exercises, ...(flex?.exercises ?? [])]
      .filter((pe) => exerciseById[pe.exerciseId].stretchAreas?.includes(area as never))
      .reduce((n, pe) => n + pe.sets * (pe.seconds ?? 0), 0)
  const fitsOneMore = (pe: PlannedExercise) => total() + secs({ ...pe, sets: 1 }) <= target + 120
  const growable = (b: Block | undefined, extra: (pe: PlannedExercise) => boolean = () => true) =>
    (b?.exercises ?? []).filter((pe) => pe.sets < (caps.get(pe) ?? pe.sets) && extra(pe) && fitsOneMore(pe)).sort((x, y) => x.sets - y.sets)[0]
  const stretchRoom = (pe: PlannedExercise) => (exerciseById[pe.exerciseId].stretchAreas ?? []).every((a) => stretchSecs(a) + (pe.seconds ?? 0) <= STRETCH_AREA_CAP)

  let finisherTried = false
  while (total() < target - 120) {
    // tired days fill spare time with mobility and flexibility instead of strength and skill
    const pe = tired
      ? (growable(blocks.find((b) => b.kind === 'warmup'), stretchRoom) ?? growable(cooldown, stretchRoom) ?? growable(flex, stretchRoom))
      : (growable(strength) ?? growable(skill) ?? growable(flex ?? cooldown, stretchRoom))
    if (pe) {
      pe.sets++
      continue
    }
    const extra = tired ? WARMUP_POOL.find((r) => ok(r, 'warmup')) : undefined
    const more = extra && plan(extra, 'warmup')
    if (more) {
      if (fitsOneMore(more)) blocks.find((b) => b.kind === 'warmup')!.exercises.push(more)
      continue
    }
    const maxRest = (x: PlannedExercise) => REST[exerciseById[x.exerciseId].type].range[1]
    const slow = skill.exercises.find((x) => x.restSeconds < maxRest(x) && total() + x.sets * 30 <= target + 120)
    if (slow) {
      slow.restSeconds = Math.min(maxRest(slow), slow.restSeconds + 30)
      continue
    }
    if (finisherTried || short || tired || !t.conditioning.length) break
    finisherTried = true
    const finisher: Block = { kind: 'conditioning', exercises: [] }
    blocks.push(finisher)
    for (const r of t.conditioning) {
      const c = plan(r, 'conditioning')
      if (c && total() + secs(c) <= target + 120) finisher.exercises.push(c)
    }
  }

  const warmup = blocks.find((b) => b.kind === 'warmup')!
  const stillNeedsWrist = blocks.some((b) => b.kind !== 'warmup' && b.exercises.some((pe) => exerciseById[pe.exerciseId].flags?.some((f) => f === 'hand_balancing' || f === 'needs_wrist_prep')))
  if (!stillNeedsWrist) warmup.exercises = warmup.exercises.filter((pe) => pe.exerciseId !== 'wrist-prep')

  const date = now.toISOString().slice(0, 10)
  const ordered = blocks.filter((b) => b.exercises.length).sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind))
  return { id: `${date}-${dayType}`, date, dayType, mode, location, minutesTarget: minutes, blocks: ordered, estSeconds: total() }
}
