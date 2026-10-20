import type { Exercise } from '../../content/schema'
import { effectiveDose, exerciseById, exercises, niggleMobility, skillTrees, tests } from '../content'
import { COOLDOWN_AREAS, dayTemplates, FOOT_POOL, FULL_BODY_SKILLS, SPLITS_BLOCK, WARMUP_POOL } from './dayTemplates'
import { abilityStep, currentStep, withinAbility } from './progression'
import type { Block, BlockKind, DayMode, DayType, Location, PlannedExercise, SessionPlan, SessionRecord, SetLog, Settings, SkillProgress } from './types'

const HOUR = 3600 * 1000
const ROTATION: DayType[] = ['pull', 'push', 'legs', 'skill_core']
const ORDER: BlockKind[] = ['warmup', 'niggle_mobility', 'balance', 'spring', 'skill', 'strength', 'secondary', 'core', 'conditioning', 'flexibility', 'cooldown']
// [kind, lowest sets per exercise before the next step]
const REMOVE_ORDER: [BlockKind, number][] = [['conditioning', 1], ['secondary', 1], ['core', 1], ['spring', 1], ['balance', 1], ['cooldown', 1], ['secondary', 1], ['strength', 2], ['cooldown', 1], ['skill', 1], ['strength', 1]]
const STRETCH_AREA_CAP = 240
// [session minutes, cool-down minutes], linear in between
const COOLDOWN_SIZE = [[10, 2], [30, 5], [60, 8], [90, 20]]
const COOLDOWN_MIN = 120
const coolMinutes = (m: number) => {
  const i = COOLDOWN_SIZE.findIndex(([x]) => m < x)
  // below 10 min the first point, from 90 min the last
  if (i <= 0) return COOLDOWN_SIZE.at(i)![1]
  const [[m0, c0], [m1, c1]] = [COOLDOWN_SIZE[i - 1], COOLDOWN_SIZE[i]]
  return c0 + ((c1 - c0) * (m - m0)) / (m1 - m0)
}
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
const flagged = (ex: Exercise | undefined, f: NonNullable<Exercise['flags']>[number]) => !!ex?.flags?.includes(f)
const plyo = (ex: Exercise | undefined) => flagged(ex, 'spring') && flagged(ex, 'explosive')

// ground contacts of one planned plyo exercise
export const contacts = (pe: PlannedExercise, ex: Exercise) =>
  plyo(ex) ? pe.sets * (pe.seconds !== undefined ? pe.seconds * 2 : (pe.reps?.[1] ?? 0)) * (ex.mode.endsWith('per_side') ? 2 : 1) : 0

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
  return fresh.sort((a, b) => count(a) - count(b))[0] ?? (week.length >= 5 ? 'movement' : 'light')
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
    // no plyo on legs days
    return !!ex && !used.has(id) && !settings.neverShow.includes(id) && (location === 'gym' || ex.homeOk) && niggleOk && !(dayType === 'legs' && plyo(ex))
  }
  const fav = (id: string) => +settings.favourites.includes(id)

  function plan(ref: string, kind: BlockKind, subbed = false): PlannedExercise | undefined {
    let id = ref
    let tree: { treeId?: string; stepIndex?: number } = {}
    let weakSide: 'left' | 'right' | undefined
    if (ref.startsWith('tree:')) {
      const st = skillTrees.find((s) => s.id === ref.slice(5))!
      if (st.perSide) {
        // weaker side: lower step, else the larger last logged cm on that step
        const [l, r] = (['left', 'right'] as const).map((side) => currentStep(progress, st, now, bests, side).stepIndex)
        const lastCm = (side: 'left' | 'right') =>
          input.recentLogs.filter((x) => x.exerciseId === st.steps[l].exerciseId && x.side === side && x.cmFromFloor !== undefined).sort((a, b) => a.at.localeCompare(b.at)).at(-1)?.cmFromFloor ?? -Infinity
        weakSide = l < r ? 'left' : r < l ? 'right' : lastCm('left') > lastCm('right') ? 'left' : lastCm('right') > lastCm('left') ? 'right' : undefined
      }
      // tied per-side trees read the left entry (both sides are on the same step)
      const side = weakSide ?? (st.perSide ? 'left' : undefined)
      const cs = currentStep(progress, st, now, bests, side)
      const dropped = progress.find((p) => p.treeId === st.id && p.side === side)?.droppedUntil
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
    let sets = kind === 'balance' ? 2 : kind === 'strength' || kind === 'secondary' || kind === 'core' || kind === 'spring' ? d.sets[1] : kind === 'skill' || kind === 'conditioning' ? d.sets[0] : 1
    if (easy && sets > 1 && kind !== 'conditioning') sets--
    const stepTarget = tree.treeId ? skillTrees.find((s) => s.id === tree.treeId)!.steps[tree.stepIndex!].target : undefined
    if (kind === 'balance' && stepTarget) sets = stepTarget.sets
    if (stepTarget?.cmFromFloor !== undefined) sets = ex.mode.startsWith('time') ? Math.min(stepTarget.sets, Math.floor(STRETCH_AREA_CAP / top(ex))) : stepTarget.sets
    const longRest = ex.type === 'main_strength' ? (minutes >= 90 ? 60 : minutes >= 60 ? 30 : 0) : 0
    const rest = (own !== undefined && own >= r.range[0] && own <= r.range[1] ? own : r.base) + longRest + (tired && r.base >= 60 ? 30 : 0)
    const pe: PlannedExercise = { exerciseId: id, sets, restSeconds: Math.min(rest, r.range[1]), ...tree, ...(tree.treeId && weakSide && { weakSide }) }
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

  // least recently logged first; never-logged ones keep list order
  const lastDone = (id: string) => Math.max(-Infinity, ...input.recentLogs.filter((l) => l.exerciseId === id).map((l) => new Date(l.at).getTime()))
  const rotate = (ids: string[]) => [...ids].sort((a, b) => lastDone(a) - lastDone(b))
  const withFlag = (f: Parameters<typeof flagged>[1]) => exercises.filter((x) => flagged(x, f)).map((x) => x.id)
  // fixed-dose extras (segment, stabilisers, active flex): exactly `sets` at the dose top, never grown
  const pick = (ids: string[], kind: BlockKind, n: number, sets: number) => {
    const out: PlannedExercise[] = []
    for (const id of ids) {
      if (out.length >= n) break
      const pe = plan(id, kind)
      if (!pe) continue
      pe.sets = sets
      caps.set(pe, sets)
      out.push(pe)
    }
    return out
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
  if (t.balance) blocks.push(list('balance', t.balance))
  if (t.spring) blocks.push(list('spring', t.spring.map((r) => (r === 'jump-rope' && location === 'home' ? 'pogo-hop' : r))))
  if (!short) {
    if (minutes >= 20) blocks.push(skill)
    // under 60 min the stabiliser takes the last template slot
    const replace = dayType !== 'movement' && minutes < 60 && t.secondary.length > 0
    const secondary = list('secondary', replace ? t.secondary.slice(0, -1) : t.secondary)
    const [nStab, stabSets] = dayType === 'movement' ? [3, 2] : minutes >= 60 ? [1, 2] : [1, 1]
    const stabs = pick(rotate(withFlag('stabiliser')), 'secondary', nStab, stabSets)
    secondary.exercises.push(...(replace && !stabs.length ? list('secondary', t.secondary.slice(-1)).exercises : stabs))
    blocks.push(secondary, list('core', t.core))
    blocks.push(list('niggle_mobility', [...new Set(niggles.flatMap((a) => niggleMobility[a]))]))
  }

  // weekly stretch seconds per area from stretch/mobility logs; reps count 3 s each like estimateSeconds
  const weekLogs = input.recentLogs.filter((l) => now.getTime() - new Date(l.at).getTime() < 7 * 24 * HOUR)
  const logged = (area: string) =>
    weekLogs
      .filter((l) => ['stretch', 'mobility'].includes(exerciseById[l.exerciseId]?.type) && exerciseById[l.exerciseId].stretchAreas?.includes(area as never))
      .reduce((n, l) => n + (l.seconds ?? (l.reps ?? 0) * 3), 0)
  // largest deficit against the 10 min/area/week target first, i.e. fewest logged seconds
  const areas = Object.keys(COOLDOWN_AREAS).sort((a, b) => logged(a) - logged(b))
  const splits = !short && (t.splits || minutes >= 75)
  const coolRefs = [...new Set([...areas.flatMap((a) => COOLDOWN_AREAS[a]), ...(splits ? SPLITS_BLOCK : []), ...t.flexibility])]
  // the cool-down is filled before the wrist check since a bridge step can need wrist prep
  const coolTarget = Math.round(coolMinutes(minutes) * 60)
  // active-flex drills count toward the cool-down budget; they sit first here so trimming pops passive stretches, and move after them at the end
  const activeFlex = short ? [] : pick(rotate(withFlag('active_flex')), 'cooldown', dayType === 'movement' ? 2 : 1, 1)
  const cooldown = fill('cooldown', coolRefs, coolTarget - activeFlex.reduce((n, pe) => n + secs(pe), 0))
  cooldown.exercises.unshift(...activeFlex)
  blocks.push(cooldown)

  const needsWrist = blocks.some((b) => b.exercises.some((pe) => exerciseById[pe.exerciseId].flags?.some((f) => f === 'hand_balancing' || f === 'needs_wrist_prep')))
  const budget = (share: number) => Math.min(600, Math.max(120, Math.round(minutes * 60 * share)))
  const warm = fill('warmup', [...(needsWrist ? ['wrist-prep'] : []), ...WARMUP_POOL], budget(0.08))
  // balance segment on top of the mobility budget: jump rope from 30 min, feet item and longer holds from 60
  const [bal] = pick(['tree:balance'], 'warmup', 1, 1)
  if (bal?.seconds !== undefined) bal.seconds = minutes >= 60 ? 30 : 20
  // one short set can't meet the tree target, so the warm-up item doesn't score the tree
  if (bal) {
    delete bal.treeId
    delete bal.stepIndex
  }
  const segStart = warm.exercises.length
  warm.exercises.push(...(bal ? [bal] : []))
  const [feet] = minutes >= 60 ? pick(rotate(FOOT_POOL), 'warmup', 1, 1) : []
  const [rope] = minutes >= 30 && location === 'gym' && dayType !== 'legs' ? pick(['jump-rope'], 'warmup', 1, 1) : []
  if (rope) rope.seconds = minutes >= 60 ? 45 : 30
  warm.exercises.push(...[feet, rope].filter((pe) => !!pe))
  // warm-up pace: mobility rest instead of skill-hold rest, so the segment stays short
  for (const pe of warm.exercises.slice(segStart)) pe.restSeconds = REST.mobility.base
  blocks.push(warm)

  const target = minutes * 60
  const total = () => blocks.reduce((n, b) => n + blockSecs(b), 0)

  while (total() > target + 120) {
    let changed = false
    for (const [i, [kind, floor]] of REMOVE_ORDER.entries()) {
      const b = blocks.find((x) => x.kind === kind && x.exercises.length)
      if (!b) continue
      // the first cool-down pass stops at its target, the late one at the 2 min floor
      const coolFloor = i === REMOVE_ORDER.findIndex(([k]) => k === 'cooldown') ? Math.max(coolTarget, COOLDOWN_MIN) : COOLDOWN_MIN
      const keeps = (s: number) => kind !== 'cooldown' || blockSecs(b) - s >= coolFloor
      const pe = b.exercises.filter((x) => x.sets > floor && keeps(secs(x) / x.sets)).sort((x, y) => y.sets - x.sets)[0]
      if (pe) pe.sets--
      else if (kind === 'cooldown' && b.exercises.length > 1 && keeps(secs(b.exercises.at(-1)!))) b.exercises.pop()
      // strength and the movement-day blocks only lose sets, never the whole block
      else if (!['strength', 'cooldown', 'balance', 'spring'].includes(kind)) b.exercises = []
      else continue
      changed = true
      break
    }
    if (!changed) break
  }

  const stretchSecs = (area: string) =>
    cooldown.exercises
      .filter((pe) => exerciseById[pe.exerciseId].stretchAreas?.includes(area as never))
      .reduce((n, pe) => n + pe.sets * (pe.seconds ?? 0), 0)
  const fitsOneMore = (pe: PlannedExercise) => total() + secs({ ...pe, sets: 1 }) <= target + 120
  const growable = (b: Block | undefined, extra: (pe: PlannedExercise) => boolean = () => true) =>
    (b?.exercises ?? []).filter((pe) => pe.sets < (caps.get(pe) ?? pe.sets) && extra(pe) && fitsOneMore(pe)).sort((x, y) => x.sets - y.sets)[0]
  const stretchRoom = (pe: PlannedExercise) => (exerciseById[pe.exerciseId].stretchAreas ?? []).every((a) => stretchSecs(a) + (pe.seconds ?? 0) <= STRETCH_AREA_CAP)
  // the cool-down stops growing once it reaches its size for the session length
  const coolRoom = (pe: PlannedExercise) => blockSecs(cooldown) < coolTarget && stretchRoom(pe)

  let finisherTried = false
  while (total() < target - 120) {
    // tired days fill spare time with mobility and flexibility instead of strength and skill
    const pe = tired
      ? (growable(blocks.find((b) => b.kind === 'warmup'), stretchRoom) ?? growable(cooldown, coolRoom))
      : (growable(strength) ?? growable(skill) ?? growable(cooldown, coolRoom))
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

  // passive stretches, then active flex, then PNF last
  const coolRank = (pe: PlannedExercise) => (flagged(exerciseById[pe.exerciseId], 'pnf') ? 2 : activeFlex.includes(pe) ? 1 : 0)
  cooldown.exercises.sort((a, b) => coolRank(a) - coolRank(b))

  const date = now.toISOString().slice(0, 10)
  const ordered = blocks.filter((b) => b.exercises.length).sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind))
  // contact cap: drop plyo sets from the last block backwards
  const cap = dayType === 'movement' ? 200 : 100
  const allContacts = () => ordered.reduce((n, b) => n + b.exercises.reduce((m, pe) => m + contacts(pe, exerciseById[pe.exerciseId]), 0), 0)
  for (const b of [...ordered].reverse())
    for (const pe of [...b.exercises].reverse())
      while (allContacts() > cap && contacts(pe, exerciseById[pe.exerciseId]) > 0) if (!--pe.sets) b.exercises.splice(b.exercises.indexOf(pe), 1)
  const kept = ordered.filter((b) => b.exercises.length)
  return { id: `${date}-${dayType}`, date, dayType, mode, location, minutesTarget: minutes, blocks: kept, estSeconds: total() }
}
