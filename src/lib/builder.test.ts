import { describe, expect, it } from 'vitest'
import { exerciseById, niggleMobility, skillTrees } from '../content'
import { dayTemplates } from './dayTemplates'
import { buildSession, pickDayType, REST } from './builder'
import type { DayMode, DayType, Location, SessionPlan, SessionRecord, Settings, SkillProgress } from './types'

const now = new Date('2026-10-20T08:00:00Z')
const settings: Settings = { weeklyTarget: 4, countdownSeconds: 10, voice: true, beeps: true, voiceRate: 1, sidePause: true, bands: [], neverShow: [], favourites: [], niggles: [], bests: {}, headphoneControls: false, lastDraft: { minutes: 30, location: 'gym', mode: 'normal' }, placed: true }
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600 * 1000).toISOString()

const build = (minutes: number, over: { mode?: DayMode; location?: Location; settings?: Settings; recent?: SessionRecord[]; progress?: SkillProgress[] } = {}) =>
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

  it('bare mode is 10 min with one strength pair', () => {
    const plan = build(60, { mode: 'bare' })
    expect(plan.minutesTarget).toBe(10)
    expect(exercisesOf(plan, 'strength')).toHaveLength(2)
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
