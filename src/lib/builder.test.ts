import { describe, expect, it } from 'vitest'
import { exerciseById, niggleMobility, skillTrees, tests } from '../content'
import { dayTemplates, FOOT_POOL } from './dayTemplates'
import { available, buildSession, buildTestSession, contacts, estimateSeconds, pickDayType, REST } from './builder'
import { bestsFromLogs, coreTestsOrdered, isTestDay, testDayType, untestedThisWeek } from './program'
import { currentStep } from './progression'
import type { DayMode, DayType, Equipment, Location, MilestoneResult, SessionPlan, SessionRecord, SetLog, Settings, SkillProgress } from './types'

const now = new Date('2026-10-20T08:00:00Z')
const settings: Settings = { weeklyTarget: 4, countdownSeconds: 10, voice: true, beeps: true, voiceRate: 1, sidePause: true, bands: [], neverShow: [], favourites: [], niggles: [], bests: {}, headphoneControls: false, lastDraft: { minutes: 30, location: 'gym', mode: 'normal' }, placed: true }
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600 * 1000).toISOString()

const build = (minutes: number, over: { mode?: DayMode; location?: Location; settings?: Settings; recent?: SessionRecord[]; progress?: SkillProgress[]; recentLogs?: SetLog[] } = {}) =>
  buildSession({ minutes, location: 'gym', mode: 'normal', now, recent: [], recentLogs: [], progress: [], ...over, settings: over.settings ?? settings })
const exercisesOf = (plan: SessionPlan, kind: string) => plan.blocks.filter((b) => b.kind === kind).flatMap((b) => b.exercises)
const all = (plan: SessionPlan) => plan.blocks.flatMap((b) => b.exercises)
const done = (dayType: DayType, h: number): SessionRecord => ({ plan: { dayType } as SessionPlan, startedAt: hoursAgo(h), endedAt: hoursAgo(h), completed: true })

describe('buildSession', () => {
  it('builds a 10 min session as warmup, strength, cooldown with two pairs', () => {
    const plan = build(10)
    expect(plan.blocks.map((b) => b.kind)).toEqual(['warmup', 'strength', 'cooldown'])
    const strength = exercisesOf(plan, 'strength')
    expect(strength).toHaveLength(4)
    for (const pe of strength) expect(strength.find((o) => o.exerciseId === pe.pairWith)?.pairWith).toBe(pe.exerciseId)
  })

  it.each([20, 30])('includes a skill block and fits %i min within 2.5 min', (minutes) => {
    const plan = build(minutes)
    expect(plan.blocks.some((b) => b.kind === 'skill')).toBe(true)
    expect(Math.abs(plan.estSeconds - minutes * 60)).toBeLessThanOrEqual(150)
  })

  it.each([60, 90])('fits %i min within 10%', (minutes) => {
    const plan = build(minutes)
    expect(Math.abs(plan.estSeconds - minutes * 60)).toBeLessThanOrEqual(minutes * 60 * 0.1)
  })

  it('has two skill exercises at 90 min', () => {
    expect(exercisesOf(build(90), 'skill')).toHaveLength(2)
  })

  it('rests at least 60 s longer on main strength at 90 min than at 30 min', () => {
    const rest = (minutes: number) => exercisesOf(build(minutes), 'strength').find((pe) => pe.exerciseId === 'trx-row')!.restSeconds
    expect(rest(90) - rest(30)).toBeGreaterThanOrEqual(60)
  })

  it('fits a non-preset 37 min within 2.5 min', () => {
    expect(Math.abs(build(37).estSeconds - 37 * 60)).toBeLessThanOrEqual(150)
  })

  it('a 10 min normal session still has warmup, strength with two pairs and cooldown', () => {
    const plan = build(10, { mode: 'normal' })
    expect(plan.blocks.map((b) => b.kind)).toEqual(['warmup', 'strength', 'cooldown'])
    expect(exercisesOf(plan, 'strength')).toHaveLength(4)
  })

  it('tired mode drops a set and adds rest on strength exercises', () => {
    const normal = exercisesOf(build(60), 'strength')
    const tired = exercisesOf(build(60, { mode: 'tired' }), 'strength')
    expect(tired.length).toBeGreaterThan(0)
    for (const pe of tired) {
      const base = normal.find((n) => n.exerciseId === pe.exerciseId)!
      expect(pe.sets).toBe(Math.max(1, base.sets - 1))
      expect(pe.restSeconds).toBeGreaterThanOrEqual(base.restSeconds + 30)
    }
  })

  it('only plans home-friendly exercises at home', () => {
    for (const pe of all(build(30, { location: 'home' }))) expect(exerciseById[pe.exerciseId].homeOk).toBe(true)
  })

  it('works around a wrist niggle', () => {
    const wrist = { ...settings, niggles: [{ area: 'wrist' as const, startedAt: hoursAgo(48) }] }
    const plan = build(30, { settings: wrist })
    const mobility = exercisesOf(plan, 'niggle_mobility')
    expect(mobility.length).toBeGreaterThan(0)
    for (const pe of mobility) expect(niggleMobility.wrist).toContain(pe.exerciseId)
    for (const b of plan.blocks.filter((b) => b.kind !== 'niggle_mobility')) {
      for (const pe of b.exercises) expect(exerciseById[pe.exerciseId].loads).not.toContain('wrist')
    }
    const handstand = skillTrees.find((t) => t.id === 'handstand')!.steps.map((s) => s.exerciseId)
    for (const pe of all(plan)) {
      expect(pe.treeId).not.toBe('handstand')
      expect(handstand).not.toContain(pe.exerciseId)
    }
  })

  it('omits an exercise in neverShow', () => {
    const id = skillTrees.find((t) => t.id === 'pull-up')!.steps[0].exerciseId
    const plan = build(30, { settings: { ...settings, neverShow: [id] } })
    expect(all(plan).map((pe) => pe.exerciseId)).not.toContain(id)
  })

  it('substitutes a gated dragon-flag step on a skill_core day', () => {
    const recent = [done('pull', 96), done('push', 72), done('legs', 36)]
    const plan = build(30, { recent })
    expect(plan.dayType).toBe('skill_core')
    const ids = all(plan).map((pe) => pe.exerciseId)
    expect(ids).not.toContain('dragon-flag-tuck-negative')
    expect(ids).toContain('hanging-leg-raise')
  })
})

describe('rest, intervals and too-easy', () => {
  const skillCore = [done('pull', 96), done('push', 72), done('legs', 36)]
  const withBests = (bests: Record<string, number>) => ({ ...settings, bests })

  it('plans rest by exercise type within REST range', () => {
    const plan = build(30)
    expect(plan.dayType).toBe('pull')
    for (const pe of all(plan)) {
      const type = exerciseById[pe.exerciseId].type
      if (type === 'mobility' || type === 'stretch') expect(pe.restSeconds).toBe(8)
      else if (type === 'core' || type === 'conditioning') continue
      else {
        const { base, range } = REST[type]
        expect(pe.restSeconds === base || (pe.restSeconds >= range[0] && pe.restSeconds <= range[1])).toBe(true)
      }
    }
  })

  it('keeps 30 s strength rest at 10 min (known exception to REST ranges)', () => {
    for (const pe of exercisesOf(build(10), 'strength')) expect(pe.restSeconds).toBe(30)
  })

  it('uses 30 s rest and no interval for paired timed core', () => {
    const plan = build(30, { recent: skillCore })
    expect(plan.dayType).toBe('skill_core')
    const timed = all(plan).filter((pe) => exerciseById[pe.exerciseId].type === 'core' && pe.seconds && pe.pairWith)
    expect(timed.length).toBeGreaterThan(0)
    for (const pe of timed) {
      expect(pe.interval).toBeFalsy()
      expect(pe.restSeconds).toBe(30)
    }
  })

  it('uses interval format for unpaired timed core', () => {
    const plan = build(60)
    expect(plan.dayType).toBe('pull')
    const formatRest: Record<number, number> = { 20: 10, 30: 15, 40: 20, 60: 20 }
    const hold = exercisesOf(plan, 'core').find((pe) => pe.exerciseId === 'hollow-hold')!
    expect(hold).toBeDefined()
    expect(hold.pairWith).toBeFalsy()
    expect(hold.interval).toBe(true)
    expect(Object.keys(formatRest).map(Number)).toContain(hold.seconds)
    expect(hold.restSeconds).toBe(formatRest[hold.seconds!])
  })

  it('moves hollow-hold up to hollow-rock when the best is 2x the top dose', () => {
    const ids = (s: Settings) => all(build(30, { recent: skillCore, settings: s })).map((pe) => pe.exerciseId)
    expect(ids(settings)).toContain('hollow-hold')
    const easy = ids(withBests({ 'hollow-hold': 120 }))
    expect(easy).toContain('hollow-rock')
    expect(easy).not.toContain('hollow-hold')
  })

  it('plans freestanding-handstand once the gate is met, else the kick-up', () => {
    const progress = [{ treeId: 'handstand', stepIndex: 5, hits: 0, misses: 0 }]
    const ids = (s: Settings) => all(build(30, { recent: skillCore, settings: s, progress })).map((pe) => pe.exerciseId)
    expect(ids(withBests({ 'chest-to-wall-handstand-hold': 60 }))).toContain('freestanding-handstand')
    const locked = ids(settings)
    expect(locked).toContain('handstand-kick-up')
    expect(locked).not.toContain('freestanding-handstand')
  })

  it('tired skill_core day has no conditioning block and main strength rest <= 180', () => {
    const plan = build(30, { mode: 'tired', recent: skillCore })
    expect(plan.dayType).toBe('skill_core')
    expect(plan.blocks.map((b) => b.kind)).not.toContain('conditioning')
    for (const pe of all(plan)) if (exerciseById[pe.exerciseId].type === 'main_strength') expect(pe.restSeconds).toBeLessThanOrEqual(180)
  })
})

describe('pickDayType', () => {
  it('starts with pull when there is no history', () => {
    expect(pickDayType([], settings, now)).toBe('pull')
  })

  it('follows the rotation after a pull session', () => {
    expect(pickDayType([done('pull', 72)], settings, now)).toBe('push')
  })

  it('picks skill_core after pull, push and legs', () => {
    expect(pickDayType([done('pull', 96), done('push', 72), done('legs', 36)], settings, now)).toBe('skill_core')
  })

  it('picks light when every pattern was trained in the last 48 h', () => {
    const recent = [done('pull', 40), done('push', 30), done('legs', 20), done('skill_core', 10)]
    expect(pickDayType(recent, settings, now)).toBe('light')
  })

  it('picks full_body when returning after a week away', () => {
    expect(pickDayType([done('pull', 240)], settings, now)).toBe('full_body')
  })

  it('picks full_body with a weekly target of 3', () => {
    expect(pickDayType([], { ...settings, weeklyTarget: 3 }, now)).toBe('full_body')
  })
})

describe('placement at pull-up step 4', () => {
  const placed: Settings = { ...settings, bests: { 'pull-up': 2 } }
  const progress: SkillProgress[] = [{ treeId: 'pull-up', stepIndex: 4, hits: 0, misses: 0 }]
  const blocked = ['high-pull-up', 'band-assisted-muscle-up', 'muscle-up-negative', 'bar-muscle-up', 'pull-up', 'chest-to-bar-pull-up', 'explosive-pull-up', 'skin-the-cat', 'tuck-front-lever']
  const cases: [string, DayType, SessionRecord[], Partial<Settings>][] = [
    ['empty', 'pull', [], {}],
    ['after pull', 'push', [done('pull', 72)], {}],
    ['after pull+push', 'legs', [done('pull', 96), done('push', 72)], {}],
    ['after pull+push+legs', 'skill_core', [done('pull', 96), done('push', 72), done('legs', 36)], {}],
    ['weekly target 3', 'full_body', [], { weeklyTarget: 3 }],
    ['all within 48 h', 'light', [done('pull', 40), done('push', 30), done('legs', 20), done('skill_core', 10)], {}],
  ]

  it.each(cases)('never plans a blocked exercise: %s', (_name, dayType, recent, over) => {
    for (const minutes of [10, 30, 60, 90, 120]) {
      for (const location of ['gym', 'home'] as Location[]) {
        for (const mode of ['normal', 'tired'] as DayMode[]) {
          const plan = build(minutes, { recent, progress, location, mode, settings: { ...placed, ...over } })
          const ctx = `${dayType} ${minutes} ${location} ${mode}`
          expect(plan.dayType, ctx).toBe(dayType)
          for (const pe of all(plan)) expect(blocked, ctx).not.toContain(pe.exerciseId)
          if (location === 'gym' && ['pull', 'push', 'full_body'].includes(dayType)) {
            expect(all(plan).find((pe) => pe.exerciseId === 'band-assisted-pull-up'), ctx).toMatchObject({ treeId: 'pull-up', stepIndex: 4 })
          }
        }
      }
    }
  })

  it('swaps a gated muscle-up skill slot for band-assisted-pull-up on the pull-up tree', () => {
    const original = dayTemplates.pull.skills
    dayTemplates.pull.skills = ['muscle-up']
    try {
      const skill = exercisesOf(build(30, { progress, settings: placed }), 'skill')
      expect(skill).toHaveLength(1)
      expect(skill[0]).toMatchObject({ exerciseId: 'band-assisted-pull-up', treeId: 'pull-up', stepIndex: 4 })
    } finally {
      dayTemplates.pull.skills = original
    }
  })
})

describe('per-side weakSide', () => {
  const legs = [done('pull', 72), done('push', 24)]
  const sided = (left: number, right: number): SkillProgress[] => [
    { treeId: 'front-split', side: 'left', stepIndex: left, hits: 0, misses: 0 },
    { treeId: 'front-split', side: 'right', stepIndex: right, hits: 0, misses: 0 },
  ]
  const split = (progress: SkillProgress[]) => {
    const plan = build(90, { recent: legs, progress })
    expect(plan.dayType).toBe('legs')
    return all(plan).find((pe) => pe.treeId === 'front-split')!
  }

  it.each([['left', 3, 4], ['right', 4, 3]] as const)('plans the weaker %s side step', (side, left, right) => {
    expect(split(sided(left, right))).toMatchObject({ exerciseId: skillTrees.find((t) => t.id === 'front-split')!.steps[3].exerciseId, stepIndex: 3, weakSide: side })
  })

  it('has no weakSide when both sides are on the same step with no logs', () => {
    expect(split(sided(3, 3)).weakSide).toBeUndefined()
  })
})

describe('cool-down', () => {
  const secondsOf = (b: SessionPlan['blocks'][number]) => b.exercises.reduce((n, pe) => n + estimateSeconds(pe, exerciseById[pe.exerciseId]), 0)
  const days: [DayType, SessionRecord[]][] = [
    ['pull', []],
    ['push', [done('pull', 72)]],
    ['skill_core', [done('pull', 96), done('push', 72), done('legs', 36)]],
  ]

  it.each(days)('ends a 60 min %s day with a 6+ min cool-down that includes a splits or bridge tree', (dayType, recent) => {
    const plan = build(60, { recent })
    expect(plan.dayType).toBe(dayType)
    const last = plan.blocks.at(-1)!
    expect(last.kind).toBe('cooldown')
    expect(secondsOf(last)).toBeGreaterThanOrEqual(360)
    expect(last.exercises.some((pe) => ['front-split', 'middle-split', 'bridge'].includes(pe.treeId ?? ''))).toBe(true)
    expect(plan.blocks.map((b) => b.kind)).not.toContain('flexibility')
  })

  it('ends a 10 min session with a 90-180 s cool-down', () => {
    const last = build(10).blocks.at(-1)!
    expect(last.kind).toBe('cooldown')
    expect(secondsOf(last)).toBeGreaterThanOrEqual(90)
    expect(secondsOf(last)).toBeLessThanOrEqual(180)
  })

  it('starts with a non-hamstring stretch once hamstrings have 10 min logged this week', () => {
    const recentLogs: SetLog[] = Array.from({ length: 10 }, (_, i) => ({ id: `h${i}`, sessionId: 's', exerciseId: 'standing-hamstring-stretch', setIndex: i, seconds: 60, repsLeft: 1, mode: 'normal', at: hoursAgo(48) }))
    expect(exerciseById['standing-hamstring-stretch'].stretchAreas).toContain('hamstrings')
    const first = build(60, { recentLogs }).blocks.at(-1)!.exercises[0]
    expect(exerciseById[first.exerciseId].stretchAreas).not.toContain('hamstrings')
  })
})

describe('warm-up segment, cool-down active flex, stabilisers, contacts and movement day', () => {
  const flagOf = (id: string, f: string) => !!(exerciseById[id].flags as string[] | undefined)?.includes(f)
  const inBlock = (plan: SessionPlan, kind: string, f: string) => exercisesOf(plan, kind).filter((pe) => flagOf(pe.exerciseId, f))
  const warm = (plan: SessionPlan) => exercisesOf(plan, 'warmup')
  const legsHistory = [done('pull', 72), done('push', 24)]
  const skillCore = [done('pull', 96), done('push', 72), done('legs', 36)]
  const movement = [done('pull', 46), done('pull', 40), done('push', 30), done('legs', 20), done('skill_core', 10)]
  const total = (plan: SessionPlan) => all(plan).reduce((n, pe) => n + contacts(pe, exerciseById[pe.exerciseId]), 0)

  it('30 min gym pull warm-up has a balance item and jump rope for 30 s', () => {
    const plan = build(30)
    expect(plan.dayType).toBe('pull')
    const bal = warm(plan).filter((pe) => flagOf(pe.exerciseId, 'balance'))
    expect(bal).toHaveLength(1)
    expect(bal[0].exerciseId).toBe('single-leg-stance')
    expect(exerciseById['single-leg-stance'].mode).toBe('time_per_side')
    expect(warm(plan).find((pe) => pe.exerciseId === 'jump-rope')?.seconds).toBe(30)
  })

  it('60 min gym pull warm-up has balance for 30 s, one foot item and jump rope for 45 s', () => {
    const plan = build(60)
    expect(plan.dayType).toBe('pull')
    expect(inBlock(plan, 'warmup', 'balance')[0].seconds).toBe(30)
    expect(warm(plan).filter((pe) => FOOT_POOL.includes(pe.exerciseId))).toHaveLength(1)
    expect(warm(plan).find((pe) => pe.exerciseId === 'jump-rope')?.seconds).toBe(45)
  })

  it('30 min home pull warm-up has balance and no jump rope', () => {
    const plan = build(30, { location: 'home' })
    expect(inBlock(plan, 'warmup', 'balance').length).toBeGreaterThan(0)
    expect(warm(plan).map((pe) => pe.exerciseId)).not.toContain('jump-rope')
  })

  it('60 min gym legs day has balance and a foot item, no jump rope and no plyo anywhere', () => {
    const plan = build(60, { recent: legsHistory })
    expect(plan.dayType).toBe('legs')
    expect(inBlock(plan, 'warmup', 'balance').length).toBeGreaterThan(0)
    expect(warm(plan).filter((pe) => FOOT_POOL.includes(pe.exerciseId))).toHaveLength(1)
    expect(warm(plan).map((pe) => pe.exerciseId)).not.toContain('jump-rope')
    expect(all(plan).filter((pe) => flagOf(pe.exerciseId, 'spring') && flagOf(pe.exerciseId, 'explosive'))).toEqual([])
  })

  it('10 min gym pull warm-up has the balance item only', () => {
    const plan = build(10)
    expect(inBlock(plan, 'warmup', 'balance')).toHaveLength(1)
    expect(warm(plan).filter((pe) => FOOT_POOL.includes(pe.exerciseId))).toEqual([])
    expect(warm(plan).map((pe) => pe.exerciseId)).not.toContain('jump-rope')
  })

  it('60 min gym pull cool-down has one active_flex drill after passive stretches and before pnf', () => {
    const plan = build(60)
    const last = plan.blocks.at(-1)!
    expect(last.kind).toBe('cooldown')
    const idx = (f: (id: string) => boolean) => last.exercises.flatMap((pe, i) => (f(pe.exerciseId) ? [i] : []))
    const active = idx((id) => flagOf(id, 'active_flex'))
    expect(active).toHaveLength(1)
    const passive = idx((id) => !flagOf(id, 'active_flex') && !flagOf(id, 'pnf'))
    expect(Math.max(...passive)).toBeLessThan(active[0])
    for (const i of idx((id) => flagOf(id, 'pnf'))) expect(i).toBeGreaterThan(active[0])
  })

  it('10 min pull cool-down has no active_flex drill', () => {
    expect(inBlock(build(10), 'cooldown', 'active_flex')).toEqual([])
  })

  it('60 min gym pull secondary has a stabiliser', () => {
    expect(inBlock(build(60), 'secondary', 'stabiliser').length).toBeGreaterThanOrEqual(1)
  })

  it('30 min gym pull has at most one stabiliser with 1 set', () => {
    const stabs = inBlock(build(30), 'secondary', 'stabiliser')
    expect(stabs.length).toBeLessThanOrEqual(1)
    for (const pe of stabs) expect(pe.sets).toBe(1)
  })

  it('movement day secondary has 3 stabilisers', () => {
    const plan = build(60, { recent: movement })
    expect(plan.dayType).toBe('movement')
    expect(inBlock(plan, 'secondary', 'stabiliser')).toHaveLength(3)
  })

  it('caps contacts at 100 on 60 min pull and skill_core days', () => {
    const pull = build(60)
    expect(pull.dayType).toBe('pull')
    expect(total(pull)).toBeLessThanOrEqual(100)
    const core = build(60, { recent: skillCore })
    expect(core.dayType).toBe('skill_core')
    expect(total(core)).toBeLessThanOrEqual(100)
  })

  it('caps contacts at 200 on a movement day and has none on a legs day', () => {
    expect(total(build(60, { recent: movement }))).toBeLessThanOrEqual(200)
    const legs = build(60, { recent: legsHistory })
    expect(legs.dayType).toBe('legs')
    expect(total(legs)).toBe(0)
  })

  it('picks movement after 5 sessions in 7 days covering every pattern within 48 h, else light', () => {
    expect(pickDayType(movement, settings, now)).toBe('movement')
    expect(pickDayType(movement.slice(1), settings, now)).toBe('light')
  })

  it('plans a movement day with balance then spring before secondary, ending in cooldown, no strength', () => {
    const plan = build(60, { recent: movement })
    const kinds = plan.blocks.map((b) => b.kind)
    expect(kinds).not.toContain('strength')
    expect(kinds.indexOf('balance')).toBeGreaterThanOrEqual(0)
    expect(kinds.indexOf('spring')).toBeGreaterThan(kinds.indexOf('balance'))
    expect(kinds.indexOf('secondary')).toBeGreaterThan(kinds.indexOf('spring'))
    expect(kinds.at(-1)).toBe('cooldown')
    expect(plan.blocks.find((b) => b.kind === 'balance')!.exercises[0]).toMatchObject({ treeId: 'balance', sets: 3 })
  })
})

describe('focus toggles', () => {
  const flagOf = (id: string, f: string) => !!(exerciseById[id].flags as string[] | undefined)?.includes(f)
  const withFocus = (focus: Partial<NonNullable<Settings['focus']>>): Settings => ({ ...settings, focus: { strength: true, mobility: true, flexibility: true, ...focus } })
  const kinds = (plan: SessionPlan) => plan.blocks.map((b) => b.kind)
  const secsOf = (b: SessionPlan['blocks'][number]) => b.exercises.reduce((n, pe) => n + estimateSeconds(pe, exerciseById[pe.exerciseId]), 0)
  const movement = [done('pull', 46), done('pull', 40), done('push', 30), done('legs', 20), done('skill_core', 10)]

  it('all on has warmup, skill, strength and cooldown blocks', () => {
    const plan = build(30, { settings: withFocus({}) })
    expect(plan.dayType).toBe('pull')
    expect(kinds(plan)).toEqual(expect.arrayContaining(['warmup', 'skill', 'strength', 'cooldown']))
  })

  it('strength off plans no strength work, fits 30 min and has an active_flex drill', () => {
    const plan = build(30, { settings: withFocus({ strength: false }) })
    for (const k of ['skill', 'strength', 'secondary', 'core', 'conditioning']) expect(kinds(plan)).not.toContain(k)
    expect(Math.abs(plan.estSeconds - 30 * 60)).toBeLessThanOrEqual(150)
    expect(exercisesOf(plan, 'cooldown').some((pe) => flagOf(pe.exerciseId, 'active_flex'))).toBe(true)
  })

  it('mobility off keeps the warm-up minimal and drops niggle mobility', () => {
    const wrist = { ...withFocus({ mobility: false }), niggles: [{ area: 'wrist' as const, startedAt: hoursAgo(48) }] }
    const plan = build(30, { settings: wrist })
    const warm = exercisesOf(plan, 'warmup')
    expect(warm.length).toBeLessThanOrEqual(2)
    for (const pe of warm) {
      expect(flagOf(pe.exerciseId, 'balance')).toBe(false)
      expect(flagOf(pe.exerciseId, 'spring')).toBe(false)
    }
    expect(kinds(plan)).not.toContain('niggle_mobility')
  })

  it('mobility off turns a movement day into light', () => {
    expect(pickDayType(movement, settings, now)).toBe('movement')
    expect(pickDayType(movement, withFocus({ mobility: false }), now)).toBe('light')
  })

  it('flexibility off ends in a short general cool-down with no splits, bridge or active flex', () => {
    const plan = build(30, { settings: withFocus({ flexibility: false }) })
    const last = plan.blocks.at(-1)!
    expect(last.kind).toBe('cooldown')
    expect(last.exercises.length).toBeLessThanOrEqual(3)
    expect(secsOf(last)).toBeLessThanOrEqual(200)
    for (const pe of last.exercises) {
      expect(['front-split', 'middle-split', 'pike-pancake', 'bridge']).not.toContain(pe.treeId)
      expect(flagOf(pe.exerciseId, 'active_flex')).toBe(false)
    }
    expect(all(plan).some((pe) => pe.treeId === 'bridge')).toBe(false)
  })

  it('flexibility only plans a wrist-prep warm-up and a splits cool-down for 20+ min', () => {
    const plan = build(30, { settings: withFocus({ strength: false, mobility: false }) })
    for (const b of plan.blocks) expect(['warmup', 'cooldown']).toContain(b.kind)
    for (const pe of exercisesOf(plan, 'warmup')) expect(pe.exerciseId).toBe('wrist-prep')
    expect(plan.estSeconds).toBeGreaterThanOrEqual(20 * 60)
    expect(exercisesOf(plan, 'cooldown').some((pe) => ['front-split', 'middle-split', 'pike-pancake'].includes(pe.treeId ?? ''))).toBe(true)
  })

  it('settings without a focus field behave as all on', () => {
    expect(kinds(build(30))).toEqual(kinds(build(30, { settings: withFocus({}) })))
  })
})

describe('deload week', () => {
  // 2026-10-20 is week 12 from 2026-08-04 and week 5 from 2026-09-22
  const at = (startDate: string): Settings => ({ ...settings, program: { startDate, focus: [] } })
  const w5 = build(60, { settings: at('2026-09-22') })
  const w12 = build(60, { settings: at('2026-08-04') })

  it('plans 0.6x strength sets, at least 1', () => {
    const normal = exercisesOf(w5, 'strength')
    expect(normal.length).toBeGreaterThan(0)
    for (const pe of exercisesOf(w12, 'strength')) {
      const base = normal.find((n) => n.exerciseId === pe.exerciseId)!
      expect(pe.sets).toBe(Math.max(1, Math.round(0.6 * base.sets)))
    }
  })

  it('does not deload the skill block', () => {
    // the freed strength time grows skill sets back towards their cap, so they can only go up
    const skill = exercisesOf(w12, 'skill')
    expect(skill.map((pe) => pe.exerciseId)).toEqual(exercisesOf(w5, 'skill').map((pe) => pe.exerciseId))
    for (const [i, pe] of skill.entries()) expect(pe.sets).toBeGreaterThanOrEqual(exercisesOf(w5, 'skill')[i].sets)
  })
})

describe('check sets', () => {
  it('plans the next pull-up step once as a check set', () => {
    const progress: SkillProgress[] = [{ treeId: 'pull-up', stepIndex: 4, hits: 0, misses: 0, checkPending: true }]
    const checks = all(build(60, { progress })).filter((pe) => pe.checkSet)
    expect(checks).toHaveLength(1)
    expect(checks[0]).toMatchObject({ exerciseId: 'pull-up', treeId: 'pull-up', stepIndex: 5, checkSet: true, sets: 3, reps: [5, 5] })
  })
})

describe('buildTestSession', () => {
  const plan = buildTestSession({ settings: { ...settings, bests: { 'pull-up': 2 } }, progress: [{ treeId: 'pull-up', stepIndex: 4, hits: 0, misses: 0 }], location: 'gym', now })

  it('is a test day with one test block of 28 items', () => {
    expect(plan.dayType).toBe('test')
    const test = plan.blocks.filter((b) => b.kind === 'test')
    expect(test).toHaveLength(1)
    expect(test[0].exercises).toHaveLength(28)
    for (const pe of test[0].exercises) expect(pe.testId).toBeTruthy()
  })

  it('leaves out tests whose gate is not met', () => {
    const ids = exercisesOf(plan, 'test').map((pe) => pe.testId)
    for (const id of ['tuck-front-lever-hold', 'skin-the-cat', 'german-hang-hold', 'dragon-flag-negative', 'archer-pull-up-max']) expect(ids).not.toContain(id)
  })
})

describe('equipment availability', () => {
  const gymList: Equipment[] = ['pull_up_bar', 'dip_station', 'trx', 'band', 'dumbbell', 'kettlebell', 'box', 'bench', 'jump_rope', 'slam_ball', 'wall', 'floor', 'door_anchor']
  const homeList: Equipment[] = ['band', 'door_anchor', 'box', 'wall', 'floor']
  const withEquip = (gym: Equipment[], home: Equipment[]): Settings => ({ ...settings, equipment: { gym, home } })
  const step4: SkillProgress[] = [{ treeId: 'pull-up', stepIndex: 4, hits: 0, misses: 0 }]
  const allAvailable = (plan: SessionPlan, s: Settings, location: Location) => {
    for (const pe of all(plan)) expect(available(exerciseById[pe.exerciseId], s, location), pe.exerciseId).toBe(true)
  }

  it('plans band-assisted-pull-up on a home pull day with a pull-up bar ticked', () => {
    const s = { ...withEquip(gymList, [...homeList, 'pull_up_bar']), bests: { 'pull-up': 2 } }
    const plan = build(60, { location: 'home', settings: s, progress: step4 })
    expect(plan.dayType).toBe('pull')
    expect(all(plan).map((pe) => pe.exerciseId)).toContain('band-assisted-pull-up')
    allAvailable(plan, s, 'home')
  })

  it('plans nothing that needs a pull-up bar at default home', () => {
    const s = withEquip(gymList, homeList)
    const plan = build(60, { location: 'home', settings: s })
    for (const pe of all(plan)) expect(exerciseById[pe.exerciseId].equipment, pe.exerciseId).not.toContain('pull_up_bar')
    allAvailable(plan, s, 'home')
  })

  it('swaps trx-row for an available alternate when the gym has no trx', () => {
    const s = withEquip(gymList.filter((e) => e !== 'trx'), homeList)
    const plan = build(60, { settings: s })
    const ids = all(plan).map((pe) => pe.exerciseId)
    expect(ids).not.toContain('trx-row')
    expect(ids.some((id) => ['band-row', 'inverted-row', 'dumbbell-row'].includes(id))).toBe(true)
    allAvailable(plan, s, 'gym')
  })

  it('needs jump_rope ticked at home for jump-rope', () => {
    const rope = exerciseById['jump-rope']
    expect(available(rope, withEquip(gymList, homeList), 'home')).toBe(false)
    expect(available(rope, withEquip(gymList, [...homeList, 'jump_rope']), 'home')).toBe(true)
  })
})

describe('test week layout', () => {
  // 2026-10-20 is week 4 from 2026-09-29
  const wk4 = (testMode: Settings['testMode'] = { mode: 'spread', weekday: 6 }): Settings => ({ ...settings, bests: { 'pull-up': 2 }, program: { startDate: '2026-09-29', focus: [] }, testMode })
  const progress: SkillProgress[] = [{ treeId: 'pull-up', stepIndex: 4, hits: 0, misses: 0 }]
  const histories: Record<string, SessionRecord[]> = {
    pull: [],
    push: [done('pull', 72)],
    legs: [done('pull', 96), done('push', 72)],
    skill_core: [done('pull', 96), done('push', 72), done('legs', 36)],
  }
  const planFor = (dayType: string, over: { mode?: DayMode; settings?: Settings; results?: MilestoneResult[] } = {}, minutes = 60) => {
    const plan = buildSession({ minutes, location: 'gym', mode: 'normal', now, recent: histories[dayType], recentLogs: [], progress, ...over, settings: over.settings ?? wk4() })
    expect(plan.dayType).toBe(dayType)
    return plan
  }
  const testIds = (plan: SessionPlan) => exercisesOf(plan, 'test').map((pe) => pe.testId!)
  const typeOf = (id: string) => testDayType(tests.find((t) => t.id === id)!)

  it('puts the 3 pull tests in a test block right after the warm-up on a pull day', () => {
    const plan = planFor('pull')
    expect(plan.blocks.map((b) => b.kind).slice(0, 2)).toEqual(['warmup', 'test'])
    expect(testIds(plan)).toEqual(['pull-up-max', 'band-assisted-pull-up-max', 'chest-to-bar-pull-up-max'])
  })

  it('plans 6 push or handstand tests on a push day', () => {
    const ids = testIds(planFor('push'))
    expect(ids).toHaveLength(6)
    for (const id of ids) expect(typeOf(id)).toBe('push')
  })

  it('plans splits, pistol and pancake tests on a legs day', () => {
    const ids = testIds(planFor('legs'))
    expect(ids.length).toBeGreaterThanOrEqual(3)
    for (const id of ids) expect(typeOf(id)).toBe('legs')
    expect(ids).toEqual(expect.arrayContaining(['front-split-left', 'pistol-left', 'pancake-chest-to-floor']))
  })

  it('plans core and balance tests on a skill_core day', () => {
    const ids = testIds(planFor('skill_core'))
    expect(ids.length).toBeGreaterThanOrEqual(3)
    for (const id of ids) expect(typeOf(id)).toBe('skill_core')
  })

  it('has no test block on a tired day or a 20 min day', () => {
    expect(planFor('pull', { mode: 'tired' }).blocks.map((b) => b.kind)).not.toContain('test')
    expect(planFor('pull', {}, 20).blocks.map((b) => b.kind)).not.toContain('test')
  })

  describe('past week 12 and without a program', () => {
    const withStart = (startDate?: string): Settings => ({ ...wk4(), program: startDate ? { startDate, focus: [] } : undefined })
    const strengthSets = (plan: SessionPlan) => exercisesOf(plan, 'strength').map((pe) => pe.sets)
    const none = planFor('pull', { settings: withStart() })
    // 2026-10-20 is week 13 from 2026-07-28 and week 20 from 2026-06-09
    const past = [['week 13', '2026-07-28'], ['week 20', '2026-06-09']]

    it.each(past)('%s plans the no-program strength sets and no test block', (_, startDate) => {
      const plan = planFor('pull', { settings: withStart(startDate) })
      expect(strengthSets(plan).length).toBeGreaterThan(0)
      expect(strengthSets(plan)).toEqual(strengthSets(none))
      expect(plan.blocks.map((b) => b.kind)).not.toContain('test')
    })

    it('week 12 is deloaded and has a test block', () => {
      const plan = planFor('pull', { settings: withStart('2026-08-04') })
      expect(plan.blocks.map((b) => b.kind)).toContain('test')
      expect(strengthSets(plan).reduce((a, b) => a + b, 0)).toBeLessThan(strengthSets(none).reduce((a, b) => a + b, 0))
      for (const [i, n] of strengthSets(plan).entries()) expect(n).toBeLessThan(strengthSets(none)[i])
    })

    it('no program has no deload and no test block', () => {
      expect(none.blocks.map((b) => b.kind)).not.toContain('test')
      expect(strengthSets(none)).toEqual(strengthSets(planFor('pull', { settings: withStart('2026-09-22') })))
    })
  })

  it('rolls over: done pull tests give way to 3 other untested tests', () => {
    const doneIds = ['pull-up-max', 'band-assisted-pull-up-max', 'chest-to-bar-pull-up-max']
    const results: MilestoneResult[] = doneIds.map((testId) => ({ id: testId, testId, value: 1, week: 4, date: '2026-10-20' }))
    const before = untestedThisWeek(wk4(), progress, [], 4, 'gym').map((t) => t.id)
    const after = untestedThisWeek(wk4(), progress, results, 4, 'gym').map((t) => t.id)
    expect(after).toHaveLength(before.length - 3)
    for (const id of doneIds) expect(after).not.toContain(id)
    const ids = testIds(planFor('pull', { results }))
    expect(ids).toHaveLength(3)
    for (const id of ids) expect(doneIds).not.toContain(id)
  })

  describe('day mode', () => {
    const dayMode = wk4({ mode: 'day', weekday: 6 })
    const core = coreTestsOrdered(dayMode, progress, 'gym')

    it('orders the 12 core tests skills, alternating strength, core, flexibility', () => {
      expect(core).toHaveLength(12)
      expect(['chest-to-wall-handstand-hold', 'tuck-l-sit-hold']).toContain(core[0].id)
      const strength = core.filter((t) => ['main_strength', 'accessory'].includes(exerciseById[t.exerciseId!].type))
      strength.forEach((t, i) => expect(exerciseById[t.exerciseId!].pattern).toBe(i % 2 === 0 ? 'pull' : 'push'))
      expect(core.slice(-3).map((t) => t.id)).toEqual(['front-split-left', 'front-split-right', 'middle-split'])
    })

    it('buildTestSession has 12 test items', () => {
      expect(exercisesOf(buildTestSession({ settings: dayMode, progress, location: 'gym', now }), 'test')).toHaveLength(12)
    })

    it('buildSession inserts at most 3 non-core tests', () => {
      const ids = testIds(planFor('pull', { settings: dayMode }))
      expect(ids.length).toBeGreaterThan(0)
      expect(ids.length).toBeLessThanOrEqual(3)
      for (const id of ids) expect(core.map((t) => t.id)).not.toContain(id)
    })

    it('isTestDay is true on the Saturday in day mode and false in spread mode', () => {
      const sat = new Date(2026, 9, 24)
      expect(isTestDay(dayMode, sat)).toBe(true)
      expect(isTestDay(dayMode, new Date(2026, 9, 23))).toBe(false)
      expect(isTestDay(wk4(), sat)).toBe(false)
    })
  })
})

describe('bestsFromLogs', () => {
  const log = (over: Partial<SetLog>): SetLog => ({ id: 'l', sessionId: 's', exerciseId: 'pull-up', setIndex: 0, reps: 9, repsLeft: 1, mode: 'normal', at: hoursAgo(1), ...over })
  const muscleUp = skillTrees.find((t) => t.id === 'muscle-up')!

  it('raises the best from a normal 9-rep log and unlocks the muscle-up tree', () => {
    expect(currentStep([], muscleUp, now, {}).locked).toBe(true)
    const bests = bestsFromLogs({}, [log({})])
    expect(bests['pull-up']).toBe(9)
    expect(currentStep([], muscleUp, now, bests).locked).toBe(false)
  })

  it('ignores tired, banded and cm logs', () => {
    expect(bestsFromLogs({}, [log({ mode: 'tired' })])).toEqual({})
    expect(bestsFromLogs({}, [log({ bandIds: ['b1'] })])).toEqual({})
    expect(bestsFromLogs({}, [log({ exerciseId: 'front-split-passive', reps: undefined, cmFromFloor: 10 })])).toEqual({})
  })
})
